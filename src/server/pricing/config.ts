import { filmLabel, type FilmCode } from "@/content/site";

export type { FilmCode };

export const PRICING_CONFIG = {
  dailyRate: 15_000,
  consumables: 3_000,
  logistics: 3_000,
  reserve: 0.07,
  usn: 0.06,
  marginAutoApprove: 0.25,
  // Цена для партнёра (Target). 0.37 даёт X5 G05 FULL TPU-S = 235 500 ₽ при закупке TPU-S 37 000 ₽/рулон (Илья, 24.10.2026).
  marginTarget: 0.37,
  roundingStep: 500,
  pricingVersion: "v2-2026-10-24",
} as const;

export const FILMS: Record<FilmCode, { label: string; pricePerMeter: number }> = {
  // Spectroll TPU-S 180: закупка 37 000 ₽ за рулон 15 м (Илья, 24.10.2026); было 2 700 ₽/м.
  PPF_STANDARD: {
    label: filmLabel("PPF_STANDARD"),
    pricePerMeter: 37_000 / 15,
  },
  SPECTROLL_PREMIUM: {
    label: filmLabel("SPECTROLL_PREMIUM"),
    pricePerMeter: 4_000,
  },
  // NAR: закупка рулона 15 м × 1,52 м — H190 65 000 ₽, H210 72 000 ₽ (Илья, 20.10.2026).
  NAR_H190: {
    label: filmLabel("NAR_H190"),
    pricePerMeter: 65_000 / 15,
  },
  NAR_H210: {
    label: filmLabel("NAR_H210"),
    pricePerMeter: 72_000 / 15,
  },
};

// ---------- Прямой прайс (источник: Илья, 14.10.2026; Spectroll TPU-S 180 / Premium 210) ----------
// Единственное место, где задаются прямые цены и цены допов.
// PPF_STANDARD = Spectroll TPU-S 180 микрон, SPECTROLL_PREMIUM = Spectroll Premium 210 микрон.

/** Прямая цена для клиента «от». Заменяет расчётный диапазон только для этой комбинации.
 *  Цены вида 349 000 вместо 350 000 — решение Ильи 14.10.2026 (воспринимаются ниже). */
