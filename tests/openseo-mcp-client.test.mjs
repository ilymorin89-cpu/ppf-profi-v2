import test from "node:test";
import assert from "node:assert/strict";
import { createOpenSeoMcpClient } from "../scripts/openseo-mcp-client.mjs";

function jsonResponse(payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json", ...headers }
  });
}

test("OpenSEO MCP client initializes, lists tools and pins calls to project", async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ body, headers: init.headers });
    if (body.method === "initialize") {
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: {
        protocolVersion: "2025-03-26", capabilities: { tools: {} },
        serverInfo: { name: "OpenSEO", version: "test" }
      } }, { "mcp-session-id": "test-session" });
    }
    if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
    if (body.method === "tools/list") {
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "whoami" }] } });
    }
    if (body.method === "tools/call") {
      return jsonResponse({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }] } });
    }
    throw new Error("Unexpected MCP method: " + body.method);
  };
  const client = createOpenSeoMcpClient({
    apiKey: "oseo_test_key", projectId: "ppf-project", fetchImpl
  });
  const tools = await client.listTools();
  assert.equal(tools[0].name, "whoami");
  const result = await client.callTool("whoami");
  assert.equal(result.content[0].text, "ok");
  const call = calls.find(item => item.body.method === "tools/call");
  assert.equal(call.body.params.arguments.project_id, "ppf-project");
  assert.equal(call.headers["MCP-Session-Id"], "test-session");
  assert.equal(call.headers.Authorization, "Bearer oseo_test_key");
});

test("OpenSEO MCP client blocks mutation and tools outside allowlist", async () => {
  const client = createOpenSeoMcpClient({
    apiKey: "oseo_test_key", projectId: "ppf-project",
    fetchImpl: async () => { throw new Error("Network must not be reached"); }
  });
  await assert.rejects(client.callTool("update_project_context"), /mutation is not enabled/);
  await assert.rejects(client.callTool("research_keywords"), /not in the explicit read-only allowlist/);
});

test("OpenSEO MCP client requires credentials and project context", () => {
  assert.throws(() => createOpenSeoMcpClient({ apiKey: "", projectId: "p" }), /OPENSEO_API_KEY/);
  assert.throws(() => createOpenSeoMcpClient({ apiKey: "oseo_test", projectId: "" }), /OPENSEO_PROJECT_ID/);
});

test("OpenSEO MCP client rejects insecure remote endpoint", () => {
  assert.throws(() => createOpenSeoMcpClient({
    apiKey: "oseo_test", projectId: "p", endpoint: "http://example.com/mcp"
  }), /HTTPS/);
});
