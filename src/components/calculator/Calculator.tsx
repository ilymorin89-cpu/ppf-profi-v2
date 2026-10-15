"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import LeadForm from "@/components/forms/LeadForm";
import type { FormContent } from "@/components/forms/FormParts";
import { buildTelegramUrl, fillTemplate, formatRub } from "@/shared/format";
import { addonsRange, forScenario, type AddonPrice, type AddonSelection } from "@/shared/addons";

type Price = { low: number; high: number } | null;

export type CalcCar = {
  code: string;
  brand: string;
  /** Модель без поколения («X5») и подпись поколения («G05 · 2018–н.в.»). */
  base: string;
  gen: string;
  label: string;
  /** prices[scenario][film] — только диапазон для клиента. */
  prices: Record<string, Record<string, Price>>;
};

export type CalcOption = { code: string; label: string; desc: string; days: string };
export type CalcFilm = { code: string; label: string; name: string; desc: string };

/** Доп из config.ts: одинаковая цена для всех моделей. */
export type CalcAddon = AddonPrice & { code: string; label: string; desc?: string; unit?: string };

export type CalculatorTexts = {
  h1: string;
  lead: string;
  carTitle: string;
  brandLabel: string;
  modelLabel: string;
  genLabel: string;
  pricesTitle: string;
  pricesHint: string;
  summaryTitle: string;
  bookButton: string;
  newCalc: string;
  toHome: string;
  priceNote: string;
  noModelTitle: string;
  noModelText: string;
  telegramTemplate: string;
  leadTitle: string;
  leadText: string;
  successTitle: string;
  successText: string;
  addonsTitle: string;
  addonsNote: string;
  addonsTotal: string;
  qtyLess: string;
  qtyMore: string;
};

type Props = {
  /** Машины в порядке показа: марки сайта первыми, внутри — как в каталоге. */
  cars: CalcCar[];
  defaultCar?: string;
  scenarios: CalcOption[];
  films: CalcFilm[];
  addons: CalcAddon[];
  texts: CalculatorTexts;
  form: FormContent;
};

/** Вариант защиты = состав работ × плёнка (Зоны риска · TPU-S 180 и т. д.). */
type Variant = { key: string; scenario: CalcOption; film: CalcFilm };

const selectClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none";
const optionClass = "bg-neutral-900 text-white";
const sectionTitle = "text-xs font-extrabold uppercase tracking-[0.16em] text-white/50";

const cardClass = (active: boolean) =>
  `rounded-2xl border px-4 py-4 text-left transition sm:px-5 ${
    active
      ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
      : "border-white/8 bg-white/[0.03] hover:border-white/20"
  }`;

/** «от 7 000 ₽» для допа с диапазоном, «2 000 ₽» — без. */
const addonPriceLabel = (a: CalcAddon) =>
  a.priceMax && a.priceMax > a.price ? `от ${formatRub(a.price)}` : formatRub(a.price);

const unique = <T,>(xs: T[]) => Array.from(new Set(xs));

