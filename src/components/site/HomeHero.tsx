/* eslint-disable @next/next/no-img-element -- фон из public/, оптимизатор не нужен */

/**
 * Первый экран главной: премиальный automotive hero с реальным фото из public/.
 * Текст и CTA остаются HTML-элементами, а не частью изображения.
 */
export default function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#080b0b]">
      <img
        src="/hero/garage-bmw-portrait.webp"
        alt=""
        width={1536}
        height={1024}
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[62%_50%]"
      />

      {/* Контрастная зона под текст и мягкое затемнение нижней части фотографии. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,8,7,0.96)_0%,rgba(5,8,7,0.82)_34%,rgba(5,8,7,0.28)_72%,rgba(5,8,7,0.08)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(5,8,7,0.92)_0%,transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(163,230,53,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(163,230,53,0.08)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(90deg,black,transparent_75%)]"
      />

      <div className="mx-auto grid min-h-[76svh] max-w-7xl items-end gap-10 px-4 pb-12 pt-14 sm:px-6 sm:pb-16 lg:min-h-[82svh] lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.65fr)] lg:items-center lg:gap-8 lg:py-20">
        <div className="reveal max-w-3xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-lime-300/25 bg-black/40 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-lime-300 backdrop-blur-md sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-[#A3E635] shadow-[0_0_14px_rgba(163,230,53,0.9)]" />
            Премиальная защита кузова
          </div>

          <h1 className="mt-6 max-w-3xl text-balance text-[clamp(2.35rem,5.2vw,5rem)] font-black leading-[0.98] tracking-[-0.055em] text-white">
            Защита кузова
            <br />
            <span className="text-[#A3E635]">полиуретановой</span>
            <br />
            плёнкой PPF
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
            Оклейка автомобилей в Москве плёнкой Spectroll Premium. Подберём пакет защиты под ваш автомобиль и рассчитаем стоимость онлайн.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#calculator"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-[#A3E635] px-6 py-4 text-sm font-black text-[#10130c] shadow-[0_8px_32px_rgba(163,230,53,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#b8f45a] hover:shadow-[0_12px_38px_rgba(163,230,53,0.28)]"
            >
              Рассчитать стоимость
              <span aria-hidden="true" className="text-lg transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#gallery"
              className="inline-flex min-h-14 items-center justify-center rounded-xl border border-white/20 bg-black/35 px-6 py-4 text-sm font-bold text-white backdrop-blur-md transition hover:border-[#A3E635]/60 hover:bg-white/10"
            >
              Смотреть наши работы
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-5 text-xs font-semibold text-white/65 sm:text-sm">
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#A3E635]" />Spectroll Premium</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#A3E635]" />Пакеты защиты под задачу</span>
            <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#A3E635]" />Расчёт онлайн</span>
          </div>
        </div>

        <div className="hidden justify-self-end lg:block">
          <div className="rounded-2xl border border-white/15 bg-black/35 p-5 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#A3E635]">PPF PROFI</p>
            <p className="mt-2 text-xl font-extrabold leading-tight text-white">Защита, которую<br />почти не видно.</p>
            <p className="mt-3 max-w-[220px] text-sm leading-6 text-white/60">Сохраняем внешний вид кузова и внимание к деталям.</p>
            <a href="#calculator" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#A3E635] hover:text-lime-200">
              Выбрать пакет <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
