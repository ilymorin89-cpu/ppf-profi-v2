/* eslint-disable @next/next/no-img-element -- фото из public/cars, оптимизатор не нужен */
import Link from "next/link";
import type { CalcCar } from "@/components/calculator/Calculator";
import { TOP_MODELS } from "@/content/site";
import { formatRub } from "@/shared/format";

/**
 * Статический блок над калькулятором на / и /calculator: карточки основных моделей с фото
 * и полный список публичных «от». Рендерится вне <Suspense>, поэтому попадает в HTML до JS.
 *
 * Цены — только публичные «от» из getCalculatorProps().cars, тот же источник, что у калькулятора.
 * Цену партнёра и себестоимость сюда не передают. Серверный компонент: без "use client" и без useSearchParams.
 */

/** Базовая плёнка Spectroll TPU-S 180 мкм (PPF_STANDARD). Премиум и NAR здесь не показываем. */
const FILM = "PPF_STANDARD";

const TITLE = "Калькулятор оклейки авто плёнкой PPF в Москве";
const DESCRIPTION =
  "Выберите марку и модель: покажем цену полной оклейки и зон риска на плёнке Spectroll. Цены указаны «от», точную сумму подтверждаем после осмотра.";

type Props = {
  cars: CalcCar[];
  /** На главной блок открывается заголовком и описанием. На /calculator заголовок уже задаёт H1 страницы. */
  intro?: boolean;
};

const riskOf = (c: CalcCar) => c.prices.RISK_ZONES?.[FILM]?.low;
const fullOf = (c: CalcCar) => c.prices.FULL?.[FILM]?.low;

export default function CalculatorStaticBlock({ cars, intro = false }: Props) {
  const byCode = new Map(cars.map((c) => [c.code, c] as const));
  // Карточки — только модели с фото и ценой: фото не ставим под чужую подпись.
  const top = TOP_MODELS.map((code) => byCode.get(code)).filter(
    (c): c is CalcCar => c !== undefined && c.hasImage && (riskOf(c) !== undefined || fullOf(c) !== undefined)
  );
  // Полный текстовый список — для поисковиков и для тех, кто ищет свою модель.
  const all = cars.filter((c) => riskOf(c) !== undefined || fullOf(c) !== undefined);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-20">
      {intro ? (
        <div className="max-w-3xl">
          <h2 className="text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl">{TITLE}</h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">{DESCRIPTION}</p>
        </div>
      ) : (
        <h2 className="sr-only">Популярные модели и цены «от»</h2>
      )}

      <ul className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${intro ? "mt-10" : ""}`}>
        {top.map((c) => {
          const risk = riskOf(c);
          const full = fullOf(c);
          return (
            <li key={c.code}>
              <Link
                href={`/calculator?car=${c.code}`}
                aria-label={`Рассчитать оклейку: ${c.label}, ${c.gen}`}
                className="dark-card block overflow-hidden transition hover:border-lime-400/40"
              >
              <img
                src={`/cars/${c.code}.webp`}
                alt={`${c.label}, ${c.gen}`}
                width={1600}
                height={900}
                loading="lazy"
                decoding="async"
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] accent">{c.brand}</span>
                  <span className="text-xs text-white/60">{c.gen}</span>
                </div>
                <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-white">{c.base}</h3>
                <div className="mt-4 space-y-2 text-base leading-relaxed sm:text-lg">
                  {risk !== undefined && (
                    <p>
                      Зоны риска — от <span className="font-bold accent">{formatRub(risk)}</span>
                    </p>
                  )}
                  {full !== undefined && (
                    <p className="text-white/90">
                      Полная оклейка — от <span className="font-bold text-white">{formatRub(full)}</span>
                    </p>
                  )}
                </div>
                <div className="mt-5 text-base font-extrabold accent sm:text-lg">Рассчитать стоимость →</div>
              </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/ceny" className="btn-accent">
          Все марки и цены →
        </Link>
        <Link href="/ppf" className="btn-ghost">
          Марки и модели →
        </Link>
      </div>

      <details className="dark-card group mt-10 p-5 sm:p-6">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold">
          Все модели и цены «от»
          <span aria-hidden="true" className="accent inline-block text-xl transition group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="mt-5 grid gap-x-6 gap-y-4 text-base leading-relaxed sm:grid-cols-2 lg:grid-cols-3">
          {all.map((c) => {
            const risk = riskOf(c);
            const full = fullOf(c);
            return (
              <li key={c.code}>
                <div className="font-bold">
                  {c.label} <span className="font-normal text-white/50">{c.gen}</span>
                </div>
                {risk !== undefined && <div>Зоны риска — от {formatRub(risk)}</div>}
                {full !== undefined && <div className="text-white/65">Полная оклейка — от {formatRub(full)}</div>}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

/** Заглушка на время загрузки калькулятора: без текста, чтобы страница не прыгала. */
export function CalculatorSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-hidden="true">
      <div className="dark-card h-[420px] animate-pulse" />
    </div>
  );
}
