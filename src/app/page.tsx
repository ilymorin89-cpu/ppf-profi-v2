import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import HeroCalculator, { type MiniCar } from "@/components/site/HeroCalculator";
import HomeLeadForm from "@/components/site/HomeLeadForm";
import CaseCard from "@/components/site/CaseCard";
import {
  getExampleLow,
  getHomeExample,
  getPublicAddonPrices,
  getPublicCatalog,
} from "@/server/pricing/public";
import { fillTemplate } from "@/shared/format";
import { getPartnerExample, spreadText } from "@/server/pricing/partner-example";
import JsonLd from "@/components/site/JsonLd";
import { allBrandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";
import {
  ADDON_TEXTS,
  BRAND_PAGE,
  CALCULATOR,
  CASES,
  FACT_TILES,
  FAQ,
  FILM_CODES,
  FORM_TEXTS,
  HOME,
  HOW_STEPS,
  PRICE_EXAMPLE,
  SCENARIOS,
  SCENARIO_CODES,
  SEO,
  TELEGRAM,
  TOP_MODELS,
  filmLabel,
  scenarioDays,
  formatRub,
  telegramUrl,
} from "@/content/site";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const title = SEO.home.title;
  const description = fillTemplate(SEO.home.description, { price: formatRub(getExampleLow()) });
  return {
    title,
    description,
    alternates: { canonical: "/" },
    openGraph: { title, description, url: "/" },
  };
}

const STD = "PPF_STANDARD" as const;

