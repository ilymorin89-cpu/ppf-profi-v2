import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import { Suspense } from "react";
import TopHeader from "@/components/site/TopHeader";
import SiteFooter from "@/components/site/SiteFooter";
import CalcPageIntro from "@/components/site/CalcPageIntro";
import Calculator from "@/components/calculator/Calculator";
import CalculatorStaticBlock, { CalculatorSkeleton } from "@/components/calculator/CalculatorStaticBlock";
import { getCalculatorProps } from "@/server/calculator/props";
import JsonLd from "@/components/site/JsonLd";
import { allBrandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI",
  description:
    "Оклейка авто пленкой в Москве. Выберите марку, модель и поколение — цены на зоны риска и полную оклейку полиуретановой плёнкой Spectroll.",
  alternates: { canonical: "/calculator" },
  openGraph: {
    title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI",
    description:
      "Оклейка авто пленкой в Москве. Выберите марку, модель и поколение — цены на зоны риска и полную оклейку полиуретановой плёнкой Spectroll.",
    url: "/calculator",
    images: [OG_IMAGE],
  },
  twitter: { ...TWITTER_CARD, title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI" },
};

export default function CalculatorPage() {
  // Один вызов: данные и для статического блока (до JS), и для самого калькулятора.
  const calculator = getCalculatorProps();
  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd data={[organizationSchema(), serviceSchema("Калькулятор оклейки авто плёнкой PPF", allBrandCars())]} />
      <TopHeader />
      <main id="main-content">

        {/* H1 страницы: виден пользователям и есть в исходном HTML для поисковиков и скринридеров. */}
        <CalcPageIntro />

        {/* Карточки основных моделей и полный список «от» рендерятся на сервере, до JS. */}
        <CalculatorStaticBlock cars={calculator.cars} />

        {/* Калькулятор рендерится на клиенте (useSearchParams), до загрузки — скелетон без текста. */}
        <section className="border-t border-white/8">
          <Suspense fallback={<CalculatorSkeleton />}>
            <Calculator {...calculator} headingHidden />
          </Suspense>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
