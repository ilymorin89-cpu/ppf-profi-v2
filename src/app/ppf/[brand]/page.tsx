import type { Metadata } from "next";
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
  WARRANTY_WORK,
  formatRub,
  getBrand,
  telegramUrl,
} from "@/content/site";
import { fillTemplate } from "@/shared/format";
import { pickerBrands } from "@/server/seo/brands";
import { breadcrumbSchema, brandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";

export const revalidate = 3600;
/** Только марки из BRANDS; любой другой адрес — 404. */
export const dynamicParams = false;

type Props = { params: Promise<{ brand: string }> };

export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.slug }));
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
  return { title, description, alternates: { canonical: path }, openGraph: { title, description, url: path } };
}

export default async function BrandPage({ params }: Props) {
  const { brand: slug } = await params;
  const b = getBrand(slug);
  if (!b) notFound();

  const cars = brandCars(b);
  const h1 = fillTemplate(BRAND_PAGE.h1, { brand: b.name });
  const formCars = cars.map((c) => ({ code: c.code, label: `${c.brand} ${c.model}` }));

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
            Гарантия {WARRANTY_WORK}. {FILM_LIFE}.
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
                return (
                  <Link
                    key={c.code}
                    href={`/calculator?car=${c.code}`}
                    className="dark-card block p-5 transition hover:border-lime-400/40"
                  >
                    <div className="text-lg font-extrabold">
                      {c.brand} {c.model}
                    </div>
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
                    <div className="mt-3 text-sm font-bold accent">{BRAND_PAGE.calcLink}</div>
                  </Link>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-white/50">{BRAND_PAGE.pricesNote}</p>
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

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Link href="/ppf" className="text-sm font-bold accent hover:underline">
          {BRAND_PAGE.allBrands}
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
