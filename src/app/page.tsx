import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import TopHeader from "@/components/site/TopHeader";
import HomeHero from "@/components/site/HomeHero";
import BenefitsRow from "@/components/site/BenefitsRow";
import SiteFooter from "@/components/site/SiteFooter";
import type { MiniCar } from "@/components/site/HeroCalculator";
import Calculator from "@/components/calculator/Calculator";
import CalculatorStaticBlock, { CalculatorSkeleton } from "@/components/calculator/CalculatorStaticBlock";
import { getCalculatorProps } from "@/server/calculator/props";
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
  CONTACTS,
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
    openGraph: { title, description, url: "/", images: [OG_IMAGE] },
    twitter: { ...TWITTER_CARD, title, description },
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
  // Минимум по всему каталогу (как на /ceny и /ppf), а не только по карточкам главной.
  const riskCars = miniCars.filter((c): c is MiniCar & { risk: { low: number } } => typeof c.risk?.low === "number");
  const minRisk = riskCars.length > 0 ? Math.min(...riskCars.map((c) => c.risk.low)) : null;
  // Модели, на которых достигается минимум: до трёх названий, остальные — «и др.».
  const minRiskNames = riskCars.filter((c) => c.risk.low === minRisk).map((c) => `${c.brand} ${c.model}`);
  const minRiskModels =
    minRiskNames.length > 3 ? `${minRiskNames.slice(0, 3).join(", ")} и др.` : minRiskNames.join(", ");
  const addonPrices = getPublicAddonPrices() as Record<string, { price: number }>;
  // Один вызов: данные и для статического блока (до JS), и для самого калькулятора.
  const calculator = getCalculatorProps();

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd data={[organizationSchema(), serviceSchema("Оклейка авто защитной плёнкой PPF в Москве", allBrandCars())]} />
      <TopHeader onHome />
      <main id="main-content">

      {/* ВЕРХ: первый экран с фото, H1 и кнопкой к калькулятору */}
      <HomeHero />

      {/* СТАТИЧЕСКИЙ БЛОК: карточки моделей и полный список «от» — в HTML до JS, видны поисковикам. */}
      <CalculatorStaticBlock cars={calculator.cars} intro />

      <BenefitsRow />

      {/* КАЛЬКУЛЯТОР: полный расчёт, тот же, что на /calculator. До загрузки JS — скелетон без текста. */}
      <section id="calculator" className="scroll-mt-28 border-t border-white/8">
        <Suspense fallback={<CalculatorSkeleton />}>
          <Calculator {...calculator} headingHidden />
        </Suspense>
      </section>

      {/* HERO: преимущества и кнопки слева, Zeekr 9X ниже калькулятора */}
      <section className="scroll-mt-28 overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-28 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:pt-14 lg:pb-16">
          <div className="reveal">

            {/* Три преимущества */}
            <ul className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                {
                  title: "Защита от сколов",
                  text: "Капот, бампер, крылья и зоны риска",
                  icon: (
                    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z M9 12l2 2 4-4" />
                  ),
                },
                {
                  title: "Сохранение ЛКП",
                  text: "Внешний вид автомобиля на долгие годы",
                  icon: (
                    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
                  ),
                },
                {
                  title: "Пакеты под бюджет",
                  text: "От частичной защиты до полной оклейки",
                  icon: (
                    <path d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7 M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
                  ),
                },
              ].map((c) => (
                <li key={c.title} className="rounded-2xl border border-white/10 bg-black/60 p-4">
                  <svg viewBox="0 0 24 24" className="h-7 w-7 text-lime-400" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {c.icon}
                  </svg>
                  <div className="mt-3 text-sm font-bold">{c.title}</div>
                  <div className="mt-1 text-xs leading-5 text-white/60">{c.text}</div>
                </li>
              ))}
            </ul>

            {/* Процесс */}
            <ol className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm">
              {["Выбор автомобиля", "Подбор пакета", "Расчёт стоимости"].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-lime-400/70 text-sm font-bold text-lime-400">
                    {i + 1}
                  </span>
                  <span className="max-w-[9rem] leading-tight text-white/85">{step}</span>
                  {i < 2 && <span aria-hidden="true" className="text-lime-400/70">→</span>}
                </li>
              ))}
            </ol>

            {/* Три кнопки */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#calculator" className="btn-accent inline-flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="5" y="3" width="14" height="18" rx="2" />
                  <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
                </svg>
                Подобрать защиту →
              </Link>
              <a href={CONTACTS.phoneHref} className="btn-ghost inline-flex items-center justify-center gap-2 border-lime-400/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-lime-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
                </svg>
                Позвонить
              </a>
              <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" className="btn-ghost inline-flex items-center justify-center gap-2 border-lime-400/50">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z" />
                </svg>
                Написать в Telegram
              </a>
            </div>
          </div>

          {/* Автомобиль и студия: отдельный визуальный слой */}
          <div className="reveal">
            <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-black">
              <Image
                src="/hero/zeekr-9x.webp"
                alt="Чёрный Zeekr 9X в студии оклейки PPF PROFI"
                width={1200}
                height={675}
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ПОЛОСА ФАКТОВ */}
      <section className="border-y border-white/8 bg-black/40">
        {/* Каждая плитка занимает две строки сетки (значение и подпись) и делит их с соседями:
            длинные значения переносятся, но подписи всё равно стоят на одной линии. */}
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {FACT_TILES.map((f) => (
            <div key={f.label} className="row-span-2 grid grid-rows-subgrid pb-8 lg:pb-0">
              <div className="text-2xl font-extrabold leading-tight accent sm:text-3xl">{f.value}</div>
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
              {fillTemplate(HOME.pricesLead, { price: formatRub(minRisk), models: minRiskModels })}
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
          <div className="mt-3 flex flex-wrap gap-5">
            <Link href="/ceny" className="inline-flex min-h-11 items-center text-sm font-bold accent hover:underline">
              Все цены →
            </Link>
            <Link href="/ppf" className="inline-flex min-h-11 items-center text-sm font-bold accent hover:underline">
              {BRAND_PAGE.allBrands}
            </Link>
          </div>

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

      {/* БРЕНДЫ ПЛЁНОК — компактный каталог */}
      <section id="film-brands" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="eyebrow">Материалы для защиты автомобиля</div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Бренды автомобильных плёнок</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
              Подбираем материал под задачи автомобиля, желаемый эффект и бюджет. Наличие конкретной серии уточняем перед заказом.
            </p>
          </div>
          <Link href="#calculator" className="btn-ghost shrink-0 justify-center">Подобрать плёнку →</Link>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { name: "Spectroll", type: "Защитная PPF", text: "Полиуретановая защита лакокрасочного покрытия от повседневных дорожных воздействий.", logo: "/brands/spectroll.jpg", w: 828, h: 404 },
            // Логотипа NAR PPF в репозитории нет, пока показываем название текстом. Описание подтверждено владельцем 21.10.2026.
            { name: "NAR PPF", type: "Защитная PPF · Premium H190 и H210", text: "Линейки NAR PPF Premium H190 и Premium H210 — полиуретановая плёнка для защиты лакокрасочного покрытия." },
          ].map((brand) => (
            <article key={brand.name} className="flex min-h-40 flex-col rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition duration-200 hover:border-lime-400/40 hover:bg-white/[0.045] sm:p-5">
              <div className="flex h-16 items-center justify-start border-b border-white/8 pb-3">
                {brand.logo && brand.w && brand.h ? (
                  <Image src={brand.logo} alt={`Логотип ${brand.name}`} width={brand.w} height={brand.h} sizes="(min-width: 1024px) 22vw, 50vw" className="h-14 w-auto max-w-full rounded-md object-contain" />
                ) : (
                  <span className="text-2xl font-extrabold tracking-wide text-white/85">{brand.name}</span>
                )}
              </div>
              <h3 className="mt-3 text-base font-extrabold tracking-wide">{brand.name}</h3>
              <div className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-lime-300/90">{brand.type}</div>
              <p className="mt-2 text-sm leading-5 text-white/60">{brand.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-white/45">
          Перечень брендов не подтверждает наличие каждой серии на складе. Конкретную линейку согласуем перед оформлением заказа.
        </p>
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
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-28 px-4 pb-20 sm:px-6">
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

      </main>
      <SiteFooter />
    </div>
  );
}