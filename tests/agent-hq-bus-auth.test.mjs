import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seoUrl = process.env.AGENT_HQ_ROLE_TEST_URL_SEO;

function runBus(args, databaseUrl) {
  return spawnSync(process.execPath, ["scripts/agent-hq-bus.mjs", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
}

test("Agent HQ bus global commands fail closed without a dedicated authorization path", () => {
  const isolatedUnusedUrl = "postgres://unused:unused@127.0.0.1:1/agent_hq_test";
  for (const [command, args] of [
    ["enqueue", ["seo", "Unsafe task", "Must not enqueue through broad CLI"]],
    ["status", []],
    ["recover", []]
  ]) {
    const result = runBus([command, ...args], isolatedUnusedUrl);
    assert.notEqual(result.status, 0, command + " must remain disabled");
    assert.match(result.stderr, /disabled until a dedicated least-privilege authorization path/i);
  }
});

test("Agent HQ bus approval inbox requires the separate operator login", () => {
  const result = runBus(["approvals"], "postgres://unused:unused@127.0.0.1:1/agent_hq_test");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AGENT_HQ_OPERATOR_DATABASE_URL is required/i);
});

test("Agent HQ bus rejects a requested role that differs from authenticated PostgreSQL LOGIN", {
  skip: !seoUrl
}, () => {
  for (const args of [
    ["claim", "qa_security", "forged-worker"],
    ["inbox", "qa_security"],
    ["send", "qa_security", "coordinator", "-", "status", "forged sender"]
  ]) {
    const result = runBus(args, seoUrl);
    assert.notEqual(result.status, 0, args[0] + " must reject role spoofing");
    assert.match(result.stderr, /authenticated PostgreSQL LOGIN agent_qa_security/i);
  }
});
