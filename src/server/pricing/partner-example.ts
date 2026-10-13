import "server-only";
import { quote } from "./quote";
import { getPublicPrice } from "./public";
import { PRICE_EXAMPLE } from "@/content/site";

// Единственное место, где публичная страница получает цену партнёра (pp):
// пример X5 G05 / FULL / Spectroll Standard для блока «Экономика сделки» на /partners.
// Наружу — только три числа этого примера. Таблицу цен партнёра не публикуем.
//
// low/high берём из getPublicPrice — он учитывает DIRECT_PRICES,
// поэтому цифры совпадают с тем, что видит клиент на сайте.

export type PartnerExample = { pp: number; low: number; high: number };

export function getPartnerExample(): PartnerExample {
  const q = quote(PRICE_EXAMPLE.carCode, PRICE_EXAMPLE.scenario, PRICE_EXAMPLE.film);
  if (!q) {
    return {
      pp: PRICE_EXAMPLE.fallbackPartner,
      low: PRICE_EXAMPLE.fallbackLow,
      high: PRICE_EXAMPLE.fallbackHigh,
    };
  }
  const pub = getPublicPrice(
    PRICE_EXAMPLE.carCode,
    PRICE_EXAMPLE.scenario,
    PRICE_EXAMPLE.film
  );
  return {
    pp: q.pp,
    low: pub ? pub.low : q.low,
    high: pub ? pub.high : q.high,
  };
}

/** Спред в тыс. ₽ (для H1 и метаданных /partners). */
export function spreadK(e: PartnerExample): { from: number; to: number } {
  return {
    from: Math.floor((e.low - e.pp) / 1000),
    to: Math.ceil((e.high - e.pp) / 1000),
  };
}