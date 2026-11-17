import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const databaseUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const supervisorUrl = process.env.AGENT_HQ_ROLE_TEST_URL_SUPERVISOR;
const operatorUrl = process.env.AGENT_HQ_ROLE_TEST_URL_OPERATOR;
const seoUrl = process.env.AGENT_HQ_ROLE_TEST_URL_SEO;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runNode = (script, args = [], overrides = {}) => spawnSync(process.execPath, [script, ...args], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, AGENT_HQ_TEST_APPROVER_UIDS: String(process.getuid?.() ?? ""), ...overrides }
});

const runNodeAsync = (script, args = [], overrides = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, AGENT_HQ_TEST_APPROVER_UIDS: String(process.getuid?.() ?? ""), ...overrides },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  child.once("error", reject);
  child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
});


test("Agent HQ runs coordinator → SEO → QA → supervisor under separate PostgreSQL logins", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const roleUrls = {
    coordinator: process.env.AGENT_HQ_ROLE_TEST_URL_COORDINATOR,
    seo: process.env.AGENT_HQ_ROLE_TEST_URL_SEO,
    qa: process.env.AGENT_HQ_ROLE_TEST_URL_QA,
    supervisor: process.env.AGENT_HQ_ROLE_TEST_URL_SUPERVISOR
  };
  for (const [role, url] of Object.entries(roleUrls)) assert.ok(url, `Missing test login for ${role}`);
  const supervisorIdentity = postgres(roleUrls.supervisor, { max: 1 });
  const [identity] = await supervisorIdentity`SELECT session_user AS login,
    public.agent_can_grant_task_access('coordinator') AS can_grant`;
  assert.equal(identity.login, "agent_supervisor");
  assert.equal(identity.can_grant, true);
  await supervisorIdentity.end();

  const sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 });
  const marker = randomUUID();
  let parentId;
  let previousBudget;
  try {
    [previousBudget] = await sql`SELECT * FROM agent_budget_config WHERE id=1`;
    await sql`UPDATE agent_budget_config SET enabled=true,
      daily_cap_microusd=100000000,monthly_cap_microusd=100000000,
      per_run_cap_microusd=10000000,input_price_per_million_microusd=1000,
      output_price_per_million_microusd=1000,web_search_price_microusd_per_call=0 WHERE id=1`;
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,acceptance_criteria,created_by,status)
      VALUES ('coordinator',${"Full lifecycle " + marker},'Delegate, execute, independently verify and consolidate',
        'Consolidated result','["SEO evidence exists","QA returns PASS"]'::jsonb,'integration-test','queued')
      RETURNING id`;
    parentId = parent.id;

    const coordinatorResponses = [
      {
        output: [{
          type: "function_call",
          name: "delegate_task",
          call_id: "delegate-seo-1",
          arguments: JSON.stringify({
            role: "seo",
            title: "SEO specialist evidence",
            objective: "Produce verifiable SEO findings for the test parent",
            acceptance_criteria: ["Return evidence and next action"],
            priority: 10
          })
        }],
        usage: { input_tokens: 0, output_tokens: 0 }
      },
      {
        output: [{
          type: "message",
          content: [{ type: "output_text", text: "Delegated SEO evidence task to specialist." }]
        }],
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    ];
    const coordinatorRun = runNode("scripts/agent-hq-worker.mjs", ["--once"], {
      DATABASE_URL: roleUrls.coordinator,
      AGENT_ROLE: "coordinator",
      AGENT_WORKER_ID: "coordinator-e2e",
      OPENAI_API_KEY: "test-key-never-used",
      AGENT_MODEL: "gpt-4.1-mini",
      AGENT_WEB_SEARCH_ENABLED: "false",
      AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify(coordinatorResponses)
    });
    assert.equal(coordinatorRun.status, 0, coordinatorRun.stderr || coordinatorRun.stdout);

    const [parentReview] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
    assert.equal(parentReview.status, "review");
    const [specialist] = await sql`SELECT id,status,assigned_role FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='seo'`;
    assert.ok(specialist, "Coordinator must create a real SEO child task.");
    assert.equal(specialist.status, "queued");

    const seoRun = runNode("scripts/agent-hq-worker.mjs", ["--once"], {
      DATABASE_URL: roleUrls.seo,
      AGENT_ROLE: "seo",
      AGENT_WORKER_ID: "seo-e2e",
      OPENAI_API_KEY: "test-key-never-used",
      AGENT_MODEL: "gpt-4.1-mini",
      AGENT_WEB_SEARCH_ENABLED: "false",
      AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: `Verified SEO evidence ${marker}; recommendation: fix crawlable metadata.` }]
        }],
        usage: { input_tokens: 0, output_tokens: 0 }
      })
    });
    assert.equal(seoRun.status, 0, seoRun.stderr || seoRun.stdout);
    const [specialistDone] = await sql`SELECT status FROM agent_tasks WHERE id=${specialist.id}`;
    assert.equal(specialistDone.status, "done", seoRun.stderr || seoRun.stdout);

    const firstSupervisor = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: roleUrls.supervisor });
    assert.equal(firstSupervisor.status, 0, firstSupervisor.stderr || firstSupervisor.stdout);
    const [qa] = await sql`SELECT id,status FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    assert.ok(qa, "Supervisor must create an independent QA task after specialist completion.");
    assert.equal(qa.status, "queued");
    const grants = await sql`SELECT task_id,principal,access_reason FROM agent_task_access
      WHERE task_id=${specialist.id}`;
    assert.ok(grants.some(row => row.principal === "coordinator" && row.access_reason === "coordinator_oversight"));
    assert.ok(grants.some(row => row.principal === "qa_security" && row.access_reason === "qa_review"));

    const qaRun = runNode("scripts/agent-hq-worker.mjs", ["--once"], {
      DATABASE_URL: roleUrls.qa,
      AGENT_ROLE: "qa_security",
      AGENT_WORKER_ID: "qa-e2e",
      OPENAI_API_KEY: "test-key-never-used",
      AGENT_MODEL: "gpt-4.1-mini",
      AGENT_WEB_SEARCH_ENABLED: "false",
      AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: `VERDICT: PASS\\nReviewed specialist evidence for ${marker}; acceptance criteria met.` }]
        }],
        usage: { input_tokens: 0, output_tokens: 0 }
      })
    });
    assert.equal(qaRun.status, 0, qaRun.stderr || qaRun.stdout);
    const [qaDone] = await sql`SELECT status FROM agent_tasks WHERE id=${qa.id}`;
    assert.equal(qaDone.status, "done", qaRun.stderr || qaRun.stdout);

    const finalSupervisor = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: roleUrls.supervisor });
    assert.equal(finalSupervisor.status, 0, finalSupervisor.stderr || finalSupervisor.stdout);
    const [completed] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
    assert.equal(completed.status, "done");
    const [artifact] = await sql`SELECT content FROM agent_artifacts
      WHERE task_id=${parentId} AND artifact_type='consolidated'`;
    assert.ok(artifact);
    assert.match(artifact.content, new RegExp("Verified SEO evidence " + marker));
    assert.match(artifact.content, /VERDICT: PASS/);
  } finally {
    if (parentId) {
      await sql`DELETE FROM agent_budget_ledger WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${parentId}
          OR task_id IN (SELECT id FROM agent_tasks WHERE parent_task_id=${parentId}))`;
      await sql`DELETE FROM agent_budget_settlements WHERE reservation_id IN
        (SELECT id FROM agent_budget_reservations WHERE task_id=${parentId}
          OR task_id IN (SELECT id FROM agent_tasks WHERE parent_task_id=${parentId}))`;
      await sql`DELETE FROM agent_budget_reservations WHERE task_id=${parentId}
        OR task_id IN (SELECT id FROM agent_tasks WHERE parent_task_id=${parentId})`;
      await sql`DELETE FROM agent_tasks WHERE parent_task_id=${parentId}`;
      await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    }
    if (previousBudget) await sql`UPDATE agent_budget_config SET enabled=${previousBudget.enabled},
      daily_cap_microusd=${previousBudget.daily_cap_microusd},
      monthly_cap_microusd=${previousBudget.monthly_cap_microusd},
      per_run_cap_microusd=${previousBudget.per_run_cap_microusd},
      input_price_per_million_microusd=${previousBudget.input_price_per_million_microusd},
      output_price_per_million_microusd=${previousBudget.output_price_per_million_microusd},
      web_search_price_microusd_per_call=${previousBudget.web_search_price_microusd_per_call} WHERE id=1`;
    await sql.end({ timeout: 5 });
  }
});

