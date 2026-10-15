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
  h1Mid: string;
  h1Accent: string;
  lead: string;
  trust: string[];
  step1: string;
  step2: string;
  step3: string;
  brandLabel: string;
  modelLabel: string;
  genLabel: string;
  onlyFull: string;
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

  const gensOfModel = brandCars.filter((c) => c.base === carObj?.base);
  const models = unique(brandCars.map((c) => c.base));
  const pickModel = (base: string) => {
    const first = brandCars.find((c) => c.base === base);
    if (first) pickCar(first.code);
  };
  const selectClass =
    "mt-1 w-full appearance-none rounded-xl border border-white/10 bg-black/60 px-3 py-3 pr-9 text-sm font-bold text-white backdrop-blur focus:border-lime-400 focus:outline-none";
  const chevron = (
    <span aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3 text-xs text-white/50">
      ▼
    </span>
  );

  const photo = (
    <figure className="relative overflow-hidden rounded-3xl">
      {carObj?.hasImage ? (
        <img
          src={carImg(carObj.code)}
          alt={carObj.label}
          width={1600}
          height={900}
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <CarPlaceholder label={carObj?.label ?? ""} className="aspect-[16/9] w-full rounded-3xl" />
      )}
      {carObj?.hasImage && (
        <figcaption className="absolute bottom-2 right-3 text-[11px] text-white/45">{texts.illustration}</figcaption>
      )}
    </figure>
  );

  const selects = (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.35fr]">
      <div className="relative">
        <label htmlFor={`${uid}-brand`} className="text-xs font-bold text-white/55">
          {texts.brandLabel}
        </label>
        <select id={`${uid}-brand`} value={brand} onChange={(e) => pickBrand(e.target.value)} className={selectClass}>
          {brands.map((b) => (
            <option key={b} value={b} className="bg-neutral-900">
              {b}
            </option>
          ))}
        </select>
        {chevron}
      </div>
      <div className="relative">
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
            <option key={m} value={m} className="bg-neutral-900">
              {m}
            </option>
          ))}
        </select>
        {chevron}
      </div>
      <div className="relative">
        <label htmlFor={`${uid}-gen`} className="text-xs font-bold text-white/55">
          {texts.genLabel}
        </label>
        <select
          id={`${uid}-gen`}
          value={car}
          onChange={(e) => pickCar(e.target.value)}
          className={selectClass}
        >
          {gensOfModel.map((g) => (
            <option key={g.code} value={g.code} className="bg-neutral-900">
              {g.gen || g.base}
            </option>
          ))}
        </select>
        {chevron}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
      {/* Hero: заголовок + выбор машины слева, фото справа */}
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)]">
        <div className="space-y-5">
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[44px]">
            {texts.h1}
            <br />
            {texts.h1Mid} <span className="accent">{texts.h1Accent}</span>
          </h1>
          <p className="max-w-xl text-white/60">{texts.lead}</p>
          <div className="lg:hidden">{photo}</div>
          {selects}
          <ul className="grid gap-1.5 text-xs text-white/55">
            {texts.trust.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-lime-400/15 text-[10px] accent">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden lg:block">{photo}</div>
      </section>

      {/* Пакеты: все цены сразу; на телефоне листаются вбок */}
      <section className="mt-10" aria-labelledby={`${uid}-s3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${uid}-s3`} className={stepTitle}>
            {texts.step3}
          </h2>
          <span className="text-xs text-white/45">{texts.pricesHint}</span>
        </div>
        <div
          className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
          role="radiogroup"
          aria-labelledby={`${uid}-s3`}
        >
          {variants.map((x) => {
            const p = priceOf(x);
            const active = x.key === variant;
            return (
              <label
                key={x.key}
                className={`${cardClass(active)} flex w-[82%] shrink-0 cursor-pointer snap-center flex-col overflow-hidden sm:w-auto`}
              >
                <span className="flex items-start justify-between gap-2 p-4 pb-2">
                  <span>
                    <span className="block text-base font-extrabold">{x.scenario.label}</span>
                    <span className="block text-sm text-white/60">{x.film.label}</span>
                  </span>
                  <input
                    type="radio"
                    name={`${uid}-variant`}
                    value={x.key}
                    checked={active}
                    onChange={() => setVariant(x.key)}
                    aria-label={`${x.scenario.label} · ${x.film.label}`}
                    className="mt-1 h-5 w-5 shrink-0 accent-lime-400"
                  />
                </span>
                {x.scenario.image && (
                  <img
                    src={x.scenario.image}
                    alt=""
                    width={832}
                    height={316}
                    loading="lazy"
                    className="aspect-[832/316] w-full object-cover"
                  />
                )}
                <span className="flex flex-1 flex-col p-4 pt-3">
                  <span className="text-xs leading-5 text-white/50">
                    {x.scenario.desc}
                  </span>
                  <span
                    className={`mt-auto whitespace-nowrap pt-3 text-xl font-extrabold tabular-nums ${active ? "accent" : ""}`}
                  >
                    {p ? `от ${formatRub(p.low)}` : "по запросу"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Допы таблицей + «Ваш выбор» */}
      <div className="mt-8 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="dark-card p-4 sm:p-5" aria-labelledby={`${uid}-s4`}>
          <h2 id={`${uid}-s4`} className={stepTitle}>
            {texts.addonsTitle}
          </h2>
          <p className="mt-1 text-xs text-white/45">{texts.addonsNote}</p>
          <ul className="mt-3 divide-y divide-white/8">
            {addons.map((a) => {
              const allowed = !a.onlyScenario || a.onlyScenario === scenario;
              const qty = allowed ? selected[a.code] ?? 0 : 0;
              const line = qty * a.price;
              return (
                <li key={a.code} className={`flex items-center gap-3 py-2.5 ${allowed ? "" : "opacity-45"}`}>
                  {a.image ? (
                    <img src={a.image} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-lg bg-white/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-tight">{a.label}</span>
                    <span className="block text-xs text-white/45">
                      {allowed
                        ? `${addonPriceLabel(a)}${a.unit ? ` / ${a.unit}` : ""}`
                        : `${addonPriceLabel(a)} · ${texts.onlyFull}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${texts.qtyLess}: ${a.label}`}
                      onClick={() => setQty(a.code, Math.max(0, qty - 1))}
                      disabled={!allowed || qty <= 0}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 font-extrabold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold tabular-nums" aria-live="polite">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label={`${texts.qtyMore}: ${a.label}`}
                      onClick={() => setQty(a.code, Math.min(a.maxQty, qty + 1))}
                      disabled={!allowed || qty >= a.maxQty}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 font-extrabold disabled:opacity-30"
                    >
                      +
                    </button>
                  </span>
                  <span
                    className={`hidden w-20 shrink-0 text-right text-sm font-extrabold tabular-nums sm:block ${line > 0 ? "accent" : "text-white/35"}`}
                  >
                    {formatRub(line)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="dark-card p-5 lg:sticky lg:top-28" aria-label={texts.summaryTitle}>
          <h2 className={stepTitle}>{texts.summaryTitle}</h2>
          <div className="mt-4 flex items-center gap-3">
            {carObj?.hasImage ? (
              <img src={carImg(carObj.code, true)} alt="" width={64} height={64} className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <CarPlaceholder label="" className="h-16 w-16 rounded-xl" />
            )}
            <span>
              <span className="block font-extrabold">{carObj?.label}</span>
              <span className="block text-xs text-white/50">{carObj?.gen}</span>
            </span>
          </div>
          {price && total && v ? (
            <>
              <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/60">
                    {v.scenario.label} · {v.film.label}
                  </dt>
                  <dd className="shrink-0 whitespace-nowrap font-bold tabular-nums">{formatRub(price.low)}</dd>
                </div>
                {chosen.map((a) => (
                  <div key={a.code} className="flex justify-between gap-3">
                    <dt className="text-white/60">
                      {a.label}
                      {a.maxQty > 1 ? ` × ${effective[a.code]}` : ""}
                    </dt>
                    <dd className="shrink-0 whitespace-nowrap font-bold tabular-nums">
                      {a.priceMax && a.priceMax > a.price ? "от " : ""}
                      {formatRub(a.price * (effective[a.code] ?? 0))}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-bold text-white/70">{texts.addonsTotal}</span>
                <span className="whitespace-nowrap text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
                  <span className="text-base text-white/60">от </span>
                  <span className="accent">{formatRub(total.low)}</span>
                </span>
              </div>
              <p className="mt-1 text-right text-xs text-white/45">{texts.priceNote}</p>
              <div className="mt-4 grid gap-2">
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
            </>
          ) : (
            <div className="mt-4">
              <div className="font-extrabold">{texts.noModelTitle}</div>
              <p className="mt-1 text-sm text-white/60">{texts.noModelText}</p>
            </div>
          )}
        </aside>
      </div>

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
