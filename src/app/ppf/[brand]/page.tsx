import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BrandModelPicker from "@/components/site/BrandModelPicker";
import HomeLeadForm from "@/components/site/HomeLeadForm";
import JsonLd from "@/components/site/JsonLd";
import {
  BRANDS,
  BRAND_PAGE,
  CALCULATOR,
  CONTACTS,
  FILM_LIFE,
  FORM_TEXTS,
  HOME,
  TELEGRAM,
  MATERIAL_WARRANTY,
  WARRANTY_WORK,
  brandFaq,
  formatRub,
  getBrand,
  telegramUrl,
} from "@/content/site";
import { fillTemplate } from "@/shared/format";
import { genLabel, pickerBrands } from "@/server/seo/brands";
import { breadcrumbSchema, brandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";
import { CAR_LANDINGS, getCarLanding } from "@/content/car-landing-pages";
import CarLandingPage, { carLandingMetadata } from "@/components/site/CarLandingPage";

export const revalidate = 3600;
/** Только марки из BRANDS; любой другой адрес — 404. */
export const dynamicParams = false;

type Props = { params: Promise<{ brand: string }> };

export function generateStaticParams() {
  return [
    ...BRANDS.map((b) => ({ brand: b.slug })),
    ...CAR_LANDINGS.map((page) => ({ brand: page.slug })),
  ];
}

const STD = "PPF_STANDARD" as const;
const PREMIUM = "SPECTROLL_PREMIUM" as const;

function minRisk(slug: string): number | null {
  const b = getBrand(slug);
  if (!b) return null;
  const lows = brandCars(b)
    .map((c) => c.prices.RISK_ZONES?.[STD]?.low)
    .filter((v): v is number => typeof v === "number");
  return lows.length > 0 ? Math.min(...lows) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { brand: slug } = await params;
  const carLanding = getCarLanding(slug);
  if (carLanding) return carLandingMetadata(carLanding);
  const b = getBrand(slug);
  if (!b) return {};
  const cars = brandCars(b);
  const price = minRisk(slug);
  const title =
    price !== null
      ? fillTemplate(BRAND_PAGE.seoTitleWithPrice, { brand: b.name, price: formatRub(price) })
      : fillTemplate(BRAND_PAGE.seoTitle, { brand: b.name });
  const description =
    cars.length > 0
      ? fillTemplate(BRAND_PAGE.seoDescriptionWithModels, {
          brand: b.name,
          models: cars.map((c) => c.model).join(", "),
          warranty: WARRANTY_WORK,
        })
      : fillTemplate(BRAND_PAGE.seoDescription, { brand: b.name, warranty: WARRANTY_WORK });
  const path = `/ppf/${b.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: [OG_IMAGE] },
    twitter: { ...TWITTER_CARD, title, description },
  };
}

export default async function BrandPage({ params }: Props) {
  const { brand: slug } = await params;
  const carLanding = getCarLanding(slug);
  if (carLanding) return <CarLandingPage page={carLanding} />;
  const b = getBrand(slug);
  if (!b) notFound();

  const cars = brandCars(b);
  const h1 = fillTemplate(BRAND_PAGE.h1, { brand: b.name });
  const formCars = cars.map((c) => ({ code: c.code, label: `${c.brand} ${c.model}` }));
  const fullLows = cars
    .map((c) => c.prices.FULL?.[STD]?.low)
    .filter((v): v is number => typeof v === "number");
  const faq = brandFaq(b.name, minRisk(b.slug), fullLows.length > 0 ? Math.min(...fullLows) : null);

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd
        data={[
          organizationSchema(),
          serviceSchema(h1, cars),
          breadcrumbSchema([
            { name: BRAND_PAGE.breadcrumbHome, path: "/" },
            { name: BRAND_PAGE.breadcrumbList, path: "/ppf" },
            { name: b.name, path: `/ppf/${b.slug}` },
          ]),
        ]}
      />
      <SiteHeader />
      <main id="main-content">

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <nav className="text-xs text-white/50">
            <Link href="/" className="hover:text-white">{BRAND_PAGE.breadcrumbHome}</Link>
            {" / "}
            <Link href="/ppf" className="hover:text-white">{BRAND_PAGE.breadcrumbList}</Link>
            {" / "}
            <span>{b.name}</span>
          </nav>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">{h1}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70">{b.intro}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">
            Гарантия {WARRANTY_WORK}. {MATERIAL_WARRANTY}. {FILM_LIFE}.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" className="btn-accent">
              {BRAND_PAGE.ctaTelegram}
            </a>
            <a href={CONTACTS.phoneHref} className="btn-ghost">
              {BRAND_PAGE.ctaPhone} {CONTACTS.phone}
            </a>
          </div>
        </div>
        <BrandModelPicker
          brands={pickerBrands()}
          initialSlug={b.slug}
          texts={{
            title: BRAND_PAGE.pickerTitle,
            brand: BRAND_PAGE.pickerBrand,
            model: BRAND_PAGE.pickerModel,
            gen: BRAND_PAGE.pickerGen,
            other: BRAND_PAGE.pickerOther,
            button: BRAND_PAGE.pickerButton,
          }}
        />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {cars.length > 0 ? (
          <>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{BRAND_PAGE.modelsTitle}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cars.map((c) => {
                const risk = c.prices.RISK_ZONES?.[STD];
                const full = c.prices.FULL?.[STD];
                const fullP = c.prices.FULL?.[PREMIUM];
                const riskNar190 = c.prices.RISK_ZONES?.NAR_H190;
                const riskNar210 = c.prices.RISK_ZONES?.NAR_H210;
                return (
                  <Link
                    key={c.code}
                    href={CAR_LANDINGS.find((page) => page.code === c.code) ? `/ppf/${CAR_LANDINGS.find((page) => page.code === c.code)!.slug}` : `/calculator?car=${c.code}`}
                    className="dark-card block p-5 transition hover:border-lime-400/40"
                  >
                    <div className="text-lg font-extrabold">
                      {c.brand} {c.model}
                    </div>
                    {c.years && <div className="mt-1 text-xs text-white/50">{genLabel(c)}</div>}
                    {/* Сначала зоны риска: вход в услугу с меньшей суммы. */}
                    {risk && (
                      <div className="mt-3 text-sm font-bold">
                        {fillTemplate(BRAND_PAGE.riskTpu, { price: formatRub(risk.low) })}
                      </div>
                    )}
                    {full && (
                      <div className="mt-1 text-sm text-white/65">
                        {fillTemplate(BRAND_PAGE.fullTpu, { price: formatRub(full.low) })}
                      </div>
                    )}
                    {fullP && (
                      <div className="mt-1 text-sm text-white/65">
                        {fillTemplate(BRAND_PAGE.fullPremium, { price: formatRub(fullP.low) })}
                      </div>
                    )}
                    {riskNar190 && (
                      <div className="mt-1 text-sm text-white/65">
                        {fillTemplate(BRAND_PAGE.riskNarH190, { price: formatRub(riskNar190.low) })}
                      </div>
                    )}
                    {riskNar210 && (
                      <div className="mt-1 text-sm text-white/65">
                        {fillTemplate(BRAND_PAGE.riskNarH210, { price: formatRub(riskNar210.low) })}
                      </div>
                    )}
                    <div className="mt-3 text-sm font-bold accent">{BRAND_PAGE.calcLink}</div>
                  </Link>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-white/50">{BRAND_PAGE.pricesNote}</p>
            <Link href="/ceny#parts" className="mt-2 inline-block text-sm font-bold accent hover:underline">
              {BRAND_PAGE.partsLink}
            </Link>
          </>
        ) : (
          <div className="dark-card p-6 sm:p-10">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{BRAND_PAGE.noModelsTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{BRAND_PAGE.noModelsText}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={telegramUrl()} target="_blank" rel="noopener noreferrer" className="btn-accent">
                {BRAND_PAGE.ctaTelegram}
              </a>
              <Link href="/calculator" className="btn-ghost">
                {BRAND_PAGE.ctaCalc}
              </Link>
            </div>
          </div>
        )}
      </section>

      {formCars.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="dark-card grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{BRAND_PAGE.formTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{HOME.finalText}</p>
            </div>
            <HomeLeadForm
              content={{ texts: FORM_TEXTS, telegram: TELEGRAM }}
              cars={formCars}
              defaults={{ scenario: "RISK_ZONES", filmCode: STD }}
              submitLabel={HOME.finalSubmit}
              successTitle={CALCULATOR.successTitle}
              successText={CALCULATOR.successText}
            />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{BRAND_PAGE.faqTitle}</h2>
        <div className="mt-6 space-y-2">
          {faq.map((f) => (
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

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Link href="/ppf" className="text-sm font-bold accent hover:underline">
          {BRAND_PAGE.allBrands}
        </Link>
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
