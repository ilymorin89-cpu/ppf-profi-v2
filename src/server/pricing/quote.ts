import {
  CARS,
  FILMS,
  CONSTANTS,
  CLASS_COEFFICIENT,
  PRICING_VERSION,
  type ClassCode,
  type FilmCode,
  type ScenarioCode,
} from "./prices";

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
    class: ClassCode;
    scenario: ScenarioCode;
    film: string;
    days: number;
    meters: number;
    labor: number;
    material: number;
    consumables: number;
    logistics: number;
    classCoefficient: number;
    reserve: number;
    cost: number;
  };
};

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function calculateQuote(input: QuoteInput): QuoteResult | null {
  const car = CARS[input.carCode];
  if (!car) return null;

  const film = FILMS[input.filmCode];
  if (!film) return null;

  const isFull = input.scenario === "FULL";
  const isFront = input.scenario === "FRONT";
  const days = isFull ? car.daysFull : 1;
  const meters = isFull
    ? car.areaFull
    : isFront
    ? Math.round(car.areaFull * 0.4 * 10) / 10
    : car.areaRisk;

  const labor = days * CONSTANTS.dailyRate;
  const material = Math.round(meters * film.pricePerMeter);
  const consumables = CONSTANTS.consumables;
  const logistics = CONSTANTS.logistics;

  const base = labor + material + consumables + logistics;
  const classCoeff = CLASS_COEFFICIENT[car.class];
  const withClass = base * classCoeff;
  const cost = withClass * (1 + CONSTANTS.reserve);

  const costFloor = roundUp(cost / (1 - CONSTANTS.usn), CONSTANTS.roundingStep);
  const autoApprove = roundUp(
    cost / (1 - CONSTANTS.usn - CONSTANTS.marginAutoApprove),
    CONSTANTS.roundingStep
  );
  const target = roundUp(
    cost / (1 - CONSTANTS.usn - CONSTANTS.marginTarget),
    CONSTANTS.roundingStep
  );

  return {
    costFloor,
    autoApprove,
    target,
    pricingVersion: PRICING_VERSION,
    breakdown: {
      car: car.label,
      class: car.class,
      scenario: input.scenario,
      film: film.label,
      days,
      meters,
      labor,
      material,
      consumables,
      logistics,
      classCoefficient: classCoeff,
      reserve: CONSTANTS.reserve,
      cost,
    },
  };
}