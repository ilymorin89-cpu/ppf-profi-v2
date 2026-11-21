import type { MetadataRoute } from "next";
import { BRANDS, SITE } from "@/content/site";
import { CAR_LANDINGS } from "@/content/car-landing-pages";

// Публичные страницы для клиентов и потенциальных B2B-партнёров.
// lastModified не задаём: без достоверных дат изменения контента текущая дата была бы недостоверной.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/calculator`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/ceny`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/partners`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/ppf`, changeFrequency: "weekly", priority: 0.8 },
    ...BRANDS.map((b) => ({
      url: `${SITE.url}/ppf/${b.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...CAR_LANDINGS.map((page) => ({
      url: `${SITE.url}/ppf/${page.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    { url: `${SITE.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
