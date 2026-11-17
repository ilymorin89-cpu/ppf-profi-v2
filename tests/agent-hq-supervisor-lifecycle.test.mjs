import test from "node:test";
import assert from "node:assert/strict";
import { createSupervisorLifecycle } from "../scripts/agent-hq-supervisor-lifecycle.mjs";

test("supervisor shutdown wakes a sleeping poll loop immediately", async () => {
  let signal = null;
  const lifecycle = createSupervisorLifecycle({ onStop: value => { signal = value; } });
  let woke = false;
  const waiting = lifecycle.waitForNextCycle(60_000).then(() => { woke = true; });
  assert.equal(lifecycle.stopping, false);
  assert.equal(lifecycle.requestStop("SIGTERM"), true);
  await waiting;
  assert.equal(woke, true);
  assert.equal(signal, "SIGTERM");
  assert.equal(lifecycle.stopping, true);
  assert.equal(lifecycle.requestStop("SIGINT"), false);
  lifecycle.close();
});

test("supervisor wait resolves immediately after shutdown", async () => {
  const lifecycle = createSupervisorLifecycle();
  lifecycle.requestStop("SIGINT");
  await lifecycle.waitForNextCycle(60_000);
  assert.equal(lifecycle.stopping, true);
  lifecycle.close();
});

test("closing supervisor lifecycle releases a pending sleep", async () => {
  const lifecycle = createSupervisorLifecycle();
  let woke = false;
  const waiting = lifecycle.waitForNextCycle(60_000).then(() => { woke = true; });
  lifecycle.close();
  await waiting;
  assert.equal(woke, true);
});
