import Link from "next/link";

const STEPS = [
  { n: "01", title: "Рассчитать", text: "Выберите автомобиль, комплектацию и состав работ." },
  { n: "02", title: "Получить партнёрскую цену", text: "Система рассчитывает стоимость PPF PROFI и рекомендуемую цену для клиента." },
  { n: "03", title: "Определить цену клиенту", text: "Вы сами назначаете цену предложения для своего клиента." },
  { n: "04", title: "Отправить предложение", text: "Сформируйте ссылку и отправьте клиенту." },
  { n: "05", title: "Передать выполнение PPF PROFI", text: "Сделка передаётся в работу и отслеживается в системе." },
];

const BENEFITS = [
  { icon: "🧮", title: "Партнёрский расчёт", text: "Цена PPF PROFI без необходимости вручную считать каждую работу." },
  { icon: "💵", title: "Собственная цена для клиента", text: "Вы контролируете коммерческое предложение и свой валовый спред." },
  { icon: "🔗", title: "Готовая ссылка клиенту", text: "Клиент получает понятное предложение без доступа к вашей партнёрской цене." },
  { icon: "📊", title: "Контроль сделки", text: "Расчёт → клиент → заказ → мастер → выполнение." },
  { icon: "🕓", title: "История расчётов", text: "Можно вернуться к предыдущему автомобилю и повторить расчёт." },
];

const PARTNER_TYPES = [
  {
    title: "Автосалоны",
    text: "Предложите защиту плёнкой покупателям сразу после сделки. Дополнительная прибыль без расширения штата.",
  },
  {
    title: "Малые станции",
    text: "Клиенты после кузовного ремонта хотят защитить восстановленные элементы. PPF PROFI выполняет работу — вы получаете спред.",
  },
  {
    title: "Детейлинг-центры",
    text: "Передавайте PPF-заказы, которые не берёте. Сохраняете клиента, получаете доход, остаётесь специалистом по детейлингу.",
  },
];

