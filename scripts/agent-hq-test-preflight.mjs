const workerRoles = new Set([
  "coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist",
  "copywriter","designer","image_generator","storyteller","community_manager","content_seo",
  "ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker"
]);
const role = process.env.AGENT_ROLE;
const databaseUrl = process.env.DATABASE_URL;
const fail = message => {
  console.error("Agent HQ test preflight rejected startup:", message);
  process.exit(1);
};
if (process.env.NODE_ENV !== "test") fail("NODE_ENV must be test.");
const oneShotTestMode = process.env.NODE_ENV === "test" && process.env.AGENT_HQ_TEST_ONCE === "true";
if (process.env.AGENT_HQ_WORKERS_ENABLED !== "true" && !oneShotTestMode) {
  fail("AGENT_HQ_WORKERS_ENABLED must be true, except for an explicitly marked one-shot test.");
}
if (oneShotTestMode && process.env.AGENT_HQ_WORKERS_ENABLED !== "false") {
  fail("One-shot test mode must keep long-running workers disabled.");
}
if (!databaseUrl) fail("DATABASE_URL is required.");
let parsed;
try { parsed = new URL(databaseUrl); } catch { fail("DATABASE_URL must be a valid PostgreSQL URL."); }
const host = parsed.hostname.replace(/^\[|\]$/g, "");
if (!["localhost","127.0.0.1","::1","host.docker.internal","postgres"].includes(host)) {
  fail("Only local disposable PostgreSQL hosts are allowed.");
}
if (decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) !== "agent_hq_test") {
  fail("Database name must be agent_hq_test.");
}
const expectedLogin = role === "supervisor" ? "agent_supervisor" : workerRoles.has(role) ? "agent_" + role : null;
if (!expectedLogin) fail("AGENT_ROLE is not an authorized Agent HQ role.");
if (parsed.username !== expectedLogin) fail("DATABASE_URL must authenticate as " + expectedLogin + ".");
if (role !== "supervisor") {
  if (process.env.OPENAI_API_KEY !== "test-no-provider-call") fail("Test workers must use the non-secret placeholder API key.");
  if (process.env.AGENT_MODEL !== "test-model") fail("Test workers must use the deterministic test model label.");
  if (process.env.AGENT_WEB_SEARCH_ENABLED !== "false") fail("Web search must be disabled in no-spend test mode.");
  if (process.env.GITHUB_TOKEN || process.env.AGENT_GITHUB_REPOSITORY) fail("External GitHub access must be disabled in no-spend test mode.");
  if (!process.env.AGENT_HQ_TEST_RESPONSES_JSON) fail("A deterministic model fixture is required.");
  try {
    const fixture = JSON.parse(process.env.AGENT_HQ_TEST_RESPONSES_JSON);
    if (!(Array.isArray(fixture) ? fixture.length > 0 : fixture && typeof fixture === "object")) {
      fail("Model fixture must be a non-empty object or array.");
    }
  } catch {
    fail("AGENT_HQ_TEST_RESPONSES_JSON must contain valid JSON.");
  }
}
console.log("Agent HQ no-spend test preflight passed for " + role + ".");
