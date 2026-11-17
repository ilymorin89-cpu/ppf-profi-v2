import { spawnSync } from "node:child_process";
import postgres from "postgres";

const groups = {
  core: ["coordinator", "seo", "qa_security", "supervisor"],
  research: ["coordinator", "web_engineer", "seo", "analytics", "qa_security", "supervisor"],
  all: ["coordinator", "community_manager", "qa_security", "web_engineer", "seo", "analytics", "supervisor"]
};
const roleEnv = {
  coordinator: "AGENT_HQ_DATABASE_URL_COORDINATOR",
  community_manager: "AGENT_HQ_DATABASE_URL_COMMUNITY_MANAGER",
  qa_security: "AGENT_HQ_DATABASE_URL_QA_SECURITY",
  web_engineer: "AGENT_HQ_DATABASE_URL_WEB_ENGINEER",
  seo: "AGENT_HQ_DATABASE_URL_SEO",
  analytics: "AGENT_HQ_DATABASE_URL_ANALYTICS",
  supervisor: "AGENT_HQ_DATABASE_URL_SUPERVISOR"
};

function usage() {
  console.log([
    "Agent HQ launcher",
    "  npm run agent-hq:launch -- check [core|research|all]",
    "  npm run agent-hq:launch -- start [core|research|all]",
    "  npm run agent-hq:launch -- stop [core|research|all]",
    "",
    "Default group: core. Requires role-specific PostgreSQL URLs, OPENAI_API_KEY,",
    "AGENT_MODEL and AGENT_HQ_WORKERS_ENABLED=true. No secrets are printed."
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
  const missing = [];
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  if (!process.env.AGENT_MODEL) missing.push("AGENT_MODEL");
  if (process.env.AGENT_HQ_WORKERS_ENABLED !== "true") missing.push("AGENT_HQ_WORKERS_ENABLED=true");
  for (const service of services) {
    const key = roleEnv[service];
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length) throw new Error("Missing required settings: " + missing.join(", "));
  const identities = services.map(service => {
    const key = roleEnv[service];
    let username;
    try { username = new URL(process.env[key]).username; }
    catch { throw new Error(`${key} must be a valid PostgreSQL URL.`); }
    if (!username) throw new Error(`${key} must include a PostgreSQL login.`);
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

async function checkBudget() {
  const url = process.env.AGENT_HQ_DATABASE_URL_COORDINATOR;
  const sql = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    const [budget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd
      FROM agent_budget_config WHERE id=1`;
    if (!budget || !budget.enabled ||
      Number(budget.daily_cap_microusd) <= 0 ||
      Number(budget.monthly_cap_microusd) <= 0 ||
      Number(budget.per_run_cap_microusd) <= 0) {
      throw new Error("Agent budget is disabled or has zero caps. No workers were started.");
    }
    console.log("Database reachable; budget enabled with non-zero caps.");
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
  if (command === "start") {
    await checkBudget();
    compose(["up", "-d", ...services]);
    console.log("Selected Agent HQ services started.");
  }
}