test("Agent HQ supervisor blocks a parent when QA does not PASS", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 3, idle_timeout: 5 });
  let parentId;
  try {
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Supervisor REVISE " + randomUUID()},'Reject QA','Blocked','integration-test','review')
      RETURNING id`;
    parentId = parent.id;
    const [specialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${parentId},'seo','Completed specialist','Evidence','Evidence','integration-test','done')
      RETURNING id`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${specialist.id},'seo','result','Evidence','Test evidence')`;
    const first = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const [qa] = await sql`SELECT id FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${qa.id}`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: REVISE\\nEvidence missing')`;
    const second = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const [blocked] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
    assert.equal(blocked.status, "blocked");
  } finally {
    if (parentId) await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    await sql.end({ timeout: 5 });
  }
});

test("Agent HQ approval CLI lists, approves and rejects pending requests exactly once", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 3, idle_timeout: 5 });
  const marker = randomUUID();
  const taskIds = [];
  const approvalIds = [];
  try {
    for (const action of ["publish_site", "launch_ad"]) {
      const [task] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by)
        VALUES ('coordinator',${"Approval CLI " + marker},'Test approval','Audit record','integration-test')
        RETURNING id`;
      taskIds.push(task.id);
      const [approval] = await sql`INSERT INTO agent_approvals
        (task_id,action,requested_by,payload,status)
        VALUES (${task.id},${action},'integration-test',${JSON.stringify({reason:marker})}::jsonb,'pending')
        RETURNING id`;
      approvalIds.push(approval.id);
    }
    const listed = runNode("scripts/agent-hq-bus.mjs", ["approvals"], { AGENT_HQ_OPERATOR_DATABASE_URL: operatorUrl });
    assert.equal(listed.status, 0, listed.stderr || listed.stdout);
    assert.ok(listed.stdout.includes(String(approvalIds[0])));
    assert.ok(listed.stdout.includes(String(approvalIds[1])));

    assert.ok(operatorUrl, "Missing isolated agent_operator test login");
    const approved = runNode("scripts/agent-hq-bus.mjs", ["approve", String(approvalIds[0]), "approved in disposable test"], { AGENT_HQ_OPERATOR_DATABASE_URL: operatorUrl });
    assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    assert.match(approved.stdout, /"status": "approved"/);
    const rejected = runNode("scripts/agent-hq-bus.mjs", ["reject", String(approvalIds[1]), "rejected in disposable test"], { AGENT_HQ_OPERATOR_DATABASE_URL: operatorUrl });
    assert.equal(rejected.status, 0, rejected.stderr || rejected.stdout);
    assert.match(rejected.stdout, /"status": "rejected"/);

    const secondDecision = runNode("scripts/agent-hq-bus.mjs", ["approve", String(approvalIds[0]), "must fail"], { AGENT_HQ_OPERATOR_DATABASE_URL: operatorUrl });
    assert.notEqual(secondDecision.status, 0, "A decided approval must not be decided again.");
    const rows = await sql`SELECT id,status,decided_by FROM agent_approvals WHERE id = ANY(${approvalIds}::bigint[]) ORDER BY id`;
    assert.equal(rows.find(row => String(row.id) === String(approvalIds[0])).status, "approved");
    assert.equal(rows.find(row => String(row.id) === String(approvalIds[1])).status, "rejected");
    assert.ok(rows.every(row => row.decided_by === `uid:${process.getuid()}`));
  } finally {
    if (approvalIds.length) await sql`DELETE FROM agent_approvals WHERE id = ANY(${approvalIds}::bigint[])`;
    if (taskIds.length) await sql`DELETE FROM agent_tasks WHERE id = ANY(${taskIds}::bigint[])`;
    await sql.end({ timeout: 5 });
  }
});

test("Agent HQ worker refuses all model calls while the budget is disabled", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(seoUrl, "Missing isolated SEO worker login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 5 });
  const marker = randomUUID();
  let taskId;
  try {
    await sql`UPDATE agent_budget_config SET enabled=false,daily_cap_microusd=0,
      monthly_cap_microusd=0,per_run_cap_microusd=0 WHERE id=1`;
    const [task] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by)
      VALUES ('seo',${"Budget fail-closed " + marker},'Must not call model','No-op','integration-test')
      RETURNING id`;
    taskId = task.id;
    const child = spawnSync(process.execPath, ["scripts/agent-hq-worker.mjs", "--once"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: seoUrl,
        AGENT_ROLE: "seo",
        OPENAI_API_KEY: "test-key-must-never-be-used",
        AGENT_MODEL: "gpt-4.1-mini",
        AGENT_WEB_SEARCH_ENABLED: "false"
      }
    });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Agent budget is disabled or has zero caps/);
    const [untouched] = await sql`SELECT status,attempts FROM agent_tasks WHERE id=${taskId}`;
    const runs = await sql`SELECT id FROM agent_runs WHERE task_id=${taskId}`;
    assert.equal(untouched.status, "queued");
    assert.equal(untouched.attempts, 0);
    assert.equal(runs.length, 0, "No model run may be recorded or started");
  } finally {
    if (taskId) await sql`DELETE FROM agent_tasks WHERE id=${taskId}`;
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ supervisor does not create duplicate QA tasks on repeated passes", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 3, idle_timeout: 5 });
  let parentId;
  try {
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Supervisor idempotency " + randomUUID()},'Check repeated supervisor passes','One QA task','integration-test','review')
      RETURNING id`;
    parentId = parent.id;
    const [specialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${parentId},'seo','Completed specialist','Evidence','Evidence','integration-test','done')
      RETURNING id`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${specialist.id},'seo','result','Evidence','Idempotency test evidence')`;

    for (let pass = 0; pass < 2; pass++) {
      const result = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    const qaRows = await sql`SELECT id,status FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    assert.equal(qaRows.length, 1, "Repeated supervisor passes must preserve exactly one QA task.");
    assert.equal(qaRows[0].status, "queued");
  } finally {
    if (parentId) await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    await sql.end({ timeout: 5 });
  }
});