export const DIRECT_PRICES: {
  carCode: string;
  scenario: "FULL" | "RISK_ZONES";
  filmCode: FilmCode;
  price: number;
}[] = [
  { carCode: "BMW_X5_G05",         scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 349000 },
  { carCode: "BMW_X5_G05",         scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 409000 },
  { carCode: "BMW_X5_G05",         scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 129000 },
  { carCode: "BMW_X5_G05",         scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 149000 },
  { carCode: "BMW_X7_G07",         scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 429000 },
  { carCode: "BMW_X7_G07",         scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 499000 },
  { carCode: "BMW_X7_G07",         scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 129000 },
  { carCode: "BMW_X7_G07",         scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 149000 },
  { carCode: "MB_GLE_V167",        scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 349000 },
  { carCode: "MB_GLE_V167",        scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 409000 },
  { carCode: "MB_GLE_V167",        scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 94000 },
  { carCode: "MB_GLE_V167",        scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 109000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 349000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 409000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 94000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 109000 },
  { carCode: "TOYOTA_LC300",       scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 429000 },
  { carCode: "TOYOTA_LC300",       scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 499000 },
  { carCode: "TOYOTA_LC300",       scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 124000 },
  { carCode: "TOYOTA_LC300",       scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 144000 },
  { carCode: "GEELY_MONJARO",      scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 309000 },
  { carCode: "GEELY_MONJARO",      scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 359000 },
  { carCode: "GEELY_MONJARO",      scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 94000 },
  { carCode: "GEELY_MONJARO",      scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 109000 },

  // NAR PPF Premium: цена Spectroll-пары + разница закупки (метры плёнки × разница ₽/м × 1,07 / 0,94 — резерв и УСН),
  // округление вверх до 1 000 ₽. Пары: H190 к TPU-S 180, H210 к Premium 210. Решение Ильи 20.10.2026.
  { carCode: "BMW_X5_G05",         scenario: "FULL",       filmCode: "NAR_H190", price: 383000 },
  { carCode: "BMW_X5_G05",         scenario: "FULL",       filmCode: "NAR_H210", price: 426000 },
  { carCode: "BMW_X5_G05",         scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 143000 },
  { carCode: "BMW_X5_G05",         scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 156000 },
  { carCode: "BMW_X7_G07",         scenario: "FULL",       filmCode: "NAR_H190", price: 470000 },
  { carCode: "BMW_X7_G07",         scenario: "FULL",       filmCode: "NAR_H210", price: 520000 },
  { carCode: "BMW_X7_G07",         scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 143000 },
  { carCode: "BMW_X7_G07",         scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 156000 },
  { carCode: "MB_GLE_V167",        scenario: "FULL",       filmCode: "NAR_H190", price: 383000 },
  { carCode: "MB_GLE_V167",        scenario: "FULL",       filmCode: "NAR_H210", price: 426000 },
  { carCode: "MB_GLE_V167",        scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 104000 },
  { carCode: "MB_GLE_V167",        scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 114000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "FULL",       filmCode: "NAR_H190", price: 383000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "FULL",       filmCode: "NAR_H210", price: 426000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 104000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 114000 },
  { carCode: "TOYOTA_LC300",       scenario: "FULL",       filmCode: "NAR_H190", price: 470000 },
  { carCode: "TOYOTA_LC300",       scenario: "FULL",       filmCode: "NAR_H210", price: 520000 },
  { carCode: "TOYOTA_LC300",       scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 134000 },
  { carCode: "TOYOTA_LC300",       scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 149000 },
  { carCode: "GEELY_MONJARO",      scenario: "FULL",       filmCode: "NAR_H190", price: 337000 },
  { carCode: "GEELY_MONJARO",      scenario: "FULL",       filmCode: "NAR_H210", price: 373000 },
  { carCode: "GEELY_MONJARO",      scenario: "RISK_ZONES", filmCode: "NAR_H190", price: 104000 },
  { carCode: "GEELY_MONJARO",      scenario: "RISK_ZONES", filmCode: "NAR_H210", price: 114000 },

  // Mercedes G-класс W463 (MB_G_W463), зоны риска, 24.10.2026: розница = партнёрская цена при закупке TPU-S 37 000 ₽/рулон,
  // 6 м плёнки, 4 дня. TPU-S 180 — 152 000, Premium 210 — 169 000.
  // NAR H190 — 173 000, NAR H210 — 178 000: выше правила (пара + разница закупки = 165 000 / 175 000), ручное решение.
  { carCode: "MB_G_W463",          scenario: "RISK_ZONES", filmCode: "PPF_STANDARD",      price: 152000 },
  { carCode: "MB_G_W463",          scenario: "RISK_ZONES", filmCode: "NAR_H190",          price: 173000 },
  { carCode: "MB_G_W463",          scenario: "RISK_ZONES", filmCode: "SPECTROLL_PREMIUM", price: 169000 },
  { carCode: "MB_G_W463",          scenario: "RISK_ZONES", filmCode: "NAR_H210",          price: 178000 },

  // Mercedes G-класс W463, полная оклейка: решение Ильи 24.10.2026, тот же коэффициент, что у зон риска (168 / 114 к лесенке GLE V167).
  // TPU-S 180 — 514 000, NAR H190 — 564 000, Spectroll Premium 210 — 603 000, NAR H210 — 628 000.
  { carCode: "MB_G_W463",          scenario: "FULL",       filmCode: "PPF_STANDARD",      price: 514000 },
  { carCode: "MB_G_W463",          scenario: "FULL",       filmCode: "NAR_H190",          price: 564000 },
  { carCode: "MB_G_W463",          scenario: "FULL",       filmCode: "SPECTROLL_PREMIUM", price: 603000 },
  { carCode: "MB_G_W463",          scenario: "FULL",       filmCode: "NAR_H210",          price: 628000 },
];

/**
 * Цена «от» по классу кузова для премиальных моделей без своей строки в DIRECT_PRICES.
 * Опорные точки — прямые цены Ильи: L = Monjaro, XL = GLE/Cayenne, XL+ = X7/LC300.
 * Подтверждено Ильёй 14.10.2026.
 */
export const CLASS_PRICES: Record<
  "L" | "XL" | "XL+",
  Record<"FULL" | "RISK_ZONES", Record<FilmCode, number>>
> = {
  // NAR: та же формула, что в DIRECT_PRICES; метры плёнки по опорным моделям класса (L = Monjaro, XL = GLE, XL+ = LC300).
  L: {
    FULL: { PPF_STANDARD: 309000, SPECTROLL_PREMIUM: 359000, NAR_H190: 337000, NAR_H210: 373000 },
    RISK_ZONES: { PPF_STANDARD: 94000, SPECTROLL_PREMIUM: 109000, NAR_H190: 104000, NAR_H210: 114000 },
  },
  XL: {
    FULL: { PPF_STANDARD: 349000, SPECTROLL_PREMIUM: 409000, NAR_H190: 383000, NAR_H210: 426000 },
    RISK_ZONES: { PPF_STANDARD: 94000, SPECTROLL_PREMIUM: 109000, NAR_H190: 104000, NAR_H210: 114000 },
  },
  "XL+": {
    FULL: { PPF_STANDARD: 429000, SPECTROLL_PREMIUM: 499000, NAR_H190: 470000, NAR_H210: 520000 },
    RISK_ZONES: { PPF_STANDARD: 124000, SPECTROLL_PREMIUM: 144000, NAR_H190: 134000, NAR_H210: 149000 },
  },
};

