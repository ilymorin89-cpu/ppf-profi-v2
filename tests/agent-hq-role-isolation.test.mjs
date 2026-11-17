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
  let seoTask, qaTask, parentTask, unrelatedParent, unrelatedTask, delegatedTaskId, seoArtifact, unrelatedArtifact;
  try {
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
    const foreignRunUpdate = await seo`UPDATE agent_runs SET status='failed' WHERE id=${qaRun.id} RETURNING id`;
    assert.equal(foreignRunUpdate.length, 0);
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
        AGENT_WORKER_ID: "seo-rls-e2e",
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
    const runs = await admin`SELECT status FROM agent_runs WHERE task_id=${taskId}`;
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, "succeeded");
  } finally {
    if (taskId) await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
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


test("Agent HQ SECURITY DEFINER helpers use a dedicated NOLOGIN non-BYPASSRLS owner", {
  skip: !adminUrl
}, async () => {
  const admin = postgres(adminUrl, { max: 1 });
  try {
    const [owner] = await admin`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
      FROM pg_roles WHERE rolname='agent_hq_fn_owner_ci'`;
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
          'agent_test_budget_totals'
        )`;
    assert.equal(helpers.length, 6, "All reviewed SECURITY DEFINER helpers must be present");
    for (const helper of helpers) {
      assert.equal(helper.owner, "agent_hq_fn_owner_ci", helper.proname + " owner");
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

    const budgetExec = await admin`
      SELECT r.rolname, has_function_privilege(r.oid, 'public.agent_test_budget_totals()', 'EXECUTE') AS allowed
      FROM pg_roles r WHERE r.rolname = ANY(${runtimeLogins})
    `;
    assert.equal(budgetExec.length, runtimeLogins.length, "All runtime roles must exist for function ACL verification");
    assert.ok(budgetExec.every(row => row.allowed === false),
      "Runtime LOGINs must not receive direct EXECUTE on the test-only global budget aggregate");

    const [publicBudgetExec] = await admin`
      SELECT has_function_privilege('public', 'public.agent_test_budget_totals()', 'EXECUTE') AS allowed
    `;
    assert.equal(publicBudgetExec.allowed, false, "PUBLIC must not execute the test-only aggregate");

    const publicHelperExec = await admin`
      SELECT p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname IN ('agent_has_task_access','agent_can_grant_task_access',
          'agent_is_valid_coordinator_parent','agent_role_for_session',
          'agent_can_insert_own_artifact','agent_test_budget_totals')
        AND has_function_privilege('public', p.oid, 'EXECUTE')
    `;
    assert.equal(publicHelperExec.length, 0, "PUBLIC must not execute any SECURITY DEFINER helper");

    const tableOwners = await admin`SELECT c.relname,r.rolname AS owner
      FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
      WHERE c.relname IN ('agent_tasks','agent_task_access','agent_runs') AND c.relkind='r'`;
    assert.ok(tableOwners.every(row => row.owner !== "agent_hq_fn_owner_ci"),
      "Function owner must not own protected tables");
  } finally {
    await admin.end();
  }
});


test("Agent HQ workers cannot forge authoritative run costs or usage", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:1});
  const seo=postgres(roleUrls.seo,{max:1});
  let taskId;
  try {
    const [task]=await admin`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo','budget ACL test','test','test','integration-test') RETURNING id`;
    taskId=task.id;
    await assert.rejects(
      seo`INSERT INTO agent_runs(task_id,role,worker_id,provider,model,status,cost_microusd)
        VALUES (${taskId},'seo','seo-ci','test','test','running',999999)`,
      error=>error.code==="42501",
      "worker cannot insert a run with an authoritative cost"
    );
    const [row]=await admin`INSERT INTO agent_runs(task_id,role,worker_id,provider,model,status)
      VALUES (${taskId},'seo','seo-ci','test','test','running') RETURNING id`;
    await assert.rejects(seo`UPDATE agent_runs SET cost_microusd=1 WHERE id=${row.id}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET input_tokens=1 WHERE id=${row.id}`,e=>e.code==="42501");
    await assert.rejects(seo`UPDATE agent_runs SET output_tokens=1 WHERE id=${row.id}`,e=>e.code==="42501");
    await assert.rejects(seo`INSERT INTO agent_budget_reservations
      (run_id,task_id,role,worker_id,reserve_key,reserved_microusd,price_snapshot,day_key,month_key)
      VALUES (${row.id},${taskId},'seo','seo-ci','forged-reserve-001',999,'{}',CURRENT_DATE,date_trunc('month',now())::date)`,
      e=>e.code==="42501" || e.code==="42501" || e.code==="42501");
    await assert.rejects(seo`SELECT * FROM agent_budget_ledger`,e=>e.code==="42501");
    const [owner]=await admin`SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
      FROM pg_roles WHERE rolname='agent_hq_budget_owner_ci'`;
    assert.ok(owner);
    assert.equal(owner.rolcanlogin,false);
    assert.equal(owner.rolsuper,false);
    assert.equal(owner.rolcreatedb,false);
    assert.equal(owner.rolcreaterole,false);
    assert.equal(owner.rolinherit,false);
    assert.equal(owner.rolbypassrls,false);
  } finally {
    if(taskId) await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    await Promise.all([seo.end(),admin.end()]);
  }
});

