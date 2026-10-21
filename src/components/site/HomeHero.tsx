/* eslint-disable @next/next/no-img-element -- фон из public/, оптимизатор не нужен */

/**
 * Первый экран главной: фото гаража с автомобилем, H1, описание и кнопка к калькулятору.
 * Фото декоративное, поэтому alt пустой. Поверх фото — затемнение, чтобы текст читался.
 */
export default function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/8">
      <img
        src="/hero/garage-bmw.webp"
        alt=""
        width={1536}
        height={1024}
        fetchPriority="high"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_50%]"
      />
      {/* Слева плотнее, чтобы текст читался; на телефоне затемнение снизу. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/75 to-black/10" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/70 to-black/20 lg:hidden"
      />

      <div className="mx-auto flex min-h-[80svh] max-w-7xl flex-col justify-end px-4 pb-14 pt-12 sm:px-6 lg:min-h-[86svh] lg:justify-center lg:pb-20">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-lime-400">
          Защита кузова
          <span className="h-px w-16 bg-lime-400/70" />
        </div>
        <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Плёнка, которая <span className="accent">бережёт</span> ваш автомобиль
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-white/80 sm:text-lg">
          Профессиональная оклейка авто плёнкой PPF в Москве. Гарантия 24 месяца.
        </p>
        <a href="#calculator" className="btn-accent mt-8 w-fit">
          Рассчитать стоимость →
        </a>
      </div>
    </section>
  );
}
