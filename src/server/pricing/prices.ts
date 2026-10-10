import { filmLabel } from "@/content/site";

export type ClassCode = "L" | "XL" | "XL+";
export type ScenarioCode = "FULL" | "RISK_ZONES";
export type FilmCode = "PPF_STANDARD" | "SPECTROLL_PREMIUM";

export const CLASS_COEFFICIENT: Record<ClassCode, number> = {
  L: 1.1,
  XL: 1.15,
  "XL+": 1.2,
};

export type CarConfig = {
  label: string;
  class: ClassCode;
  areaFull: number;
  areaRisk: number;
  daysFull: number;
  daysRisk: number;
};

export const CARS: Record<string, CarConfig> = {
  GEELY_MONJARO: {
    label: "Geely Monjaro",
    class: "L",
    areaFull: 15,
    areaRisk: 5,
    daysFull: 3,
    daysRisk: 1,
  },
  BMW_X5_G05: {
    label: "BMW X5 G05",
    class: "XL",
    areaFull: 18,
    areaRisk: 6,
    daysFull: 4,
    daysRisk: 1,
  },
  BMW_X7_G07: {
    label: "BMW X7 G07",
    class: "XL+",
    areaFull: 22,
    areaRisk: 7.5,
    daysFull: 5,
    daysRisk: 1,
  },
  MB_GLE_V167: {
    label: "Mercedes-Benz GLE V167",
    class: "XL",
    areaFull: 18,
    areaRisk: 6,
    daysFull: 4,
    daysRisk: 1,
  },
  PORSCHE_CAYENNE_E3: {
    label: "Porsche Cayenne E3",
    class: "XL",
    areaFull: 18,
    areaRisk: 6,
    daysFull: 4,
    daysRisk: 1,
  },
  TOYOTA_LC300: {
    label: "Toyota Land Cruiser 300",
    class: "XL+",
    areaFull: 22,
    areaRisk: 7.5,
    daysFull: 5,
    daysRisk: 1,
  },
};

export type FilmConfig = {
  label: string;
  pricePerMeter: number;
};

export const FILMS: Record<FilmCode, FilmConfig> = {
  PPF_STANDARD: {
    label: filmLabel("PPF_STANDARD"),
    pricePerMeter: 2300,
  },
  SPECTROLL_PREMIUM: {
    label: filmLabel("SPECTROLL_PREMIUM"),
    pricePerMeter: 4000,
  },
};

export const CONSTANTS = {
  dailyRate: 20_000,
  consumables: 3_000,
  logistics: 3_000,
  reserve: 0.07,
  usn: 0.06,
  marginAutoApprove: 0.15,
  marginTarget: 0.25,
  roundingStep: 500,
};

export const PRICING_VERSION = "draft-1-2026-10-06";