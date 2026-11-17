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
  const [budget] = await sql`
    SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd
    FROM public.agent_budget_config WHERE id=1
  `;
  record("budget_config", Boolean(budget) && (!budget.enabled ||
    (Number(budget.daily_cap_microusd)>0 && Number(budget.monthly_cap_microusd)>0 && Number(budget.per_run_cap_microusd)>0)),
    budget ? { enabled:budget.enabled,dailyCapMicrousd:Number(budget.daily_cap_microusd),
      monthlyCapMicrousd:Number(budget.monthly_cap_microusd),perRunCapMicrousd:Number(budget.per_run_cap_microusd) } : "missing");
  const [principals] = await sql`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE enabled)::int AS enabled,
      count(DISTINCT login_role)::int AS logins,
      count(DISTINCT worker_id)::int AS worker_ids
    FROM public.agent_worker_principals
  `;
  record("worker_principals", principals.total===19 && principals.enabled===19 &&
    principals.logins===19 && principals.worker_ids===19, principals);
  const [tasks] = await sql`
    SELECT count(*) FILTER (WHERE status='queued')::int AS queued,
      count(*) FILTER (WHERE status IN ('claimed','running'))::int AS active,
      count(*) FILTER (WHERE status='review')::int AS review,
      count(*) FILTER (WHERE status='dead_letter')::int AS dead_letter,
      count(*) FILTER (WHERE status IN ('claimed','running') AND lease_until < now())::int AS expired_leases
    FROM public.agent_tasks
  `;
  record("expired_leases", tasks.expired_leases===0, tasks.expired_leases);
  const [reservations] = await sql`
    SELECT count(*) FILTER (WHERE state='unknown')::int AS unknown,
      count(*) FILTER (WHERE state='active')::int AS active
    FROM public.agent_budget_reservations
  `;
  record("unknown_reservations", reservations.unknown===0, reservations.unknown);
  const result = {
    service:"ppf-agent-hq-staging-monitor",
    status:critical ? "CRITICAL" : "OK",
    checkedAt:new Date().toISOString(),
    environment:"staging",
    paidCallsMade:0,
    checks,
    workload:{ queued:tasks.queued,active:tasks.active,review:tasks.review,deadLetter:tasks.dead_letter },
    reservations:{ active:reservations.active,unknown:reservations.unknown }
  };
  console.log(JSON.stringify(result,null,2));
  if (critical) process.exitCode=2;
} finally {
  await sql.end({ timeout:5 });
}
