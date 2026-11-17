export function parseApprovalPayload(value, maxLength = 12000) {
  const raw = typeof value === "string" ? value.slice(0, maxLength) : "";
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { text: raw };
  }
}

export function mayExecuteToolCalls(turnIndex, maxTurns) {
  return Number.isInteger(turnIndex) && Number.isInteger(maxTurns) &&
    turnIndex >= 0 && maxTurns > 0 && turnIndex < maxTurns - 1;
}

export function uniqueCitations(citations) {
  const byUrl = new Map();
  for (const item of citations || []) {
    if (item && typeof item.url === "string" && /^https?:\/\//i.test(item.url)) {
      if (!byUrl.has(item.url)) byUrl.set(item.url, { url: item.url, title: item.title || null });
    }
  }
  return [...byUrl.values()];
}

export function calculateRunCost({ inputTokens, outputTokens, inputPricePerMillion, outputPricePerMillion, webSearchCalls, webSearchPricePerCall }) {
  const values = [inputTokens, outputTokens, inputPricePerMillion, outputPricePerMillion, webSearchCalls, webSearchPricePerCall];
  if (values.some(value => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new Error("Run cost inputs must be finite non-negative numbers");
  }
  const tokenCost = Math.ceil((
    Number(inputTokens) * Number(inputPricePerMillion) +
    Number(outputTokens) * Number(outputPricePerMillion)
  ) / 1000000);
  const searchCost = Number(webSearchCalls) * Number(webSearchPricePerCall);
  return { tokenCost, searchCost, totalCost: tokenCost + searchCost };
}


export const AGENT_ROLES = Object.freeze([
  "coordinator", "web_engineer", "seo", "geo", "growth", "analytics",
  "qa_security", "vk_strategist", "copywriter", "designer", "image_generator",
  "storyteller", "community_manager", "content_seo", "ads_manager",
  "trend_scout", "auto_news_editor", "auto_law_monitor", "fact_checker"
]);

export function requireAgentRole(value, label = "role") {
  if (typeof value !== "string" || !AGENT_ROLES.includes(value)) {
    throw new Error(`Invalid ${label}: role is not allowlisted`);
  }
  return value;
}

export function resolveApproverIdentity({ uid, allowedUids }) {
  if (!Number.isInteger(uid) || uid < 0) {
    throw new Error("Approval decisions require a supported operating-system UID");
  }
  const allowed = String(allowedUids || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!allowed.length || !allowed.includes(String(uid))) {
    throw new Error("Current operating-system UID is not authorized to decide approvals");
  }
  return `uid:${uid}`;
}
