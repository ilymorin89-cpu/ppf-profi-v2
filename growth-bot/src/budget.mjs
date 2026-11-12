import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { POLICY } from "./policy.mjs";

const path = process.env.BUDGET_STATE_PATH || "/data/growth-bot-state.json";
const rub = (v) => Math.round(Number(v) * 100) / 100;
const monthKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: POLICY.timezone, year: "numeric", month: "2-digit" }).format(d);
const dayKey = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: POLICY.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

async function load() {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; return { month: monthKey(), day: dayKey(), spentRub: 0, dailySpentRub: 0, reservations: {}, events: [] }; }
}
async function save(state) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + ".tmp";
  await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(tmp, path);
}
function roll(state) {
  const m = monthKey(), d = dayKey();
  if (state.month !== m) { state.month = m; state.spentRub = 0; state.reservations = {}; }
  if (state.day !== d) { state.day = d; state.dailySpentRub = 0; }
  return state;
}
export async function budgetSnapshot() {
  const s = roll(await load());
  const reserved = Object.values(s.reservations).reduce((a, x) => a + x.amountRub, 0);
  return { month: s.month, day: s.day, spentRub: s.spentRub, dailySpentRub: s.dailySpentRub, reservedRub: rub(reserved), monthlyRemainingRub: rub(POLICY.monthlyBudgetRub - s.spentRub - reserved), dailyRemainingRub: rub(POLICY.dailyBudgetRub - s.dailySpentRub) };
}
export async function reserveSpend({ id, amountRub, channel, purpose }) {
  if (!id || !Number.isFinite(amountRub) || amountRub <= 0) throw new Error("Некорректный ID или сумма резерва");
  const s = roll(await load());
  if (s.reservations[id]) throw new Error("Резерв с таким ID уже существует");
  const amount = rub(amountRub);
  const reserved = Object.values(s.reservations).reduce((a, x) => a + x.amountRub, 0);
  if (s.spentRub + reserved + amount > POLICY.monthlyBudgetRub) throw new Error("Превышен месячный бюджет: действие заблокировано");
  if (s.dailySpentRub + dailyReserved + amount > POLICY.dailyBudgetRub) throw new Error("Превышен дневной лимит: действие заблокировано");
  s.reservations[id] = { amountRub: amount, channel, purpose, day: s.day, createdAt: new Date().toISOString() };
  s.events.push({ type: "reserve", id, amountRub: amount, channel, purpose, at: new Date().toISOString() });
  await save(s);
  return budgetSnapshot();
}
export async function settleSpend({ id, actualRub }) {
  const s = roll(await load()), reservation = s.reservations[id];
  if (!reservation) throw new Error("Резерв не найден");
  const actual = rub(actualRub);
  if (!Number.isFinite(actual) || actual < 0 || actual > reservation.amountRub) throw new Error("Фактический расход должен быть от 0 до зарезервированной суммы");
  delete s.reservations[id];
  s.spentRub = rub(s.spentRub + actual);
  s.dailySpentRub = rub(s.dailySpentRub + actual);
  s.events.push({ type: "settle", id, actualRub: actual, at: new Date().toISOString() });
  await save(s);
  return budgetSnapshot();
}
export async function releaseSpend(id, reason = "cancelled") {
  const s = roll(await load()), reservation = s.reservations[id];
  if (!reservation) return budgetSnapshot();
  delete s.reservations[id];
  s.events.push({ type: "release", id, reason, at: new Date().toISOString() });
  await save(s);
  return budgetSnapshot();
}
