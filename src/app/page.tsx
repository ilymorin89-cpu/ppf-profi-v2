"use client";

import Link from "next/link";
import { useState } from "react";

const NAV = [
  { label: "Главная", href: "#top" },
  { label: "Партнёрам", href: "/partners" },
  { label: "Мастерам", href: "/master" },
  { label: "Как это работает", href: "#how" },
  { label: "Преимущества", href: "#features" },
  { label: "Контакты", href: "#contacts" },
];

const STATS = [
  { value: "8+", label: "проверенных бригад мастеров" },
  { value: "100%", label: "контроль качества и сроков" },
  { value: "10+", label: "B2B-партнёров уже с нами" },
  { value: "12 мес", label: "гарантия на все виды работ и материалы" },
];

const FEATURES = [
  {
    title: "Проверенные мастера",
    text: "Только опытные бригады с реальными кейсами и портфолио.",
    icon: "★",
  },
  {
    title: "Строгий контроль",
    text: "Проверяем качество работ, соблюдение сроков и стандартов.",
    icon: "🛡",
  },
  {
    title: "Прозрачные расчёты",
    text: "Цена видна до подтверждения. Финальная стоимость фиксируется в системе.",
    icon: "💰",
  },
  {
    title: "Поддержка 24/7",
    text: "Операционный менеджер на связи с партнёрами и клиентами.",
    icon: "🎧",
  },
];

const PARTNER_TYPES = [
  "Автосалоны",
  "Детейлинг-центры",
  "Кузовные мастерские",
];

const HERO_FEATURES = [
  { title: "Гарантия", sub: "на работы", icon: "🛡" },
  { title: "Премиальные", sub: "материалы", icon: "💎" },
  { title: "Проверенные", sub: "бригады мастеров", icon: "👥" },
];

