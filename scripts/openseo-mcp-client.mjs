const DEFAULT_READ_ONLY_TOOLS = new Set([
  "whoami",
  "list_projects",
  "get_project_context",
  "list_reports",
  "get_report",
  "list_search_console_sites",
  "get_search_console_performance",
  "list_google_analytics_properties",
  "get_google_analytics_measurement_health",
  "get_google_analytics_organic_overview"
]);

const MUTATING_TOOLS = new Set([
  "create_project",
  "save_project_website_setup",
  "update_project_context",
  "save_keywords",
  "remove_saved_keywords",
  "save_ai_visibility_tracker",
  "set_ai_visibility_schedule",
  "create_rank_tracker",
  "add_rank_tracking_keywords",
  "remove_rank_tracking_keywords",
  "pin_rank_tracking_keywords",
  "set_search_console_site",
  "set_google_analytics_property",
  "submit_indexnow_urls",
  "save_report",
  "set_report_sharing",
  "delete_report",
  "save_report_template",
  "delete_report_template",
  "delete_site_audit"
]);

function parseSsePayload(text) {
  const frames = text.split(/\r?\n\r?\n/);
  for (const frame of frames) {
    const data = frame.split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try { return JSON.parse(data); } catch { /* try next SSE frame */ }
  }
  throw new Error("OpenSEO MCP returned no valid JSON-RPC payload.");
}

async function readJsonRpcResponse(response) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenSEO MCP HTTP ${response.status}: ${body.slice(0, 500)}`);
  }
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) return JSON.parse(body);
  if (type.includes("text/event-stream")) return parseSsePayload(body);
  throw new Error(`Unsupported OpenSEO MCP content type: ${type || "missing"}`);
}

export function createOpenSeoMcpClient({
  apiKey = process.env.OPENSEO_API_KEY,
  projectId = process.env.OPENSEO_PROJECT_ID,
  endpoint = process.env.OPENSEO_MCP_URL || "https://app.openseo.so/mcp",
  fetchImpl = globalThis.fetch
} = {}) {
  if (!apiKey || !apiKey.startsWith("oseo_")) {
    throw new Error("OPENSEO_API_KEY is required and must be stored outside the repository.");
  }
  if (!projectId) throw new Error("OPENSEO_PROJECT_ID is required.");
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  const url = new URL(endpoint);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("OpenSEO MCP endpoint must use HTTPS.");
  }

  let requestId = 0;
  let sessionId;
  let initialized = false;

  async function rpc(method, params = {}) {
    const id = ++requestId;
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    };
    if (initialized) headers["MCP-Protocol-Version"] = "2025-03-26";
    if (sessionId) headers["MCP-Session-Id"] = sessionId;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
    });
    const nextSession = response.headers.get("mcp-session-id");
    if (nextSession) sessionId = nextSession;
    return readJsonRpcResponse(response);
  }

  async function initialize() {
    if (initialized) return;
    const result = await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "ppf-profi-agent-hq", version: "0.1.0" }
    });
    if (result.error) throw new Error(`OpenSEO MCP initialize failed: ${result.error.message}`);
    if (!result.result?.serverInfo) throw new Error("OpenSEO MCP initialize response is invalid.");
    initialized = true;
    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26"
    };
    if (sessionId) headers["MCP-Session-Id"] = sessionId;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });
    if (!response.ok) throw new Error(`OpenSEO MCP initialized notification failed: HTTP ${response.status}`);
  }

  async function listTools() {
    await initialize();
    const response = await rpc("tools/list");
    if (response.error) throw new Error(`OpenSEO MCP tools/list failed: ${response.error.message}`);
    return response.result?.tools || [];
  }

  async function callTool(name, args = {}) {
    if (MUTATING_TOOLS.has(name)) {
      throw new Error(`OpenSEO tool "${name}" is blocked: mutation is not enabled for Agent HQ.`);
    }
    if (!DEFAULT_READ_ONLY_TOOLS.has(name)) {
      throw new Error(`OpenSEO tool "${name}" is not in the explicit read-only allowlist.`);
    }
    await initialize();
    const toolArgs = (name === "whoami" || name === "list_projects")
      ? { ...args }
      : { ...args, project_id: projectId };
    const response = await rpc("tools/call", { name, arguments: toolArgs });
    if (response.error) throw new Error(`OpenSEO tool "${name}" failed: ${response.error.message}`);
    if (response.result?.isError) {
      const message = (response.result.content || []).map(item => item.text || "").join("\n");
      throw new Error(`OpenSEO tool "${name}" returned an error: ${message.slice(0, 1000)}`);
    }
    return response.result;
  }

  return Object.freeze({ initialize, listTools, callTool });
}

export { DEFAULT_READ_ONLY_TOOLS, MUTATING_TOOLS };
