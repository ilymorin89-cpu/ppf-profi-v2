/* eslint-disable @next/next/no-img-element -- фон из public/, оптимизатор не нужен */

/**
 * Верх страницы /calculator: подпись, H1 и пояснение про цены «от». Фото — фон справа, затемнено слева.
 */
export default function CalcPageIntro() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/8">
      <img
        src="/hero/garage-bmw-portrait.webp"
        alt=""
        width={1536}
        height={1024}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[80%_30%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/65 to-black/20" />

      <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-lime-400">
          Онлайн-расчёт
          <span className="h-px w-16 bg-lime-400/70" />
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Калькулятор оклейки авто <span className="accent">плёнкой PPF в Москве</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">
          Цены указаны «от». Точную сумму подтверждаем после осмотра.
        </p>
      </div>
    </section>
  );
}
