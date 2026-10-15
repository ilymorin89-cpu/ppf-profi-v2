"use client";

import Link from "next/link";
import { useState, useId } from "react";
import { fillTemplate, formatRub } from "@/shared/format";

type Price = { low: number; high: number } | null;

export type MiniCar = { code: string; brand: string; model: string; full: Price; risk: Price };

type Props = {
  cars: MiniCar[];
  texts: {
    title: string;
    brand: string;
    model: string;
    more: string;
    full: string;
    risk: string;
    note: string;
  };
};

const selectClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none";

/** Мини-калькулятор в hero: марка → модель → цены «от» (только low, без года). */
export default function HeroCalculator({ cars, texts }: Props) {
  const uid = useId();
  const brands = Array.from(new Set(cars.map((c) => c.brand)));
  const [brand, setBrand] = useState(cars[0]?.brand ?? "");
  const [code, setCode] = useState(cars[0]?.code ?? "");
  const car = cars.find((c) => c.code === code);

  return (
    <div className="dark-card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{texts.title}</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-1`} className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
            {texts.brand}
          </label>
          <select id={`${uid}-1`}
            value={brand}
            onChange={(e) => {
              const b = e.target.value;
              setBrand(b);
              const first = cars.find((c) => c.brand === b);
              if (first) setCode(first.code);
            }}
            className={selectClass}
          >
            {brands.map((b) => (
              <option key={b} className="bg-neutral-900 text-white">
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-2`} className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
            {texts.model}
          </label>
          <select id={`${uid}-2`} value={code} onChange={(e) => setCode(e.target.value)} className={selectClass}>
            {cars
              .filter((c) => c.brand === brand)
              .map((c) => (
                <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                  {c.model}
                </option>
              ))}
          </select>
        </div>
      </div>

      {car && (car.full || car.risk) && (
        <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-black/40 p-4 text-sm">
          {/* Сначала зоны риска: вход в услугу с меньшей суммы. */}
          {car.risk && (
            <div className="font-extrabold">
              {fillTemplate(texts.risk, { price: formatRub(car.risk.low) })}
            </div>
          )}
          {car.full && (
            <div className="font-bold text-white/75">
              {fillTemplate(texts.full, { price: formatRub(car.full.low) })}
            </div>
          )}
          <p className="pt-1 text-xs leading-5 text-white/50">{texts.note}</p>
        </div>
      )}

      <Link
        href={code ? `/calculator?car=${code}` : "/calculator"}
        className="btn-accent mt-5 w-full justify-center"
      >
        {texts.more}
      </Link>
    </div>
  );
}