export default function HomePage() {
  // Только low/high — цена партнёра и себестоимость сюда не попадают.
  const catalog = getPublicCatalog();
  const miniCars: MiniCar[] = catalog.map((c) => ({
    code: c.code,
    brand: c.brand,
    model: c.model,
    full: c.prices.FULL[STD],
    risk: c.prices.RISK_ZONES[STD],
  }));
  const topCars = TOP_MODELS.map((code) => miniCars.find((c) => c.code === code)).filter(
    (c): c is MiniCar => Boolean(c && (c.full || c.risk))
  );
  // Сначала шесть основных моделей — мини-калькулятор открывается на X5 G05.
  const orderedCars = [...topCars, ...miniCars.filter((c) => !topCars.includes(c))];
  const formCars = orderedCars.map((c) => ({ code: c.code, label: `${c.brand} ${c.model}` }));
  // Пример расчёта: X5 G05 FULL · Spectroll TPU-S + допы, все числа из src/server/pricing/config.ts.
  const example = getHomeExample();
  // Минимальная цена зон риска среди моделей главной — «вход» в услугу.
  const riskLows = topCars.map((c) => c.risk?.low).filter((v): v is number => typeof v === "number");
  const minRisk = riskLows.length > 0 ? Math.min(...riskLows) : null;
  const addonPrices = getPublicAddonPrices() as Record<string, { price: number }>;

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd data={[organizationSchema(), serviceSchema("Оклейка авто защитной плёнкой PPF в Москве", allBrandCars())]} />
      <SiteHeader onHome />

      {/* HERO + мини-калькулятор */}
      <section id="calculator" className="scroll-mt-28 overflow-hidden">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:pt-16">
          <div className="reveal">
            <div className="eyebrow">{HOME.eyebrow}</div>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
              {HOME.h1Lead}{" "}
              <span className="accent">
                {fillTemplate(HOME.h1Price, { price: formatRub(getExampleLow()) })}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              {HOME.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/calculator" className="btn-accent">
                {HOME.ctaCalc}
              </Link>
              <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                {HOME.ctaTelegram}
              </a>
            </div>

            {/* Картинка первого экрана: файл public/hero.jpg */}
            <div className="mt-10 overflow-hidden rounded-3xl border border-white/8 bg-black">
              <Image
                src="/hero.jpg"
                alt="Премиальный внедорожник"
                width={1672}
                height={941}
                sizes="(min-width: 1024px) 50vw, 100vw"
                preload
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="reveal">
            <HeroCalculator
              cars={orderedCars}
              texts={{
                title: HOME.miniCalcTitle,
                brand: HOME.miniCalcBrand,
                model: HOME.miniCalcModel,
                more: HOME.miniCalcMore,
                full: HOME.pricesFull,
                risk: HOME.pricesRisk,
                note: HOME.pricesNote,
              }}
            />
          </div>
        </div>
      </section>

      {/* ПОЛОСА ФАКТОВ */}
      <section className="border-y border-white/8 bg-black/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {FACT_TILES.map((f) => (
            <div key={f.label}>
              <div className="text-2xl font-extrabold accent sm:text-3xl">{f.value}</div>
              <div className="mt-2 text-xs leading-5 text-white/60">{f.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ЦЕНЫ ШЕСТИ МОДЕЛЕЙ */}
      {topCars.length > 0 && (
        <section id="prices" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6">
          <div className="eyebrow">{HOME.pricesEyebrow}</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {HOME.pricesTitle}
          </h2>
          {minRisk !== null && (
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              {fillTemplate(HOME.pricesLead, { price: formatRub(minRisk) })}
            </p>
          )}
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCars.map((c) => (
              <Link
                key={c.code}
                href={`/calculator?car=${c.code}`}
                className="dark-card block p-5 transition hover:border-lime-400/40"
              >
                <div className="text-lg font-extrabold">
                  {c.brand} {c.model}
                </div>
                {/* Сначала зоны риска: вход в услугу с меньшей суммы. */}
                {c.risk && (
                  <div className="mt-3 text-sm font-bold">
                    {fillTemplate(HOME.pricesRisk, { price: formatRub(c.risk.low) })}
                  </div>
                )}
                {c.full && (
                  <div className="mt-1 text-sm text-white/65">
                    {fillTemplate(HOME.pricesFull, { price: formatRub(c.full.low) })}
                  </div>
                )}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/50">{HOME.pricesNote}</p>
          <Link href="/ppf" className="mt-3 inline-block text-sm font-bold accent hover:underline">
            {BRAND_PAGE.allBrands}
          </Link>

          {HOME.showExample && example && (
            <div className="dark-card mt-8 max-w-xl p-5 sm:p-6">
              <div className="text-sm font-extrabold uppercase tracking-[0.14em] accent">
                {HOME.exampleTitle}
              </div>
              <div className="mt-2 text-sm text-white/60">
                {fillTemplate(HOME.exampleText, { car: PRICE_EXAMPLE.carFullName })}
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-white/75">
                <div>{fillTemplate(HOME.exampleBase, { price: formatRub(example.base.low) })}</div>
                {Object.entries(example.selection).map(([code, qty]) => (
                  <div key={code}>
                    {ADDON_TEXTS[code]?.label ?? code}
                    {qty > 1 ? ` × ${qty}` : ""} — {formatRub(addonPrices[code].price * qty)}
                  </div>
                ))}
              </div>
              <div className="mt-4 text-lg font-extrabold">
                {fillTemplate(HOME.exampleTotal, { price: formatRub(example.total.low) })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ЧТО КЛЕИМ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="eyebrow">{HOME.wrapEyebrow}</div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.wrapTitle}</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {SCENARIO_CODES.map((code) => (
            <div key={code} className="dark-card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-lg font-extrabold">{SCENARIOS[code].label}</div>
                <div className="shrink-0 text-sm font-bold accent">{scenarioDays(code)}</div>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/60">{SCENARIOS[code].desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ПЛЁНКА */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.filmTitle}</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {FILM_CODES.map((code) => (
            <div key={code} className="dark-card p-6">
              <div className="text-lg font-extrabold">{filmLabel(code)}</div>
              <p className="mt-2 text-sm leading-6 text-white/60">{HOME.filmText[code]}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-white/70">{HOME.filmCaption}</p>
        <p className="mt-2 text-[11px] text-white/40">{HOME.filmFootnote}</p>
      </section>

      {/* РАБОТЫ — скрыт, если кейсов нет */}
      {CASES.length > 0 && (
        <section id="works" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20 sm:px-6">
          <div className="eyebrow">{HOME.worksEyebrow}</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.worksTitle}</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {CASES.map((c, i) => (
              <CaseCard key={`${c.model}-${i}`} item={c} />
            ))}
          </div>
        </section>
      )}

      {/* КАК ПРОХОДИТ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="eyebrow">{HOME.howEyebrow}</div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.howTitle}</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s, i) => (
            <div key={s.title} className="dark-card p-6">
              <div className="text-2xl font-extrabold accent">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-3 font-extrabold">{s.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/55">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ГАРАНТИЯ */}
      <section id="warranty" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20 sm:px-6">
        <div className="dark-card p-6 sm:p-10">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.warrantyTitle}</h2>
          {HOME.warrantyCovers.length > 0 && (
            <p className="mt-4 text-sm leading-6 text-white/70">
              {HOME.warrantyCoversLabel} {HOME.warrantyCovers.join(", ")}.
            </p>
          )}
          {HOME.warrantyFilmLife && (
            <p className="mt-4 text-sm leading-6 text-white/70">{HOME.warrantyFilmLife}</p>
          )}
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60">{HOME.warrantyNotCovered}</p>
        </div>
      </section>

      {/* ВОПРОСЫ */}
      {FAQ.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
          <div className="eyebrow">{HOME.faqEyebrow}</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.faqTitle}</h2>
          <div className="mt-8 space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className="dark-card group p-5">
                <summary className="cursor-pointer list-none font-extrabold">
                  <span className="accent mr-2 inline-block transition group-open:rotate-45">+</span>
                  {f.q}
                </summary>
                <p className="mt-3 text-sm leading-6 text-white/65">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ПАРТНЁРАМ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="dark-card flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow">{HOME.partnersEyebrow}</div>
            <p className="mt-3 max-w-2xl text-xl font-extrabold leading-snug sm:text-2xl">
              {fillTemplate(HOME.partnersText, { spread: spreadText(getPartnerExample()) })}
            </p>
          </div>
          <Link href="/partners" className="btn-accent shrink-0 justify-center">
            {HOME.partnersButton}
          </Link>
        </div>
      </section>

      {/* ФИНАЛЬНЫЙ CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="dark-card grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{HOME.finalTitle}</h2>
            <p className="mt-4 text-base leading-7 text-white/65">{HOME.finalText}</p>
            <a
              href={telegramUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mt-6 inline-flex"
            >
              {HOME.ctaTelegram}
            </a>
          </div>
          <HomeLeadForm
            content={{ texts: FORM_TEXTS, telegram: TELEGRAM }}
            cars={formCars}
            defaults={{ scenario: "FULL", filmCode: STD }}
            submitLabel={HOME.finalSubmit}
            successTitle={CALCULATOR.successTitle}
            successText={CALCULATOR.successText}
          />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}