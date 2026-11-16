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
