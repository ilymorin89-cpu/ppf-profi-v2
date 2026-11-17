import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roles = Object.freeze({
  coordinator: { login: "agent_coordinator", script: "scripts/agent-hq-worker.mjs" },
  seo: { login: "agent_seo", script: "scripts/agent-hq-worker.mjs" },
  qa_security: { login: "agent_qa_security", script: "scripts/agent-hq-worker.mjs" },
  supervisor: { login: "agent_supervisor", script: "scripts/agent-hq-supervisor.mjs" }
});

function parseLocalTestUrl(value, label) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error(label + " must be a valid PostgreSQL URL."); }
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(label + " must point to localhost or 127.0.0.1; remote databases are forbidden.");
  }
  if (url.pathname !== "/agent_hq_test") {
    throw new Error(label + " must target the disposable database named agent_hq_test.");
  }
  if (url.search || url.hash) throw new Error(label + " must not contain URL query options or fragments.");
  return url;
}

function validate(role) {
  const config = roles[role];
  if (!config) throw new Error("Unsupported simulation role. Allowed: " + Object.keys(roles).join(", "));
  const adminUrl = parseLocalTestUrl(process.env.AGENT_HQ_TEST_DATABASE_URL, "AGENT_HQ_TEST_DATABASE_URL");
  if (decodeURIComponent(adminUrl.username) !== "agent_test") {
    throw new Error("AGENT_HQ_TEST_DATABASE_URL must use the disposable test owner login agent_test.");
  }
  const roleKey = "AGENT_HQ_ROLE_TEST_URL_" + role.toUpperCase();
  const roleUrl = parseLocalTestUrl(process.env[roleKey], roleKey);
  if (decodeURIComponent(roleUrl.username) !== config.login) {
    throw new Error(roleKey + " must use the dedicated login " + config.login + ".");
  }
  if (adminUrl.hostname !== roleUrl.hostname || adminUrl.port !== roleUrl.port || adminUrl.pathname !== roleUrl.pathname) {
    throw new Error("Owner and role URLs must point to the same local agent_hq_test database.");
  }
  return { config, roleUrl: roleUrl.toString() };
}

function usage() {
  console.log([
    "Agent HQ no-spend simulation (one task, deterministic stub; no provider calls)",
    "  npm run agent-hq:simulate -- check <coordinator|seo|qa_security|supervisor>",
    "  npm run agent-hq:simulate -- run <coordinator|seo|qa_security|supervisor>",
    "",
    "Requires AGENT_HQ_TEST_DATABASE_URL and AGENT_HQ_ROLE_TEST_URL_<ROLE> URLs",
    "for a local PostgreSQL database named agent_hq_test. Remote hosts are rejected."
  ].join("\n"));
}

const [command, role] = process.argv.slice(2);
if (!command || command === "help" || command === "--help") {
  usage();
  process.exit(0);
}
if (!["check", "run"].includes(command)) {
  usage();
  throw new Error("Command must be check or run.");
}

const { config, roleUrl } = validate(role);
const workerEnv = {
  PATH: process.env.PATH || "",
  SystemRoot: process.env.SystemRoot || "",
  WINDIR: process.env.WINDIR || "",
  HOME: process.env.HOME || "",
  TMP: process.env.TMP || "",
  TEMP: process.env.TEMP || "",
  NODE_ENV: "test",
  DATABASE_URL: roleUrl,
  OPENAI_API_KEY: "test-no-provider-call",
  AGENT_MODEL: "test-model",
  AGENT_ROLE: role,
  AGENT_WORKER_ID: role === "supervisor" ? "" : "test-" + role,
  AGENT_MAX_OUTPUT_TOKENS: "128",
  AGENT_POLL_MS: "1",
  AGENT_WEB_SEARCH_ENABLED: "false",
  AGENT_HQ_WORKERS_ENABLED: "false",
  AGENT_HQ_TEST_ONCE: "true",
  AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "SIMULATION ONLY: " + role + " completed one task using a deterministic local fixture. No OpenAI, web search, GitHub or external action was used."
      }]
    }],
    usage: { input_tokens: 0, output_tokens: 0 }
  })
};

const args = config.script.endsWith("supervisor.mjs")
  ? [config.script, "--once"]
  : [config.script, "--once"];
// Run the same fail-closed preflight used by the test harness before
// starting the one-shot worker. This mode explicitly keeps long-running
// workers disabled while permitting exactly one deterministic test process.
const preflight = spawnSync(process.execPath, ["scripts/agent-hq-test-preflight.mjs"], {
  cwd: root,
  env: workerEnv,
  stdio: "inherit",
  shell: false
});
if (preflight.error) throw preflight.error;
if (preflight.status !== 0) process.exit(preflight.status || 1);

if (command === "check") {
  console.log("Simulation target validated for " + role + "; fail-closed preflight passed. No database connection, task claim or worker process was started.");
  process.exit(0);
}

const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: workerEnv,
  stdio: "inherit",
  shell: false
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
