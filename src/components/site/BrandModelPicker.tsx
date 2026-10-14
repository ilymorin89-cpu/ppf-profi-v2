"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PickerGen = { code: string; label: string };
export type PickerModel = { base: string; gens: PickerGen[] };
export type PickerBrand = { slug: string; name: string; models: PickerModel[] };

type Props = {
  brands: PickerBrand[];
  initialSlug?: string;
  texts: { title: string; brand: string; model: string; gen: string; other: string; button: string };
};

const selectClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none";
const OTHER = "__other__";

/**
 * Выбор «марка → модель → поколение».
 * Поколение из каталога ведёт в калькулятор, «Другая модель» — на страницу марки.
 */
export default function BrandModelPicker({ brands, initialSlug, texts }: Props) {
  const router = useRouter();
  const start = brands.find((b) => b.slug === initialSlug) ?? brands[0];
  const [slug, setSlug] = useState(start?.slug ?? "");
  const [base, setBase] = useState(start?.models[0]?.base ?? OTHER);
  const [code, setCode] = useState(start?.models[0]?.gens[0]?.code ?? "");

  const brand = brands.find((b) => b.slug === slug);
  const model = brand?.models.find((m) => m.base === base);

  function pickBrand(s: string) {
    setSlug(s);
    const b = brands.find((x) => x.slug === s);
    const m = b?.models[0];
    setBase(m?.base ?? OTHER);
    setCode(m?.gens[0]?.code ?? "");
  }
  function pickModel(v: string) {
    setBase(v);
    const m = brand?.models.find((x) => x.base === v);
    setCode(m?.gens[0]?.code ?? "");
  }
  function go() {
    if (base !== OTHER && code) router.push(`/calculator?car=${encodeURIComponent(code)}`);
    else router.push(`/ppf/${slug}`);
  }

  return (
    <div className="dark-card p-5 sm:p-6">
      <h2 className="text-lg font-extrabold">{texts.title}</h2>
      <div className="mt-4 grid gap-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{texts.brand}</label>
          <select value={slug} onChange={(e) => pickBrand(e.target.value)} className={selectClass}>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug} className="bg-neutral-900 text-white">
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{texts.model}</label>
            <select value={base} onChange={(e) => pickModel(e.target.value)} className={selectClass}>
              {brand?.models.map((m) => (
                <option key={m.base} value={m.base} className="bg-neutral-900 text-white">
                  {m.base}
                </option>
              ))}
              <option value={OTHER} className="bg-neutral-900 text-white">
                {texts.other}
              </option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{texts.gen}</label>
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={!model}
              className={`${selectClass} disabled:opacity-40`}
            >
              {model?.gens.map((g) => (
                <option key={g.code} value={g.code} className="bg-neutral-900 text-white">
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <button type="button" onClick={go} className="btn-accent mt-5 w-full justify-center">
        {texts.button}
      </button>
    </div>
  );
}
