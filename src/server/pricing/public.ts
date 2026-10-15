import "server-only";
import { quote } from "./quote";
import { getCars } from "./catalog";
import { ADDONS, DIRECT_PRICES, HOME_ADDON_EXAMPLE, PART_PRICES_XL, fixedRetailPrice, partPrice } from "./config";
import { addonsRange, parseAddons, type AddonSelection, forScenario } from "@/shared/addons";
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
  /** Модель без поколения («X5»), поколение («G05»), годы («2018–н.в.»). */
  base: string;
  gen: string;
  years: string;
  prices: Record<ScenarioCode, Record<FilmCode, PublicPrice | null>>;
};

export function getPublicPrice(
  carCode: string,
  scenario: string,
  filmCode: string
): PublicPrice | null {
  const car = getCars().find((c) => c.code === carCode);
  if (!car) return null;
  const fixed = fixedRetailPrice(car, scenario, filmCode);
  if (fixed !== null) return { low: fixed, high: fixed };
  const q = quote(carCode, scenario, filmCode);
  if (!q) return null;
  return { low: q.low, high: q.high };
}

/**
 * Проверяет выбор допов из запроса; null — некорректный выбор (неизвестный код, количество вне 0..max).
 * Допы, не подходящие к составу работ (мат к зонам риска), молча убираются.
 */
export function parsePublicAddons(raw: unknown, scenario: string): AddonSelection | null {
  const parsed = parseAddons(raw, ADDONS);
  return parsed ? forScenario(parsed, ADDONS, scenario) : null;
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

/** Пример расчёта на главной: X5 G05 FULL · Spectroll TPU-S + допы из HOME_ADDON_EXAMPLE. */
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
    return { code: c.code, brand: c.brand, model: c.model, base: c.base, gen: c.gen, years: c.years, prices };
  });
}

export function isKnownCar(carCode: string): boolean {
  return getCars().some((c) => c.code === carCode);
}

export function carName(carCode: string): string {
  const c = getCars().find((x) => x.code === carCode);
  return c ? `${c.brand} ${c.model}` : carCode;
}

/** Цена «от» для H1 и метаданных главной: FULL X5 G05 на Spectroll TPU-S; fallback — прямая цена из config.ts. */
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
/** Прайс отдельных деталей по классам кузова (только розница). */
export function getPublicPartPrices(): { code: string; L: number; XL: number; XLp: number }[] {
  return PART_PRICES_XL.map((p) => ({
    code: p.code,
    L: partPrice(p.price, "L"),
    XL: p.price,
    XLp: partPrice(p.price, "XL+"),
  }));
}

export function getPublicAddonPrices() {
  return ADDONS;
}
