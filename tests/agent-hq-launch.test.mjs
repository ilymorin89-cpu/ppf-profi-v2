import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(root, "scripts", "agent-hq-launch.mjs");

function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      ...extraEnv
    }
  });
}

const allWorkerRoles = [
  "coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist",
  "copywriter","designer","image_generator","storyteller","community_manager","content_seo",
  "ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker"
];
const allRoleEnv = Object.fromEntries(allWorkerRoles.map(role => [
  "AGENT_HQ_DATABASE_URL_" + role.toUpperCase(),
  "postgres://agent_" + role + ":test@127.0.0.1:5432/agent_hq_test"
]));
allRoleEnv.AGENT_HQ_DATABASE_URL_SUPERVISOR = "postgres://agent_supervisor:test@127.0.0.1:5432/agent_hq_test";

test("research launch group requires audited per-role credentials", () => {
  const result = run(["check", "research"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required settings/);
  assert.match(result.stderr, /AGENT_HQ_DATABASE_URL_WEB_ENGINEER/);
  assert.match(result.stderr, /AGENT_HQ_DATABASE_URL_ANALYTICS/);
  assert.doesNotMatch(result.stderr, /roles without audited database authorization/);
});

test("all launch group requires credentials for all 19 worker roles and supervisor", () => {
  const result = run(["check", "all"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing required settings/);
  for (const role of ["COORDINATOR","GEO","GROWTH","VK_STRATEGIST","COPYWRITER","DESIGNER",
    "IMAGE_GENERATOR","STORYTELLER","COMMUNITY_MANAGER","CONTENT_SEO","ADS_MANAGER",
    "TREND_SCOUT","AUTO_NEWS_EDITOR","AUTO_LAW_MONITOR","FACT_CHECKER","SUPERVISOR"]) {
    assert.match(result.stderr, new RegExp("AGENT_HQ_DATABASE_URL_" + role));
  }
  assert.doesNotMatch(result.stderr, /roles without audited database authorization/);
});

test("all role URLs are checked for duplicate PostgreSQL identities", () => {
  const env = {
    ...allRoleEnv,
    OPENAI_API_KEY: "test-no-provider-call",
    AGENT_MODEL: "test-model",
    AGENT_HQ_WORKERS_ENABLED: "true",
    AGENT_HQ_DATABASE_URL_FACT_CHECKER: allRoleEnv.AGENT_HQ_DATABASE_URL_SEO
  };
  const result = run(["check", "all"], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Database login reused by seo and fact_checker/);
});

test("launcher refuses live provider mode before starting Docker services", () => {
  const env = {
    ...allRoleEnv,
    OPENAI_API_KEY: "not-a-real-key",
    AGENT_MODEL: "test-model",
    AGENT_HQ_WORKERS_ENABLED: "true",
    NODE_ENV: "production"
  };
  const result = run(["start", "all"], env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Worker start is restricted to no-spend test mode/);
});

test("Docker Compose defines one isolated worker service for every role", () => {
  const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
  for (const role of [...allWorkerRoles,"supervisor"]) {
    assert.match(compose, new RegExp("^  " + role + ":$", "m"), "Missing Compose service for " + role);
    if (role !== "supervisor") {
      assert.match(compose, new RegExp("AGENT_HQ_DATABASE_URL_" + role.toUpperCase()));
    }
  }
});

test("unknown launch group is rejected", () => {
  const result = run(["check", "unknown"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown group "unknown"/);
});

test("help remains available without credentials", () => {
  const result = run(["help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Agent HQ launcher/);
});


const simulator = path.join(root, "scripts", "agent-hq-simulate.mjs");
function runSimulation(args, extraEnv = {}) {
  return spawnSync(process.execPath, [simulator, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      ...extraEnv
    }
  });
}

const simulationUrls = {
  AGENT_HQ_TEST_DATABASE_URL: "postgres://agent_test:test@127.0.0.1:5432/agent_hq_test",
  AGENT_HQ_ROLE_TEST_URL_COORDINATOR: "postgres://agent_coordinator:test@127.0.0.1:5432/agent_hq_test",
  AGENT_HQ_ROLE_TEST_URL_SEO: "postgres://agent_seo:test@127.0.0.1:5432/agent_hq_test",
  AGENT_HQ_ROLE_TEST_URL_QA_SECURITY: "postgres://agent_qa_security:test@127.0.0.1:5432/agent_hq_test",
  AGENT_HQ_ROLE_TEST_URL_SUPERVISOR: "postgres://agent_supervisor:test@127.0.0.1:5432/agent_hq_test"
};

test("no-spend simulator validates local test DB and role login without starting a worker", () => {
  const result = runSimulation(["check", "seo"], simulationUrls);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Simulation target validated for seo/);
  assert.match(result.stdout, /No database connection, task claim or worker process was started/);
});

test("no-spend simulator rejects remote databases", () => {
  const result = runSimulation(["check", "seo"], {
    ...simulationUrls,
    AGENT_HQ_ROLE_TEST_URL_SEO: "postgres://agent_seo:test@db.example.com:5432/agent_hq_test"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /remote databases are forbidden/);
});

test("no-spend simulator rejects production database names", () => {
  const result = runSimulation(["check", "seo"], {
    ...simulationUrls,
    AGENT_HQ_TEST_DATABASE_URL: "postgres://agent_test:test@127.0.0.1:5432/production"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /disposable database named agent_hq_test/);
});

test("no-spend simulator rejects shared or mismatched role logins", () => {
  const result = runSimulation(["check", "seo"], {
    ...simulationUrls,
    AGENT_HQ_ROLE_TEST_URL_SEO: "postgres://agent_test:test@127.0.0.1:5432/agent_hq_test"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /dedicated login agent_seo/);
});

test("no-spend simulator rejects roles without audited launch authorization", () => {
  const result = runSimulation(["check", "web_engineer"], simulationUrls);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported simulation role/);
});
