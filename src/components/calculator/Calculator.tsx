"use client";

/* eslint-disable @next/next/no-img-element -- статичные картинки из public/, оптимизатор не нужен */

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
  /** Иллюстрация есть в public/cars/{code}.webp. */
  hasImage: boolean;
  /** prices[scenario][film] — только диапазон для клиента. */
  prices: Record<string, Record<string, Price>>;
};

export type CalcOption = { code: string; label: string; desc: string; days: string; image?: string };
export type CalcFilm = { code: string; label: string; name: string; desc: string };

/** Доп из config.ts: одинаковая цена для всех моделей. */
export type CalcAddon = AddonPrice & { code: string; label: string; desc?: string; unit?: string; image?: string };

export type CalculatorTexts = {
  h1: string;
  h1Accent: string;
  lead: string;
  trust: string[];
  step1: string;
  step2: string;
  step3: string;
  illustration: string;
  brandsCount: string;
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

const stepTitle = "text-lg font-extrabold tracking-tight sm:text-xl";

const cardClass = (active: boolean) =>
  `rounded-2xl border text-left transition ${
    active
      ? "border-lime-400 bg-lime-400/[0.07] ring-1 ring-lime-400"
      : "border-white/10 bg-white/[0.03] hover:border-white/25"
  }`;

/** «от 7 000 ₽» для допа с диапазоном, «2 000 ₽» — без. */
const addonPriceLabel = (a: CalcAddon) =>
  a.priceMax && a.priceMax > a.price ? `от ${formatRub(a.price)}` : formatRub(a.price);

const unique = <T,>(xs: T[]) => Array.from(new Set(xs));
const carImg = (code: string, sq = false) => `/cars/${code}${sq ? "-sq" : ""}.webp`;

/** Заглушка, пока нет иллюстрации: силуэт без марки. */
function CarPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`grid place-items-center bg-gradient-to-b from-white/[0.06] to-transparent ${className}`}>
      <svg viewBox="0 0 120 64" aria-label={label} role="img" className="w-1/2 max-w-48 text-white/25" fill="none">
        <path
          d="M12 42 18 27Q20 22 27 21L40 12H78L91 23 101 27Q107 29 108 36L109 44H101A9 9 0 0 1 83 44H38A9 9 0 0 1 20 44H12Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="29" cy="44" r="6" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="92" cy="44" r="6" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </div>
  );
}

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
  const brandCars = cars.filter((c) => c.brand === brand);

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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:pb-16">
      {/* Заголовок + доверие */}
      <h1 className="text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
        {texts.h1} <span className="accent">{texts.h1Accent}</span>
      </h1>
      <p className="mt-3 max-w-2xl text-white/60">{texts.lead}</p>
      <ul className="mt-5 grid grid-cols-1 gap-2 text-xs text-white/60 sm:grid-cols-3">
        {texts.trust.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-400/15 text-[11px] accent">✓</span>
            {t}
          </li>
        ))}
      </ul>

      {/* 1. Марка */}
      <section className="mt-10" aria-labelledby={`${uid}-s1`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={`${uid}-s1`} className={stepTitle}>
            {texts.step1}
          </h2>
          <span className="text-xs text-white/40">{fillTemplate(texts.brandsCount, { n: String(brands.length) })}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {brands.map((b) => {
            const active = b === brand;
            return (
              <button
                key={b}
                type="button"
                aria-pressed={active}
                onClick={() => pickBrand(b)}
                className={`${cardClass(active)} flex min-h-16 items-center justify-center px-2 py-3 text-center text-sm font-extrabold leading-tight`}
              >
                {b}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Модель и поколение + фото */}
      <section className="mt-10" aria-labelledby={`${uid}-s2`}>
        <h2 id={`${uid}-s2`} className={stepTitle}>
          {texts.step2}
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ul className="order-2 grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:max-h-[420px] sm:grid-cols-2 lg:order-1 lg:max-h-[520px] lg:grid-cols-1" role="listbox" aria-labelledby={`${uid}-s2`}>
            {brandCars.map((c) => {
              const active = c.code === car;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pickCar(c.code)}
                    className={`${cardClass(active)} flex w-full items-center gap-3 p-2 pr-3`}
                  >
                    {c.hasImage ? (
                      <img
                        src={carImg(c.code, true)}
                        alt=""
                        width={56}
                        height={56}
                        loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <CarPlaceholder label="" className="h-14 w-14 shrink-0 rounded-xl" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-extrabold">{c.base}</span>
                      <span className="block truncate text-xs text-white/50">{c.gen}</span>
                    </span>
                    <span aria-hidden="true" className={active ? "accent" : "text-white/30"}>
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <figure className="dark-card order-1 overflow-hidden p-0 lg:order-2">
            {carObj?.hasImage ? (
              <img
                src={carImg(carObj.code)}
                alt={carObj.label}
                width={1600}
                height={900}
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <CarPlaceholder label={carObj?.label ?? ""} className="aspect-[16/9] w-full" />
            )}
            <figcaption className="flex flex-wrap items-end justify-between gap-2 p-4 sm:p-5">
              <span>
                <span className="block text-xl font-extrabold sm:text-2xl">{carObj?.label}</span>
                <span className="block text-sm text-white/50">{carObj?.gen}</span>
              </span>
              {carObj?.hasImage && <span className="text-[11px] text-white/35">{texts.illustration}</span>}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* 3. Пакет защиты — все цены сразу */}
      <section className="mt-10" aria-labelledby={`${uid}-s3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${uid}-s3`} className={stepTitle}>
            {texts.step3}
          </h2>
          <span className="text-xs text-white/45">{texts.pricesHint}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-labelledby={`${uid}-s3`}>
          {variants.map((x) => {
            const p = priceOf(x);
            const active = x.key === variant;
            // На телефоне схема пакета — один раз на состав работ (у второй плёнки та же картинка).
            const firstFilm = x.film.code === films[0]?.code;
            return (
              <label key={x.key} className={`${cardClass(active)} flex cursor-pointer flex-col overflow-hidden`}>
                {x.scenario.image && (
                  <img
                    src={x.scenario.image}
                    alt=""
                    width={832}
                    height={316}
                    loading="lazy"
                    className={`aspect-[832/316] w-full object-cover ${firstFilm ? "" : "hidden sm:block"}`}
                  />
                )}
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-base font-extrabold">{x.scenario.label}</span>
                  <span className="text-sm text-white/60">{x.film.label}</span>
                  <span className="mt-2 text-xs leading-5 text-white/45">
                    {x.scenario.desc}. Срок {x.scenario.days}.
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className={`whitespace-nowrap text-xl font-extrabold tabular-nums ${active ? "accent" : ""}`}>
                      {p ? `от ${formatRub(p.low)}` : "по запросу"}
                    </span>
                    <input
                      type="radio"
                      name={`${uid}-variant`}
                      value={x.key}
                      checked={active}
                      onChange={() => setVariant(x.key)}
                      aria-label={`${x.scenario.label} · ${x.film.label}`}
                      className="h-5 w-5 shrink-0 accent-lime-400"
                    />
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Допы */}
      {visibleAddons.length > 0 && (
        <section className="mt-10" aria-labelledby={`${uid}-s4`}>
          <h2 id={`${uid}-s4`} className={stepTitle}>
            {texts.addonsTitle}
          </h2>
          <p className="mt-1 text-xs text-white/50">{texts.addonsNote}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {visibleAddons.map((a) => {
              const qty = selected[a.code] ?? 0;
              const thumb = a.image ? (
                <img src={a.image} alt="" width={64} height={54} loading="lazy" className="h-14 w-16 shrink-0 rounded-lg object-cover" />
              ) : null;
              const info = (
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold leading-tight">{a.label}</span>
                  <span className="mt-1 block text-xs text-white/50">
                    {addonPriceLabel(a)}
                    {a.unit ? ` за ${a.unit}` : ""}
                  </span>
                </span>
              );
              if (a.maxQty > 1) {
                return (
                  <div key={a.code} className={`${cardClass(qty > 0)} flex items-center gap-3 p-2 pr-3`}>
                    {thumb}
                    {info}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`${texts.qtyLess}: ${a.label}`}
                        onClick={() => setQty(a.code, Math.max(0, qty - 1))}
                        disabled={qty <= 0}
                        className="grid h-8 w-8 place-items-center rounded-full border border-white/15 font-extrabold disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-extrabold tabular-nums" aria-live="polite">
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
                <label key={a.code} className={`${cardClass(qty > 0)} flex cursor-pointer items-center gap-3 p-2 pr-3`}>
                  {thumb}
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

      {/* Итог */}
      <section className="dark-card mt-10 p-5 sm:p-6" aria-label={texts.summaryTitle}>
        {price && total && v ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="text-sm font-bold text-white/60">
                {carObj?.label} · {v.scenario.label} · {v.film.label}
                {chosen.map((a) => `, ${a.label.toLowerCase()}${a.maxQty > 1 ? ` × ${effective[a.code]}` : ""}`).join("")}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm font-bold text-white/60">{texts.addonsTotal}</span>
                <span className="whitespace-nowrap text-4xl font-extrabold tracking-[-0.03em] tabular-nums">
                  от <span className="accent">{formatRub(total.low)}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-white/45">{texts.priceNote}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:w-[420px]">
              <button type="button" onClick={book} className="btn-accent justify-center">
                {texts.bookButton} →
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
          </div>
        ) : (
          <div>
            <div className="font-extrabold">{texts.noModelTitle}</div>
            <p className="mt-1 text-sm text-white/60">{texts.noModelText}</p>
          </div>
        )}
      </section>

      {/* Заявка */}
      {price && v && (
        <section ref={formRef} id="zayavka" className="dark-card mt-6 scroll-mt-28 p-5 sm:p-6">
          <h2 className="text-2xl font-extrabold tracking-tight">{texts.leadTitle}</h2>
          <p className="mt-2 text-sm text-white/60">{texts.leadText}</p>
          <div className="mt-5 max-w-xl">
            <LeadForm
              content={form}
              selection={{ carCode: car, scenario, filmCode: film, addons: effective }}
              submitLabel={texts.bookButton}
              onSuccess={() => setSent(true)}
            />
          </div>
        </section>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
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
