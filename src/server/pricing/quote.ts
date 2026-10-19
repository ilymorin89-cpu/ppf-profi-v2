import { PRICING_CONFIG, FILMS, fixedRetailPrice, type FilmCode } from "./config";
import { getCar, type CarEntry } from "./catalog";

export type ScenarioCode = "FULL" | "RISK_ZONES";

export type QuoteInput = {
  carCode: string;
  scenario: ScenarioCode;
  filmCode: FilmCode;
};

export type QuoteResult = {
  costFloor: number;
  autoApprove: number;
  target: number;
  pricingVersion: string;
  breakdown: {
    car: string;
    scenario: ScenarioCode;
    film: string;
    days: number;
    meters: number;
    material: number;
    labor: number;
    extras: number;
    reserve: number;
    cost: number;
  };
};

export type QuoteError =
  | { kind: "unknown-car" }
  | { kind: "not-verified" }
  | { kind: "no-data" }
  | { kind: "unknown-film" };

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function pickMeters(car: CarEntry, scenario: ScenarioCode): number | null {
  if (scenario === "FULL") return car.filmMFull;
  if (scenario === "RISK_ZONES") return car.filmMRisk;
  return null;
}

function pickDays(car: CarEntry, scenario: ScenarioCode): number | null {
  if (scenario === "FULL") return car.daysFull;
  if (scenario === "RISK_ZONES") return car.daysRisk;
  return null;
}

export function calculateQuote(
  input: QuoteInput
): { ok: true; result: QuoteResult } | { ok: false; error: QuoteError } {
  const car = getCar(input.carCode);
  if (!car) return { ok: false, error: { kind: "unknown-car" } };
  if (!car.verified) return { ok: false, error: { kind: "not-verified" } };

  const film = FILMS[input.filmCode];
  if (!film) return { ok: false, error: { kind: "unknown-film" } };

  const meters = pickMeters(car, input.scenario);
  const days = pickDays(car, input.scenario);
  if (meters === null || days === null) {
    return { ok: false, error: { kind: "no-data" } };
  }

  const material = Math.round(meters * film.pricePerMeter);
  const labor = Math.round(days * PRICING_CONFIG.dailyRate);
  const extras = PRICING_CONFIG.consumables + PRICING_CONFIG.logistics;

  const base = material + labor + extras;
  const cost = base * (1 + PRICING_CONFIG.reserve);

  const costFloor = roundUp(cost / (1 - PRICING_CONFIG.usn), PRICING_CONFIG.roundingStep);
  const autoApprove = roundUp(
    cost / (1 - PRICING_CONFIG.usn - PRICING_CONFIG.marginAutoApprove),
    PRICING_CONFIG.roundingStep
  );
  const target = roundUp(
    cost / (1 - PRICING_CONFIG.usn - PRICING_CONFIG.marginTarget),
    PRICING_CONFIG.roundingStep
  );

  return {
    ok: true,
    result: {
      costFloor,
      autoApprove,
      target,
      pricingVersion: PRICING_CONFIG.pricingVersion,
      breakdown: {
        car: `${car.brand} ${car.model}`,
        scenario: input.scenario,
        film: film.label,
        days,
        meters,
        material,
        labor,
        extras,
        reserve: PRICING_CONFIG.reserve,
        cost,
      },
    },
  };
}

// NAR: розница = цена пары Spectroll + разница закупки (то же правило, что в DIRECT_PRICES и CLASS_PRICES).
// Пары: H190 к TPU-S 180, H210 к Premium 210. Решение Ильи 20.10.2026.
const NAR_PAIR: Partial<Record<FilmCode, FilmCode>> = {
  NAR_H190: "PPF_STANDARD",
  NAR_H210: "SPECTROLL_PREMIUM",
};

// Совместимость: orders и public-quote пока вызывают quote().
// Возвращает цену партнёра (Target) и условный диапазон розницы.
// ДИАПАЗОН РОЗНИЦЫ ВРЕМЕННЫЙ, заменить данными рынка.
export function quote(
  car: string,
  pkg: string,
  film: string
): { pp: number; low: number; high: number } | null {
  const r = calculateQuote({
    carCode: car,
    scenario: pkg as ScenarioCode,
    filmCode: film as FilmCode,
  });
  if (!r.ok) return null;
  const pp = r.result.target;

  // Прямая цена модели или цена класса (premium) — как low/high.
  // Это синхронизирует партнёрский расчёт с тем, что видит клиент на сайте.
  const entry = getCar(car);
  const fixed = entry ? fixedRetailPrice(entry, pkg, film) : null;
  if (fixed !== null) return { pp, low: fixed, high: fixed };

  const pair = NAR_PAIR[film as FilmCode];
  if (pair) {
    const base = quote(car, pkg, pair);
    if (base) {
      const perMeter = FILMS[film as FilmCode].pricePerMeter - FILMS[pair].pricePerMeter;
      const delta =
        (r.result.breakdown.meters * perMeter * (1 + PRICING_CONFIG.reserve)) / (1 - PRICING_CONFIG.usn);
      return { pp, low: roundUp(base.low + delta, 500), high: roundUp(base.high + delta, 500) };
    }
  }

  const low = Math.round(pp / 0.85 / 500) * 500;
  const high = Math.round(pp / 0.8 / 500) * 500;
  return { pp, low, high };
}