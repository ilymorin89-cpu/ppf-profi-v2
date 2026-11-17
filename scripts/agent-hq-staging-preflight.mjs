import assert from "node:assert/strict";
import postgres from "postgres";

const databaseUrl = process.env.STAGING_DATABASE_URL;
const expectedDatabase = process.env.AGENT_HQ_STAGING_DATABASE || "agent_hq_staging";
assert.ok(databaseUrl, "STAGING_DATABASE_URL is required; never use the production DATABASE_URL");
assert.equal(expectedDatabase, "agent_hq_staging", "The staging preflight is pinned to database agent_hq_staging");

const parsed = new URL(databaseUrl);
assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol), "STAGING_DATABASE_URL must be a PostgreSQL URL");
assert.ok(parsed.hostname && !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), "Staging must use its dedicated remote PostgreSQL endpoint");
assert.equal(decodeURIComponent(parsed.pathname.replace(/^\/+/, "")), expectedDatabase, "Refusing a database name other than agent_hq_staging");

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 8, idle_timeout: 5, ssl: "require" });
const expectedRoles = [
  "coordinator","web_engineer","seo","geo","growth","analytics","qa_security",
  "vk_strategist","copywriter","designer","image_generator","storyteller",
  "community_manager","content_seo","ads_manager","trend_scout",
  "auto_news_editor","auto_law_monitor","fact_checker"
];

try {
  const [identity] = await sql`
    SELECT current_database() AS database_name, session_user AS login,
      current_user AS effective_user,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS tls
  `;
  assert.equal(identity.database_name, expectedDatabase, "Connected database is not the dedicated staging database");
  assert.equal(identity.tls, true, "TLS must be active for staging PostgreSQL");
  const [budget] = await sql`
    SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd
    FROM public.agent_budget_config WHERE id=1
  `;
  assert.ok(budget, "Agent HQ budget singleton is missing; apply migrations first");
  assert.equal(budget.enabled, false, "Staging preflight requires budget disabled");
  const principals = await sql`
    SELECT p.login_role,p.role,p.worker_id,p.enabled,
      r.rolcanlogin,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolinherit,r.rolbypassrls
    FROM public.agent_worker_principals p
    LEFT JOIN pg_roles r ON r.rolname=p.login_role
    ORDER BY p.role
  `;
  assert.equal(principals.length, expectedRoles.length, "Exactly 19 registered worker principals are required");
  assert.deepEqual(principals.map(p=>p.role).sort(), [...expectedRoles].sort(), "Registered roles do not match the 19-role manifest");
  assert.ok(principals.every(p=>p.enabled), "Every worker principal must be enabled");
  assert.ok(principals.every(p=>p.rolcanlogin && !p.rolsuper && !p.rolcreatedb && !p.rolcreaterole && !p.rolinherit && !p.rolbypassrls),
    "Worker LOGINs must be least-privilege, non-inheriting LOGINs");
  assert.equal(new Set(principals.map(p=>p.login_role)).size, 19, "Each worker needs a distinct PostgreSQL LOGIN");
  assert.equal(new Set(principals.map(p=>p.worker_id)).size, 19, "Each worker needs a distinct immutable worker ID");
  const [privileged] = await sql`
    SELECT
      count(*) FILTER (WHERE rolname IN ('agent_supervisor','agent_operator') AND rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) AS valid_privileged_logins,
      count(*) FILTER (WHERE rolname IN ('agent_hq_budget_owner','agent_hq_runtime_fn_owner') AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls) AS valid_function_owners
    FROM pg_roles
  `;
  assert.equal(Number(privileged.valid_privileged_logins), 2, "Dedicated safe supervisor and operator LOGINs must exist");
  assert.equal(Number(privileged.valid_function_owners), 2, "Function-owner roles must be NOLOGIN and least-privilege");
  const [memberships] = await sql`
    SELECT count(*)::int AS count
    FROM pg_auth_members m
    JOIN pg_roles member ON member.oid=m.member
    WHERE member.rolname = ANY(${sql.array([...principals.map(p=>p.login_role),"agent_supervisor","agent_operator"])})
  `;
  assert.equal(memberships.count, 0, "Worker, supervisor and operator LOGINs must not inherit role memberships");
  console.log(JSON.stringify({
    result:"PASS",
    environment:"staging-preflight-only",
    database:identity.database_name,
    tls:identity.tls,
    registeredWorkers:principals.length,
    distinctLogins:19,
    supervisorAndOperatorLogins:2,
    functionOwnerRoles:2,
    budgetEnabled:budget.enabled,
    paidCallsMade:0
  },null,2));
} finally {
  await sql.end({ timeout: 5 });
}
