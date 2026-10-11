import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { Suspense } from "react";
import Calculator, { type CalcCar } from "@/components/calculator/Calculator";
import { getPublicAddonPrices, getPublicCatalog } from "@/server/pricing/public";
import {
  ADDON_TEXTS,
  CALCULATOR,
  FILMS,
  FILM_CODES,
  FORM_TEXTS,
  SCENARIOS,
  SCENARIO_CODES,
  TELEGRAM,
  TOP_MODELS,
  filmLabel,
} from "@/content/site";

export const revalidate = 3600;

export default function CalculatorPage() {
  // Только low/high: getPublicCatalog не отдаёт цену партнёра и себестоимость.
  const catalog: CalcCar[] = getPublicCatalog().map((c) => ({
    code: c.code,
    label: `${c.brand} ${c.model}`,
    prices: c.prices,
  }));
  const topCars = TOP_MODELS.map((code) => catalog.find((c) => c.code === code)).filter(
    (c): c is CalcCar => Boolean(c)
  );
  const otherCars = catalog.filter((c) => !TOP_MODELS.includes(c.code));

  return (
    <div className="dark-grid min-h-screen text-white">
      <SiteHeader />

      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center text-sm text-white/50">Загрузка...</div>
        }
      >
        <Calculator
          topCars={topCars}
          otherCars={otherCars}
          scenarios={SCENARIO_CODES.map((code) => ({
            code,
            label: SCENARIOS[code].label,
            desc: SCENARIOS[code].desc,
          }))}
          films={FILM_CODES.map((code) => ({
            code,
            label: filmLabel(code),
            name: FILMS[code].name,
            desc: FILMS[code].short,
          }))}
          addons={Object.entries(getPublicAddonPrices()).map(([code, a]) => ({
            code,
            ...a,
            label: ADDON_TEXTS[code]?.label ?? code,
            desc: ADDON_TEXTS[code]?.desc,
            unit: ADDON_TEXTS[code]?.unit,
          }))}
          texts={CALCULATOR}
          form={{ texts: FORM_TEXTS, telegram: TELEGRAM }}
        />
      </Suspense>

      <SiteFooter />
    </div>
  );
}
