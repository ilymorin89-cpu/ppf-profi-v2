import process from "node:process";
import { budgetSnapshot } from "./budget.mjs";
import { POLICY } from "./policy.mjs";
import { audit } from "./audit.mjs";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID;
const SITE_URL = (process.env.SITE_URL || "https://ppfprofi.ru").replace(/\/$/, "");
const SCAN_INTERVAL_HOURS = Math.max(6, Number(process.env.SCAN_INTERVAL_HOURS || 24));
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";
let offset = 0;
let scanInProgress = false;\nlet autonomousPaused = false;
let lastScan = null;

if (!TOKEN || !ALLOWED_CHAT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ALLOWED_CHAT_ID");
  process.exit(1);
}

async function telegram(method, body = {}) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35_000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram HTTP ${response.status}`);
  return data.result;
}

async function send(chatId, text) {
  return telegram("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "PPFPROFI-GrowthBot/0.1 (+https://ppfprofi.ru)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  return { status: response.status, text: await response.text() };
}

async function scanSite() {
  if (scanInProgress) return "Проверка уже выполняется.";
  scanInProgress = true;
  try {
    const started = new Date();
    const [home, robots, sitemap] = await Promise.all([
      fetch(SITE_URL, { signal: AbortSignal.timeout(20_000) }),
      fetch(`${SITE_URL}/robots.txt`, { signal: AbortSignal.timeout(20_000) }),
      fetch(`${SITE_URL}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) }),
    ]);
    const xml = sitemap.ok ? await sitemap.text() : "";
    const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).slice(0, 100);
    const failures = [];
    let checked = 0;
    for (let i = 0; i < urls.length; i += 5) {
      const batch = urls.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (url) => {
        try {
          const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "PPFPROFI-GrowthBot/0.1" } });
          checked++;
          if (!r.ok) failures.push(`${r.status} — ${url}`);
        } catch (e) {
          checked++;
          failures.push(`ошибка запроса — ${url} (${e.message})`);
        }
      }));
    }
    const ok = home.ok && robots.ok && sitemap.ok;
    lastScan = { at: started.toISOString(), home: home.status, robots: robots.status, sitemap: sitemap.status, checked, failures };
    const lines = [
      "🔎 PPF PROFI — проверка сайта",
      `Главная: HTTP ${home.status}`,
      `robots.txt: HTTP ${robots.status}`,
      `sitemap.xml: HTTP ${sitemap.status}`,
      `URL проверено: ${checked} (максимум 100 за один запуск)`,
      `Ошибок страниц: ${failures.length}`,
      failures.length ? failures.slice(0, 12).join("\n") : "Ошибок HTTP не обнаружено.",
      "",
      "Это техническая проверка доступности, не отчёт о позициях в поиске."
    ];
    return lines.join("\n");
  } catch (e) {
    return `❌ Не удалось проверить сайт: ${e.message}`;
  } finally {
    scanInProgress = false;
  }
}

async function handle(message) {
  const chatId = String(message.chat?.id ?? "");
  if (chatId !== String(ALLOWED_CHAT_ID)) return;
  const text = (message.text || "").trim();
  if (text === "/start" || text === "/help") {
    await send(chatId, "PPF PROFI Growth Bot запущен.\n\n/status — состояние бота\n/scan — проверить сайт и sitemap\n/help — помощь");
  } else if (text === "/status") {
    await send(chatId, [
      "🤖 PPF PROFI Growth Bot",
      "Статус: работает",
      `Сайт: ${SITE_URL}`,
      `Автопроверка: ежедневно в 09:00 по Москве`,\n      `Автономные действия: ${autonomousPaused ? "остановлены" : "разрешены политикой, интеграции пока не подключены"}`,
      `Последняя проверка: ${lastScan?.at || "ещё не запускалась"}`
    ].join("\n"));
  } else if (text === "/budget") {
    const b = await budgetSnapshot();
    await send(chatId, [
      "💳 Бюджет PPF PROFI",
      `Месяц: ${b.month}`,
      `Потрачено: ${b.spentRub} ₽ / ${POLICY.monthlyBudgetRub} ₽`,
      `Зарезервировано: ${b.reservedRub} ₽`,
      `Остаток месяца: ${b.monthlyRemainingRub} ₽`,
      `Сегодня потрачено: ${b.dailySpentRub} ₽ / ${POLICY.dailyBudgetRub} ₽`,
      `Остаток на сегодня: ${b.dailyRemainingRub} ₽`
    ].join("\\n"));
  } else if (text === "/pause") {
    autonomousPaused = true;
    await audit({ action: "kill_switch", actor: chatId, state: "paused" });
    await send(chatId, "⛔ Автономные действия остановлены. Мониторинг сайта остаётся доступен.");
  } else if (text === "/resume") {
    autonomousPaused = false;
    await audit({ action: "kill_switch", actor: chatId, state: "resumed" });
    await send(chatId, "▶️ Мониторинг возобновлён. Внешние интеграции активируются только после настройки и проверки credentials.");
  } else if (text === "/scan") {
    await send(chatId, "Начинаю техническую проверку сайта…");
    await send(chatId, await scanSite());
  }
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) await handle(update.message);
      }
    } catch (e) {
      console.error("Polling error:", e.message);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

function moscowHourMinute() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  return { hour: Number(parts.find((p) => p.type === "hour").value), minute: Number(parts.find((p) => p.type === "minute").value) };
}

let lastDailyDate = "";
setInterval(async () => {
  const now = moscowHourMinute();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date());
  if (now.hour === 9 && now.minute < 2 && today !== lastDailyDate) {
    lastDailyDate = today;
    try {
      await send(ALLOWED_CHAT_ID, await scanSite());
    } catch (e) {
      console.error("Daily scan failed:", e.message);
    }
  }
}, 60_000);

console.log("PPF PROFI Growth Bot started");
poll();
