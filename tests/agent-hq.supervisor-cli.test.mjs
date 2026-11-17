import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const databaseUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const supervisorUrl = process.env.AGENT_HQ_ROLE_TEST_URL_SUPERVISOR;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runNode = (script, args = [], overrides = {}) => spawnSync(process.execPath, [script, ...args], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl, AGENT_HQ_TEST_APPROVER_UIDS: String(process.getuid?.() ?? ""), ...overrides }
});

test("Agent HQ supervisor executes the real parent → QA → consolidation lifecycle", async t => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  assert.ok(supervisorUrl, "Set AGENT_HQ_ROLE_TEST_URL_SUPERVISOR for the restricted supervisor login.");
  const supervisorIdentity = postgres(supervisorUrl, { max: 1 });
  const [identity] = await supervisorIdentity`SELECT session_user AS login`;
  assert.equal(identity.login, "agent_supervisor", "Supervisor E2E must use the dedicated PostgreSQL login.");
  await supervisorIdentity.end();
  const sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 });
  const marker = randomUUID();
  let parentId;
  try {
    const [parent] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,acceptance_criteria,created_by,status)
      VALUES ('coordinator',${"Supervisor E2E " + marker},'Verify real supervisor lifecycle','Consolidated result',
        '["specialist evidence included","QA verdict PASS"]'::jsonb,'integration-test','review')
      RETURNING id`;
    parentId = parent.id;
    const [specialist] = await sql`INSERT INTO agent_tasks
      (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
      VALUES (${parentId},'seo','Specialist evidence','Produce evidence','Evidence','integration-test','done')
      RETURNING id`;
    const evidence = `Verified specialist evidence ${marker}`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${specialist.id},'seo','result','SEO evidence',${evidence})`;

    const first = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const [qa] = await sql`SELECT id,status FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    assert.ok(qa, "Supervisor must create an independent QA task.");
    assert.equal(qa.status, "queued");
    const grants = await sql`SELECT task_id,principal,access_reason FROM agent_task_access
      WHERE task_id=${specialist.id} ORDER BY principal`;
    assert.ok(grants.some(row => row.principal === "coordinator" && row.access_reason === "coordinator_oversight"),
      "Supervisor must grant coordinator scoped access to the specialist task");
    assert.ok(grants.some(row => row.principal === "qa_security" && row.access_reason === "qa_review"),
      "Supervisor must grant QA scoped access to specialist artifacts");

    await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${qa.id}`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: PASS\\nAcceptance criteria verified')`;

    const second = runNode("scripts/agent-hq-supervisor.mjs", ["--once"], { DATABASE_URL: supervisorUrl });
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const [completed] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
    assert.equal(completed.status, "done");
    const [artifact] = await sql`SELECT content FROM agent_artifacts
      WHERE task_id=${parentId} AND artifact_type='consolidated'`;
    assert.ok(artifact);
    assert.match(artifact.content, new RegExp("Verified specialist evidence " + marker));
    assert.match(artifact.content, /VERDICT: PASS/);
  } finally {
    if (parentId) await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
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
    const first = runNode("scripts/agent-hq-supervisor.mjs", ["--once"]);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const [qa] = await sql`SELECT id FROM agent_tasks
      WHERE parent_task_id=${parentId} AND assigned_role='qa_security'`;
    await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${qa.id}`;
    await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
      VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: REVISE\\nEvidence missing')`;
    const second = runNode("scripts/agent-hq-supervisor.mjs", ["--once"]);
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
    const listed = runNode("scripts/agent-hq-bus.mjs", ["approvals"]);
    assert.equal(listed.status, 0, listed.stderr || listed.stdout);
    assert.ok(listed.stdout.includes(String(approvalIds[0])));
    assert.ok(listed.stdout.includes(String(approvalIds[1])));

    const approved = runNode("scripts/agent-hq-bus.mjs", ["approve", String(approvalIds[0]), "approved in disposable test"]);
    assert.equal(approved.status, 0, approved.stderr || approved.stdout);
    assert.match(approved.stdout, /"status": "approved"/);
    const rejected = runNode("scripts/agent-hq-bus.mjs", ["reject", String(approvalIds[1]), "rejected in disposable test"]);
    assert.equal(rejected.status, 0, rejected.stderr || rejected.stdout);
    assert.match(rejected.stdout, /"status": "rejected"/);

    const secondDecision = runNode("scripts/agent-hq-bus.mjs", ["approve", String(approvalIds[0]), "must fail"]);
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
        DATABASE_URL: databaseUrl,
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
