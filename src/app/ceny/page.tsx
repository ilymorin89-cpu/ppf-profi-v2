import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
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
    openGraph: { title, description: PRICES_PAGE.seoDescription, url: "/ceny", images: [OG_IMAGE] },
    twitter: { ...TWITTER_CARD, title, description: PRICES_PAGE.seoDescription },
  };
}

function Price({ v }: { v: number | undefined }) {
  return <>{typeof v === "number" ? `от ${formatRub(v)}` : "—"}</>;
}

const TH = "px-3 py-3 align-bottom font-normal first:pl-0 last:pr-0";
const TD = "px-3 py-3 align-middle first:pl-0 last:pr-0";

/** Двухстрочная шапка колонки: крупное название + подпись мелко. */
function ColHead({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <span className="block text-xs font-extrabold uppercase tracking-[0.1em] text-white/80">{title}</span>
      <span className="mt-1 block text-xs leading-4 text-white/45">{sub}</span>
    </>
  );
}

function SimpleHead({ title }: { title: string }) {
  return (
    <span className="block text-xs font-extrabold uppercase tracking-[0.1em] text-white/50">{title}</span>
  );
}

function Table({ cars }: { cars: PublicCar[] }) {
  const cells = [
    (c: PublicCar) => c.prices.RISK_ZONES?.[STD]?.low,
    (c: PublicCar) => c.prices.FULL?.[STD]?.low,
    (c: PublicCar) => c.prices.FULL?.[PREMIUM]?.low,
  ];
  return (
    <>
    {/* Телефон: карточка на машину, цены видны без прокрутки */}
    <ul className="mt-4 divide-y divide-white/8 md:hidden">
      {cars.map((c) => (
        <li key={c.code} className="py-4">
          <Link href={`/calculator?car=${c.code}`} className="font-bold hover:underline">
            {c.brand} {c.model}
          </Link>
          <div className="mt-0.5 text-xs text-white/50">{genLabel(c)}</div>
          <dl className="mt-3 space-y-2">
            {PRICES_PAGE.priceCols.map((col, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
                <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-white/80">{col.title}</dt>
                <dd className={`whitespace-nowrap text-sm font-bold tabular-nums ${i === 0 ? "accent" : ""}`}>
                  <Price v={cells[i](c)} />
                </dd>
                {/* плёнка на всю ширину карточки — не переносится на узких экранах */}
                <dd className="col-span-2 text-[11px] leading-4 text-white/45">{col.film}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
    <div className="mt-4 hidden md:block">
      {/* table-fixed + одинаковые ширины: колонки ровные во всех таблицах марок */}
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[17%]" />
          <col className="w-[19%]" />
          <col className="w-[19%]" />
          <col className="w-[19%]" />
        </colgroup>
        <thead>
          <tr>
            <th className={TH}><SimpleHead title={PRICES_PAGE.colModel} /></th>
            <th className={TH}><SimpleHead title={PRICES_PAGE.colYears} /></th>
            {PRICES_PAGE.priceCols.map((col, i) => (
              <th key={i} className={TH}>
                <ColHead title={col.title} sub={col.film} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cars.map((c) => (
            <tr key={c.code} className="border-t border-white/8">
              <td className={`${TD} font-bold`}>
                <Link href={`/calculator?car=${c.code}`} className="hover:underline">
                  {c.brand} {c.model}
                </Link>
              </td>
              <td className={`${TD} text-white/60`}>{genLabel(c)}</td>
              {cells.map((get, i) => (
                <td key={i} className={`${TD} whitespace-nowrap font-bold tabular-nums ${i === 0 ? "accent" : ""}`}>
                  <Price v={get(c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
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
      <main id="main-content">

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
          <p className="mt-2 text-xs leading-5 text-white/45 md:hidden">
            {PRICES_PAGE.partsCols.map((c) => `${c.title} — ${c.hint}`).join(" · ")}
          </p>
          <ul className="mt-4 divide-y divide-white/8 md:hidden">
            {parts.map((p) => (
              <li key={p.code} className="py-3">
                <div className="text-sm font-bold">{PART_TEXTS[p.code] ?? p.code}</div>
                <div className="mt-2 grid grid-cols-3 items-end gap-2">
                  {[p.L, p.XL, p.XLp].map((v, i) => (
                    <div key={i} className="min-w-0">
                      <div className="text-[11px] leading-4 text-white/45">
                        {PRICES_PAGE.partsCols[i].title}
                      </div>
                      <div className="whitespace-nowrap text-sm font-bold tabular-nums">от {formatRub(v)}</div>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden md:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={TH}><SimpleHead title={PRICES_PAGE.partsColPart} /></th>
                  {PRICES_PAGE.partsCols.map((col) => (
                    <th key={col.title} className={TH}>
                      <ColHead title={col.title} sub={col.hint} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.code} className="border-t border-white/8">
                    <td className={`${TD} font-bold`}>{PART_TEXTS[p.code] ?? p.code}</td>
                    {[p.L, p.XL, p.XLp].map((v, i) => (
                      <td key={i} className={`${TD} whitespace-nowrap font-bold tabular-nums`}>
                        от {formatRub(v)}
                      </td>
                    ))}
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

      </main>
      <SiteFooter />
    </div>
  );
}