test("Agent HQ supervisor blocks parent when completed QA has no explicit verdict", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 3, idle_timeout: 5 });
  let parentId;
  try {
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Supervisor missing verdict " + randomUUID()},'Require explicit QA verdict','Blocked','integration-test','review')
      RETURNING id`;
    parentId = parent.id;
    const [specialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${parentId},'seo','Completed specialist','Evidence','Evidence','integration-test','done')
      RETURNING id`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${specialist.id},'seo','result','Evidence','Evidence without a verdict')`;
    const first = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const [qa] = await sql`SELECT id FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    assert.ok(qa, "Supervisor must create the QA task.");
    await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${qa.id}`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${qa.id},'qa_security','review','QA without verdict','Review complete, but no PASS or REVISE marker.')`;
    const second = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const [blocked] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
    assert.equal(blocked.status, "blocked", "Missing or ambiguous QA verdict must fail closed.");
  } finally {
    if (parentId) await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    await sql.end({ timeout: 5 });
  }
});

test("Agent HQ supervisor recovers expired worker leases without enabling workers", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 5 });
  let taskId;
  try {
    const [task] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status,attempts,max_attempts,lease_owner,lease_until)
      VALUES ('seo',${"Expired lease " + randomUUID()},'Recover stale lease','Queued again','integration-test','running',1,3,'stale-worker',now()-interval '5 minutes')
      RETURNING id`;
    taskId = task.id;
    const result = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const [recovered] = await sql`SELECT status,lease_owner,lease_until FROM agent_tasks WHERE id=${taskId}`;
    assert.equal(recovered.status, "queued");
    assert.equal(recovered.lease_owner, null);
    assert.equal(recovered.lease_until, null);
  } finally {
    if (taskId) await sql`DELETE FROM agent_tasks WHERE id=${taskId}`;
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ concurrent supervisors create one QA task and one scoped grant", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 });
  const marker = randomUUID();
  let parentId;
  let specialistId;
  try {
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Concurrent supervisor " + marker},'Serialize concurrent lifecycle passes','One QA task','integration-test','review')
      RETURNING id`;
    parentId = parent.id;
    const [specialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${parentId},'seo','Completed specialist','Evidence','Evidence','integration-test','done')
      RETURNING id`;
    specialistId = specialist.id;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${specialistId},'seo','result','Evidence','Concurrent supervisor evidence')`;

    const results = await Promise.all([
      runNodeAsync("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl, AGENT_SUPERVISOR_ID: "ci-supervisor-a" }),
      runNodeAsync("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl, AGENT_SUPERVISOR_ID: "ci-supervisor-b" })
    ]);
    for (const result of results) assert.equal(result.status, 0, result.stderr || result.stdout);

    const qaRows = await sql`SELECT id,status FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    assert.equal(qaRows.length, 1, "Concurrent supervisor passes must create exactly one QA task.");
    const grants = await sql`SELECT task_id,principal,access_reason FROM agent_task_access
      WHERE task_id=${specialistId} AND principal='qa_security' AND access_reason='qa_review'`;
    assert.equal(grants.length, 1, "Concurrent supervisor passes must issue exactly one QA grant.");
  } finally {
    if (parentId) {
      await sql`DELETE FROM agent_tasks WHERE parent_task_id=${parentId}`;
      await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    }
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ supervisor blocks QA REVISE and exhausted specialist work", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 5, idle_timeout: 5 });
  const marker = randomUUID();
  const parentIds = [];
  try {
    const [reviseParent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"QA revise " + marker},'Require revision','Blocked','integration-test','review')
      RETURNING id`;
    parentIds.push(reviseParent.id);
    const [reviseSpecialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${reviseParent.id},'seo','Specialist output','Evidence','Evidence','integration-test','done')
      RETURNING id`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${reviseSpecialist.id},'seo','result','Evidence','Finding requires correction')`;
    const [qa] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${reviseParent.id},'qa_security','QA review','Review evidence','Verdict','supervisor','done')
      RETURNING id`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: REVISE\\nMissing evidence and unsupported conclusion')`;

    const [deadParent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,status)
      VALUES ('coordinator',${"Dead letter " + marker},'Handle exhausted specialist','Blocked','integration-test','review')
      RETURNING id`;
    parentIds.push(deadParent.id);
    await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status,attempts,max_attempts)
      VALUES (${deadParent.id},'web_engineer','Exhausted task','Complete work','Evidence','integration-test','dead_letter',3,3)
      RETURNING id`;

    const result = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const [reviseState] = await sql`SELECT status FROM agent_tasks WHERE id=${reviseParent.id}`;
    assert.equal(reviseState.status, "blocked", "QA REVISE must block the parent.");
    const [objection] = await sql`SELECT kind,body FROM agent_messages
      WHERE task_id=${reviseParent.id} AND to_role='coordinator' AND kind='objection'
      ORDER BY created_at DESC LIMIT 1`;
    assert.ok(objection, "QA REVISE must notify the coordinator.");
    assert.ok(objection.body.includes("VERDICT: REVISE"), "Supervisor must preserve the explicit QA REVISE verdict in its objection.");

    const [deadState] = await sql`SELECT status FROM agent_tasks WHERE id=${deadParent.id}`;
    assert.equal(deadState.status, "blocked", "Dead-letter specialist work must block the parent.");
    const [deadNotice] = await sql`SELECT kind,body FROM agent_messages
      WHERE task_id=${deadParent.id} AND to_role='coordinator' AND kind='status'
      ORDER BY created_at DESC LIMIT 1`;
    assert.ok(deadNotice, "Dead-letter outcome must notify the coordinator.");
  } finally {
    for (const id of parentIds) {
      await sql`DELETE FROM agent_tasks WHERE parent_task_id=${id}`;
      await sql`DELETE FROM agent_tasks WHERE id=${id}`;
    }
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ bus send derives sender from authenticated PostgreSQL LOGIN", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(seoUrl, "Missing isolated SEO PostgreSQL LOGIN.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 2, idle_timeout: 5 });
  const marker = randomUUID();
  const ownBody = "authenticated sender " + marker;
  const forgedBody = "forged sender " + marker;
  const probeBody = "direct RLS probe " + marker;
  let taskId;
  try {
    const [task] = await sql`INSERT INTO agent_tasks
      (title,objective,expected_output,assigned_role,created_by)
      VALUES (${"Bus sender auth " + marker},'Verify authenticated sender identity',
        'A message from the matching role','seo','owner')
      RETURNING id`;
    taskId = task.id;
    const seo = postgres(seoUrl, { max: 1, idle_timeout: 5 });
    try {
      const [identity] = await seo`SELECT session_user AS login, public.agent_role_for_session() AS role`;
      assert.equal(identity.login, "agent_seo");
      assert.equal(identity.role, "seo");
      const visibleTask = await seo`SELECT id,assigned_role FROM agent_tasks WHERE id=${taskId}`;
      assert.equal(visibleTask.length, 1, "SEO LOGIN must see its own task before sending a task-scoped message.");
      assert.equal(visibleTask[0].assigned_role, "seo");
      const [policyProbe] = await seo`SELECT
        public.agent_role_for_session() AS mapped_role,
        EXISTS (SELECT 1 FROM public.agent_tasks WHERE id=${taskId} AND assigned_role='seo') AS owns_task`;
      assert.equal(policyProbe.mapped_role, "seo");
      assert.equal(policyProbe.owns_task, true);
      await seo`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${taskId},${randomUUID()},'seo','coordinator','status',${probeBody},${randomUUID()})`;
      await seo`DELETE FROM agent_messages WHERE body=${probeBody}`.catch(() => {});
    } finally {
      await seo.end({ timeout: 5 });
    }
    const own = runNode("scripts/agent-hq-bus.mjs", ["send","seo","coordinator",String(taskId),"status",ownBody], { DATABASE_URL: seoUrl });
    assert.equal(own.status, 0, own.stderr || own.stdout);
    const forged = runNode("scripts/agent-hq-bus.mjs", ["send","coordinator","seo",String(taskId),"status",forgedBody], { DATABASE_URL: seoUrl });
    assert.notEqual(forged.status, 0, "A worker must not claim another role as the sender.");
    assert.match(forged.stderr, /authenticated PostgreSQL LOGIN/i);
    const rows = await sql`SELECT id,task_id,from_role,to_role FROM agent_messages WHERE body=${ownBody}`;
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].task_id), String(taskId));
    assert.equal(rows[0].from_role, "seo");
    assert.equal(rows[0].to_role, "coordinator");
  } finally {
    await sql`DELETE FROM agent_messages WHERE body IN (${ownBody},${forgedBody},${probeBody})`;
    if (taskId) await sql`DELETE FROM agent_tasks WHERE id=${taskId}`;
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ supervisor rejects a non-supervisor PostgreSQL LOGIN", {
  skip: !seoUrl
}, () => {
  const result = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: seoUrl });
  assert.notEqual(result.status, 0, "Supervisor must reject a worker login before lifecycle SQL.");
  assert.match(result.stderr, /must authenticate as PostgreSQL LOGIN "agent_supervisor"/i);
});


