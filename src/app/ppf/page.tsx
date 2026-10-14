import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BrandModelPicker from "@/components/site/BrandModelPicker";
import JsonLd from "@/components/site/JsonLd";
import { BRANDS, BRAND_PAGE, formatRub } from "@/content/site";
import { fillTemplate } from "@/shared/format";
import { pickerBrands } from "@/server/seo/brands";
import { breadcrumbSchema, brandCars } from "@/server/seo/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: BRAND_PAGE.listSeoTitle,
  description: BRAND_PAGE.listSeoDescription,
  alternates: { canonical: "/ppf" },
  openGraph: { title: BRAND_PAGE.listSeoTitle, description: BRAND_PAGE.listSeoDescription, url: "/ppf" },
};

export default function BrandsPage() {
  const cards = BRANDS.map((b) => {
    const cars = brandCars(b);
    const lows = cars
      .map((c) => c.prices.RISK_ZONES?.PPF_STANDARD?.low)
      .filter((v): v is number => typeof v === "number");
    return { ...b, minRisk: lows.length > 0 ? Math.min(...lows) : null, count: cars.length };
  });

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd
        data={breadcrumbSchema([
          { name: BRAND_PAGE.breadcrumbHome, path: "/" },
          { name: BRAND_PAGE.breadcrumbList, path: "/ppf" },
        ])}
      />
      <SiteHeader />

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="eyebrow">{BRAND_PAGE.listEyebrow}</div>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
            {BRAND_PAGE.listTitle}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70">{BRAND_PAGE.listText}</p>
        </div>
        <BrandModelPicker
          brands={pickerBrands()}
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

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((b) => (
            <Link
              key={b.slug}
              href={`/ppf/${b.slug}`}
              className="dark-card block p-5 transition hover:border-lime-400/40"
            >
              <div className="text-lg font-extrabold">{fillTemplate(BRAND_PAGE.h1, { brand: b.name })}</div>
              <div className="mt-3 text-sm text-white/65">
                {b.minRisk !== null
                  ? fillTemplate(BRAND_PAGE.riskTpu, { price: formatRub(b.minRisk) })
                  : BRAND_PAGE.noModelsTitle}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
