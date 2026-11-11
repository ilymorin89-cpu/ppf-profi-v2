import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import EconomyCalculator from "@/components/partners/EconomyCalculator";
import PartnerLeadForm from "@/components/forms/PartnerLeadForm";
import { getPartnerExample, spreadText } from "@/server/pricing/partner-example";
import { carsLabel, fillTemplate } from "@/shared/format";
import {
  FILMS,
  FORM_TEXTS,
  PARTNERS,
  PARTNER_FORM,
  PARTNER_TYPES,
  PRICE_EXAMPLE,
  SCENARIOS,
  SEO,
  TELEGRAM,
  THICKNESS_UNIT,
  scenarioDays,
  formatRub,
  telegramUrl,
} from "@/content/site";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const k = { spread: spreadText(getPartnerExample()) };
  const title = fillTemplate(SEO.partners.title, k);
  const description = fillTemplate(SEO.partners.description, k);
  return { title, description, alternates: { canonical: "/partners" }, openGraph: { title, description, images: [OG_IMAGE] }, twitter: { ...TWITTER_CARD, title, description } };
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

export default function PartnersPage() {
  // Пример X5 G05 / FULL / Spectroll TPU-S: единственное место с ценой партнёра на сайте.
  const ex = getPartnerExample();
  const k = { spread: spreadText(ex) };
  /** «350 000 ₽» при одной цене, «340 000–360 000 ₽» при диапазоне. */
  const range = (a: number, b: number) => (a === b ? formatRub(a) : `${fmt(a)}–${formatRub(b)}`);
  const tenCars = PARTNERS.econTenCarsCount;
  const film = FILMS[PRICE_EXAMPLE.film];

  return (
    <div className="dark-grid min-h-screen text-white">
      <SiteHeader />
      <main id="main-content">

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-8 sm:px-6">
        <div className="reveal">
          <div className="eyebrow">{PARTNERS.eyebrow}</div>
          <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            {fillTemplate(PARTNERS.h1, k)}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/65">{PARTNERS.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#economics" className="btn-accent">
              {PARTNERS.ctaCalc}
            </a>
            <a href="#join" className="btn-ghost">
              {PARTNERS.ctaJoin}
            </a>
          </div>
        </div>
      </section>

      {/* ЭКОНОМИКА СДЕЛКИ — единственный блок с ценой партнёра */}
      <section id="economics" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-8 sm:px-6">
        <div className="dark-card p-6 sm:p-10">
          <div className="eyebrow">{PARTNERS.econEyebrow}</div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{PARTNERS.econTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-white/60">
            {fillTemplate(PARTNERS.econSubtitle, {
              car: PRICE_EXAMPLE.carFullName,
              scenario: SCENARIOS[PRICE_EXAMPLE.scenario].label.toLowerCase(),
              film: `${film.name} (${film.thickness} ${THICKNESS_UNIT})`,
              days: scenarioDays(PRICE_EXAMPLE.scenario),
            })}
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">{PARTNERS.econYouPay}</div>
              <div className="mt-2 text-2xl font-extrabold">{formatRub(ex.pp)}</div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                {PARTNERS.econClientPays}
              </div>
              <div className="mt-2 text-2xl font-extrabold">
                {range(ex.low, ex.high)}
              </div>
            </div>
            <div className="rounded-xl border border-lime-400/25 bg-lime-400/[0.06] p-5">
              <div className="text-xs font-bold uppercase tracking-[0.14em] accent">{PARTNERS.econSpread}</div>
              <div className="mt-2 text-2xl font-extrabold accent">
                {range(ex.low - ex.pp, ex.high - ex.pp)}
              </div>
              <div className="mt-1 text-xs text-white/55">{PARTNERS.econSpreadSuffix}</div>
            </div>
          </div>

          <p className="mt-5 text-base font-bold">
            {fillTemplate(PARTNERS.econTenCars, {
              n: carsLabel(tenCars),
              total:
                ex.low === ex.high
                  ? fmt(tenCars * (ex.low - ex.pp))
                  : `${fmt(tenCars * (ex.low - ex.pp))}–${fmt(tenCars * (ex.high - ex.pp))}`,
            })}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/65">{PARTNERS.econClientGets}</p>

          <EconomyCalculator
            pp={ex.pp}
            low={ex.low}
            high={ex.high}
            texts={{
              title: PARTNERS.calcTitle,
              partner: PARTNERS.calcPartner,
              client: PARTNERS.calcClient,
              cars: PARTNERS.calcCars,
              carsMin: PARTNERS.calcCarsMin,
              carsMax: PARTNERS.calcCarsMax,
              result: PARTNERS.calcResult,
              noSpread: PARTNERS.calcNoSpread,
            }}
          />

          <p className="mt-5 text-[11px] leading-5 text-white/45">{PARTNERS.econFootnote}</p>
        </div>
      </section>

      {/* КАК РАБОТАЕТ */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="eyebrow">{PARTNERS.howEyebrow}</div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{PARTNERS.howTitle}</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PARTNERS.steps.map((s, i) => (
            <div key={s.title} className="dark-card p-4">
              <div className="text-lg font-extrabold accent">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-3 text-sm font-extrabold leading-5">{s.title}</div>
              <p className="mt-1.5 text-xs leading-5 text-white/55">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* КОМУ ПОДХОДИТ */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="eyebrow">{PARTNERS.segmentsEyebrow}</div>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{PARTNERS.segmentsTitle}</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {PARTNERS.segments.map((t) => (
            <div key={t.title} className="dark-card p-5">
              <div className="text-base font-extrabold">{t.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/60">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* СТАТЬ ПАРТНЁРОМ */}
      <section id="join" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-8 pb-16 sm:px-6">
        <div className="dark-card p-6 sm:p-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{PARTNERS.finalTitle}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">{PARTNERS.finalText}</p>
          <div className="mt-8">
            <PartnerLeadForm
              content={{ texts: FORM_TEXTS, telegram: TELEGRAM }}
              types={PARTNER_TYPES}
              texts={PARTNER_FORM}
            />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              {FORM_TEXTS.telegramButton}
            </a>
            <Link href="/b2b" className="btn-ghost">
              {PARTNERS.cabinet}
            </Link>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
