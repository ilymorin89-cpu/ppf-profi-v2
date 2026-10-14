import "server-only";
import { BRANDS, CONTACTS, SITE, type BrandPage } from "@/content/site";
import { getPublicCatalog, type PublicCar } from "@/server/pricing/public";

// Разметка schema.org. Без адреса (работаем на площадках партнёров), без рейтингов и отзывов.

const ORG_ID = `${SITE.url}/#organization`;

export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE.name,
    url: SITE.url,
    telephone: CONTACTS.phone,
    email: CONTACTS.email,
    areaServed: { "@type": "City", name: "Москва" },
  };
}

/** Все «от»-цены машины (зоны риска и полная, обе плёнки). */
function carLows(c: PublicCar): number[] {
  const out: number[] = [];
  for (const byFilm of Object.values(c.prices)) {
    for (const p of Object.values(byFilm)) if (p) out.push(p.low);
  }
  return out;
}

export function serviceSchema(name: string, cars: PublicCar[]): Record<string, unknown> {
  const lows = cars.flatMap(carLows);
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    serviceType: "Оклейка автомобиля защитной плёнкой PPF",
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "City", name: "Москва" },
  };
  if (lows.length > 0) {
    base.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "RUB",
      lowPrice: Math.min(...lows),
      highPrice: Math.max(...lows),
    };
  }
  return base;
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE.url}${it.path}`,
    })),
  };
}

/** Модели марки из каталога (с ценами). */
export function brandCars(brand: BrandPage): PublicCar[] {
  if (!brand.catalogBrand) return [];
  return getPublicCatalog().filter((c) => c.brand === brand.catalogBrand);
}

export function allBrandCars(): PublicCar[] {
  return BRANDS.flatMap(brandCars);
}
