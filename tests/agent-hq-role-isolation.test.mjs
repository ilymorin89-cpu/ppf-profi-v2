import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const adminUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const roleUrls = {
  seo: process.env.AGENT_HQ_ROLE_TEST_URL_SEO,
  qa: process.env.AGENT_HQ_ROLE_TEST_URL_QA,
  coordinator: process.env.AGENT_HQ_ROLE_TEST_URL_COORDINATOR,
  supervisor: process.env.AGENT_HQ_ROLE_TEST_URL_SUPERVISOR,
  operator: process.env.AGENT_HQ_ROLE_TEST_URL_OPERATOR
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
  let seoTask, qaTask, parentTask, unrelatedParent, unrelatedTask, delegatedTaskId, seoArtifact, unrelatedArtifact;
  try {
    const [principal] = await seo`SELECT session_user AS login,
      public.agent_role_for_session() AS role,
      public.agent_worker_id_for_session() AS worker_id`;
    assert.equal(principal.login, "agent_seo");
    assert.equal(principal.role, "seo");
    assert.equal(principal.worker_id, "test-seo");
    await assert.rejects(
      seo`SELECT * FROM public.agent_worker_principals`,
      error => error.code === "42501",
      "Worker cannot read or enumerate the principal registry"
    );
    await assert.rejects(
      seo`SELECT * FROM public.agent_task_claim('forged-worker-id')`,
      error => error.code === "42501",
      "Worker cannot claim tasks under an environment-supplied or forged worker ID"
    );
    await assert.rejects(
      seo`SELECT * FROM public.agent_task_claim('test-coordinator')`,
      error => error.code === "42501",
      "Worker cannot impersonate another valid registered worker principal"
    );
    await assert.rejects(
      seo`INSERT INTO public.agent_worker_principals(login_role,role,worker_id)
        VALUES ('agent_fake','seo','fake-worker')`,
      error => error.code === "42501",
      "Worker cannot self-register a database identity"
    );
    await assert.rejects(
      seo`UPDATE public.agent_worker_principals SET worker_id='spoofed' WHERE login_role='agent_seo'`,
      error => error.code === "42501",
      "Worker cannot rewrite its authenticated identity"
    );

    [seoTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo',${"SEO " + marker},'SEO test','Evidence','integration-test') RETURNING id`;
    [qaTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES ('qa_security',${"QA " + marker},'QA test','Verdict','integration-test') RETURNING id`;
    [parentTask] = await admin`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Parent " + marker},'Parent test','Summary','integration-test','review') RETURNING id`;
    await admin`UPDATE agent_tasks SET parent_task_id=${parentTask.id} WHERE id IN (${seoTask.id},${qaTask.id})`;
    await supervisor`INSERT INTO agent_task_access (task_id,principal,access_reason)
      VALUES (${seoTask.id},'qa_security','qa_review'),
             (${qaTask.id},'qa_security','qa_review'),
             (${seoTask.id},'coordinator','coordinator_oversight'),
             (${qaTask.id},'coordinator','coordinator_oversight')`;
    [seoArtifact] = await admin`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${seoTask.id},'seo','result','SEO artifact',${marker}) RETURNING id`;
    [unrelatedParent] = await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Unrelated parent " + marker},'Other project','Other result','integration-test','review') RETURNING id`;
    [unrelatedTask] = await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,parent_task_id)
      VALUES ('seo',${"Unrelated SEO " + marker},'Other task','Other evidence','integration-test',${unrelatedParent.id}) RETURNING id`;
    [unrelatedArtifact] = await admin`INSERT INTO agent_artifacts
      (task_id,created_by,artifact_type,title,content)
      VALUES (${unrelatedTask.id},'seo','result','Unrelated artifact',${"private-" + marker}) RETURNING id`;

    const ownTasks = await seo`SELECT id FROM agent_tasks WHERE id=${seoTask.id}`;
    const foreignTasks = await seo`SELECT id FROM agent_tasks WHERE id IN (${qaTask.id},${parentTask.id})`;
    assert.equal(ownTasks.length, 1, "SEO can read its own task");
    assert.equal(foreignTasks.length, 0, "SEO cannot read QA or coordinator tasks");

    await assert.rejects(
      seo`UPDATE agent_tasks SET title='forged' WHERE id=${qaTask.id} RETURNING id`,
      error => error.code === "42501",
      "SEO cannot update another role's task"
    );
    await assert.rejects(
      seo`UPDATE agent_tasks SET assigned_role='qa_security' WHERE id=${seoTask.id}`,
      error => error.code === "42501",
      "SEO cannot change task routing/identity columns"
    );
    await assert.rejects(
      seo`UPDATE agent_tasks SET parent_task_id=${parentTask.id} WHERE id=${seoTask.id}`,
      error => error.code === "42501",
      "SEO cannot re-parent its task"
    );
    await assert.rejects(
      seo`DELETE FROM agent_tasks WHERE id=${seoTask.id}`,
      error => error.code === "42501",
      "SEO cannot delete tasks"
    );
    await assert.rejects(
      seo`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${qaTask.id},'seo','result','forged','forged')`,
      error => ["42501","23514"].includes(error.code),
      "SEO cannot write an artifact against QA task"
    );

    const ownArtifacts = await seo`SELECT id FROM agent_artifacts WHERE id=${seoArtifact.id}`;
    const qaArtifacts = await qa`SELECT id FROM agent_artifacts WHERE id=${seoArtifact.id}`;
    assert.equal(ownArtifacts.length, 1);
    assert.equal(qaArtifacts.length, 1, "QA can read sibling specialist artifacts explicitly granted for this parent review");
    const unrelatedQaArtifacts = await qa`SELECT id FROM agent_artifacts WHERE id=${unrelatedArtifact.id}`;
    assert.equal(unrelatedQaArtifacts.length, 0, "QA cannot read artifacts from an unrelated parent");
    const unrelatedCoordinatorTasks = await coordinator`SELECT id FROM agent_tasks WHERE id=${unrelatedTask.id}`;
    assert.equal(unrelatedCoordinatorTasks.length, 0, "Coordinator cannot read child tasks without a scoped grant");
    const coordinatorChildTasks = await coordinator`SELECT id FROM agent_tasks WHERE id IN (${seoTask.id},${qaTask.id}) ORDER BY id`;
    assert.equal(coordinatorChildTasks.length, 2, "Coordinator can inspect explicitly granted child tasks");
    const coordinatorArtifacts = await coordinator`SELECT id FROM agent_artifacts WHERE id=${seoArtifact.id}`;
    assert.equal(coordinatorArtifacts.length, 1, "Coordinator can read explicitly granted child artifacts");
    const qaSiblingTasks = await qa`SELECT id FROM agent_tasks WHERE id=${seoTask.id}`;
    assert.equal(qaSiblingTasks.length, 1, "QA can inspect sibling task metadata for its parent review");
    await assert.rejects(
      coordinator`INSERT INTO agent_task_access (task_id,principal,access_reason)
        VALUES (${qaTask.id},'seo','coordinator_oversight')`,
      error => ["42501","23514"].includes(error.code),
      "Coordinator cannot grant access or impersonate another principal"
    );
    await assert.rejects(
      seo`INSERT INTO agent_task_access (task_id,principal,access_reason)
        VALUES (${qaTask.id},'qa_security','qa_review')`,
      error => ["42501","23514"].includes(error.code),
      "Specialists cannot create cross-role access grants"
    );
    const seoAccess = await seo`SELECT task_id FROM agent_task_access WHERE task_id=${seoTask.id}`;
    assert.equal(seoAccess.length, 0, "Specialist cannot read another role's access grants");

    const [seoMessage] = await admin`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${seoTask.id},${randomUUID()},'seo','qa_security','request','SEO to QA',${"m-" + marker + "-seo"}) RETURNING id`;
    const [qaMessage] = await admin`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${qaTask.id},${randomUUID()},'qa_security','seo','question','QA to SEO',${"m-" + marker + "-qa"}) RETURNING id`;
    const seoInbox = await seo`SELECT id FROM agent_messages WHERE id IN (${seoMessage.id},${qaMessage.id})`;
    const qaInbox = await qa`SELECT id FROM agent_messages WHERE id IN (${seoMessage.id},${qaMessage.id})`;
    assert.equal(seoInbox.length, 1);
    assert.equal(String(seoInbox[0].id), String(qaMessage.id));
    assert.equal(qaInbox.length, 1);
    assert.equal(String(qaInbox[0].id), String(seoMessage.id));
    await assert.rejects(
      seo`INSERT INTO agent_messages (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${seoTask.id},${randomUUID()},'qa_security','seo','status','forged',${"m-" + marker + "-forged"})`,
      error => ["42501","23514"].includes(error.code)
    );
    await assert.rejects(
      seo`INSERT INTO agent_messages (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${qaTask.id},${randomUUID()},'seo','qa_security','status','cross-task',${"m-" + marker + "-cross"})`,
      error => ["42501","23514"].includes(error.code),
      "SEO cannot attach a message to another role's task"
    );

    const [seoRun] = await admin`INSERT INTO agent_runs (task_id,role,worker_id,provider,model,status)
      VALUES (${seoTask.id},'seo','seo-ci','test','test','succeeded') RETURNING id`;
    const [qaRun] = await admin`INSERT INTO agent_runs (task_id,role,worker_id,provider,model,status)
      VALUES (${qaTask.id},'qa_security','qa-ci','test','test','succeeded') RETURNING id`;
    const seoRuns = await seo`SELECT id FROM agent_runs WHERE id IN (${seoRun.id},${qaRun.id})`;
    const qaRuns = await qa`SELECT id FROM agent_runs WHERE id IN (${seoRun.id},${qaRun.id})`;
    assert.equal(seoRuns.length, 1);
    assert.equal(String(seoRuns[0].id), String(seoRun.id));
    assert.equal(qaRuns.length, 1);
    assert.equal(String(qaRuns[0].id), String(qaRun.id));
    await assert.rejects(
      seo`UPDATE agent_runs SET status='failed' WHERE id=${qaRun.id}`,
      error => error.code === "42501",
      "Runtime worker has no direct run accounting or lifecycle UPDATE privilege"
    );
    await assert.rejects(
      seo`UPDATE agent_runs SET role='qa_security' WHERE id=${seoRun.id}`,
      error => error.code === "42501",
      "SEO cannot reassign run identity"
    );

    const [seoApproval] = await admin`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
      VALUES (${seoTask.id},'other','seo','{"reason":"test"}'::jsonb,'pending') RETURNING id`;
    const [qaApproval] = await admin`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
      VALUES (${qaTask.id},'other','qa_security','{"reason":"test"}'::jsonb,'pending') RETURNING id`;
    const seoApprovals = await seo`SELECT id FROM agent_approvals WHERE id IN (${seoApproval.id},${qaApproval.id})`;
    assert.equal(seoApprovals.length, 1);
    assert.equal(String(seoApprovals[0].id), String(seoApproval.id));
    await assert.rejects(
      seo`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
        VALUES (${seoTask.id},'other','qa_security','{}'::jsonb,'pending')`,
      error => ["42501","23514"].includes(error.code)
    );
    await assert.rejects(
      seo`INSERT INTO agent_approvals (task_id,action,requested_by,payload,status)
        VALUES (${seoTask.id},'other','seo','{}'::jsonb,'approved')`,
      error => ["42501","23514"].includes(error.code),
      "Worker may request approval only in pending state"
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
    await assert.rejects(
      seo`DELETE FROM agent_approvals WHERE id=${seoApproval.id}`,
      error => error.code === "42501",
      "Worker cannot delete approval audit records"
    );

    const coordinatorOwn = await coordinator`SELECT id FROM agent_tasks WHERE id=${parentTask.id}`;
    assert.equal(coordinatorOwn.length, 1);
    await coordinator`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by)
      VALUES (${parentTask.id},'seo','Delegated child','Do bounded work','Evidence','coordinator')`;
    const [delegated] = await coordinator`SELECT currval('agent_tasks_id_seq') AS id`;
    delegatedTaskId = delegated.id;
    assert.ok(delegated.id, "Coordinator can create a child under its own parent without SELECT-before-grant");
    const beforeGrant = await coordinator`SELECT id FROM agent_tasks WHERE id=${delegated.id}`;
    assert.equal(beforeGrant.length, 0, "Coordinator cannot read child before supervisor grant");
    await supervisor`INSERT INTO agent_task_access (task_id,principal,access_reason)
      VALUES (${delegated.id},'coordinator','coordinator_oversight')`;
    const afterGrant = await coordinator`SELECT id FROM agent_tasks WHERE id=${delegated.id}`;
    assert.equal(afterGrant.length, 1, "Coordinator can read child after supervisor grants scoped access");
    await assert.rejects(
      coordinator`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by)
        VALUES ('seo','Orphan child','No parent','Evidence','coordinator')`,
      error => ["42501","23514"].includes(error.code),
      "Coordinator cannot create an unparented task"
    );
    await assert.rejects(
      coordinator`INSERT INTO agent_tasks
        (parent_task_id,assigned_role,title,objective,expected_output,created_by)
        VALUES (${parentTask.id},'seo','Forged child','No','Evidence','seo')`,
      error => ["42501","23514"].includes(error.code),
      "Coordinator cannot forge task creator"
    );
    const allTasks = await supervisor`SELECT id FROM agent_tasks WHERE id IN (${seoTask.id},${qaTask.id},${parentTask.id})`;
    assert.equal(allTasks.length, 3, "Supervisor has its narrowly designated lifecycle visibility");
  } finally {
    if (parentTask) await admin`DELETE FROM agent_tasks WHERE id=${parentTask.id}`;
    if (unrelatedParent) await admin`DELETE FROM agent_tasks WHERE id=${unrelatedParent.id}`;
    if (seoTask) await admin`DELETE FROM agent_tasks WHERE id=${seoTask.id}`;
    if (qaTask) await admin`DELETE FROM agent_tasks WHERE id=${qaTask.id}`;
    if (unrelatedTask) await admin`DELETE FROM agent_tasks WHERE id=${unrelatedTask.id}`;
    if (delegatedTaskId) await admin`DELETE FROM agent_tasks WHERE id=${delegatedTaskId}`;
    await Promise.all([admin.end(),seo.end(),qa.end(),coordinator.end(),supervisor.end()]);
  }
});


test("real SEO worker completes a task using its restricted PostgreSQL login and mocked model", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin = postgres(adminUrl, { max: 2 });
  const marker = randomUUID();
  let taskId;
  let previousBudget;
  try {
    [previousBudget] = await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,
      daily_cap_microusd=100000000,monthly_cap_microusd=100000000,
      per_run_cap_microusd=10000000,
      input_price_per_million_microusd=1000,
      output_price_per_million_microusd=1000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const [task] = await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo',${"RLS worker E2E " + marker},'Run real worker under SEO login',
        'Evidence-backed result','integration-test') RETURNING id`;
    taskId = task.id;
    const child = spawnSync(process.execPath, [
      "scripts/agent-hq-worker.mjs", "--once"
    ], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: roleUrls.seo,
        AGENT_ROLE: "seo",
        AGENT_WORKER_ID: "test-seo",
        OPENAI_API_KEY: "test-key-never-used",
        AGENT_MODEL: "gpt-4.1-mini",
        AGENT_WEB_SEARCH_ENABLED: "false",
        AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({
          output: [{
            type: "message",
            content: [{ type: "output_text", text: "CI mocked evidence: worker completed under RLS." }]
          }],
          usage: { input_tokens: 0, output_tokens: 0 }
        })
      }
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    const [completed] = await admin`SELECT status,attempts FROM agent_tasks WHERE id=${taskId}`;
    assert.equal(completed.status, "done", child.stderr || child.stdout);
    assert.equal(completed.attempts, 1);
    const artifacts = await admin`SELECT content FROM agent_artifacts
      WHERE task_id=${taskId} AND created_by='seo'`;
    assert.equal(artifacts.length, 1);
    assert.match(artifacts[0].content, /CI mocked evidence/);
    const runs = await admin`SELECT status,input_tokens,output_tokens,cost_microusd FROM agent_runs WHERE task_id=${taskId}`;
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "succeeded");
    assert.equal(Number(runs[0].input_tokens),0);
    assert.equal(Number(runs[0].output_tokens),0);
    assert.equal(Number(runs[0].cost_microusd),0);
    const [reservation]=await admin`SELECT state,reserved_microusd FROM agent_budget_reservations WHERE task_id=${taskId}`;
    assert.equal(reservation.state,"settled");
    assert.ok(Number(reservation.reserved_microusd)>0);
    const [settlementCount]=await admin`SELECT count(*)::int AS n FROM agent_budget_settlements s
      JOIN agent_budget_reservations r ON r.id=s.reservation_id WHERE r.task_id=${taskId}`;
    assert.equal(settlementCount.n,1);
    const [ledgerCount]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger l
      JOIN agent_budget_reservations r ON r.id=l.reservation_id WHERE r.task_id=${taskId}`;
    assert.equal(ledgerCount.n,2);
  } finally {
    if (taskId) {
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if (previousBudget) await admin`UPDATE agent_budget_config SET
      enabled=${previousBudget.enabled},
      daily_cap_microusd=${previousBudget.daily_cap_microusd},
      monthly_cap_microusd=${previousBudget.monthly_cap_microusd},
      per_run_cap_microusd=${previousBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${previousBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${previousBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${previousBudget.web_search_price_microusd_per_call}
      WHERE id=1`;
    await admin.end();
  }
});


test("Agent HQ blocks retry and retains reservation after ambiguous provider outcome", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const marker=randomUUID();
  let taskId;
  let oldBudget;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,
      daily_cap_microusd=100000,monthly_cap_microusd=500000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const [task]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by)
      VALUES('seo',${"ambiguous provider outcome "+marker},'Test ambiguous billing outcome',
        'A non-empty result','integration-test') RETURNING id`;
    taskId=task.id;
    const child=spawnSync(process.execPath,["scripts/agent-hq-worker.mjs","--once"],{
      cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),
      encoding:"utf8",
      env:{
        ...process.env,NODE_ENV:"test",DATABASE_URL:roleUrls.seo,AGENT_ROLE:"seo",
        AGENT_WORKER_ID:"test-seo",OPENAI_API_KEY:"test-key-never-used",
        AGENT_MODEL:"gpt-4.1-mini",AGENT_WEB_SEARCH_ENABLED:"false",
        AGENT_HQ_TEST_RESPONSES_JSON:JSON.stringify({
          __test_provider_outcome:"ambiguous",
          output:[],usage:{input_tokens:0,output_tokens:0}
        })
      }
    });
    assert.equal(child.status,0,child.stderr||child.stdout);
    const [blocked]=await admin`SELECT status FROM agent_tasks WHERE id=${taskId}`;
    assert.equal(blocked.status,"blocked",child.stderr||child.stdout);
    const [reservation]=await admin`SELECT state FROM agent_budget_reservations WHERE task_id=${taskId}`;
    assert.equal(reservation.state,"unknown");
    const [event]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger l
      JOIN agent_budget_reservations r ON r.id=l.reservation_id
      WHERE r.task_id=${taskId} AND l.event_type='unknown'`;
    assert.equal(event.n,1);
  } finally {
    if(taskId){
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await admin.end();
  }
});

test("Agent HQ worker rejects a database LOGIN that does not match AGENT_ROLE", {
  skip: !roleUrls.seo
}, () => {
  const result = spawnSync(process.execPath, ["scripts/agent-hq-worker.mjs", "--once"], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: roleUrls.seo,
      AGENT_ROLE: "qa_security",
      OPENAI_API_KEY: "test-key-never-used",
      AGENT_MODEL: "test-model",
      AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({ output: [], usage: { input_tokens: 0, output_tokens: 0 } })
    }
  });
  assert.notEqual(result.status, 0, "Worker must reject mismatched database identity before claiming work.");
  assert.match(result.stderr, /must authenticate as PostgreSQL LOGIN "agent_qa_security"/i);
});


test("Agent HQ concurrent reservations cannot overspend the daily cap", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const workerA=postgres(roleUrls.seo,{max:1});
  const workerB=postgres(roleUrls.seo,{max:1});
  let oldBudget;
  const taskIds=[];
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=1026,
      monthly_cap_microusd=50000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const [a]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','concurrent budget A','test','test','integration-test','claimed','seo-budget-a',
        now()+interval '5 minutes',5000) RETURNING id`;
    const [b]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','concurrent budget B','test','test','integration-test','claimed','seo-budget-b',
        now()+interval '5 minutes',5000) RETURNING id`;
    taskIds.push(a.id,b.id);
    const calls=await Promise.allSettled([
      workerA`SELECT * FROM agent_budget_reserve(${a.id},'seo-budget-a','test_stub','test-model',10000,256,1,0,${'parallel-a-'+randomUUID()})`,
      workerB`SELECT * FROM agent_budget_reserve(${b.id},'seo-budget-b','test_stub','test-model',10000,256,1,0,${'parallel-b-'+randomUUID()})`
    ]);
    assert.equal(calls.filter(x=>x.status==="fulfilled").length,1,
      "The serialized budget reservation lock must admit only one run at the exact daily cap");
    assert.equal(calls.filter(x=>x.status==="rejected").length,1);
  } finally {
    for(const taskId of taskIds){
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([workerA.end(),workerB.end(),admin.end()]);
  }
});

test("Agent HQ reservation and settlement are idempotent and bound to the original worker", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const seo=postgres(roleUrls.seo,{max:1});
  let oldBudget;
  let taskId;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=100000,
      monthly_cap_microusd=500000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const workerId="test-seo";
    const marker=randomUUID();
    const [task]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','budget idempotency','test','test','integration-test','claimed',${workerId},
        now()+interval '5 minutes',5000) RETURNING id`;
    taskId=task.id;
    const reserveKey="reserve-"+marker;
    const [first]=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${reserveKey})`;
    const [again]=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${reserveKey})`;
    assert.equal(String(again.run_id),String(first.run_id));
    assert.equal(String(again.reservation_id),String(first.reservation_id));
    await assert.rejects(seo`SELECT agent_budget_settle(
      ${first.reservation_id},'forged-worker',1000,500,0,${"wrong-"+marker},'provider-test-ref')`,
      e=>e.code==="42501");
    const [settled]=await seo`SELECT agent_budget_settle(
      ${first.reservation_id},${workerId},1000,500,0,${"settle-"+marker},'provider-test-ref') AS cost`;
    const [repeat]=await seo`SELECT agent_budget_settle(
      ${first.reservation_id},${workerId},1000,500,0,${"settle-"+marker},'provider-test-ref') AS cost`;
    assert.equal(String(repeat.cost),String(settled.cost));
    await assert.rejects(seo`SELECT agent_budget_settle(
      ${first.reservation_id},${workerId},1000,500,0,${"settle-"+marker},'different-provider-ref')`,
      e=>e.code==="23505");
    await assert.rejects(seo`SELECT agent_budget_settle(
      ${first.reservation_id},${workerId},1001,500,0,${"settle-other-"+marker},'provider-test-ref')`,
      e=>e.code==="23505");
    const [counts]=await admin`SELECT
      (SELECT count(*) FROM agent_budget_settlements WHERE reservation_id=${first.reservation_id})::int AS settlements,
      (SELECT count(*) FROM agent_budget_ledger WHERE reservation_id=${first.reservation_id} AND event_type='settled')::int AS ledger_events`;
    assert.equal(counts.settlements,1);
    assert.equal(counts.ledger_events,1);
  } finally {
    if(taskId){
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),admin.end()]);
  }
});

