import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { Suspense } from "react";
import Calculator from "@/components/calculator/Calculator";
import { getCalculatorProps } from "@/server/calculator/props";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Калькулятор оклейки авто плёнкой PPF — цены в Москве | PPF PROFI",
  description:
    "Выберите марку, модель и поколение — сразу увидите цены на зоны риска и полную оклейку плёнкой Spectroll, допы и итог. Москва.",
  alternates: { canonical: "/calculator" },
};

export default function CalculatorPage() {
  return (
    <div className="dark-grid min-h-screen text-white">
      <SiteHeader />

      {/* Серверный H1: есть в исходном HTML, виден поисковикам и скринридерам (Calculator рендерится на клиенте). */}
      <h1 className="sr-only">Калькулятор оклейки авто плёнкой PPF в Москве</h1>

      <Suspense
        fallback={
          <div className="grid min-h-[50vh] place-items-center text-sm text-white/50">Загрузка...</div>
        }
      >
        <Calculator {...getCalculatorProps()} />
      </Suspense>

      <SiteFooter />
    </div>
  );
}
