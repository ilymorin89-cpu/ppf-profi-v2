import VenomButton from "@/components/site/VenomButton";
import Image from "next/image";

/**
 * Первый экран главной: фото студии, понятный поисковый заголовок и переход к расчёту.
 * Изображение декоративное: alt пустой, загрузка приоритетная.
 */
export default function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/8">
      <Image
        src="/hero/garage-bmw-portrait.webp"
        alt=""
        fill
        priority
        quality={70}
        sizes="100vw"
        className="-z-10 object-cover object-[65%_50%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent lg:hidden"
      />

      <div className="mx-auto flex min-h-[72svh] max-w-7xl flex-col justify-end px-4 pb-12 pt-10 sm:px-6 lg:min-h-[82svh] lg:justify-center lg:pb-20">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-lime-400">
          Защита кузова
          <span className="h-px w-16 bg-lime-400/70" />
        </div>
        <h1 className="mt-5 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
          Оклейка автомобиля <span className="accent">полиуретановой плёнкой PPF</span> в Москве
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
          Антигравийная защита кузова плёнкой Spectroll: полная оклейка или зоны риска.
          Рассчитайте стоимость для BMW, Mercedes-Benz, Porsche, Geely и других марок.
        </p>
        <VenomButton href="#calculator" className="mt-7 w-fit">
          Рассчитать стоимость <span aria-hidden="true">→</span>
        </VenomButton>
      </div>
    </section>
  );
}
