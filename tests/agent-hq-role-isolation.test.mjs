import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const adminUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const roleUrls = {
  seo: process.env.AGENT_HQ_ROLE_TEST_URL_SEO,
  qa: process.env.AGENT_HQ_ROLE_TEST_URL_QA,
  coordinator: process.env.AGENT_HQ_ROLE_TEST_URL_COORDINATOR,
  supervisor: process.env.AGENT_HQ_ROLE_TEST_URL_SUPERVISOR
};

test("Agent HQ database roles are isolated by authenticated PostgreSQL identity", {
  skip: !adminUrl || Object.values(roleUrls).some(value => !value)
}, async () => {
  const admin = postgres(adminUrl, { max: 2 });
  const seo = postgres(roleUrls.seo, { max: 1 });
  const qa = postgres(roleUrls.qa, { max: 1 });
  const coordinator = postgres(roleUrls.coordinator, { max: 1 });
  const supervisor = postgres(roleUrls.supervisor, { max: 1 });
  const marker = randomUUID();
  let seoTask, qaTask, parentTask, seoArtifact;
  try {
    [seoTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo',${"SEO " + marker},'SEO test','Evidence','integration-test') RETURNING id`;
    [qaTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES ('qa_security',${"QA " + marker},'QA test','Verdict','integration-test') RETURNING id`;
    [parentTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Parent " + marker},'Parent test','Summary','integration-test','review') RETURNING id`;
    [seoArtifact] = await admin`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${seoTask.id},'seo','result','SEO artifact',${marker}) RETURNING id`;

    const ownTasks = await seo`SELECT id FROM agent_tasks WHERE id=${seoTask.id}`;
    const foreignTasks = await seo`SELECT id FROM agent_tasks WHERE id IN (${qaTask.id},${parentTask.id})`;
    assert.equal(ownTasks.length, 1, "SEO can read its own task");
    assert.equal(foreignTasks.length, 0, "SEO cannot read QA or coordinator tasks");

    const foreignUpdate = await seo`UPDATE agent_tasks SET title='forged' WHERE id=${qaTask.id} RETURNING id`;
    assert.equal(foreignUpdate.length, 0, "SEO cannot update another role's task");
    await assert.rejects(
      seo`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${qaTask.id},'seo','result','forged','forged')`,
      error => ["42501","23514"].includes(error.code),
      "SEO cannot write an artifact against QA task"
    );

    const ownArtifacts = await seo`SELECT id FROM agent_artifacts WHERE id=${seoArtifact.id}`;
    const qaArtifacts = await qa`SELECT id FROM agent_artifacts WHERE id=${seoArtifact.id}`;
    assert.equal(ownArtifacts.length, 1);
    assert.equal(qaArtifacts.length, 0, "QA cannot read unrelated specialist artifacts");

    const [seoMessage] = await admin`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${seoTask.id},${randomUUID()},'seo','qa_security','request','SEO to QA',${"m-" + marker + "-seo"}) RETURNING id`;
    const [qaMessage] = await admin`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${qaTask.id},${randomUUID()},'qa_security','seo','question','QA to SEO',${"m-" + marker + "-qa"}) RETURNING id`;
    const seoInbox = await seo`SELECT id FROM agent_messages WHERE id IN (${seoMessage.id},${qaMessage.id})`;
    const qaInbox = await qa`SELECT id FROM agent_messages WHERE id IN (${seoMessage.id},${qaMessage.id})`;
    assert.deepEqual(seoInbox.map(row => String(row.id)), [String(qaMessage.id)]);
    assert.deepEqual(qaInbox.map(row => String(row.id)), [String(seoMessage.id)]);
    await assert.rejects(
      seo`INSERT INTO agent_messages (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${seoTask.id},${randomUUID()},'qa_security','seo','status','forged',${"m-" + marker + "-forged"})`,
      error => ["42501","23514"].includes(error.code)
    );

    const [seoRun] = await admin`INSERT INTO agent_runs (task_id,role,worker_id,provider,model,status)
      VALUES (${seoTask.id},'seo','seo-ci','test','test','succeeded') RETURNING id`;
    const [qaRun] = await admin`INSERT INTO agent_runs (task_id,role,worker_id,provider,model,status)
      VALUES (${qaTask.id},'qa_security','qa-ci','test','test','succeeded') RETURNING id`;
    const seoRuns = await seo`SELECT id FROM agent_runs WHERE id IN (${seoRun.id},${qaRun.id})`;
    const qaRuns = await qa`SELECT id FROM agent_runs WHERE id IN (${seoRun.id},${qaRun.id})`;
    assert.deepEqual(seoRuns.map(row => String(row.id)), [String(seoRun.id)]);
    assert.deepEqual(qaRuns.map(row => String(row.id)), [String(qaRun.id)]);
    const foreignRunUpdate = await seo`UPDATE agent_runs SET status='failed' WHERE id=${qaRun.id} RETURNING id`;
    assert.equal(foreignRunUpdate.length, 0);

    const [seoApproval] = await admin`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
      VALUES (${seoTask.id},'other','seo','{"reason":"test"}'::jsonb,'pending') RETURNING id`;
    const [qaApproval] = await admin`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
      VALUES (${qaTask.id},'other','qa_security','{"reason":"test"}'::jsonb,'pending') RETURNING id`;
    const seoApprovals = await seo`SELECT id FROM agent_approvals WHERE id IN (${seoApproval.id},${qaApproval.id})`;
    assert.deepEqual(seoApprovals.map(row => String(row.id)), [String(seoApproval.id)]);
    await assert.rejects(
      seo`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
        VALUES (${seoTask.id},'other','qa_security','{}'::jsonb,'pending')`,
      error => ["42501","23514"].includes(error.code)
    );

    await seo`SELECT set_config('agent.role','qa_security',false)`;
    const afterSpoof = await seo`SELECT id FROM agent_tasks WHERE id=${qaTask.id}`;
    assert.equal(afterSpoof.length, 0, "Changing a custom GUC cannot impersonate QA");

    await assert.rejects(seo`SET ROLE agent_qa_security`, error => error.code === "42501");
    await assert.rejects(
      seo`UPDATE agent_budget_config SET daily_cap_microusd=999999 WHERE id=1`,
      error => error.code === "42501"
    );
    await assert.rejects(
      seo`UPDATE agent_approvals SET status='approved' WHERE status='pending'`,
      error => error.code === "42501"
    );

    const coordinatorOwn = await coordinator`SELECT id FROM agent_tasks WHERE id=${parentTask.id}`;
    assert.equal(coordinatorOwn.length, 1);
    const allTasks = await supervisor`SELECT id FROM agent_tasks WHERE id IN (${seoTask.id},${qaTask.id},${parentTask.id})`;
    assert.equal(allTasks.length, 3, "Supervisor has its narrowly designated lifecycle visibility");
  } finally {
    if (parentTask) await admin`DELETE FROM agent_tasks WHERE id=${parentTask.id}`;
    if (seoTask) await admin`DELETE FROM agent_tasks WHERE id=${seoTask.id}`;
    if (qaTask) await admin`DELETE FROM agent_tasks WHERE id=${qaTask.id}`;
    await Promise.all([admin.end(),seo.end(),qa.end(),coordinator.end(),supervisor.end()]);
  }
});
