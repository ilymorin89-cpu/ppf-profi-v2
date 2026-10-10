import Link from "next/link";
import { Suspense } from "react";
import Calculator, { type CalcCar } from "@/components/calculator/Calculator";
import { getPublicCatalog } from "@/server/pricing/public";
import {
  CALCULATOR,
  CONTACTS,
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
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-lg font-extrabold tracking-[0.12em]">
            PPF <span className="accent">PROFI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden text-xs font-bold text-white/50 hover:text-white sm:block">
              ← На главную
            </Link>
            <a href={CONTACTS.phoneHref} className="text-sm font-bold accent">
              Позвонить
            </a>
          </div>
        </div>
      </header>

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
          texts={CALCULATOR}
          form={{ texts: FORM_TEXTS, telegram: TELEGRAM }}
        />
      </Suspense>
    </div>
  );
}
