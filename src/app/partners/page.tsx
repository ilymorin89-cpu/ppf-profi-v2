import Link from "next/link";

const STEPS = [
  { n: "01", title: "Рассчитать", text: "Автомобиль, комплектация, состав работ." },
  { n: "02", title: "Партнёрская цена", text: "Система рассчитывает стоимость PPF PROFI." },
  { n: "03", title: "Своя цена клиенту", text: "Вы назначаете цену предложения." },
  { n: "04", title: "Отправить клиенту", text: "Ссылка на предложение без вашей цены." },
  { n: "05", title: "PPF PROFI выполняет", text: "Сделка ведётся в системе до результата." },
];

const BENEFITS = [
  { icon: "🧮", title: "Партнёрский расчёт", text: "Цена PPF PROFI без ручного счёта каждой работы." },
  { icon: "💵", title: "Своя цена клиенту", text: "Вы контролируете КП и валовый спред." },
  { icon: "🔗", title: "Ссылка клиенту", text: "Клиент видит предложение без вашей партнёрской цены." },
  { icon: "📊", title: "Контроль сделки", text: "Расчёт → клиент → заказ → мастер → выполнение." },
  { icon: "🕓", title: "История расчётов", text: "Повторить расчёт по предыдущему авто." },
];

const PARTNER_TYPES = [
  {
    title: "Автосалоны",
    text: "Предложите защиту покупателям сразу после сделки. Дополнительная прибыль без расширения штата.",
  },
  {
    title: "Малые станции",
    text: "Клиенты после кузовного ремонта хотят защитить элементы. PPF PROFI выполняет — вы получаете спред.",
  },
  {
    title: "Детейлинг-центры",
    text: "Передавайте PPF-заказы, которые не берёте. Сохраняете клиента, получаете доход.",
  },
];

export default function PartnersPage() {
  return (
    <div className="dark-grid min-h-screen text-white">
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
          <div className="flex items-center gap-4">
            <a
              href="https://t.me/partner_detiling"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm font-bold text-white/60 transition hover:text-white md:block"
            >
              Написать в Telegram
            </a>
            <Link href="/b2b" className="btn-accent text-sm">
              Войти в кабинет
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-6 pt-10 pb-8">
        <div className="reveal">
          <div className="eyebrow">PPF PROFI для бизнеса</div>
          <h1 className="mt-3 max-w-4xl text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-4xl lg:text-5xl">
            Добавьте PPF в свою продажу —{" "}
            <span className="accent">без собственного участка и команды.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
            Рассчитывайте стоимость, формируйте предложение клиенту и передавайте
            выполнение PPF PROFI.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://t.me/partner_detiling"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent"
            >
              Стать партнёром →
            </a>
            <Link href="/b2b" className="btn-ghost">
              Войти в кабинет
            </Link>
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
            Прозрачная партнёрская модель без скрытых условий
          </p>
        </div>
      </section>

      {/* ЭКОНОМИКА */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="dark-card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
            <div className="border-b border-white/8 p-6 lg:border-b-0 lg:border-r lg:p-8">
              <div className="eyebrow">Экономика сделки</div>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Вы определяете <span className="accent">свою цену</span>
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                PPF PROFI фиксирует партнёрскую цену. Вы назначаете цену клиенту
                и оставляете себе разницу.
              </p>
              <p className="mt-3 text-xs leading-5 text-white/40">
                Система показывает партнёрскую и рекомендуемую розничную цену.
                Внутренняя себестоимость PPF PROFI не раскрывается.
              </p>
            </div>

            <div className="p-6 lg:p-8">
              <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                Пример расчёта
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Цена PPF PROFI для партнёра
                  </div>
                  <div className="mt-2 text-2xl font-extrabold">42 000 ₽</div>
                </div>

                <div className="hidden text-center text-xl accent sm:block">→</div>

                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                    Цена для клиента
                  </div>
                  <div className="mt-2 text-2xl font-extrabold">55 000 ₽</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-lime-400/25 bg-lime-400/[0.06] p-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] accent">
                    Ваш валовый спред
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    Разница между ценой клиента и партнёрской ценой
                  </div>
                </div>
                <div className="text-3xl font-extrabold accent">+ 13 000 ₽</div>
              </div>

              <p className="mt-4 text-[11px] leading-5 text-white/40">
                Цифры приведены исключительно для иллюстрации механики.
                Фактические цены и доступные условия рассчитываются системой в
                личном кабинете.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* КАК РАБОТАЕТ */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="eyebrow">Как это работает</div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
              От расчёта до готового автомобиля
            </h2>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <div key={s.n} className="dark-card p-4">
              <div className="text-lg font-extrabold accent">{s.n}</div>
              <div className="mt-3 text-xs font-extrabold leading-5">{s.title}</div>
              <p className="mt-1.5 text-[11px] leading-4 text-white/55">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ЧТО ПОЛУЧАЕТ ПАРТНЁР + ИНФРАСТРУКТУРА */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="dark-card p-6">
            <div className="eyebrow">Возможности</div>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
              Что получает партнёр
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="text-base">{b.icon}</div>
                  <div className="mt-2 text-sm font-extrabold">{b.title}</div>
                  <p className="mt-1 text-xs leading-5 text-white/55">{b.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dark-card relative overflow-hidden p-6">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-lime-400/10 blur-3xl" />
            <div className="relative">
              <div className="eyebrow">Не просто скидка</div>
              <h2 className="mt-2 text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
                PPF PROFI — это <span className="accent">инфраструктура</span>{" "}
                для продажи услуги
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Партнёру не нужно становиться специалистом по PPF. Он продаёт
                решение. PPF PROFI обеспечивает расчёт, производство и
                выполнение.
              </p>
              <div className="mt-5 space-y-2 border-t border-white/8 pt-5 text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <span className="accent">✓</span> Без своего бокса
                </div>
                <div className="flex items-center gap-2">
                  <span className="accent">✓</span> Без найма мастеров
                </div>
                <div className="flex items-center gap-2">
                  <span className="accent">✓</span> Без закупки материалов
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* КОМУ ПОДХОДИТ */}
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4">
          <div className="eyebrow">Кому подходит PPF PROFI</div>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
            Сегменты, для которых мы работаем
          </h2>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {PARTNER_TYPES.map((t) => (
            <div key={t.title} className="dark-card p-5">
              <div className="text-base font-extrabold">{t.title}</div>
              <p className="mt-2 text-xs leading-5 text-white/60">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ФИНАЛЬНЫЙ CTA */}
      <section className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <div className="dark-card relative overflow-hidden p-6 sm:p-8">
          <div className="absolute -left-24 -top-24 h-56 w-56 rounded-full bg-lime-400/10 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-56 w-56 rounded-full bg-lime-400/[0.06] blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Начните работать с PPF PROFI
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                Напишите нам в Telegram — выдадим slug и PIN для доступа в кабинет.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://t.me/partner_detiling"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent"
              >
                Написать в Telegram →
              </a>
              <Link href="/b2b" className="btn-ghost">
                Войти в кабинет
              </Link>
            </div>
          </div>
          <p className="relative mt-4 text-[11px] text-white/40">
            Логин и PIN выдаёт PPF PROFI после первого контакта.
          </p>
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
            <Link href="/b2b" className="hover:text-white">
              Войти
            </Link>
          </div>
          <div className="text-xs text-white/40">
            © 2026 PPF PROFI. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}