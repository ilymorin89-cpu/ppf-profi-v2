import test from "node:test";
import assert from "node:assert/strict";
import { classifyAddress, safeConnectionTarget } from "../scripts/agent-hq-db-connectivity-check.mjs";

test("classifies Timeweb private network addresses", () => {
  assert.equal(classifyAddress("192.168.0.4"), "private");
  assert.equal(classifyAddress("10.1.2.3"), "private");
  assert.equal(classifyAddress("172.20.1.4"), "private");
  assert.equal(classifyAddress("5.42.126.47"), "public-or-provider-routed");
});

test("accepts only the Agent HQ database and PostgreSQL port", () => {
  assert.deepEqual(
    safeConnectionTarget("postgresql://agent_hq_user:secret@192.168.0.4:5432/agent_hq"),
    { host: "192.168.0.4", port: 5432, database: "agent_hq", username: "agent_hq_user", addressType: "private" }
  );
  assert.throws(() => safeConnectionTarget("postgresql://user:secret@host:5432/production"), /other than agent_hq/);
  assert.throws(() => safeConnectionTarget("postgresql://user:secret@host:5433/agent_hq"), /unexpected PostgreSQL port/);
  assert.throws(() => safeConnectionTarget("https://host/agent_hq"), /postgres/);
});
