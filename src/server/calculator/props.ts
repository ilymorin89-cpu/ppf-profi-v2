import { existsSync } from "node:fs";
import path from "node:path";
import type { CalcCar } from "@/components/calculator/Calculator";
import { genLabel } from "@/server/seo/brands";
import { getPublicAddonPrices, getPublicCatalog } from "@/server/pricing/public";
import {
  ADDON_TEXTS,
  BRANDS,
  CALCULATOR,
  FILMS,
  FILM_CODES,
  FORM_TEXTS,
  SCENARIOS,
  SCENARIO_CODES,
  type ScenarioCode,
  TELEGRAM,
  TOP_MODELS,
  FILM_LIFE,
  WARRANTY_WORK,
  filmPriceLabel,
  scenarioDays,
} from "@/content/site";

/** Описание пакетов в калькуляторе (как в макете агента). На главной — SCENARIOS.desc. */
const CALC_SCENARIO_DESC: Record<ScenarioCode, string> = {
  FULL: "Полная защита кузова плёнкой Spectroll",
  RISK_ZONES: "Бампер, капот, крылья, зеркала, зона погрузки и другие элементы",
};

/** Есть ли файл в public/ (иллюстрации машин, схемы пакетов, картинки допов). */
function hasPublic(rel: string): boolean {
  return existsSync(path.join(process.cwd(), "public", rel));
}

/** Данные калькулятора для /calculator и для главной — один источник, без расхождений. */
export function getCalculatorProps() {
  // Только low/high: getPublicCatalog не отдаёт цену партнёра и себестоимость.
  const catalog = getPublicCatalog();
  // Порядок марок: как на сайте (BRANDS), затем остальные по алфавиту.
  const order = BRANDS.map((b) => b.catalogBrand);
  const rank = (brand: string) => {
    const i = order.indexOf(brand);
    return i === -1 ? order.length : i;
  };
  const cars: CalcCar[] = catalog
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.brand) - rank(b.c.brand) || a.c.brand.localeCompare(b.c.brand) || a.i - b.i)
    .map(({ c }) => ({
      code: c.code,
      brand: c.brand,
      base: c.base || c.model,
      gen: genLabel(c),
      label: `${c.brand} ${c.model}`,
      hasImage: hasPublic(`cars/${c.code}.webp`),
      prices: c.prices,
    }));

  return {
    cars,
    defaultCar: TOP_MODELS[0],
    scenarios: SCENARIO_CODES.map((code) => ({
      code,
      label: SCENARIOS[code].label,
      desc: CALC_SCENARIO_DESC[code],
      days: scenarioDays(code),
      image: hasPublic(`packages/${code}.webp`) ? `/packages/${code}.webp` : undefined,
    })),
    films: FILM_CODES.map((code) => ({
      code,
      label: filmPriceLabel(code),
      name: FILMS[code].name,
      desc: FILMS[code].short,
    })),
    addons: Object.entries(getPublicAddonPrices()).map(([code, a]) => ({
      code,
      ...a,
      label: ADDON_TEXTS[code]?.label ?? code,
      desc: ADDON_TEXTS[code]?.desc,
      unit: ADDON_TEXTS[code]?.unit,
      image: hasPublic(`addons/${code}.webp`) ? `/addons/${code}.webp` : undefined,
    })),
    texts: {
      ...CALCULATOR,
      trust: ["Оригинальные плёнки Spectroll", WARRANTY_WORK, FILM_LIFE],
    },
    form: { texts: FORM_TEXTS, telegram: TELEGRAM },
  };
}
