import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.AGENT_HQ_TEST_DATABASE_URL;
const marker = process.env.AGENT_HQ_TEST_MARKER || "agent_hq_19role_e2e";
const timeoutMs = Number(process.env.AGENT_HQ_TEST_TIMEOUT_MS || 120000);
assert.ok(url, "AGENT_HQ_TEST_DATABASE_URL is required");
const parsed = new URL(url);
assert.equal(parsed.hostname, "postgres", "E2E assertion must use the isolated Compose database service");
assert.equal(decodeURIComponent(parsed.pathname.slice(1)), "agent_hq_test", "E2E assertion must target agent_hq_test");
assert.equal(decodeURIComponent(parsed.username), "agent_test", "E2E assertion must use disposable owner login");

const expectedRoles = [
  "coordinator","web_engineer","seo","geo","growth","analytics","qa_security",
  "vk_strategist","copywriter","designer","image_generator","storyteller",
  "community_manager","content_seo","ads_manager","trend_scout",
  "auto_news_editor","auto_law_monitor","fact_checker"
];
const sql = postgres(url, { max: 1, connect_timeout: 5 });
const deadline = Date.now() + timeoutMs;
let rows = [];
try {
  while (Date.now() < deadline) {
    rows = await sql`
      SELECT t.assigned_role,t.status,
        r.provider,r.status AS run_status,r.cost_microusd,
        count(DISTINCT a.id)::int AS artifact_count,
        max(br.state) AS reservation_state,
        max(bs.actual_cost_microusd) AS actual_cost_microusd
      FROM agent_tasks t
      LEFT JOIN agent_runs r ON r.task_id=t.id
      LEFT JOIN agent_artifacts a ON a.task_id=t.id
      LEFT JOIN agent_budget_reservations br ON br.task_id=t.id
      LEFT JOIN agent_budget_settlements bs ON bs.reservation_id=br.id
      WHERE t.created_by=${marker}
      GROUP BY t.id,r.id
      ORDER BY t.assigned_role`;
    const complete = rows.length === expectedRoles.length && rows.every(row =>
      ["done","review"].includes(row.status) &&
      row.provider === "test_stub" &&
      row.run_status === "succeeded" &&
      Number(row.cost_microusd) === 0 &&
      Number(row.artifact_count) >= 1 &&
      row.reservation_state === "settled" &&
      Number(row.actual_cost_microusd) === 0
    );
    if (complete) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  assert.equal(rows.length, expectedRoles.length,
    "All 19 role-specific test tasks must exist and be observed");
  const actualRoles = rows.map(row => row.assigned_role).sort();
  assert.deepEqual(actualRoles, [...expectedRoles].sort(),
    "Every expected worker role must have exactly one task");
  for (const row of rows) {
    assert.ok(["done","review"].includes(row.status), row.assigned_role + " task did not complete");
    assert.equal(row.provider, "test_stub", row.assigned_role + " must use only deterministic fixture mode");
    assert.equal(row.run_status, "succeeded", row.assigned_role + " run must succeed");
    assert.equal(Number(row.cost_microusd), 0, row.assigned_role + " cost must be zero");
    assert.ok(Number(row.artifact_count) >= 1, row.assigned_role + " must persist an artifact");
    assert.equal(row.reservation_state, "settled", row.assigned_role + " reservation must settle");
    assert.equal(Number(row.actual_cost_microusd), 0, row.assigned_role + " settlement must be zero");
  }

  const [open] = await sql`
    SELECT count(*)::int AS count
    FROM agent_budget_reservations r
    JOIN agent_tasks t ON t.id=r.task_id
    WHERE t.created_by=${marker} AND r.state IN ('active','unknown')`;
  assert.equal(open.count, 0, "No active/unknown reservation may remain after the test");
  console.log(JSON.stringify({
    result: "PASS",
    test: "all-19-worker-container-no-spend",
    roles: rows.length,
    successfulRuns: rows.filter(row => row.run_status === "succeeded").length,
    persistedArtifacts: rows.reduce((sum,row) => sum + Number(row.artifact_count),0),
    totalActualCostMicrousd: rows.reduce((sum,row) => sum + Number(row.actual_cost_microusd),0),
    openReservations: open.count,
    evidence: rows.map(row => ({ role: row.assigned_role, taskStatus: row.status, provider: row.provider, costMicrousd: Number(row.cost_microusd) }))
  }, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
