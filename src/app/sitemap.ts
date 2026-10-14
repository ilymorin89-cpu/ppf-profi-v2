import type { MetadataRoute } from "next";
import { BRANDS, SITE } from "@/content/site";

// Только публичные страницы для клиентов. /partners не включён: он под noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/calculator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/ceny`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE.url}/ppf`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...BRANDS.map((b) => ({
      url: `${SITE.url}/ppf/${b.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