export default function Calculator({ cars, defaultCar, scenarios, films, addons, texts, form }: Props) {
  const uid = useId();
  const searchParams = useSearchParams();
  const fromUrl = cars.find((c) => c.code === searchParams.get("car"));
  const start = fromUrl ?? cars.find((c) => c.code === defaultCar) ?? cars[0];

  const [car, setCar] = useState(start?.code ?? "");
  const variants: Variant[] = scenarios
    .slice()
    // Зоны риска первыми: с них проще начать.
    .sort((a, b) => (a.code === "RISK_ZONES" ? -1 : b.code === "RISK_ZONES" ? 1 : 0))
    .flatMap((s) => films.map((f) => ({ key: `${s.code}:${f.code}`, scenario: s, film: f })));
  const [variant, setVariant] = useState(variants[0]?.key ?? "");
  const [selected, setSelected] = useState<AddonSelection>({});
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const carObj = cars.find((c) => c.code === car);
  const brands = unique(cars.map((c) => c.brand));
  const brand = carObj?.brand ?? brands[0];
  const models = unique(cars.filter((c) => c.brand === brand).map((c) => c.base));
  const gens = cars.filter((c) => c.brand === brand && c.base === carObj?.base);

  const v = variants.find((x) => x.key === variant) ?? variants[0];
  const scenario = v?.scenario.code ?? "";
  const film = v?.film.code ?? "";
  const priceOf = (x: Variant): Price => carObj?.prices[x.scenario.code]?.[x.film.code] ?? null;
  const price = v ? priceOf(v) : null;

  // Итог на клиенте только для показа; при отправке заявки сервер считает заново.
  const addonPrices: Record<string, AddonPrice> = Object.fromEntries(addons.map((a) => [a.code, a]));
  const visibleAddons = addons.filter((a) => !a.onlyScenario || a.onlyScenario === scenario);
  const effective = forScenario(selected, addonPrices, scenario);
  const extra = addonsRange(effective, addonPrices);
  const total: Price = price ? { low: price.low + extra.low, high: price.high + extra.high } : null;
  const chosen = visibleAddons.filter((a) => (effective[a.code] ?? 0) > 0);

  const setQty = (code: string, qty: number) =>
    setSelected((s) => {
      const next = { ...s };
      if (qty > 0) next[code] = qty;
      else delete next[code];
      return next;
    });

  /** Смена машины: ссылка с ?car= остаётся актуальной, чтобы расчётом можно было поделиться. */
  function pickCar(code: string) {
    setCar(code);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("car", code);
      window.history.replaceState(null, "", url);
    } catch {
      /* адресная строка недоступна — не страшно */
    }
  }
  const pickBrand = (b: string) => {
    const first = cars.find((c) => c.brand === b);
    if (first) pickCar(first.code);
  };
  const pickModel = (base: string) => {
    const first = cars.find((c) => c.brand === brand && c.base === base);
    if (first) pickCar(first.code);
  };

  const book = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
  };

  const tgText =
    carObj && v && total
      ? fillTemplate(texts.telegramTemplate, {
          model: carObj.label,
          scenario:
            v.scenario.label.toLowerCase() +
            chosen
              .map((a) => `, ${a.label.toLowerCase()}${a.maxQty > 1 ? ` × ${effective[a.code]}` : ""}`)
              .join(""),
          film: v.film.name,
          price: `от ${formatRub(total.low)}`,
        })
      : undefined;

  const noModel = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="font-extrabold">{texts.noModelTitle}</div>
      <p className="mt-1 text-sm text-white/60">{texts.noModelText}</p>
      <a
        href={buildTelegramUrl(form.telegram)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-4 inline-flex text-sm"
      >
        {form.texts.telegramButton}
      </a>
    </div>
  );

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-400/15 ring-1 ring-lime-400/40">
          <span className="text-4xl accent">✓</span>
        </div>
        <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">{texts.successTitle}</h1>
        <p className="mt-4 text-white/60">{texts.successText}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => setSent(false)} className="btn-accent justify-center">
            {texts.newCalc}
          </button>
          <Link href="/" className="btn-ghost justify-center">
            {texts.toHome}
          </Link>
        </div>
      </div>
    );
  }

  const summary = (
    <div className="dark-card p-5 sm:p-6">
      <div className={sectionTitle}>{texts.summaryTitle}</div>
      <div className="mt-3 text-lg font-extrabold leading-tight">{carObj?.label}</div>
      {carObj?.gen && <div className="mt-0.5 text-xs text-white/50">{carObj.gen}</div>}
      {price && total && v ? (
        <>
          <div className="mt-4 space-y-1.5 border-b border-white/10 pb-4 text-sm text-white/70">
            <div className="flex justify-between gap-4">
              <span>
                {v.scenario.label} · {v.film.label}
              </span>
              <span className="shrink-0 whitespace-nowrap tabular-nums">от {formatRub(price.low)}</span>
            </div>
            {chosen.map((a) => {
              const qty = effective[a.code];
              return (
                <div key={a.code} className="flex justify-between gap-4">
                  <span>
                    {a.label}
                    {a.maxQty > 1 ? ` × ${qty}` : ""}
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    {a.priceMax && a.priceMax > a.price ? "от " : ""}
                    {formatRub(a.price * qty)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="text-sm font-bold text-white/60">{texts.addonsTotal}</span>
            <span className="whitespace-nowrap text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
              от <span className="accent">{formatRub(total.low)}</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-white/50">{texts.priceNote}</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={book} className="btn-accent justify-center">
              {texts.bookButton}
            </button>
            <a
              href={buildTelegramUrl(form.telegram, tgText)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost justify-center"
            >
              {form.texts.telegramButton}
            </a>
          </div>
        </>
      ) : (
        <div className="mt-4">{noModel}</div>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-6 lg:pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{texts.h1}</h1>
      <p className="mt-3 max-w-2xl text-white/60">{texts.lead}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* 1. Машина */}
          <section className="dark-card p-5 sm:p-6">
            <h2 className={sectionTitle}>{texts.carTitle}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`${uid}-brand`} className="text-xs font-bold text-white/55">
                  {texts.brandLabel}
                </label>
                <select
                  id={`${uid}-brand`}
                  value={brand}
                  onChange={(e) => pickBrand(e.target.value)}
                  className={selectClass}
                >
                  {brands.map((b) => (
                    <option key={b} value={b} className={optionClass}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-model`} className="text-xs font-bold text-white/55">
                  {texts.modelLabel}
                </label>
                <select
                  id={`${uid}-model`}
                  value={carObj?.base ?? ""}
                  onChange={(e) => pickModel(e.target.value)}
                  className={selectClass}
                >
                  {models.map((m) => (
                    <option key={m} value={m} className={optionClass}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-gen`} className="text-xs font-bold text-white/55">
                  {texts.genLabel}
                </label>
                <select
                  id={`${uid}-gen`}
                  value={car}
                  onChange={(e) => pickCar(e.target.value)}
                  disabled={gens.length < 2}
                  className={`${selectClass} disabled:opacity-60`}
                >
                  {gens.map((g) => (
                    <option key={g.code} value={g.code} className={optionClass}>
                      {g.gen || g.base}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 2. Варианты защиты — все цены сразу */}
          <section className="dark-card p-5 sm:p-6" aria-labelledby={`${uid}-prices`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`${uid}-prices`} className={sectionTitle}>
                {texts.pricesTitle}
              </h2>
              <span className="text-xs text-white/45">{texts.pricesHint}</span>
            </div>
            <div className="mt-4 grid gap-2" role="radiogroup" aria-labelledby={`${uid}-prices`}>
              {variants.map((x) => {
                const p = priceOf(x);
                const active = x.key === variant;
                return (
                  <label key={x.key} className={`${cardClass(active)} flex cursor-pointer items-start gap-3`}>
                    <input
                      type="radio"
                      name={`${uid}-variant`}
                      value={x.key}
                      checked={active}
                      onChange={() => setVariant(x.key)}
                      className="mt-1 h-4 w-4 shrink-0 accent-lime-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="font-extrabold text-white">
                          {x.scenario.label}
                          <span className="font-semibold text-white/55"> · {x.film.label}</span>
                        </span>
                        <span
                          className={`whitespace-nowrap font-extrabold tabular-nums ${active ? "accent" : "text-white"}`}
                        >
                          {p ? `от ${formatRub(p.low)}` : "по запросу"}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-white/50">
                        {x.scenario.desc}. Срок {x.scenario.days}.
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* 3. Допы */}
          {visibleAddons.length > 0 && (
            <section className="dark-card p-5 sm:p-6">
              <h2 className={sectionTitle}>{texts.addonsTitle}</h2>
              <p className="mt-2 text-xs text-white/50">{texts.addonsNote}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {visibleAddons.map((a) => {
                  const qty = selected[a.code] ?? 0;
                  const info = (
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-white">{a.label}</span>
                      <span className="mt-1 block text-xs text-white/50">
                        {addonPriceLabel(a)}
                        {a.unit ? ` за ${a.unit}` : ""}
                        {a.desc ? ` · ${a.desc}` : ""}
                      </span>
                    </span>
                  );
                  if (a.maxQty > 1) {
                    return (
                      <div key={a.code} className={`${cardClass(qty > 0)} flex items-center gap-3`}>
                        {info}
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            aria-label={`${texts.qtyLess}: ${a.label}`}
                            onClick={() => setQty(a.code, Math.max(0, qty - 1))}
                            disabled={qty <= 0}
                            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 font-extrabold disabled:opacity-30"
                          >
                            −
                          </button>
                          <span className="w-5 text-center font-extrabold tabular-nums" aria-live="polite">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`${texts.qtyMore}: ${a.label}`}
                            onClick={() => setQty(a.code, Math.min(a.maxQty, qty + 1))}
                            disabled={qty >= a.maxQty}
                            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 font-extrabold disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <label key={a.code} className={`${cardClass(qty > 0)} flex cursor-pointer items-center gap-3`}>
                      {info}
                      <input
                        type="checkbox"
                        checked={qty > 0}
                        onChange={(e) => setQty(a.code, e.target.checked ? 1 : 0)}
                        className="h-5 w-5 shrink-0 accent-lime-400"
                      />
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Итог на телефоне — перед заявкой; на компьютере он справа */}
          <div className="lg:hidden">{summary}</div>

          {/* 4. Заявка */}
          {price && v && (
            <section ref={formRef} id="zayavka" className="dark-card scroll-mt-28 p-5 sm:p-6">
              <h2 className="text-2xl font-extrabold tracking-tight">{texts.leadTitle}</h2>
              <p className="mt-2 text-sm text-white/60">{texts.leadText}</p>
              <div className="mt-5">
                <LeadForm
                  content={form}
                  selection={{ carCode: car, scenario, filmCode: film, addons: effective }}
                  submitLabel={texts.bookButton}
                  onSuccess={() => setSent(true)}
                />
              </div>
            </section>
          )}

          {noModel}
        </div>

        <aside className="hidden lg:sticky lg:top-28 lg:block">{summary}</aside>
      </div>

      {/* Телефон: итог и кнопка всегда под рукой */}
      {price && total && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs text-white/55">{carObj?.label}</div>
              <div className="whitespace-nowrap text-lg font-extrabold tabular-nums">
                от <span className="accent">{formatRub(total.low)}</span>
              </div>
            </div>
            <button type="button" onClick={book} className="btn-accent shrink-0">
              {texts.bookButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
