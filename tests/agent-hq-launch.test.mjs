import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(root, "scripts", "agent-hq-launch.mjs");

function run(args) {
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR
    }
  });
}

test("research launch group fails closed before reading credentials", () => {
  const result = run(["check", "research"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /roles without audited database authorization: web_engineer, analytics/);
  assert.doesNotMatch(result.stderr, /Missing required settings/);
});

test("all launch group fails closed before reading credentials", () => {
  const result = run(["check", "all"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /roles without audited database authorization: community_manager, web_engineer, analytics/);
  assert.doesNotMatch(result.stderr, /Missing required settings/);
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
