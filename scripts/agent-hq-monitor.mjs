import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
assert.ok(url, "DATABASE_URL is required");
const parsed = new URL(url);
assert.equal(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")), "agent_hq_staging",
  "Monitor is pinned to the dedicated staging database");
const sql = postgres(url, { max: 1, connect_timeout: 8, idle_timeout: 5, ssl: "require" });
const checks = [];
let critical = false;
function record(name, ok, detail) {
  checks.push({ name, status: ok ? "ok" : "critical", detail });
  if (!ok) critical = true;
}
try {
  const [identity] = await sql`
    SELECT current_database() AS database_name,session_user AS login,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS tls
  `;
  record("database", identity.database_name === "agent_hq_staging", identity.database_name);
  record("supervisor_login", identity.login === "agent_supervisor", identity.login);
  record("postgres_tls", identity.tls === true, identity.tls);
  const [snapshotRow] = await sql`SELECT public.agent_hq_monitor_snapshot() AS snapshot`;
  assert.ok(snapshotRow?.snapshot, "Read-only monitoring snapshot function is missing; apply migration 0011");
  const snapshot = snapshotRow.snapshot;
  const budget = snapshot.budget;
  const principals = snapshot.principals;
  const tasks = snapshot.tasks;
  const reservations = snapshot.reservations;
  record("budget_config", Boolean(budget) && (!budget.enabled ||
    (Number(budget.daily_cap_microusd)>0 && Number(budget.monthly_cap_microusd)>0 && Number(budget.per_run_cap_microusd)>0)),
    budget ? { enabled:budget.enabled,dailyCapMicrousd:Number(budget.daily_cap_microusd),
      monthlyCapMicrousd:Number(budget.monthly_cap_microusd),perRunCapMicrousd:Number(budget.per_run_cap_microusd) } : "missing");
  record("worker_principals", Number(principals.total)===19 && Number(principals.enabled)===19 &&
    Number(principals.distinct_logins)===19 && Number(principals.distinct_worker_ids)===19, principals);
  record("expired_leases", Number(tasks.expired_leases)===0, tasks.expired_leases);
  record("unknown_reservations", Number(reservations.unknown)===0, reservations.unknown);
  const result = {
    service:"ppf-agent-hq-staging-monitor",
    status:critical ? "CRITICAL" : "OK",
    checkedAt:new Date().toISOString(),
    environment:"staging",
    paidCallsMade:0,
    checks,
    workload:{ queued:Number(tasks.queued),active:Number(tasks.active),review:Number(tasks.review),deadLetter:Number(tasks.dead_letter) },
    reservations:{ active:Number(reservations.active),unknown:Number(reservations.unknown) }
  };
  console.log(JSON.stringify(result,null,2));
  if (critical) process.exitCode=2;
} finally {
  await sql.end({ timeout:5 });
}
