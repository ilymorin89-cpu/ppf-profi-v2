import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/site/JsonLd";
import {
  ADDON_TEXTS,
  BRANDS,
  PART_TEXTS,
  BRAND_PAGE,
  PRICES_PAGE,
  formatRub,
} from "@/content/site";
import { fillTemplate } from "@/shared/format";
import {
  getPublicAddonPrices,
  getPublicCatalog,
  getPublicPartPrices,
  type PublicCar,
} from "@/server/pricing/public";
import { breadcrumbSchema, organizationSchema, serviceSchema } from "@/server/seo/schema";
import { genLabel } from "@/server/seo/brands";

export const revalidate = 3600;

const STD = "PPF_STANDARD" as const;
const PREMIUM = "SPECTROLL_PREMIUM" as const;

function minRiskAll(): number | null {
  const lows = getPublicCatalog()
    .map((c) => c.prices.RISK_ZONES?.[STD]?.low)
    .filter((v): v is number => typeof v === "number");
  return lows.length > 0 ? Math.min(...lows) : null;
}

export function generateMetadata(): Metadata {
  const min = minRiskAll();
  const title = fillTemplate(PRICES_PAGE.seoTitle, { price: min !== null ? formatRub(min) : "" });
  return {
    title,
    description: PRICES_PAGE.seoDescription,
    alternates: { canonical: "/ceny" },
    openGraph: { title, description: PRICES_PAGE.seoDescription, url: "/ceny" },
  };
}

function Price({ v }: { v: number | undefined }) {
  return <>{typeof v === "number" ? `от ${formatRub(v)}` : "—"}</>;
}

function Table({ cars }: { cars: PublicCar[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.1em] text-white/50">
          <tr>
            <th className="py-2 pr-4 font-bold">{PRICES_PAGE.colModel}</th>
            <th className="py-2 pr-4 font-bold">{PRICES_PAGE.colYears}</th>
            <th className="py-2 pr-4 font-bold">{PRICES_PAGE.colRisk}</th>
            <th className="py-2 pr-4 font-bold">{PRICES_PAGE.colFull}</th>
            <th className="py-2 font-bold">{PRICES_PAGE.colPremium}</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((c) => (
            <tr key={c.code} className="border-t border-white/8">
              <td className="py-2.5 pr-4 font-bold">
                <Link href={`/calculator?car=${c.code}`} className="hover:underline">
                  {c.brand} {c.model}
                </Link>
              </td>
              <td className="py-2.5 pr-4 text-white/60">{genLabel(c)}</td>
              <td className="py-2.5 pr-4 font-bold">
                <Price v={c.prices.RISK_ZONES?.[STD]?.low} />
              </td>
              <td className="py-2.5 pr-4">
                <Price v={c.prices.FULL?.[STD]?.low} />
              </td>
              <td className="py-2.5">
                <Price v={c.prices.FULL?.[PREMIUM]?.low} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PricesPage() {
  const catalog = getPublicCatalog();
  const groups = BRANDS.map((b) => ({
    brand: b,
    cars: catalog.filter((c) => c.brand === b.catalogBrand),
  })).filter((g) => g.cars.length > 0);
  const known = new Set(BRANDS.map((b) => b.catalogBrand));
  const others = catalog.filter((c) => !known.has(c.brand));
  const addons = getPublicAddonPrices();
  const parts = getPublicPartPrices();

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd
        data={[
          organizationSchema(),
          serviceSchema(PRICES_PAGE.h1, catalog),
          breadcrumbSchema([
            { name: BRAND_PAGE.breadcrumbHome, path: "/" },
            { name: PRICES_PAGE.eyebrow, path: "/ceny" },
          ]),
        ]}
      />
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-4 pt-12 pb-8 sm:px-6">
        <div className="eyebrow">{PRICES_PAGE.eyebrow}</div>
        <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
          {PRICES_PAGE.h1}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">{PRICES_PAGE.lead}</p>
        <Link href="/calculator" className="btn-accent mt-7 inline-flex">
          {PRICES_PAGE.calcCta}
        </Link>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 pb-10 sm:px-6">
        {groups.map((g) => (
          <div key={g.brand.slug} className="dark-card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-xl font-extrabold">{g.brand.name}</h2>
              <Link href={`/ppf/${g.brand.slug}`} className="text-sm font-bold accent hover:underline">
                {PRICES_PAGE.brandLink}
              </Link>
            </div>
            <Table cars={g.cars} />
          </div>
        ))}
        {others.length > 0 && (
          <div className="dark-card p-5 sm:p-6">
            <h2 className="text-xl font-extrabold">{PRICES_PAGE.otherBrands}</h2>
            <Table cars={others} />
          </div>
        )}
      </section>

      <section id="parts" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-10 sm:px-6">
        <div className="dark-card p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">{PRICES_PAGE.partsTitle}</h2>
          <p className="mt-2 text-sm text-white/60">{PRICES_PAGE.partsLead}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-white/50">
                <tr>
                  <th className="py-2 pr-4 font-bold">{PRICES_PAGE.partsColPart}</th>
                  <th className="py-2 pr-4 font-bold">{PRICES_PAGE.partsColL}</th>
                  <th className="py-2 pr-4 font-bold">{PRICES_PAGE.partsColXL}</th>
                  <th className="py-2 font-bold">{PRICES_PAGE.partsColXLp}</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.code} className="border-t border-white/8">
                    <td className="py-2.5 pr-4 font-bold">{PART_TEXTS[p.code] ?? p.code}</td>
                    <td className="py-2.5 pr-4">от {formatRub(p.L)}</td>
                    <td className="py-2.5 pr-4">от {formatRub(p.XL)}</td>
                    <td className="py-2.5">от {formatRub(p.XLp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="dark-card p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">{PRICES_PAGE.addonsTitle}</h2>
          <ul className="mt-4 divide-y divide-white/8 text-sm">
            {Object.entries(addons).map(([code, a]) => (
              <li key={code} className="flex justify-between gap-4 py-2.5">
                <span>
                  {ADDON_TEXTS[code]?.label ?? code}
                  {ADDON_TEXTS[code]?.desc ? (
                    <span className="text-white/50"> · {ADDON_TEXTS[code]?.desc}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-bold">
                  {a.priceMax
                    ? `${fillTemplate(PRICES_PAGE.addonRange, { from: formatRub(a.price), to: formatRub(a.priceMax) })}`
                    : formatRub(a.price)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/50">{PRICES_PAGE.addonsNote}</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
