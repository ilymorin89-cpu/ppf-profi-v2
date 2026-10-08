export type FilmCode = "PPF_STANDARD" | "SPECTROLL_PREMIUM";

export const PRICING_CONFIG = {
  dailyRate: 15_000,
  consumables: 3_000,
  logistics: 3_000,
  reserve: 0.07,
  usn: 0.06,
  marginAutoApprove: 0.25,
  marginTarget: 0.37,
  roundingStep: 500,
  pricingVersion: "v1-2026-10-08",
} as const;

export const FILMS: Record<FilmCode, { label: string; pricePerMeter: number }> = {
  PPF_STANDARD: {
    label: "PPF PROFI Standard",
    pricePerMeter: 2_700,
  },
  SPECTROLL_PREMIUM: {
    label: "Spectroll Premium",
    pricePerMeter: 4_000,
  },
};