test("Agent HQ trusted budget reservation is atomic, idempotent and settles once", {
  skip: !adminUrl || !roleUrls.seo
}, async () => {
  const admin=postgres(adminUrl,{max:3});
  const seo=postgres(roleUrls.seo,{max:1});
  let taskId;
  let oldBudget;
  try {
    [oldBudget]=await admin`SELECT * FROM agent_budget_config WHERE id=1`;
    await admin`UPDATE agent_budget_config SET enabled=true,daily_cap_microusd=1000000,
      monthly_cap_microusd=5000000,per_run_cap_microusd=500000,
      input_price_per_million_microusd=100000,output_price_per_million_microusd=100000,
      web_search_price_microusd_per_call=0 WHERE id=1`;
    const marker=randomUUID();
    const [task]=await admin`INSERT INTO agent_tasks(assigned_role,title,objective,expected_output,created_by,
      status,lease_owner,lease_until,budget_limit_microusd)
      VALUES('seo','budget reservation','test','test','integration-test','running','seo-budget-test',
        now()+interval '5 minutes',400000) RETURNING id`;
    taskId=task.id;
    await seo`SELECT set_config('agent.worker_id','seo-budget-test',false)`;
    const key="reserve-"+marker;
    const reserved=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},'seo-budget-test','test-model',10000,256,1,0,${key})`;
    assert.equal(reserved.length,1);
    const duplicate=await seo`SELECT * FROM agent_budget_reserve(
      ${taskId},'seo-budget-test','test-model',10000,256,1,0,${key})`;
    assert.equal(duplicate.length,1);
    assert.equal(String(duplicate[0].run_id),String(reserved[0].run_id));
    assert.equal(String(duplicate[0].reservation_id),String(reserved[0].reservation_id));
    const cost=await seo`SELECT agent_budget_settle(
      ${reserved[0].reservation_id},'seo-budget-test',1000,500,0,${"settle-"+marker},'provider-test-ref') AS cost`;
    assert.ok(Number(cost[0].cost)>0);
    const repeat=await seo`SELECT agent_budget_settle(
      ${reserved[0].reservation_id},'seo-budget-test',1000,500,0,${"settle-"+marker},'provider-test-ref') AS cost`;
    assert.equal(String(repeat[0].cost),String(cost[0].cost));
    const [ledger]=await admin`SELECT count(*)::int AS n FROM agent_budget_ledger WHERE reservation_id=${reserved[0].reservation_id} AND event_type='settled'`;
    assert.equal(ledger.n,1);
    const [run]=await admin`SELECT status,input_tokens,output_tokens,cost_microusd FROM agent_runs WHERE id=${reserved[0].run_id}`;
    assert.equal(run.status,"succeeded");
    assert.equal(run.input_tokens,1000);
    assert.equal(run.output_tokens,500);
    assert.equal(String(run.cost_microusd),String(cost[0].cost));
  } finally {
    if(taskId) await admin`DELETE FROM agent_tasks WHERE id=${taskId}`;
    if(oldBudget) await admin`UPDATE agent_budget_config SET enabled=${oldBudget.enabled},
      daily_cap_microusd=${oldBudget.daily_cap_microusd},monthly_cap_microusd=${oldBudget.monthly_cap_microusd},
      per_run_cap_microusd=${oldBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${oldBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${oldBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${oldBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await Promise.all([seo.end(),admin.end()]);
  }
});
