import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { Suspense } from "react";
import Calculator from "@/components/calculator/Calculator";
import { getCalculatorProps } from "@/server/calculator/props";
import JsonLd from "@/components/site/JsonLd";
import { allBrandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI",
  description:
    "Выберите марку, модель и поколение — сразу увидите цены на зоны риска и полную оклейку плёнкой Spectroll, допы и итог. Москва.",
  alternates: { canonical: "/calculator" },
  openGraph: {
    title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI",
    description:
      "Выберите марку, модель и поколение — сразу увидите цены на зоны риска и полную оклейку плёнкой Spectroll, допы и итог. Москва.",
    url: "/calculator",
    images: [OG_IMAGE],
  },
  twitter: { ...TWITTER_CARD, title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI" },
};

export default function CalculatorPage() {
  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd data={[organizationSchema(), serviceSchema("Калькулятор оклейки авто плёнкой PPF", allBrandCars())]} />
      <SiteHeader />
      <main id="main-content">

      {/* Серверный H1: есть в исходном HTML, виден поисковикам и скринридерам (Calculator рендерится на клиенте). */}
      <h1 className="sr-only">Калькулятор оклейки авто плёнкой PPF в Москве</h1>

      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center text-sm text-white/50">Загрузка...</div>
        }
      >
        <Calculator {...getCalculatorProps()} />
      </Suspense>

      </main>
      <SiteFooter />
    </div>
  );
}
