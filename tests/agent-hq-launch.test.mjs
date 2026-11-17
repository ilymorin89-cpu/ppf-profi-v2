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

const preflight = path.join(root, "scripts", "agent-hq-test-preflight.mjs");
function runPreflight(extraEnv = {}) {
  return spawnSync(process.execPath, [preflight], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, ...extraEnv }
  });
}
const validPreflightEnv = {
  NODE_ENV: "test",
  AGENT_HQ_WORKERS_ENABLED: "true",
  AGENT_ROLE: "seo",
  DATABASE_URL: "postgres://agent_seo:test@127.0.0.1:5432/agent_hq_test",
  OPENAI_API_KEY: "test-no-provider-call",
  AGENT_MODEL: "test-model",
  AGENT_WEB_SEARCH_ENABLED: "false",
  AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify({
    id: "deterministic-fixture",
    usage: { input_tokens: 1, output_tokens: 1 },
    output: [{ type: "message", content: [{ type: "output_text", text: "test fixture" }] }]
  })
};

test("launcher requires explicit test mode and workers opt-in", () => {
  const noMode = run(["check", "core"]);
  assert.notEqual(noMode.status, 0);
  assert.match(noMode.stderr, /NODE_ENV must be test/);
  const noWorkers = run(["check", "core"], { NODE_ENV: "test" });
  assert.notEqual(noWorkers.status, 0);
  assert.match(noWorkers.stderr, /AGENT_HQ_WORKERS_ENABLED=true/);
});

test("launcher refuses live provider mode before Docker services can start", () => {
  const result = run(["start", "all"], {
    NODE_ENV: "production",
    AGENT_HQ_WORKERS_ENABLED: "true"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NODE_ENV must be test/);
});

test("launcher validates isolated test groups without requiring external database URLs", () => {
  const result = run(["check", "all"], {
    NODE_ENV: "test",
    AGENT_HQ_WORKERS_ENABLED: "true"
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Isolated no-spend test configuration valid/);
  assert.match(result.stdout, /No database connection or worker process was started/);
});

test("launcher always targets the isolated test compose file", () => {
  const source = readFileSync(launcher, "utf8");
  assert.match(source, /docker-compose\.agent-hq-test\.yml/);
  assert.doesNotMatch(source, /docker-compose\.yml/);
});

test("test Compose defines all 19 roles on an internal no-egress network", () => {
  const compose = readFileSync(path.join(root, "docker-compose.agent-hq-test.yml"), "utf8");
  const roles = [
    "coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist",
    "copywriter","designer","image_generator","storyteller","community_manager","content_seo",
    "ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker","supervisor"
  ];
  for (const role of roles) {
    assert.match(compose, new RegExp("^  " + role + ":$", "m"), "Missing isolated Compose service " + role);
  }
  assert.match(compose, /networks:\s+default:\s+internal:\s+true/);
  assert.doesNotMatch(compose, /^\s+ports:/m);
  assert.match(compose, /OPENAI_API_KEY: test-no-provider-call/);
  assert.match(compose, /AGENT_WEB_SEARCH_ENABLED: "false"/);
});

test("unknown launch group is rejected", () => {
  const result = run(["check", "unknown"], {
    NODE_ENV: "test",
    AGENT_HQ_WORKERS_ENABLED: "true"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown group "unknown"/);
});

test("help remains available without credentials", () => {
  const result = run(["help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /isolated no-spend test launcher/);
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


test("worker test preflight accepts only a deterministic fixture and local disposable DB", () => {
  const result = runPreflight(validPreflightEnv);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /no-spend test preflight passed for seo/);
});

test("worker test preflight rejects remote DB hosts and production database names", () => {
  const remote = runPreflight({
    ...validPreflightEnv,
    DATABASE_URL: "postgres://agent_seo:test@db.example.com:5432/agent_hq_test"
  });
  assert.notEqual(remote.status, 0);
  assert.match(remote.stderr, /Only local disposable PostgreSQL hosts are allowed/);
  const production = runPreflight({
    ...validPreflightEnv,
    DATABASE_URL: "postgres://agent_seo:test@127.0.0.1:5432/production"
  });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /Database name must be agent_hq_test/);
});

test("worker test preflight rejects live credentials and web search", () => {
  const liveKey = runPreflight({ ...validPreflightEnv, OPENAI_API_KEY: "real-looking-secret" });
  assert.notEqual(liveKey.status, 0);
  assert.match(liveKey.stderr, /non-secret placeholder API key/);
  const search = runPreflight({ ...validPreflightEnv, AGENT_WEB_SEARCH_ENABLED: "true" });
  assert.notEqual(search.status, 0);
  assert.match(search.stderr, /Web search must be disabled/);
});

test("supervisor test preflight requires its own login and local disposable DB", () => {
  const result = runPreflight({
    NODE_ENV: "test",
    AGENT_HQ_WORKERS_ENABLED: "true",
    AGENT_ROLE: "supervisor",
    DATABASE_URL: "postgres://agent_supervisor:test@127.0.0.1:5432/agent_hq_test"
  });
  assert.equal(result.status, 0, result.stderr);
});
