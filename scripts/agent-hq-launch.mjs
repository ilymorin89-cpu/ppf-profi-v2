import { spawnSync } from "node:child_process";

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

function usage() {
  console.log([
    "Agent HQ isolated no-spend test launcher",
    "  npm run agent-hq:launch -- check [core|research|all]",
    "  npm run agent-hq:launch -- start [core|research|all]",
    "  npm run agent-hq:launch -- stop [core|research|all]",
    "",
    "Uses docker-compose.agent-hq-test.yml only: disposable PostgreSQL, deterministic test provider,",
    "and an internal Docker network with no external connectivity.",
    "Starting workers requires NODE_ENV=test and AGENT_HQ_WORKERS_ENABLED=true."
  ].join("\n"));
}

function compose(args) {
  const result = spawnSync("docker", ["compose", "-p", "ppf-agent-hq-no-egress-test", "-f", "docker-compose.agent-hq-test.yml", ...args], {
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
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Agent HQ launcher is test-only; NODE_ENV must be test.");
  }
  if (process.env.AGENT_HQ_WORKERS_ENABLED !== "true") {
    throw new Error("Set AGENT_HQ_WORKERS_ENABLED=true only when intentionally starting the isolated no-spend test stack.");
  }
  return services;
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
  console.log(`Isolated no-spend test configuration valid for group "${requestedGroup}": ${services.join(", ")}`);
  if (command === "check") {
    console.log("No database connection or worker process was started.");
  } else {
    compose(["up", "-d", ...services]);
    if (requestedGroup === "all") {
      // Wait for the 19 one-shot workers and verify persisted zero-cost evidence.
      compose(["run", "--rm", "test-assert"]);
      console.log("All 19 role containers passed the deterministic zero-cost assertion.");
    } else {
      console.log("Selected one-shot test services launched on the internal no-egress Docker network.");
    }
  }
}
