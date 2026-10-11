import "server-only";
import { quote } from "./quote";
import { getCars } from "./catalog";
import { ADDONS, DIRECT_PRICES, HOME_ADDON_EXAMPLE } from "./config";
import { addonsRange, parseAddons, type AddonSelection } from "@/shared/addons";
import {
  FILM_CODES,
  PRICE_EXAMPLE,
  SCENARIO_CODES,
  type FilmCode,
  type ScenarioCode,
} from "@/content/site";

// Публичная цена для клиента: только диапазон low..high.
// Цена партнёра, target, costFloor, autoApprove из этого модуля наружу не выходят.
// Используется /api/public-quote, /api/leads и публичными страницами (/, /calculator).

export type PublicPrice = { low: number; high: number };

export type PublicCar = {
  code: string;
  brand: string;
  model: string;
  prices: Record<ScenarioCode, Record<FilmCode, PublicPrice | null>>;
};

export function getPublicPrice(
  carCode: string,
  scenario: string,
  filmCode: string
): PublicPrice | null {
  const direct = DIRECT_PRICES.find(
    (d) => d.carCode === carCode && d.scenario === scenario && d.filmCode === filmCode
  );
  if (direct && isKnownCar(carCode)) return { low: direct.price, high: direct.price };
  const q = quote(carCode, scenario, filmCode);
  if (!q) return null;
  return { low: q.low, high: q.high };
}

/** Проверяет выбор допов из запроса; null — некорректный выбор (неизвестный код, количество вне 0..max). */
export function parsePublicAddons(raw: unknown): AddonSelection | null {
  return parseAddons(raw, ADDONS);
}

/** Итог для клиента: оклейка + допы. Допы одинаковы для всех моделей. */
export function getPublicTotal(
  carCode: string,
  scenario: string,
  filmCode: string,
  addons: AddonSelection
): { base: PublicPrice; addons: PublicPrice; total: PublicPrice } | null {
  const base = getPublicPrice(carCode, scenario, filmCode);
  if (!base) return null;
  const a = addonsRange(addons, ADDONS);
  return { base, addons: a, total: { low: base.low + a.low, high: base.high + a.high } };
}

/** Пример расчёта на главной: X5 G05 Full Standard + допы из HOME_ADDON_EXAMPLE. */
export function getHomeExample() {
  const r = getPublicTotal(
    PRICE_EXAMPLE.carCode,
    PRICE_EXAMPLE.scenario,
    PRICE_EXAMPLE.film,
    HOME_ADDON_EXAMPLE as AddonSelection
  );
  return r ? { ...r, selection: HOME_ADDON_EXAMPLE as AddonSelection } : null;
}

export function getPublicCatalog(): PublicCar[] {
  return getCars().map((c) => {
    const prices = {} as PublicCar["prices"];
    for (const s of SCENARIO_CODES) {
      prices[s] = {} as Record<FilmCode, PublicPrice | null>;
      for (const f of FILM_CODES) prices[s][f] = getPublicPrice(c.code, s, f);
    }
    return { code: c.code, brand: c.brand, model: c.model, prices };
  });
}

export function isKnownCar(carCode: string): boolean {
  return getCars().some((c) => c.code === carCode);
}

export function carName(carCode: string): string {
  const c = getCars().find((x) => x.code === carCode);
  return c ? `${c.brand} ${c.model}` : carCode;
}

/** Цена «от» для H1 и метаданных главной: Standard FULL X5 G05; fallback — прямая цена из config.ts. */
export function getExampleLow(): number {
  const p = getPublicPrice(PRICE_EXAMPLE.carCode, PRICE_EXAMPLE.scenario, PRICE_EXAMPLE.film);
  if (p) return p.low;
  const direct = DIRECT_PRICES.find(
    (d) =>
      d.carCode === PRICE_EXAMPLE.carCode &&
      d.scenario === PRICE_EXAMPLE.scenario &&
      d.filmCode === PRICE_EXAMPLE.film
  );
  return direct ? direct.price : PRICE_EXAMPLE.fallbackLow;
}

/** Цены допов для калькулятора: только публичные цены, без экономики. */
export function getPublicAddonPrices() {
  return ADDONS;
}