test("Agent HQ releases a reservation only for its original worker and idempotency key", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const seo=postgres(roleUrls.seo,{max:1});
  let oldBudget;
  let taskId;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=100000,
      monthly_cap_microusd=500000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const workerId="test-seo";
    const marker=randomUUID();
    const [task]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','budget release','test','test','integration-test','claimed',${workerId},
        now()+interval '5 minutes',5000) RETURNING id`;
    taskId=task.id;
    const [reservation]=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${"release-reserve-"+marker})`;
    await assert.rejects(seo`SELECT agent_budget_release(
      ${reservation.reservation_id},'forged-worker','provider call not started',${"release-"+marker})`,
      e=>e.code==="42501");
    const [released]=await seo`SELECT agent_budget_release(
      ${reservation.reservation_id},${workerId},'provider call not started',${"release-"+marker}) AS ok`;
    assert.equal(released.ok,true);
    const [repeat]=await seo`SELECT agent_budget_release(
      ${reservation.reservation_id},${workerId},'provider call not started',${"release-"+marker}) AS ok`;
    assert.equal(repeat.ok,true);
    await assert.rejects(seo`SELECT agent_budget_release(
      ${reservation.reservation_id},${workerId},'different reason',${"release-"+marker})`,
      e=>e.code==="23505");
    await assert.rejects(seo`SELECT agent_budget_release(
      ${reservation.reservation_id},${workerId},'different reason',${"release-other-"+marker})`,
      e=>e.code==="23505");
    const [state]=await admin`SELECT state FROM agent_budget_reservations WHERE id=${reservation.reservation_id}`;
    assert.equal(state.state,"released");
    const [events]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger
      WHERE reservation_id=${reservation.reservation_id} AND event_type='released'`;
    assert.equal(events.n,1);
  } finally {
    if(taskId){
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),admin.end()]);
  }
});

test("Agent HQ operator reconciles an unknown reservation exactly once after lease expiry", {
  skip: !adminUrl || !roleUrls.seo || !roleUrls.operator
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const seo=postgres(roleUrls.seo,{max:1});
  const operator=postgres(roleUrls.operator,{max:1});
  let oldBudget;
  let taskId;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=100000,
      monthly_cap_microusd=500000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const workerId="test-seo";
    const marker=randomUUID();
    const [task]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','budget reconcile','test','test','integration-test','claimed',${workerId},
        now()+interval '5 minutes',5000) RETURNING id`;
    taskId=task.id;
    const [reservation]=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${"reconcile-reserve-"+marker})`;
    await seo`SELECT agent_budget_mark_unknown(
      ${reservation.reservation_id},${workerId},'provider response timed out',${"unknown-"+marker})`;
    await admin`UPDATE agent_tasks SET status='queued',lease_owner=NULL,lease_until=NULL WHERE id=${taskId}`;
    const [cost]=await operator`SELECT agent_budget_reconcile_usage(
      ${reservation.reservation_id},1000,500,0,'provider-usage-confirmed',${"reconcile-"+marker}) AS cost`;
    const [repeat]=await operator`SELECT agent_budget_reconcile_usage(
      ${reservation.reservation_id},1000,500,0,'provider-usage-confirmed',${"reconcile-"+marker}) AS cost`;
    assert.equal(String(repeat.cost),String(cost.cost));
    await assert.rejects(operator`SELECT agent_budget_reconcile_usage(
      ${reservation.reservation_id},1000,500,0,'different-provider-reference',${"reconcile-"+marker}) AS cost`,
      e=>e.code==="23505");
    const [state]=await admin`SELECT state FROM agent_budget_reservations WHERE id=${reservation.reservation_id}`;
    assert.equal(state.state,"settled");
    const [run]=await admin`SELECT status,input_tokens,output_tokens,cost_microusd FROM agent_runs WHERE id=${reservation.run_id}`;
    assert.equal(run.status,"succeeded");
    assert.equal(Number(run.input_tokens),1000);
    assert.equal(Number(run.output_tokens),500);
    assert.equal(String(run.cost_microusd),String(cost.cost));
    const [events]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger
      WHERE reservation_id=${reservation.reservation_id} AND event_type='reconciled'`;
    assert.equal(events.n,1);
  } finally {
    if(taskId){
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),operator.end(),admin.end()]);
  }
});


