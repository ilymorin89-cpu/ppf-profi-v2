import fs from "node:fs";
import path from "node:path";

export type CarClass = "L" | "XL" | "XL+";

export type CarEntry = {
  code: string;
  brand: string;
  model: string;
  class: CarClass;
  filmMFull: number | null;
  filmMFront: number | null;
  filmMRisk: number | null;
  daysFull: number | null;
  daysFront: number | null;
  daysRisk: number | null;
  verified: boolean;
  /** Модель без поколения: «X5». Для группировки в выборе «марка → модель → поколение». */
  base: string;
  /** Поколение / кузов: «G05». */
  gen: string;
  /** Годы выпуска: «2018–н.в.». */
  years: string;
  /** "premium" — цена по классу кузова (CLASS_PRICES), иначе — расчёт по формуле. */
  tier: string;
};

function parseNum(v: string | undefined): number | null {
  if (!v) return null;
  const normalized = v.replace(",", ".").trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBool(v: string | undefined): boolean {
  return (v || "").trim().toLowerCase() === "yes";
}

export function getCars(): CarEntry[] {
  const filePath = path.join(process.cwd(), "data", "pricing-cars.csv");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(";").map((h) => h.trim());
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { idx[h] = i; });
  const rows: CarEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    const cls = (c[idx.class] || "").trim() as CarClass;
    if (cls !== "L" && cls !== "XL" && cls !== "XL+") continue;
    rows.push({
      code: (c[idx.code] || "").trim(),
      brand: (c[idx.brand] || "").trim(),
      model: (c[idx.model] || "").trim(),
      class: cls,
      filmMFull: parseNum(c[idx.film_m_full]),
      filmMFront: parseNum(c[idx.film_m_front]),
      filmMRisk: parseNum(c[idx.film_m_risk]),
      daysFull: parseNum(c[idx.days_full]),
      daysFront: parseNum(c[idx.days_front]),
      daysRisk: parseNum(c[idx.days_risk]),
      verified: parseBool(c[idx.verified]),
      base: (c[idx.base] || "").trim() || (c[idx.model] || "").trim(),
      gen: (c[idx.gen] || "").trim(),
      years: (c[idx.years] || "").trim(),
      tier: (c[idx.tier] || "").trim(),
    });
  }
  return rows;
}

export function getCar(code: string): CarEntry | undefined {
  return getCars().find((c) => c.code === code);
}

export function getPublicCars() {
  return getCars().map((c) => ({
    code: c.code,
    brand: c.brand,
    model: c.model,
    class: c.class,
    hasPrice: c.verified && c.filmMFull !== null && c.daysFull !== null,
  }));
}