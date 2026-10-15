// Чистый расчёт допов: одинаковый на клиенте (калькулятор) и на сервере (заявка).
// Цены приходят параметром из src/server/pricing/config.ts, здесь чисел нет.

export type AddonPrice = {
  price: number;
  priceMax?: number;
  maxQty: number;
  /** Доп доступен только для этого состава работ (матовая плёнка — только к полной оклейке). */
  onlyScenario?: string;
};

/** Количество по коду допа; булевы опции — 0 или 1. */
export type AddonSelection = Record<string, number>;

export type Range = { low: number; high: number };

export function addonsRange(selection: AddonSelection, prices: Record<string, AddonPrice>): Range {
  let low = 0;
  let high = 0;
  for (const [code, qty] of Object.entries(selection)) {
    const a = prices[code];
    if (!a || !qty) continue;
    low += qty * a.price;
    high += qty * (a.priceMax ?? a.price);
  }
  return { low, high };
}

/** Проверка выбора: известные коды, целое количество 0..maxQty. null — выбор некорректен. */
export function parseAddons(
  raw: unknown,
  prices: Record<string, AddonPrice>
): AddonSelection | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: AddonSelection = {};
  for (const [code, v] of Object.entries(raw as Record<string, unknown>)) {
    const a = prices[code];
    if (!a) return null;
    const qty = typeof v === "boolean" ? Number(v) : v;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 0 || qty > a.maxQty) return null;
    if (qty > 0) out[code] = qty;
  }
  return out;
}

/** Убирает допы, которые не подходят к выбранному составу работ. Одинаково на клиенте и сервере. */
export function forScenario(
  selection: AddonSelection,
  prices: Record<string, AddonPrice>,
  scenario: string
): AddonSelection {
  const out: AddonSelection = {};
  for (const [code, qty] of Object.entries(selection)) {
    const only = prices[code]?.onlyScenario;
    if (!only || only === scenario) out[code] = qty;
  }
  return out;
}