test("Agent HQ enforces monthly, task and per-run reservation caps", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const seo=postgres(roleUrls.seo,{max:1});
  let oldBudget;
  const taskIds=[];
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=100000,
      monthly_cap_microusd=1103,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const createTask=async (budgetLimit,workerId) => {
      const [task]=await admin`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,status,lease_owner,lease_until,budget_limit_microusd)
        VALUES ('seo','budget cap test','test','test','integration-test','claimed',${workerId},
          now()+interval '5 minutes',${budgetLimit}) RETURNING id`;
      taskIds.push(task.id);
      return task.id;
    };
    const reserve=async (taskId,workerId,key) => seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${key})`;
    const firstTask=await createTask(5000,"seo-monthly-cap-a");
    const [first]=await reserve(firstTask,"seo-monthly-cap-a","monthly-cap-a-"+randomUUID());
    assert.equal(Number(first.reserved_microusd),1103);
    const secondTask=await createTask(5000,"seo-monthly-cap-b");
    await assert.rejects(
      reserve(secondTask,"seo-monthly-cap-b","monthly-cap-b-"+randomUUID()),
      e=>e.code==="P0001",
      "A second reservation must be rejected at the monthly cap"
    );

    await admin`UPDATE agent_budget_config SET monthly_cap_microusd=100000 WHERE id=1`;
    const taskLimited=await createTask(1102,"seo-task-cap");
    await assert.rejects(
      reserve(taskLimited,"seo-task-cap","task-cap-"+randomUUID()),
      e=>e.code==="P0001",
      "A reservation must not exceed the task-level budget"
    );

    await admin`UPDATE agent_budget_config SET per_run_cap_microusd=1102 WHERE id=1`;
    const runLimited=await createTask(5000,"seo-run-cap");
    await assert.rejects(
      reserve(runLimited,"seo-run-cap","run-cap-"+randomUUID()),
      e=>e.code==="P0001",
      "A reservation must not exceed the per-run budget"
    );
  } finally {
    if(taskIds.length) {
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=ANY(${taskIds}))`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=ANY(${taskIds}))`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=ANY(${taskIds})`;
      await admin`DELETE FROM agent_runs WHERE task_id=ANY(${taskIds})`;
      await admin`DELETE FROM agent_tasks WHERE id=ANY(${taskIds})`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),admin.end()]);
  }
});