export default function HomePage() {
  const [brand, setBrand] = useState("BMW");
  const [model, setModel] = useState("X5");
  const [year, setYear] = useState("2023");

  return (
    <div id="top" className="dark-grid min-h-screen text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-xl font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
            <div className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 md:block">
              Premium Protection
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-white/70 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/partners"
              className="hidden text-sm font-bold text-lime-400 hover:text-lime-300 md:block"
            >
              Для партнёров
            </Link>
            <Link href="/calculator" className="btn-accent text-sm">
              Рассчитать PPF
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 pt-16 pb-20">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
            {/* Левая часть — текст + большая картинка авто */}
            <div className="reveal">
              <div className="eyebrow">Профессиональная оклейка автомобилей</div>
              <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                ЗАЩИТА АВТО
                <br />
                <span className="accent">НА НОВОМ УРОВНЕ</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                PPF PROFI — это проверенные мастера, премиальные материалы и гарантия
                результата. Мы берём на себя все процессы, чтобы вы получали идеальный
                сервис.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/partners" className="btn-accent">
                  Стать партнёром →
                </Link>
                <a href="#how" className="btn-ghost">
                  ▶ Как это работает
                </a>
              </div>

              {/* Большая картинка авто */}
              <div className="relative mt-10 overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-neutral-900 via-black to-neutral-950">
                <img
                  src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80"
                  alt="Премиальный автомобиль"
                  className="aspect-[16/9] w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-lime-400/20 via-transparent to-black/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              </div>

              {/* Три фичи-иконки */}
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {HERO_FEATURES.map((f) => (
                  <div key={f.title} className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-lime-400/20 bg-lime-400/10 text-lg">
                      {f.icon}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold">{f.title}</div>
                      <div className="text-xs text-white/50">{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Правая часть — промо-карточка + калькулятор */}
            <div className="reveal space-y-5">
              {/* Промо-карточка «PPF плёнка» */}
              <div className="dark-card relative overflow-hidden p-6">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/10 blur-3xl" />
                <div className="relative">
                  <div className="eyebrow">Премиальная защита</div>
                  <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">
                    PPF плёнка <br />
                    <span className="accent">для вашего авто</span>
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Надёжная защита от сколов, царапин, ультрафиолета и реагентов.
                    Сохраняет идеальный вид автомобиля на годы.
                  </p>
                  <Link
                    href="/calculator"
                    className="btn-accent mt-5 w-full justify-center"
                  >
                    Рассчитать стоимость →
                  </Link>
                </div>
              </div>

              {/* Калькулятор */}
              <div className="dark-card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">Калькулятор PPF</h2>
                  <div className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-lime-400">
                    PPF PROFI
                    <div className="text-white/40">Premium Protection</div>
                  </div>
                </div>

                <p className="mt-2 text-xs leading-5 text-white/50">
                  Рассчитайте предварительную стоимость оклейки вашего автомобиля за 1 минуту.
                </p>

                {/* Шаги */}
                <div className="mt-5 flex items-center gap-2 text-[11px]">
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-lime-400 text-[10px] font-extrabold text-black">
                    1
                  </div>
                  <span className="font-bold text-white">Выбор автомобиля</span>
                  <div className="h-px flex-1 bg-white/10" />
                  <div className="text-white/40">2 Параметры</div>
                  <div className="text-white/40">3 Результат</div>
                </div>

                {/* Поля */}
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      Марка
                    </label>
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none"
                    >
                      <option className="bg-neutral-900 text-white">BMW</option>
                      <option className="bg-neutral-900 text-white">Mercedes-Benz</option>
                      <option className="bg-neutral-900 text-white">Porsche</option>
                      <option className="bg-neutral-900 text-white">Toyota</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      Модель
                    </label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none"
                    >
                      <option className="bg-neutral-900 text-white">X5</option>
                      <option className="bg-neutral-900 text-white">X7</option>
                      <option className="bg-neutral-900 text-white">GLE</option>
                      <option className="bg-neutral-900 text-white">Cayenne</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                      Год выпуска
                    </label>
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white focus:border-lime-400 focus:outline-none"
                    >
                      <option className="bg-neutral-900 text-white">2024</option>
                      <option className="bg-neutral-900 text-white">2023</option>
                      <option className="bg-neutral-900 text-white">2022</option>
                      <option className="bg-neutral-900 text-white">2021</option>
                    </select>
                  </div>

                  <Link
                    href="/calculator"
                    className="btn-accent w-full justify-center"
                  >
                    Далее →
                  </Link>
                </div>

                {/* Предпросмотр цены */}
                <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Предварительная стоимость
                  </div>
                  <div className="mt-2 text-sm font-extrabold">
                    {brand} {model} ({year})
                  </div>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Полная оклейка</span>
                      <span className="font-bold">450 000 ₽</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Материалы (премиум)</span>
                      <span className="font-bold">+ 80 000 ₽</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Работа</span>
                      <span className="font-bold">+ 120 000 ₽</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="text-sm font-extrabold">Итого</span>
                    <span className="text-xl font-extrabold accent">650 000 ₽</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-white/40">
                    Окончательная стоимость может отличаться после осмотра автомобиля.
                  </p>
                  <Link
                    href="/calculator"
                    className="btn-accent mt-3 w-full justify-center"
                  >
                    Оставить заявку
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* СТАТИСТИКА */}
      <section className="border-y border-white/8 bg-black/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-14 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-extrabold accent">{s.value}</div>
              <div className="mt-2 text-xs leading-5 text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* КАК ЭТО РАБОТАЕТ */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="eyebrow">Как это работает</div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          От расчёта до готового результата
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Выбор автомобиля", "Марка, модель и год выпуска"],
            ["02", "Состав работ", "Передняя часть, зоны риска или полная оклейка"],
            ["03", "Расчёт", "Предварительная стоимость за 1 минуту"],
            ["04", "Мастер и работа", "Назначение и выполнение в срок"],
          ].map(([n, title, text]) => (
            <div key={n} className="dark-card p-6">
              <div className="text-3xl font-extrabold accent">{n}</div>
              <div className="mt-4 font-extrabold">{title}</div>
              <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ПРЕИМУЩЕСТВА */}
      <section id="features" className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Преимущества работы с нами
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="dark-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime-400/10 text-lg accent">
                {f.icon}
              </div>
              <div className="mt-4 text-base font-extrabold">{f.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/55">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ПАРТНЁРАМ */}
      <section id="business" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="dark-card overflow-hidden p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <div className="eyebrow">Для бизнеса</div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Станьте партнёром <span className="accent">PPF PROFI</span>
              </h2>
              <p className="mt-4 max-w-lg text-base leading-7 text-white/60">
                Получайте заказы, увеличивайте прибыль и работайте с лучшими мастерами в
                индустрии.
              </p>
              <Link href="/partners" className="btn-accent mt-8">
                Узнать условия →
              </Link>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {PARTNER_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-400/15 text-xs accent">
                      ✓
                    </div>
                    <div className="text-sm font-bold">{type}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Мобильный макет — реалистичный телефон */}
            <div className="relative mx-auto w-full max-w-[320px]">
              <div className="relative aspect-[9/19.5] w-full rounded-[3rem] border border-white/15 bg-gradient-to-b from-neutral-900 via-black to-neutral-950 p-2 shadow-2xl shadow-black/60">
                {/* Внутренний экран */}
                <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] bg-black">
                  {/* Dynamic Island */}
                  <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />

                  {/* Status bar */}
                  <div className="relative z-10 flex items-center justify-between px-7 pt-4 text-[11px] font-bold text-white/80">
                    <span>9:41</span>
                    <span className="flex items-center gap-1">
                      <span>5G</span>
                      <span>▮</span>
                    </span>
                  </div>

                  {/* Содержимое экрана */}
                  <div className="relative flex h-full flex-col px-6 pb-6 pt-14">
                    {/* Шапка */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-extrabold tracking-[0.12em]">
                        PPF <span className="accent">PROFI</span>
                      </div>
                      <div className="text-white/40">☰</div>
                    </div>

                    {/* Заголовок */}
                    <div className="mt-8 text-2xl font-extrabold leading-[1.15]">
                      Партнёрская
                      <br />
                      программа
                    </div>

                    {/* Описание */}
                    <p className="mt-3 text-[12px] leading-5 text-white/50">
                      Станьте частью сети PPF PROFI и получайте стабильный поток
                      заказов от проверенных клиентов.
                    </p>

                    {/* Кнопка */}
                    <Link
                      href="/partners"
                      className="mt-6 block w-full rounded-xl bg-lime-400 py-3 text-center text-[13px] font-extrabold text-black"
                    >
                      Стать партнёром
                    </Link>

                    {/* Преимущества — прижаты к низу */}
                    <div className="mt-auto space-y-3 pt-6 text-[12px]">
                      <div className="flex items-center gap-2 text-white/80">
                        <span className="accent">📈</span> Стабильный поток заказов
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <span className="accent">✓</span> Честные условия
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <span className="accent">🎧</span> Поддержка на всех этапах
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section id="contacts" className="border-t border-white/8 bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <div className="eyebrow">Контакты</div>
              <div className="mt-4 text-2xl font-extrabold">PPF PROFI</div>
              <div className="mt-2 text-sm text-white/60">
                Москва · Выезд по городу и области
              </div>
            </div>
            <div className="text-sm">
              <div className="text-white/40">Телефон</div>
              <div className="mt-1 font-bold">+7 (952) 857-54-23</div>
              <div className="mt-3 text-white/40">Email</div>
              <div className="mt-1 font-bold">kent777_09@mail.ru</div>
              <div className="mt-3 text-white/40">Telegram</div>
              <a
                href="https://t.me/partner_detiling"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-bold accent hover:underline"
              >
                @partner_detiling
              </a>
            </div>
            <div className="text-sm">
              <div className="text-white/40">ИП Морин Илья Владимирович</div>
              <div className="mt-1 text-white/70">ИНН 740414579370</div>
              <div className="mt-1 text-white/70">ОГРНИП 321745600022340</div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/8 bg-black/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
              Premium Protection
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-white/60">
            <Link href="/" className="hover:text-white">
              Главная
            </Link>
            <Link href="/partners" className="hover:text-white">
              Партнёрам
            </Link>
            <Link href="/master" className="hover:text-white">
              Мастерам
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Политика
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://t.me/partner_detiling"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
              title="Telegram"
            >
              ✈
            </a>
            <a
              href="https://instagram.com/"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
              title="Instagram"
            >
              📷
            </a>
            <a
              href="https://youtube.com/"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:bg-white/10"
              title="YouTube"
            >
              ▶
            </a>
          </div>

          <div className="text-xs text-white/40">
            © 2026 PPF PROFI. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}