/** Розничная цена «от»: прямая цена модели → цена класса (только tier=premium) → null (тогда формула). */
export function fixedRetailPrice(
  car: { code: string; class: string; tier: string },
  scenario: string,
  filmCode: string
): number | null {
  const direct = DIRECT_PRICES.find(
    (d) => d.carCode === car.code && d.scenario === scenario && d.filmCode === filmCode
  );
  if (direct) return direct.price;
  if (car.tier !== "premium") return null;
  const byClass = CLASS_PRICES[car.class as keyof typeof CLASS_PRICES];
  const v = byClass?.[scenario as "FULL" | "RISK_ZONES"]?.[filmCode as FilmCode];
  return typeof v === "number" ? v : null;
}

export type AddonCode =
  | "PILLARS"
  | "SILLS_INNER"
  | "SCREENS"
  | "PANORAMA"
  | "WINDSHIELD"
  | "TINT"
  | "BUMPER_MESH"
  | "MATTE";

/**
 * Допы одинаковы для всех моделей, без коэффициента класса.
 * price — цена за штуку (или «от»), priceMax — верх диапазона, maxQty — максимум в калькуляторе.
 */
export const ADDONS: Record<AddonCode, { price: number; priceMax?: number; maxQty: number; onlyScenario?: string }> = {
  PILLARS: { price: 2_000, maxQty: 6 },
  /** Цена за штуку, до 4 шт (решение Ильи 20.10.2026). */
  SILLS_INNER: { price: 2_000, maxQty: 4 },
  SCREENS: { price: 7_000, priceMax: 9_000, maxQty: 1 },
  PANORAMA: { price: 20_000, maxQty: 1 },
  WINDSHIELD: { price: 30_000, maxQty: 1 },
  TINT: { price: 15_000, maxQty: 1 },
  /** Сетка в бампер. Цена 10 000 ₽ — Илья, 20.10.2026; единица (один бампер или комплект) не уточнена, maxQty 1. */
  BUMPER_MESH: { price: 10_000, maxQty: 1 },
  /** Доплата за матовую плёнку к полной оклейке (решение Ильи 14.10.2026). */
  MATTE: { price: 35_000, maxQty: 1, onlyScenario: "FULL" },
};

// ---------- Отдельные детали ----------

/**
 * Цены на отдельные детали для класса XL (X5, GLE, Cayenne). Источник: Илья, 14.10.2026.
 * Для L и XL+ цена пересчитывается пропорционально цене полной оклейки класса (CLASS_PRICES, TPU-S).
 */
export const PART_PRICES_XL: { code: string; price: number }[] = [
  { code: "HOOD_STRIPE", price: 11_000 },
  { code: "HOOD", price: 43_000 },
  { code: "TRUNK_LID", price: 17_500 },
  { code: "ROOF", price: 50_500 },
  { code: "ROOF_STRIPE", price: 10_000 },
  { code: "LOADING_ZONE", price: 5_500 },
  { code: "FRONT_BUMPER", price: 33_000 },
  { code: "FRONT_FENDER", price: 16_500 },
  { code: "REAR_BUMPER", price: 45_500 },
  { code: "REAR_FENDER", price: 47_000 },
  { code: "DOOR", price: 14_500 },
  { code: "HANDLE_CUPS", price: 5_500 },
  { code: "SILL_OUTER", price: 16_000 },
  { code: "SILLS_INNER_4", price: 12_500 },
  { code: "HEADLIGHTS", price: 10_500 },
  { code: "MIRRORS", price: 10_000 },
  { code: "A_PILLARS", price: 14_000 },
  { code: "FOG_LIGHTS", price: 8_000 },
  { code: "SPOILER", price: 14_000 },
];

/** Цена детали для класса кузова: XL — как в прайсе, L и XL+ — пропорционально полной оклейке, шаг 500 ₽. */
export function partPrice(xlPrice: number, cls: "L" | "XL" | "XL+"): number {
  if (cls === "XL") return xlPrice;
  const k = CLASS_PRICES[cls].FULL.PPF_STANDARD / CLASS_PRICES.XL.FULL.PPF_STANDARD;
  return Math.round((xlPrice * k) / 500) * 500;
}

export const ADDON_CODES = Object.keys(ADDONS) as AddonCode[];

/** Пример расчёта на главной: Full + 6 стоек + пороги внутри. */
export const HOME_ADDON_EXAMPLE: Partial<Record<AddonCode, number>> = { PILLARS: 6, SILLS_INNER: 1 };
