import test from "node:test";
import assert from "node:assert/strict";
import { createWorkerLifecycle } from "../scripts/agent-hq-worker-lifecycle.mjs";

test("SIGTERM-style shutdown aborts the active request exactly once", () => {
  const lifecycle = createWorkerLifecycle();
  const controller = new AbortController();
  lifecycle.setActiveRequest(controller);

  assert.equal(lifecycle.requestStop("SIGTERM"), true);
  assert.equal(lifecycle.stopping, true);
  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason.message, "SIGTERM");
  assert.equal(lifecycle.requestStop("SIGINT"), false);
  assert.equal(controller.signal.reason.message, "SIGTERM");
});

test("lease loss aborts active provider work and prevents later work", () => {
  const lifecycle = createWorkerLifecycle();
  const active = new AbortController();
  lifecycle.setActiveRequest(active);

  lifecycle.loseLease("heartbeat returned false");

  assert.equal(lifecycle.stopping, true);
  assert.equal(active.signal.aborted, true);
  assert.equal(active.signal.reason.message, "heartbeat returned false");

  const late = new AbortController();
  lifecycle.setActiveRequest(late);
  assert.equal(late.signal.aborted, true);
});

test("shutdown before request creation aborts a subsequently registered request", () => {
  const lifecycle = createWorkerLifecycle();
  lifecycle.requestStop("process shutdown");

  const controller = new AbortController();
  lifecycle.setActiveRequest(controller);

  assert.equal(controller.signal.aborted, true);
  assert.equal(controller.signal.reason.message, "process shutdown");
});

test("clearing an old request does not clear a newer active request", () => {
  const lifecycle = createWorkerLifecycle();
  const first = new AbortController();
  const second = new AbortController();
  lifecycle.setActiveRequest(first);
  lifecycle.setActiveRequest(second);
  lifecycle.clearActiveRequest(first);
  lifecycle.requestStop("stop");

  assert.equal(first.signal.aborted, false);
  assert.equal(second.signal.aborted, true);
});
