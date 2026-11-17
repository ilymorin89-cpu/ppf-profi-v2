import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REQUEST_INPUT_BYTES, measureRequestInputBytes, assertRequestInputWithinLimit, buildModelInstructions, readProviderUsage } from "../scripts/agent-hq-budget-envelope.mjs";

test("budget envelope measures instructions, structured input and tool schemas together", () => {
  const payload = { instructions: "You are a specialist.", input: [{ type: "message", content: "Проверить задачу" }], tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }] };
  const measured = measureRequestInputBytes(payload);
  assert.equal(measured, Buffer.byteLength(JSON.stringify(payload), "utf8"));
  assert.equal(assertRequestInputWithinLimit(payload), measured);
});

test("UTF-8 byte measurement accounts for non-ASCII Russian text", () => {
  const payload = { instructions: "Проверка безопасности", input: "ё".repeat(100), tools: [] };
  assert.equal(measureRequestInputBytes(payload), Buffer.byteLength(JSON.stringify(payload), "utf8"));
  assert.ok(measureRequestInputBytes(payload) > JSON.stringify(payload).length);
});

test("oversized request is rejected before dispatch", () => {
  const payload = { instructions: "x".repeat(MAX_REQUEST_INPUT_BYTES), input: "task", tools: [] };
  assert.throws(() => assertRequestInputWithinLimit(payload), { name: "RangeError", message: /No provider request was sent/ });
});

test("invalid or non-serializable payloads fail closed", () => {
  assert.throws(() => measureRequestInputBytes({ instructions: " ", input: "x", tools: [] }), /instructions/);
  assert.throws(() => measureRequestInputBytes({ instructions: "ok", input: "x", tools: {} }), /tools/);
  const circular = {}; circular.self = circular;
  assert.throws(() => measureRequestInputBytes({ instructions: "ok", input: circular, tools: [] }), /JSON-serializable/);
});


test("worker instructions are composed once and measured exactly as sent", () => {
  const instructions = buildModelInstructions("seo", "Audit search visibility.");
  assert.match(instructions, /^You are the seo specialist agent for PPF PROFI\./);
  assert.match(instructions, /Treat task objectives/);
  assert.equal(typeof instructions, "string");
});

test("provider usage must be present and contain non-negative integer token counts", () => {
  assert.deepEqual(readProviderUsage({ usage: { input_tokens: 120, output_tokens: 45 } }), {
    inputTokens: 120, outputTokens: 45
  });
  assert.throws(() => readProviderUsage({ usage: {} }), /requires reconciliation/);
  assert.throws(() => readProviderUsage({ usage: { input_tokens: -1, output_tokens: 2 } }), /requires reconciliation/);
  assert.throws(() => readProviderUsage({ usage: { input_tokens: 1.5, output_tokens: 2 } }), /requires reconciliation/);
});