test("Agent HQ supervisor blocks expired leases with active or unknown provider reservations", async () => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.ok(supervisorUrl, "Missing isolated supervisor test login.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 });
  const marker = randomUUID();
  const fixtures = [];
  try {
    for (const state of ["active", "unknown"]) {
      const [task] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,status,attempts,max_attempts,lease_owner,lease_until)
        VALUES ('seo',${"Crash recovery " + state + " " + marker},'Simulate worker crash after possible provider call',
          'Must be blocked for reconciliation','integration-test','running',1,3,${"crashed-" + state},now()-interval '5 minutes')
        RETURNING id`;
      const [run] = await sql`INSERT INTO agent_runs
        (task_id,role,worker_id,provider,model,status,cost_microusd)
        VALUES (${task.id},'seo',${"crashed-" + state},'test_stub','test-model','failed',0)
        RETURNING id`;
      const [reservation] = await sql`INSERT INTO agent_budget_reservations
        (run_id,task_id,role,worker_id,idempotency_key,reserved_microusd,price_snapshot,day_key,month_key,state)
        VALUES (${run.id},${task.id},'seo',${"crashed-" + state},${"crash-" + state + "-" + marker},
          10000,${JSON.stringify({pricing_version:"test-v1",input_price:100000,output_price:100000,search_price:0,
            estimated_input_tokens:10000,max_output_tokens:256,max_turns:1,max_search_calls:0,model:"test-model",provider:"test_stub"})}::jsonb,
          CURRENT_DATE,date_trunc('month',now())::date,${state}) RETURNING id`;
      await sql`INSERT INTO agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
        VALUES (${reservation.id},${"crash-event-" + state + "-" + marker},${state === "active" ? "reserved" : "unknown"},
          10000,'{}'::jsonb)`;
      fixtures.push({taskId:task.id,runId:run.id,reservationId:reservation.id,state});
    }
    const result = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const fixture of fixtures) {
      const [task] = await sql`SELECT status,lease_owner,lease_until FROM agent_tasks WHERE id=${fixture.taskId}`;
      assert.equal(task.status,"blocked",fixture.state + " reservation must prevent automatic retry");
      assert.equal(task.lease_owner,null);
      assert.equal(task.lease_until,null);
      const [reservation] = await sql`SELECT state FROM agent_budget_reservations WHERE id=${fixture.reservationId}`;
      assert.equal(reservation.state,fixture.state,"Supervisor must not release or rewrite financial state");
      const [message] = await sql`SELECT body FROM agent_messages
        WHERE task_id=${fixture.taskId} AND to_role='coordinator' AND idempotency_key=${"budget-recovery-" + fixture.taskId}`;
      assert.ok(message?.body.includes("operator reconciliation"),"Coordinator must be notified of the reconciliation gate");
    }
  } finally {
    for (const fixture of fixtures) {
      await sql`DELETE FROM agent_budget_ledger WHERE reservation_id=${fixture.reservationId}`;
      await sql`DELETE FROM agent_budget_settlements WHERE reservation_id=${fixture.reservationId}`;
      await sql`DELETE FROM agent_budget_reservations WHERE id=${fixture.reservationId}`;
      await sql`DELETE FROM agent_runs WHERE id=${fixture.runId}`;
      await sql`DELETE FROM agent_tasks WHERE id=${fixture.taskId}`;
    }
    await sql.end({ timeout: 5 });
  }
});
