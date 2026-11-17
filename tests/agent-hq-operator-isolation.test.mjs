import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bus = path.join(root, "scripts", "agent-hq-bus.mjs");
const baseEnv = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  WINDIR: process.env.WINDIR,
  NODE_ENV: "test",
  DATABASE_URL: "postgres://agent_bus:placeholder@127.0.0.1:1/agent_hq",
  AGENT_HQ_TEST_APPROVER_UIDS: String(typeof process.getuid === "function" ? process.getuid() : 1000)
};

function run(operatorUrl) {
  const env = { ...baseEnv };
  if (operatorUrl !== undefined) env.AGENT_HQ_OPERATOR_DATABASE_URL = operatorUrl;
  return spawnSync(process.execPath, [bus, "approve", "1", "test"], {
    cwd: root,
    encoding: "utf8",
    env
  });
}

test("approval fails closed when operator database URL is missing", () => {
  const result = run(undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /AGENT_HQ_OPERATOR_DATABASE_URL is required/);
});

test("approval rejects a shared or non-operator database login", () => {
  const result = run("postgres://agent_bus:placeholder@127.0.0.1:1/agent_hq");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /distinct PostgreSQL login named agent_operator/);
});

test("approval rejects any login other than agent_operator", () => {
  const result = run("postgres://postgres:placeholder@127.0.0.1:1/agent_hq");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /distinct PostgreSQL login named agent_operator/);
});