export default function PartnersPage() {
  return (
    <div className="dark-grid min-h-screen text-white">
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
          <div className="flex items-center gap-4">
            <Link
              href="/b2b"
              className="hidden text-sm font-bold text-white/60 transition hover:text-white md:block"
            >
              Войти в кабинет
            </Link>
            <Link href="/calculator" className="btn-accent text-sm">
              Рассчитать PPF
            </Link>
          </div>
        </div>
      </header>

      {/* ПЕРВЫЙ ЭКРАН */}
      <section className="mx-auto max-w-7xl px-6 pt-20 pb-16">
        <div className="reveal mx-auto max-w-4xl text-center">
          <div className="eyebrow">PPF PROFI для бизнеса</div>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Добавьте PPF в свою продажу — <br />
            <span className="accent">без собственного участка и команды.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Рассчитывайте стоимость, формируйте предложение клиенту и передавайте
            выполнение PPF PROFI.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/calculator" className="btn-accent">
              Рассчитать автомобиль →
            </Link>
            <Link href="/b2b" className="btn-ghost">
              Войти в кабинет
            </Link>
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-white/40">
            Прозрачная партнёрская модель без скрытых условий
          </p>
        </div>
      </section>

      {/* ЭКОНОМИКА */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:items-center">
          <div>
            <div className="eyebrow">Экономика сделки</div>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Вы определяете <span className="accent">свою цену</span>
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/60">
              PPF PROFI фиксирует партнёрскую цену. Вы назначаете цену клиенту
              и оставляете себе разницу. Прозрачно и предсказуемо на каждой
              сделке.
            </p>
            <p className="mt-6 max-w-lg text-xs leading-6 text-white/40">
              Система показывает партнёрскую цену и рекомендуемую розничную
              цену. Внутренняя себестоимость PPF PROFI не раскрывается.
            </p>
          </div>

          <div className="dark-card p-8">
            <div className="mb-6 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              Пример расчёта
            </div>

            <div className="space-y-5">
              <div className="flex items-baseline justify-between border-b border-white/8 pb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Цена PPF PROFI для партнёра
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Стоимость выполнения работы
                  </div>
                </div>
                <div className="text-2xl font-extrabold">42 000 ₽</div>
              </div>

              <div className="flex items-baseline justify-between border-b border-white/8 pb-5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Цена для клиента
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Устанавливаете вы
                  </div>
                </div>
                <div className="text-2xl font-extrabold">55 000 ₽</div>
              </div>

              <div className="flex items-baseline justify-between pt-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
                    Ваш валовый спред
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Разница между ценой клиента и партнёрской ценой
                  </div>
                </div>
                <div className="text-3xl font-extrabold accent">+ 13 000 ₽</div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4 text-xs leading-5 text-lime-100">
              Цифры приведены исключительно для иллюстрации механики.
              Фактические цены и доступные условия рассчитываются системой в
              личном кабинете.
            </div>
          </div>
        </div>
      </section>

      {/* КАК РАБОТАЕТ */}
      <section className="border-y border-white/8 bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="eyebrow">Как это работает</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            От расчёта до готового автомобиля
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s) => (
              <div key={s.n} className="dark-card p-6">
                <div className="text-3xl font-extrabold accent">{s.n}</div>
                <div className="mt-4 text-sm font-extrabold leading-5">
                  {s.title}
                </div>
                <p className="mt-2 text-xs leading-5 text-white/55">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ЧТО ПОЛУЧАЕТ ПАРТНЁР */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="eyebrow">Возможности</div>
        <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Что получает партнёр
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="dark-card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-lime-400/10 text-lg">
                {b.icon}
              </div>
              <div className="mt-4 text-base font-extrabold">{b.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/55">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* КЛЮЧЕВОЕ ОТЛИЧИЕ */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="dark-card relative overflow-hidden p-8 sm:p-12">
          <div className="absolute -right-32 -top-32 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="eyebrow">Не просто партнёрская скидка</div>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              PPF PROFI — это <span className="accent">инфраструктура</span>{" "}
              для продажи услуги
            </h2>
            <p className="mt-5 text-base leading-7 text-white/65">
              Партнёру не нужно становиться специалистом по PPF. Он продаёт
              клиенту решение. PPF PROFI обеспечивает расчёт, производство
              услуги и выполнение.
            </p>
          </div>
        </div>
      </section>

      {/* КОМУ ПОДХОДИТ */}
      <section className="border-t border-white/8 bg-black/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="eyebrow">Кому подходит PPF PROFI</div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Сегменты, для которых мы работаем
          </h2>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PARTNER_TYPES.map((t) => (
              <div key={t.title} className="dark-card p-7">
                <div className="text-xl font-extrabold">{t.title}</div>
                <p className="mt-4 text-sm leading-6 text-white/60">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ФИНАЛЬНЫЙ CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="dark-card relative overflow-hidden p-10 text-center sm:p-16">
          <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
          <div className="absolute -right-32 -bottom-32 h-72 w-72 rounded-full bg-lime-400/8 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Начните работать с PPF PROFI
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/60">
              Откройте кабинет партнёра, рассчитайте первый заказ и предложите
              клиенту готовое решение.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/b2b" className="btn-accent">
                Войти в кабинет →
              </Link>
              <Link href="/calculator" className="btn-ghost">
                Посмотреть расчёт
              </Link>
            </div>
            <p className="mt-6 text-xs text-white/40">
              Логин и PIN выдаёт PPF PROFI после первого контакта.
            </p>
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
            <Link href="/" className="hover:text-white">Главная</Link>
            <Link href="/partners" className="hover:text-white">Партнёрам</Link>
            <Link href="/master" className="hover:text-white">Мастерам</Link>
            <Link href="/b2b" className="hover:text-white">Войти</Link>
          </div>
          <div className="text-xs text-white/40">
            © 2026 PPF PROFI. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
}