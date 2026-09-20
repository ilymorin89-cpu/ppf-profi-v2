import Link from "next/link";

const flow = [
  { n: "01", title: "Автомобиль", text: "Модель и поколение" },
  { n: "02", title: "Состав", text: "Пакет или элементы" },
  { n: "03", title: "Расчёт", text: "Цена и валовый спред" },
  { n: "04", title: "Проверка", text: "Фото и условия" },
  { n: "05", title: "Заказ", text: "Фиксация предложения" },
];

export default function HomePage() {
  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#061426]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-xl font-black italic shadow-lg shadow-blue-600/30">
              P
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-[0.13em]">PPF PROFI</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-blue-300/80">
                Partner System
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a href="#how" className="transition hover:text-white">Как работает</a>
            <Link href="/b2b" className="transition hover:text-white">Партнёрам</Link>
            <Link href="/master" className="transition hover:text-white">Мастерам</Link>
          </nav>
          <Link
            href="/calculator"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
          >
            Открыть расчёт →
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-32 pt-24">
        <div className="reveal max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,.9)]" />
            Выездной сервис по Москве
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Защита авто.<br />
            <span className="text-blue-400">Прибыль партнёра.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
            Рассчитайте PPF за минуту, назначьте цену клиенту и передайте заказ PPF PROFI
            без собственного мастера и риска для маржи.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/calculator"
              className="rounded-xl bg-blue-600 px-7 py-4 text-base font-extrabold shadow-xl shadow-blue-600/30 transition hover:bg-blue-500"
            >
              Начать расчёт →
            </Link>
            <Link
              href="/b2b"
              className="rounded-xl border border-white/20 bg-white/5 px-7 py-4 text-base font-bold transition hover:bg-white/10"
            >
              Я партнёр
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="relative -mt-12 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="premium-panel grid gap-3 p-4 md:grid-cols-5 md:p-5">
            {flow.map((item) => (
              <div
                key={item.n}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.055] p-5 transition hover:-translate-y-1 hover:bg-white/[0.09]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20">
                    <span className="text-lg font-extrabold">✓</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-600">{item.n}</span>
                </div>
                <div className="font-extrabold text-white">{item.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-24 text-slate-950">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <div className="eyebrow">Партнёрская модель</div>
            <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.035em] sm:text-5xl">
              Вы продаёте сервис.<br />Мы выполняем работу.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              PPF PROFI рассчитывает материал, проверяет риски, выполняет оклейку и
              отвечает за качество. Партнёр сохраняет клиента и сам назначает розничную цену.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ["Защищённая маржа", "Цена не опускается ниже внутренних порогов"],
                ["Ответ за 2–5 минут", "После получения полного комплекта данных"],
                ["White-label", "Клиент и коммуникация остаются у партнёра"],
                ["План против факта", "Экономика уточняется после каждой работы"],
              ].map(([title, text]) => (
                <div key={title} className="white-card p-5">
                  <div className="text-blue-600">◆</div>
                  <div className="mt-4 font-extrabold">{title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[28px] bg-[#07182c] shadow-2xl shadow-blue-950/20">
            <div className="aspect-[4/3] w-full bg-gradient-to-br from-blue-900/40 via-slate-900 to-slate-950" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07182c] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9">
              <div className="text-sm font-bold uppercase tracking-[0.16em] text-blue-300">
                PPF PROFI
              </div>
              <div className="mt-2 text-2xl font-extrabold text-white">
                Технологии для мастеров.<br />Выгода для партнёров.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#061426] py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 text-sm font-black italic">P</div>
            <span className="font-extrabold tracking-[0.13em] text-white">PPF PROFI</span>
          </div>
          <div>Партнёрский расчёт · Москва · 2026</div>
        </div>
      </footer>
    </div>
  );
}