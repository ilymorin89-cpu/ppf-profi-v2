import "server-only";
import { quote } from "./quote";
import { getCars } from "./catalog";
import { FILM_CODES, SCENARIO_CODES, type FilmCode, type ScenarioCode } from "@/content/site";

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
  const q = quote(carCode, scenario, filmCode);
  if (!q) return null;
  return { low: q.low, high: q.high };
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
