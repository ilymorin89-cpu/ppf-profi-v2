import assert from "node:assert/strict";
import postgres from "postgres";

const databaseUrl = process.env.STAGING_DATABASE_URL;
const expectedDatabase = process.env.AGENT_HQ_STAGING_DATABASE || "agent_hq_staging";
assert.ok(databaseUrl, "STAGING_DATABASE_URL is required; never use the production DATABASE_URL");
assert.equal(expectedDatabase, "agent_hq_staging", "The staging preflight is pinned to database agent_hq_staging");

const parsed = new URL(databaseUrl);
assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol), "STAGING_DATABASE_URL must be a valid PostgreSQL URL");
assert.equal(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")), expectedDatabase, "Refusing a database name other than agent_hq_staging");
assert.equal(decodeURIComponent(parsed.username), "agent_supervisor", "Use the dedicated agent_supervisor LOGIN; do not use a superuser or shared migration account");

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 8, idle_timeout: 5, ssl: "require" });
try {
  const [identity] = await sql`
    SELECT current_database() AS database_name, session_user AS login,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS tls
  `;
  assert.equal(identity.database_name, expectedDatabase, "Connected database is not the dedicated staging database");
  assert.equal(identity.login, "agent_supervisor", "Preflight must use the dedicated supervisor LOGIN");
  assert.equal(identity.tls, true, "TLS must be active for staging PostgreSQL");
  const [row] = await sql`SELECT public.agent_hq_monitor_snapshot() AS snapshot`;
  assert.ok(row?.snapshot, "Read-only monitoring migration 0011 is missing");
  const snapshot = row.snapshot;
  const budget = snapshot.budget;
  const principals = snapshot.principals;
  const privileged = snapshot.privileged;
  assert.ok(budget, "Agent HQ budget singleton is missing; apply migrations first");
  assert.equal(budget.enabled, false, "Staging preflight requires budget disabled");
  const expectedRoles = [
    "coordinator","web_engineer","seo","geo","growth","analytics","qa_security",
    "vk_strategist","copywriter","designer","image_generator","storyteller",
    "community_manager","content_seo","ads_manager","trend_scout",
    "auto_news_editor","auto_law_monitor","fact_checker"
  ];
  assert.deepEqual(snapshot.principals.roles, expectedRoles, "Registered worker role manifest does not match the 19 expected roles");
  assert.equal(Number(principals.total), 19, "Exactly 19 worker principals are required");
  assert.equal(Number(principals.enabled), 19, "All 19 worker principals must be enabled");
  assert.equal(Number(principals.distinct_logins), 19, "Each worker needs a distinct PostgreSQL LOGIN");
  assert.equal(Number(principals.distinct_worker_ids), 19, "Each worker needs a distinct immutable worker ID");
  assert.equal(principals.safe_login_flags, true, "Worker LOGINs must be non-superuser, NOINHERIT and least-privilege");
  assert.equal(Number(privileged.safe_supervisor_operator_logins), 2, "Dedicated safe supervisor and operator LOGINs must exist");
  assert.equal(Number(privileged.safe_function_owners), 3, "Budget, runtime and monitor function-owner roles must be NOLOGIN and least-privilege");
  assert.equal(Number(privileged.login_memberships), 0, "Worker, supervisor and operator LOGINs must not inherit role memberships");
  console.log(JSON.stringify({
    result:"PASS",
    environment:"staging-preflight-only",
    database:identity.database_name,
    tls:identity.tls,
    registeredWorkers:Number(principals.total),
    distinctLogins:Number(principals.distinct_logins),
    supervisorAndOperatorLogins:Number(privileged.safe_supervisor_operator_logins),
    functionOwnerRoles:Number(privileged.safe_function_owners),
    budgetEnabled:budget.enabled,
    paidCallsMade:0
  },null,2));
} finally {
  await sql.end({ timeout: 5 });
}
