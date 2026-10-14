import type { MetadataRoute } from "next";
import { SITE } from "@/content/site";

// Кабинеты и API закрыты от обхода. /partners открыт для обхода,
// но помечен noindex в метаданных страницы: поисковик должен увидеть этот запрет.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/master", "/b2b", "/api/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
