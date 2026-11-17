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
