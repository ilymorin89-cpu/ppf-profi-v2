import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import JsonLd from "@/components/site/JsonLd";
import { CAR_LANDINGS, type CarLanding } from "@/content/car-landing-pages";
import { ADDON_TEXTS, BRAND_PAGE, CONTACTS, FILM_LIFE, MATERIAL_WARRANTY, SCENARIOS, WARRANTY_WORK, formatRub, telegramUrl } from "@/content/site";
import { getPublicAddonPrices, getPublicCatalog } from "@/server/pricing/public";
import { getCalculatorProps } from "@/server/calculator/props";
import { breadcrumbSchema, organizationSchema, serviceSchema } from "@/server/seo/schema";

type Props = { page: CarLanding };

export function carLandingMetadata(page: CarLanding) {
  const path = `/ppf/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: { title: page.title, description: page.description, url: path },
    twitter: { card: "summary_large_image" as const, title: page.title, description: page.description },
  };
}

export default function CarLandingPage({ page }: Props) {
  const car = getPublicCatalog().find((item) => item.code === page.code);
  if (!car) return null;
  const calculatorCar = getCalculatorProps().cars.find((item) => item.code === page.code);
  const path = `/ppf/${page.slug}`;
  const addonPrices = getPublicAddonPrices();
  const risk = car.prices.RISK_ZONES;
  const full = car.prices.FULL;
  const rows = [
    { label: "Зоны риска · Spectroll TPU-S 180", price: risk.PPF_STANDARD },
    { label: "Зоны риска · Spectroll Premium 210", price: risk.SPECTROLL_PREMIUM },
    { label: "Зоны риска · NAR PPF Premium H190", price: risk.NAR_H190 },
    { label: "Зоны риска · NAR PPF Premium H210", price: risk.NAR_H210 },
    { label: "Полная оклейка · Spectroll TPU-S 180", price: full.PPF_STANDARD },
    { label: "Полная оклейка · Spectroll Premium 210", price: full.SPECTROLL_PREMIUM },
    { label: "Полная оклейка · NAR PPF Premium H190", price: full.NAR_H190 },
    { label: "Полная оклейка · NAR PPF Premium H210", price: full.NAR_H210 },
  ].filter((row) => row.price);
  const min = rows.length ? Math.min(...rows.map((row) => row.price!.low)) : null;
  const calculatorUrl = `/calculator?car=${encodeURIComponent(car.code)}`;
  const faq = [
    { q: `Сколько стоит оклейка ${car.brand} ${car.model}?`, a: min !== null ? `Стоимость начинается от ${formatRub(min)}. Цена зависит от состава работ и выбранной плёнки. Итоговую смету подтверждаем после осмотра.` : "Стоимость рассчитывается индивидуально после выбора состава работ и осмотра автомобиля." },
    { q: "Что входит в зоны риска?", a: `${SCENARIOS.RISK_ZONES.desc}. Перечень и границы оклейки подтверждаем перед началом работ.` },
    { q: "Что означает полная оклейка?", a: `${SCENARIOS.FULL.desc}. Конкретный перечень окрашенных элементов и исключения согласуем при осмотре автомобиля.` },
    { q: "Сколько занимает оклейка?", a: `Ориентир по каталогу для этой модели: зоны риска — ${car.daysRisk ?? "срок уточняется"} дн., полная оклейка — ${car.daysFull ?? "срок уточняется"} дн. Подтверждаем график после осмотра.` },
    { q: "Какая гарантия предоставляется?", a: `Гарантия на монтаж: ${WARRANTY_WORK}. ${MATERIAL_WARRANTY}. ${FILM_LIFE}` },
  ];

  return (
    <div className="dark-grid min-h-screen text-white">
      <JsonLd data={[
        organizationSchema(),
        serviceSchema(page.h1, [car]),
        breadcrumbSchema([
          { name: "Главная", path: "/" },
          { name: BRAND_PAGE.breadcrumbList, path: "/ppf" },
          { name: `${car.brand} ${car.model}`, path },
        ]),
      ]} />
      <SiteHeader />
      <main id="main-content">
        <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-10 pb-12 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:pt-14">
          <div>
            <nav className="text-xs text-white/50">
              <Link href="/" className="hover:text-white">Главная</Link> / <Link href="/ppf" className="hover:text-white">Марки и модели</Link> / <span>{car.brand} {car.model}</span>
            </nav>
            <div className="eyebrow mt-6">PPF PROFI · Москва</div>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-5xl">{page.h1}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/75">{page.intro}</p>
            <p className="mt-3 text-sm text-white/55">{car.gen}{car.years ? ` · ${car.years}` : ""}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={calculatorUrl} className="btn-accent">Рассчитать стоимость</Link>
              <a href={telegramUrl(`Здравствуйте! Хочу узнать стоимость оклейки ${car.brand} ${car.model} плёнкой PPF.`)} target="_blank" rel="noopener noreferrer" className="btn-ghost">Написать в Telegram</a>
              <a href={CONTACTS.phoneHref} className="btn-ghost">Позвонить</a>
            </div>
          </div>
          <div className="dark-card overflow-hidden p-2">
            {calculatorCar?.hasImage ? (
              <Image src={`/cars/${car.code}.webp`} alt={`${car.brand} ${car.model} — защита кузова плёнкой PPF`} width={1600} height={900} priority className="aspect-[16/9] w-full rounded-2xl object-cover" />
            ) : (
              <div className="grid aspect-[16/9] place-items-center rounded-2xl bg-gradient-to-br from-white/10 via-black to-lime-400/10 px-6 text-center">
                <span className="text-2xl font-extrabold sm:text-3xl">{car.brand}<br />{car.model}</span>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2">
            {page.details.map((item) => <p key={item} className="dark-card p-5 text-sm leading-7 text-white/70">{item}</p>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="eyebrow">Состав работ</div>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Что входит в пакеты защиты</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="dark-card p-6"><h3 className="text-lg font-extrabold">Зоны риска</h3><p className="mt-3 text-sm leading-7 text-white/70">{SCENARIOS.RISK_ZONES.desc}.</p><p className="mt-3 text-xs leading-6 text-white/45">Границы оклейки и конкретные детали согласуем до начала работ.</p></article>
            <article className="dark-card p-6"><h3 className="text-lg font-extrabold">Полная оклейка</h3><p className="mt-3 text-sm leading-7 text-white/70">{SCENARIOS.FULL.desc}.</p><p className="mt-3 text-xs leading-6 text-white/45">Перечень окрашенных элементов, входящих в смету, подтверждаем после осмотра.</p></article>
          </div>
          <h3 className="mt-8 text-lg font-extrabold">Дополнительные опции</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Работы рассчитываются отдельно и не включены автоматически в базовую стоимость пакета.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(addonPrices).map(([code, value]) => {
              const label = ADDON_TEXTS[code]?.label ?? code;
              const price = value.priceMax && value.priceMax > value.price ? `${formatRub(value.price)}–${formatRub(value.priceMax)}` : `от ${formatRub(value.price)}`;
              const note = code === "MATTE" ? "Доплата только к полной оклейке" : ADDON_TEXTS[code]?.desc;
              return <div key={code} className="dark-card p-4"><div className="text-sm font-bold">{label}</div><div className="mt-2 text-base font-extrabold accent">{price}{ADDON_TEXTS[code]?.unit ? ` / ${ADDON_TEXTS[code].unit}` : ""}</div>{note && <p className="mt-1 text-xs leading-5 text-white/45">{note}</p>}</div>;
            })}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="eyebrow">Стоимость</div>
          <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">Цены на оклейку {car.brand} {car.model}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">Цены «от» по публичному прайсу PPF PROFI. Выберите пакет и плёнку для подробного расчёта; окончательную стоимость подтвердим после осмотра.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <Link key={row.label} href={calculatorUrl} className="dark-card block p-5 transition hover:border-lime-400/40">
                <div className="text-sm font-bold text-white/70">{row.label}</div>
                <div className="mt-3 text-xl font-extrabold accent">от {formatRub(row.price!.low)}</div>
                <div className="mt-1 text-xs text-white/45">Открыть расчёт →</div>
              </Link>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {car.daysRisk !== null && <div className="dark-card p-4"><div className="text-xs text-white/45">Ориентир по сроку · зоны риска</div><div className="mt-1 text-lg font-extrabold">{car.daysRisk} {car.daysRisk === 1 ? "день" : car.daysRisk >= 2 && car.daysRisk <= 4 ? "дня" : "дней"}</div></div>}
            {car.daysFull !== null && <div className="dark-card p-4"><div className="text-xs text-white/45">Ориентир по сроку · полная оклейка</div><div className="mt-1 text-lg font-extrabold">{car.daysFull} {car.daysFull === 1 ? "день" : car.daysFull >= 2 && car.daysFull <= 4 ? "дня" : "дней"}</div></div>}
          </div>
          <p className="mt-4 text-xs text-white/45">Сроки ориентировочные по внутреннему каталогу расчёта. Фактический срок подтверждаем после осмотра, согласования состава работ и графика.</p>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Как проходит оклейка</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Осмотр и подбор", "Оцениваем состояние кузова, согласуем детали и тип плёнки."],
              ["02", "Подготовка и монтаж", "Подготавливаем поверхность и выполняем оклейку согласованных элементов."],
              ["03", "Проверка результата", "Проверяем края и качество монтажа, передаём рекомендации по уходу."],
            ].map(([n, title, text]) => <div key={n} className="dark-card p-5"><div className="text-sm font-extrabold accent">{n}</div><h3 className="mt-3 font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{text}</p></div>)}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Частые вопросы</h2>
          <div className="mt-6 space-y-2">
            {faq.map((item) => <details key={item.q} className="dark-card group p-5"><summary className="cursor-pointer list-none font-extrabold"><span className="mr-2 accent">+</span>{item.q}</summary><p className="mt-3 text-sm leading-6 text-white/65">{item.a}</p></details>)}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="dark-card flex flex-col items-start justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-9">
            <div><h2 className="text-2xl font-extrabold">Подберём защиту для вашего автомобиля</h2><p className="mt-2 text-sm text-white/60">Выберите плёнку и состав работ в калькуляторе PPF PROFI.</p></div>
            <Link href={calculatorUrl} className="btn-accent shrink-0">Перейти к расчёту →</Link>
          </div>
          <Link href="/ppf" className="mt-8 inline-block text-sm font-bold accent hover:underline">Все марки и модели →</Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
