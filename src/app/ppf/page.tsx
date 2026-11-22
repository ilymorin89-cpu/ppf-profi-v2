import type { Metadata } from "next";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BrandModelPicker from "@/components/site/BrandModelPicker";
import JsonLd from "@/components/site/JsonLd";
import { BRANDS, BRAND_PAGE, formatRub } from "@/content/site";
import { fillTemplate } from "@/shared/format";
import { pickerBrands } from "@/server/seo/brands";
import { allBrandCars, breadcrumbSchema, brandCars, organizationSchema, serviceSchema } from "@/server/seo/schema";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: BRAND_PAGE.listSeoTitle,
  description: BRAND_PAGE.listSeoDescription,
  alternates: { canonical: "/ppf" },
  openGraph: { title: BRAND_PAGE.listSeoTitle, description: BRAND_PAGE.listSeoDescription, url: "/ppf", images: [OG_IMAGE] },
  twitter: { ...TWITTER_CARD, title: BRAND_PAGE.listSeoTitle, description: BRAND_PAGE.listSeoDescription },
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
        data={[
          organizationSchema(),
          serviceSchema("Оклейка авто защитной плёнкой PPF по маркам", allBrandCars()),
          breadcrumbSchema([
            { name: BRAND_PAGE.breadcrumbHome, path: "/" },
            { name: BRAND_PAGE.breadcrumbList, path: "/ppf" },
          ]),
        ]}
      />
      <SiteHeader />
      <main id="main-content">
        <section className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-10 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <div className="eyebrow">{BRAND_PAGE.listEyebrow}</div>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
              {BRAND_PAGE.listTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70">{BRAND_PAGE.listText}</p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/60">
              PPF — прозрачная полиуретановая плёнка для защиты лакокрасочного покрытия от повседневных
              дорожных воздействий. На этой странице собраны марки и модели, для которых можно посмотреть
              ориентиры стоимости оклейки в PPF PROFI. Выберите марку в списке или укажите автомобиль
              в подборщике — калькулятор покажет доступные варианты защиты.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/ceny" className="btn-ghost">Все цены и состав пакетов →</Link>
              <Link href="/calculator" className="btn-accent">Рассчитать стоимость →</Link>
            </div>
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

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6" aria-labelledby="brand-list-title">
          <h2 id="brand-list-title" className="mb-5 text-2xl font-extrabold tracking-tight">
            Выберите марку автомобиля
          </h2>
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
                <div className="mt-2 text-xs text-white/45">
                  {b.count} {b.count === 1 ? "модель в каталоге" : b.count >= 2 && b.count <= 4 ? "модели в каталоге" : "моделей в каталоге"}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="dark-card p-6 sm:p-8">
              <h2 className="text-xl font-extrabold tracking-tight">Какие зоны можно защитить</h2>
              <p className="mt-3 text-sm leading-7 text-white/65">
                Состав зависит от выбранного пакета и автомобиля. Для пакета «Зоны риска» в каталоге
                предусмотрены передний бампер, капот, передние крылья, зеркала, фары, передние стойки
                и полоса на крыше. Конкретный перечень деталей согласуется при расчёте.
              </p>
              <p className="mt-3 text-sm leading-7 text-white/65">
                Полная оклейка (FULL) рассчитана на все окрашенные элементы кузова. Дополнительные
                детали и работы можно посмотреть в прайсе и учесть в расчёте отдельно.
              </p>
              <Link href="/ceny" className="mt-5 inline-flex text-sm font-bold accent hover:underline">
                Посмотреть цены по деталям и пакетам →
              </Link>
            </div>
            <div className="dark-card p-6 sm:p-8">
              <h2 className="text-xl font-extrabold tracking-tight">Какие плёнки доступны</h2>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-white/65">
                <li><strong className="text-white">Spectroll TPU-S, 180 мкм.</strong> Базовый вариант, представленный в прайсе для зон риска и полной оклейки.</li>
                <li><strong className="text-white">Spectroll Premium, 210 мкм.</strong> Более толстый вариант Spectroll, доступный для полной оклейки.</li>
                <li><strong className="text-white">NAR PPF Premium H190 и H210.</strong> Дополнительные варианты NAR PPF, доступные в каталоге для отдельных пакетов.</li>
              </ul>
              <p className="mt-3 text-xs leading-5 text-white/45">
                Наличие конкретной плёнки и её применимость к выбранному пакету уточняются при расчёте.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-extrabold tracking-tight">Как узнать стоимость оклейки</h2>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            <li className="dark-card p-5">
              <div className="text-xs font-bold accent">01</div>
              <h3 className="mt-2 font-extrabold">Выберите автомобиль</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">Укажите марку, модель и поколение кузова в подборщике или калькуляторе.</p>
            </li>
            <li className="dark-card p-5">
              <div className="text-xs font-bold accent">02</div>
              <h3 className="mt-2 font-extrabold">Сравните варианты</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">Посмотрите доступные пакеты и ориентировочные цены для выбранной машины.</p>
            </li>
            <li className="dark-card p-5">
              <div className="text-xs font-bold accent">03</div>
              <h3 className="mt-2 font-extrabold">Подтвердите расчёт</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">Точную стоимость и состав работ подтверждаем после осмотра автомобиля.</p>
            </li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/calculator" className="btn-accent">Открыть калькулятор →</Link>
            <Link href="/ceny" className="btn-ghost">Перейти к прайсу →</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
