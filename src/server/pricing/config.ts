import { filmLabel } from "@/content/site";

export type FilmCode = "PPF_STANDARD" | "SPECTROLL_PREMIUM";

export const PRICING_CONFIG = {
  dailyRate: 15_000,
  consumables: 3_000,
  logistics: 3_000,
  reserve: 0.07,
  usn: 0.06,
  marginAutoApprove: 0.25,
  marginTarget: 0.51,
  roundingStep: 500,
  pricingVersion: "v1-2026-10-08",
} as const;

export const FILMS: Record<FilmCode, { label: string; pricePerMeter: number }> = {
  PPF_STANDARD: {
    label: filmLabel("PPF_STANDARD"),
    pricePerMeter: 2_700,
  },
  SPECTROLL_PREMIUM: {
    label: filmLabel("SPECTROLL_PREMIUM"),
    pricePerMeter: 4_000,
  },
};

// ---------- Прямой прайс (источник: Илья, X5 G05, Spectroll Standard 170) ----------
// Единственное место, где задаются прямые цены и цены допов.

/** Прямая цена для клиента «от». Заменяет расчётный диапазон только для этой комбинации. */
export const DIRECT_PRICES: {
  carCode: string;
  scenario: "FULL" | "RISK_ZONES";
  filmCode: FilmCode;
  price: number;
}[] = [
  // Спред FULL ~125-130к, RISK ~38-42к
  { carCode: "BMW_X5_G05",         scenario: "FULL",       filmCode: "PPF_STANDARD", price: 450000 },
  { carCode: "BMW_X5_G05",         scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 175000 },
  { carCode: "BMW_X7_G07",         scenario: "FULL",       filmCode: "PPF_STANDARD", price: 550000 },
  { carCode: "BMW_X7_G07",         scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 175000 },
  { carCode: "MB_GLE_V167",        scenario: "FULL",       filmCode: "PPF_STANDARD", price: 450000 },
  { carCode: "MB_GLE_V167",        scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 125000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "FULL",       filmCode: "PPF_STANDARD", price: 450000 },
  { carCode: "PORSCHE_CAYENNE_E3", scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 125000 },
  { carCode: "TOYOTA_LC300",       scenario: "FULL",       filmCode: "PPF_STANDARD", price: 555000 },
  { carCode: "TOYOTA_LC300",       scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 165000 },
  { carCode: "GEELY_MONJARO",      scenario: "FULL",       filmCode: "PPF_STANDARD", price: 395000 },
  { carCode: "GEELY_MONJARO",      scenario: "RISK_ZONES", filmCode: "PPF_STANDARD", price: 125000 },
];

export type AddonCode = "PILLARS" | "SILLS_INNER" | "SCREENS" | "PANORAMA" | "WINDSHIELD" | "TINT";

/**
 * Допы одинаковы для всех моделей, без коэффициента класса.
 * price — цена за штуку (или «от»), priceMax — верх диапазона, maxQty — максимум в калькуляторе.
 */
export const ADDONS: Record<AddonCode, { price: number; priceMax?: number; maxQty: number }> = {
  PILLARS: { price: 2_000, maxQty: 6 },
  SILLS_INNER: { price: 2_000, maxQty: 1 },
  SCREENS: { price: 7_000, priceMax: 9_000, maxQty: 1 },
  PANORAMA: { price: 20_000, maxQty: 1 },
  WINDSHIELD: { price: 30_000, maxQty: 1 },
  TINT: { price: 15_000, maxQty: 1 },
};

export const ADDON_CODES = Object.keys(ADDONS) as AddonCode[];

/** Пример расчёта на главной: Full + 6 стоек + пороги внутри. */
export const HOME_ADDON_EXAMPLE: Partial<Record<AddonCode, number>> = { PILLARS: 6, SILLS_INNER: 1 };
