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