test("Agent HQ operator can reconcile a reservation with confirmed zero provider charge", {
  skip: !adminUrl || !roleUrls.seo || !roleUrls.operator
}, async () => {
  const admin=postgres(adminUrl,{max:2});
  const seo=postgres(roleUrls.seo,{max:1});
  const operator=postgres(roleUrls.operator,{max:1});
  let oldBudget;
  let taskId;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=100000,
      monthly_cap_microusd=500000,per_run_cap_microusd=5000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const workerId="test-seo";
    const marker=randomUUID();
    const [task]=await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status,lease_owner,lease_until,budget_limit_microusd)
      VALUES ('seo','no-charge reconciliation','test','test','integration-test','claimed',${workerId},
        now()+interval '5 minutes',5000) RETURNING id`;
    taskId=task.id;
    const [reservation]=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},${workerId},'test_stub','test-model',10000,1024,1,0,${"no-charge-reserve-"+marker})`;
    const [unknownFirst]=await seo`SELECT agent_budget_mark_unknown(
      ${reservation.reservation_id},${workerId},'provider outcome ambiguous',${"no-charge-unknown-"+marker}) AS ok`;
    const [unknownRepeat]=await seo`SELECT agent_budget_mark_unknown(
      ${reservation.reservation_id},${workerId},'provider outcome ambiguous',${"no-charge-unknown-"+marker}) AS ok`;
    assert.equal(unknownFirst.ok,true);
    assert.equal(unknownRepeat.ok,true);
    await assert.rejects(seo`SELECT agent_budget_mark_unknown(
      ${reservation.reservation_id},${workerId},'different provider outcome',${"no-charge-unknown-"+marker})`,
      e=>e.code==="23505");
    await admin`UPDATE agent_tasks SET status='queued',lease_owner=NULL,lease_until=NULL WHERE id=${taskId}`;
    const [first]=await operator`SELECT agent_budget_reconcile_no_charge(
      ${reservation.reservation_id},'provider billing record confirms zero charge',${"no-charge-"+marker}) AS ok`;
    const [repeat]=await operator`SELECT agent_budget_reconcile_no_charge(
      ${reservation.reservation_id},'provider billing record confirms zero charge',${"no-charge-"+marker}) AS ok`;
    assert.equal(first.ok,true);
    assert.equal(repeat.ok,true);
    await assert.rejects(operator`SELECT agent_budget_reconcile_no_charge(
      ${reservation.reservation_id},'different confirmation evidence',${"no-charge-"+marker}) AS ok`,
      e=>e.code==="23505");
    const [state]=await admin`SELECT state FROM agent_budget_reservations WHERE id=${reservation.reservation_id}`;
    assert.equal(state.state,"released");
    const [run]=await admin`SELECT status,cost_microusd FROM agent_runs WHERE id=${reservation.run_id}`;
    assert.equal(run.status,"cancelled");
    assert.equal(String(run.cost_microusd),"0");
    const [events]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger
      WHERE reservation_id=${reservation.reservation_id} AND event_key=${"reconcile:"+ "no-charge-"+marker}`;
    assert.equal(events.n,1);
    await assert.rejects(
      seo`SELECT agent_budget_reconcile_no_charge(${reservation.reservation_id},
        'worker must not reconcile',${"no-charge-worker-"+marker})`,
      e=>e.code==="42501"
    );
  } finally {
    if(taskId) {
      await admin`DELETE FROM agent_budget_ledger WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_settlements WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${taskId})`;
      await admin`DELETE FROM agent_budget_reservations WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_runs WHERE task_id=${taskId}`;
      await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    }
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),operator.end(),admin.end()]);
  }
});

test("Agent HQ trusted budget tables and run accounting are inaccessible to workers", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:1});
  const seo=postgres(roleUrls.seo,{max:1});
  let taskId;
  try {
    const [task]=await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo','budget boundary ACL','test','test','integration-test') RETURNING id`;
    taskId=task.id;
    await assert.rejects(seo`UPDATE agent_tasks SET status='done' WHERE id=${taskId}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_tasks SET lease_owner='forged-worker' WHERE id=${taskId}`,e=>e.code==="42501");
    const [taskLifecycleAcl]=await admin`SELECT
      has_function_privilege('agent_seo','public.agent_task_heartbeat(bigint,text)','EXECUTE') AS heartbeat,
      has_function_privilege('agent_seo','public.agent_task_transition(bigint,text,text,bigint)','EXECUTE') AS transition,
      has_function_privilege('public','public.agent_task_heartbeat(bigint,text)','EXECUTE') AS public_heartbeat`;
    assert.equal(taskLifecycleAcl.heartbeat,true);
    assert.equal(taskLifecycleAcl.transition,true);
    assert.equal(taskLifecycleAcl.public_heartbeat,false);
    const [run]=await admin`INSERT INTO agent_runs(task_id,role,worker_id,provider,model,status)
      VALUES (${taskId},'seo','seo-acl-test','test','test','running') RETURNING id`;
    await assert.rejects(seo`INSERT INTO agent_runs(task_id,role,worker_id,provider,model,status,cost_microusd)
      VALUES (${taskId},'seo','seo-acl-test','test','test','running',999999)`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET cost_microusd=1 WHERE id=${run.id}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET input_tokens=1 WHERE id=${run.id}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET output_tokens=1 WHERE id=${run.id}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET status='succeeded' WHERE id=${run.id}`,e=>e.code==="42501");
    await assert.rejects(seo`SELECT * FROM agent_budget_reservations`,e=>e.code==="42501");
    await assert.rejects(seo`SELECT * FROM agent_budget_ledger`,e=>e.code==="42501");
    await assert.rejects(seo`SELECT * FROM agent_budget_settlements`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_budget_ledger SET amount_microusd=0`,e=>e.code==="42501");
    await assert.rejects(seo`DELETE FROM agent_budget_ledger`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_budget_settlements SET actual_cost_microusd=0`,e=>e.code==="42501");
    const budgetFunctions=await admin`SELECT p.proname,r.rolname AS owner,p.prosecdef,p.proconfig
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_roles r ON r.oid=p.proowner
      WHERE n.nspname='public' AND p.proname IN
        ('agent_budget_reserve','agent_budget_settle','agent_budget_release',
         'agent_budget_mark_unknown','agent_budget_reconcile_usage','agent_budget_reconcile_no_charge',
         'agent_task_heartbeat','agent_task_transition')`;
    assert.equal(budgetFunctions.length,8);
    assert.ok(budgetFunctions.every(fn=>fn.owner==="agent_hq_budget_owner" && fn.prosecdef &&
      Array.isArray(fn.proconfig) && fn.proconfig.some(value=>value.startsWith("search_path=pg_catalog"))));
    const [runtimeExec]=await admin`SELECT has_function_privilege('agent_seo',
      'public.agent_budget_reserve(bigint,text,text,text,integer,integer,integer,integer,text)','EXECUTE') AS allowed`;
    assert.equal(runtimeExec.allowed,true);
    const [operatorReconcile]=await admin`SELECT has_function_privilege('agent_operator',
      'public.agent_budget_reconcile_usage(bigint,integer,integer,integer,text,text)','EXECUTE') AS allowed`;
    assert.equal(operatorReconcile.allowed,true);
    const [workerReconcile]=await admin`SELECT has_function_privilege('agent_seo',
      'public.agent_budget_reconcile_usage(bigint,integer,integer,integer,text,text)','EXECUTE') AS allowed`;
    assert.equal(workerReconcile.allowed,false);
    const [owner]=await admin`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
      FROM pg_roles WHERE rolname='agent_hq_budget_owner'`;
    assert.ok(owner);
    assert.deepEqual(owner,{rolcanlogin:false,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolinherit:false,rolbypassrls:false});
    const ownedTables=await admin`SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE r.rolname='agent_hq_budget_owner' AND c.relname = ANY(${[
        "agent_tasks","agent_runs","agent_budget_config","agent_budget_reservations",
        "agent_budget_ledger","agent_budget_settlements"
      ]})`;
    assert.equal(ownedTables.length,0,"Budget function owner must not own protected tables");
    const [ownerMemberships]=await admin`SELECT count(*)::int AS n FROM pg_auth_members m
      JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
      WHERE r.rolname='agent_hq_budget_owner' OR member.rolname='agent_hq_budget_owner'`;
    assert.equal(ownerMemberships.n,0,"Budget function owner must not have or receive role memberships");
    const [schemaCreate]=await admin`SELECT has_schema_privilege('agent_hq_budget_owner','public','CREATE') AS allowed`;
    assert.equal(schemaCreate.allowed,false,"Budget function owner must not retain CREATE on public");
    const [publicExec]=await admin`SELECT has_function_privilege('public',
      'public.agent_budget_reserve(bigint,text,text,text,integer,integer,integer,integer,text)','EXECUTE') AS allowed`;
    assert.equal(publicExec.allowed,false);
    const [recoveryAcl]=await admin`SELECT
      has_function_privilege('agent_supervisor','public.agent_budget_recover_expired_tasks()','EXECUTE') AS supervisor_allowed,
      has_function_privilege('agent_seo','public.agent_budget_recover_expired_tasks()','EXECUTE') AS worker_allowed,
      has_function_privilege('public','public.agent_budget_recover_expired_tasks()','EXECUTE') AS public_allowed`;
    assert.equal(recoveryAcl.supervisor_allowed,true);
    assert.equal(recoveryAcl.worker_allowed,false);
    assert.equal(recoveryAcl.public_allowed,false);
    const [claimAcl]=await admin`SELECT
      has_function_privilege('agent_seo','public.agent_task_claim(text)','EXECUTE') AS worker_allowed,
      has_function_privilege('agent_supervisor','public.agent_task_claim(text)','EXECUTE') AS supervisor_allowed,
      has_function_privilege('public','public.agent_task_claim(text)','EXECUTE') AS public_allowed`;
    assert.equal(claimAcl.worker_allowed,true);
    assert.equal(claimAcl.supervisor_allowed,false);
    assert.equal(claimAcl.public_allowed,false);
  } finally {
    if(taskId) await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    await Promise.all([seo.end(),admin.end()]);
  }
});

test("Agent HQ SECURITY DEFINER helpers use a dedicated NOLOGIN non-BYPASSRLS owner", {
  skip: !adminUrl
}, async () => {
  const admin = postgres(adminUrl, { max: 1 });
  try {
    const [owner] = await admin`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
      FROM pg_roles WHERE rolname='agent_hq_runtime_fn_owner'`;
    assert.ok(owner, "Dedicated CI function owner must exist");
    assert.equal(owner.rolcanlogin, false);
    assert.equal(owner.rolsuper, false);
    assert.equal(owner.rolcreatedb, false);
    assert.equal(owner.rolcreaterole, false);
    assert.equal(owner.rolinherit, false);
    assert.equal(owner.rolbypassrls, false);

    const helpers = await admin`
      SELECT p.proname,r.rolname AS owner,p.prosecdef,p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_roles r ON r.oid=p.proowner
      WHERE n.nspname='public'
        AND p.proname IN (
          'agent_has_task_access',
          'agent_can_grant_task_access',
          'agent_is_valid_coordinator_parent',
          'agent_role_for_session',
          'agent_can_insert_own_artifact',
          'agent_worker_id_for_session'
        )`;
    assert.equal(helpers.length, 6, "All reviewed runtime SECURITY DEFINER helpers must be present");
    for (const helper of helpers) {
      assert.equal(helper.owner, "agent_hq_runtime_fn_owner", helper.proname + " owner");
      assert.equal(helper.prosecdef, true, helper.proname + " must be SECURITY DEFINER");
      assert.ok(
        Array.isArray(helper.proconfig) && helper.proconfig.some(value => value.startsWith("search_path=pg_catalog")),
        helper.proname + " must pin search_path"
      );
    }

    const runtimeLogins = [
      "agent_web_engineer", "agent_geo", "agent_growth", "agent_analytics",
      "agent_vk_strategist", "agent_copywriter", "agent_designer", "agent_image_generator",
      "agent_storyteller", "agent_community_manager", "agent_content_seo", "agent_ads_manager",
      "agent_trend_scout", "agent_auto_news_editor", "agent_auto_law_monitor", "agent_fact_checker",
      "agent_seo", "agent_qa_security", "agent_coordinator", "agent_supervisor", "agent_operator"
    ];
    const runtimeRoleFlags = await admin`
      SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
      FROM pg_roles WHERE rolname = ANY(${runtimeLogins})
    `;
    assert.equal(runtimeRoleFlags.length, runtimeLogins.length, "All runtime LOGIN roles must exist");
    assert.ok(runtimeRoleFlags.every(r => r.rolcanlogin && !r.rolsuper && !r.rolcreatedb &&
      !r.rolcreaterole && !r.rolinherit && !r.rolbypassrls),
      "Every runtime identity must be LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE and NOBYPASSRLS");

    const memberships = await admin`SELECT member.rolname AS member, granted.rolname AS granted_role
      FROM pg_auth_members m
      JOIN pg_roles granted ON granted.oid=m.roleid
      JOIN pg_roles member ON member.oid=m.member
      WHERE member.rolname = ANY(${runtimeLogins})`;
    assert.equal(memberships.length, 0, "Runtime LOGINs must not inherit or SET ROLE to any other role");

    const publicHelperExec = await admin`
      SELECT p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname IN ('agent_has_task_access','agent_can_grant_task_access',
          'agent_is_valid_coordinator_parent','agent_role_for_session',
          'agent_can_insert_own_artifact','agent_worker_id_for_session')
        AND has_function_privilege('public', p.oid, 'EXECUTE')
    `;
    assert.equal(publicHelperExec.length, 0, "PUBLIC must not execute any SECURITY DEFINER helper");

    const tableOwners = await admin`SELECT c.relname,r.rolname AS owner
      FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE c.relname IN ('agent_tasks','agent_task_access','agent_runs') AND c.relkind='r'`;
    assert.ok(tableOwners.every(row => row.owner !== "agent_hq_runtime_fn_owner"),
      "Function owner must not own protected tables");
  } finally {
    await admin.end();
  }
});


test("Agent HQ budget function owner has only the column privileges required by trusted routines", {
  skip: !adminUrl
}, async () => {
  const admin=postgres(adminUrl,{max:1});
  try {
    const [privileges]=await admin`SELECT
      has_table_privilege('agent_hq_budget_owner','public.agent_runs','SELECT') AS run_select,
      has_table_privilege('agent_hq_budget_owner','public.agent_runs','INSERT') AS run_table_insert,
      has_table_privilege('agent_hq_budget_owner','public.agent_runs','UPDATE') AS run_table_update,
      has_table_privilege('agent_hq_budget_owner','public.agent_budget_reservations','UPDATE') AS reservation_table_update,
      has_table_privilege('agent_hq_budget_owner','public.agent_budget_ledger','UPDATE') AS ledger_update,
      has_table_privilege('agent_hq_budget_owner','public.agent_budget_ledger','DELETE') AS ledger_delete,
      has_table_privilege('agent_hq_budget_owner','public.agent_budget_settlements','UPDATE') AS settlement_update,
      has_table_privilege('agent_hq_budget_owner','public.agent_budget_settlements','DELETE') AS settlement_delete,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','id','SELECT') AS run_select_id,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','cost_microusd','SELECT') AS run_select_cost,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','task_id','INSERT') AS run_insert_task,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','cost_microusd','INSERT') AS run_insert_cost,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','status','UPDATE') AS run_update_status,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','cost_microusd','UPDATE') AS run_update_cost,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','worker_id','UPDATE') AS run_update_worker,
      has_column_privilege('agent_hq_budget_owner','public.agent_runs','provider','UPDATE') AS run_update_provider,
      has_column_privilege('agent_hq_budget_owner','public.agent_budget_reservations','state','UPDATE') AS reservation_update_state,
      has_column_privilege('agent_hq_budget_owner','public.agent_budget_reservations','updated_at','UPDATE') AS reservation_update_timestamp,
      has_column_privilege('agent_hq_budget_owner','public.agent_budget_reservations','worker_id','UPDATE') AS reservation_update_worker,
      has_column_privilege('agent_hq_budget_owner','public.agent_budget_reservations','reserved_microusd','UPDATE') AS reservation_update_amount`;
    assert.equal(privileges.run_select,false);
    assert.equal(privileges.run_table_insert,false);
    assert.equal(privileges.run_table_update,false);
    assert.equal(privileges.reservation_table_update,false);
    assert.equal(privileges.ledger_update,false);
    assert.equal(privileges.ledger_delete,false);
    assert.equal(privileges.settlement_update,false);
    assert.equal(privileges.settlement_delete,false);
    assert.equal(privileges.run_select_id,true);
    assert.equal(privileges.run_select_cost,false);
    assert.equal(privileges.run_insert_task,true);
    assert.equal(privileges.run_insert_cost,true);
    assert.equal(privileges.run_update_status,true);
    assert.equal(privileges.run_update_cost,true);
    assert.equal(privileges.run_update_worker,false);
    assert.equal(privileges.run_update_provider,false);
    assert.equal(privileges.reservation_update_state,true);
    assert.equal(privileges.reservation_update_timestamp,true);
    assert.equal(privileges.reservation_update_worker,false);
    assert.equal(privileges.reservation_update_amount,false);
  } finally {
    await admin.end();
  }
});
