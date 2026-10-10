"use client";

// Общая отправка заявок: таймаут, UTM из sessionStorage, разбор ошибок.

const UTM_KEY = "ppf_utm";
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const TIMEOUT_MS = 15_000;

export type Utm = Partial<Record<(typeof UTM_FIELDS)[number], string>>;

/** Читает UTM из URL при первой загрузке; уже сохранённые значения не перезаписывает. */
export function captureUtm(): void {
  try {
    if (sessionStorage.getItem(UTM_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const utm: Utm = {};
    for (const k of UTM_FIELDS) {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 120);
    }
    if (Object.keys(utm).length > 0) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {
    // sessionStorage недоступен (приватный режим) — UTM просто не передаём
  }
}

function readUtm(): Utm {
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    return raw ? (JSON.parse(raw) as Utm) : {};
  } catch {
    return {};
  }
}

export type SubmitResult =
  | { kind: "ok"; publicNumber?: string }
  | { kind: "invalid"; message: string; fields: Record<string, string> }
  | { kind: "rate-limited" }
  | { kind: "failed" };

export async function postLead(body: Record<string, unknown>): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...readUtm() }),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      fields?: Record<string, string>;
      publicNumber?: string;
    };
    if (res.ok) return { kind: "ok", publicNumber: data.publicNumber };
    if (res.status === 429) return { kind: "rate-limited" };
    if (res.status === 400) {
      return { kind: "invalid", message: data.error || "", fields: data.fields || {} };
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
