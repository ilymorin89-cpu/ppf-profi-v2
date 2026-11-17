import { spawnSync } from "node:child_process";
import postgres from "postgres";

const workerRoles = [
  "coordinator", "web_engineer", "seo", "geo", "growth", "analytics", "qa_security",
  "vk_strategist", "copywriter", "designer", "image_generator", "storyteller",
  "community_manager", "content_seo", "ads_manager", "trend_scout",
  "auto_news_editor", "auto_law_monitor", "fact_checker"
];
const groups = {
  core: ["coordinator", "seo", "qa_security", "supervisor"],
  research: ["coordinator", "web_engineer", "seo", "geo", "analytics", "trend_scout", "fact_checker", "auto_law_monitor", "qa_security", "supervisor"],
  all: [...workerRoles, "supervisor"]
};
// Only identities covered by the disposable role-isolation suite are eligible for launch.
// This is a preflight guard, NOT proof that production RLS has been installed.
const auditedLogins = Object.freeze(Object.fromEntries([
  ...workerRoles.map(role => [role, "agent_" + role]),
  ["supervisor", "agent_supervisor"]
]));

const roleEnv = Object.freeze(Object.fromEntries([
  ...workerRoles.map(role => [role, "AGENT_HQ_DATABASE_URL_" + role.toUpperCase()]),
  ["supervisor", "AGENT_HQ_DATABASE_URL_SUPERVISOR"]
]));

function usage() {
  console.log([
    "Agent HQ launcher",
    "  npm run agent-hq:launch -- check [core|research|all]",
    "  npm run agent-hq:launch -- start [core|research|all]",
    "  npm run agent-hq:launch -- stop [core|research|all]",
    "",
    "Default group: core. All groups require a distinct PostgreSQL LOGIN per role.",
    "Starting workers is restricted to deterministic NODE_ENV=test fixtures; no live provider calls."
  ].join("\n"));
}

function compose(args) {
  const result = spawnSync("docker", ["compose", "-f", "docker-compose.yml", ...args], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function validate(group) {
  const services = groups[group];
  if (!services) throw new Error(`Unknown group "${group}". Choose: ${Object.keys(groups).join(", ")}.`);
  const unsupported = services.filter(service => !Object.hasOwn(auditedLogins, service));
  if (unsupported.length) {
    throw new Error(`Group "${group}" includes roles without audited database authorization: ${unsupported.join(", ")}. Only core is eligible for preflight; workers remain disabled until production RLS and E2E review.`);
  }
  const missing = [];
  const testStubReady = process.env.NODE_ENV === "test" && Boolean(process.env.AGENT_HQ_TEST_RESPONSES_JSON);
  if (!testStubReady && !process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!process.env.AGENT_MODEL) missing.push("AGENT_MODEL");
  if (process.env.AGENT_HQ_WORKERS_ENABLED !== "true") missing.push("AGENT_HQ_WORKERS_ENABLED=true");
  for (const service of services) {
    const key = roleEnv[service];
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length) throw new Error("Missing required settings: " + missing.join(", "));
  const identities = services.map(service => {
    const key = roleEnv[service];
    let parsed;
    try { parsed = new URL(process.env[key]); }
    catch { throw new Error(`${key} must be a valid PostgreSQL URL.`); }
    const username = parsed.username;
    if (!username) throw new Error(`${key} must include a PostgreSQL login.`);
    if (username !== auditedLogins[service]) {
      throw new Error(`${key} must use the dedicated login ${auditedLogins[service]}; shared or elevated database identities are forbidden.`);
    }
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (![ "localhost", "127.0.0.1", "::1", "host.docker.internal", "postgres" ].includes(host)) {
      throw new Error(`${key} must target a local disposable PostgreSQL host; remote database hosts are forbidden.`);
    }
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (databaseName !== "agent_hq_test") {
      throw new Error(`${key} must target the disposable database named agent_hq_test.`);
    }
    return [service, username];
  });
  const seen = new Map();
  for (const [service, username] of identities) {
    if (seen.has(username)) {
      throw new Error(`Database login reused by ${seen.get(username)} and ${service}. Use a distinct PostgreSQL login per role.`);
    }
    seen.set(username, service);
  }
  return services;
}

async function checkBudget(requireEnabled = true) {
  const url = process.env.AGENT_HQ_DATABASE_URL_COORDINATOR;
  const sql = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    const [budget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd
      FROM agent_budget_config WHERE id=1`;
    const enabled = Boolean(budget?.enabled) &&
      Number(budget?.daily_cap_microusd) > 0 &&
      Number(budget?.monthly_cap_microusd) > 0 &&
      Number(budget?.per_run_cap_microusd) > 0;
    console.log("Database reachable.");
    console.log(enabled ? "Budget is enabled with non-zero caps." : "Budget is disabled or has zero caps; workers cannot start.");
    if (requireEnabled && !enabled) {
      throw new Error("Agent budget is disabled or has zero caps. No workers were started.");
    }
  } finally {
    await sql.end({ timeout: 3 });
  }
}

const [command, requestedGroup = "core"] = process.argv.slice(2);
if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}
if (!["check", "start", "stop"].includes(command)) {
  usage();
  throw new Error(`Unknown command "${command}".`);
}
const services = groups[requestedGroup];
if (!services) throw new Error(`Unknown group "${requestedGroup}". Choose: ${Object.keys(groups).join(", ")}.`);
if (command === "stop") {
  compose(["stop", ...services]);
} else {
  validate(requestedGroup);
  console.log(`Configuration valid for group "${requestedGroup}": ${services.join(", ")}`);
  if (command === "check") {
    await checkBudget(false);
  } else if (command === "start") {
    if (process.env.NODE_ENV !== "test" || !process.env.AGENT_HQ_TEST_RESPONSES_JSON) {
      throw new Error("Worker start is restricted to no-spend test mode. Set NODE_ENV=test and AGENT_HQ_TEST_RESPONSES_JSON; live provider execution is disabled by this launcher.");
    }
    await checkBudget(true);
    compose(["up", "-d", ...services]);
    console.log("Selected Agent HQ services started.");
  }
}
