/* eslint-disable @next/next/no-img-element -- сохраняем естественные пропорции исходных фото */

/** Галерея фотографий работ владельца. Подписи с моделями не добавляем без подтверждения. */
const WORKS = [
  "/works/work-01.webp",
  "/works/work-02.webp",
  "/works/work-03.webp",
  "/works/work-04.webp",
  "/works/work-05.webp",
  "/works/work-06.webp",
  "/works/work-07.webp",
];

export default function WorksGallery() {
  return (
    <section id="gallery" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20 sm:px-6">
      <div className="eyebrow">Работы</div>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Наши работы</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">Фотографии выполненных работ PPF PROFI. Откройте снимок, чтобы рассмотреть детали в полном размере.</p>
      <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {WORKS.map((src, i) => (
          <figure key={src} className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Открыть фотографию работы PPF PROFI ${i + 1} в полном размере`}
              className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-400"
            >
              <img
                src={src}
                alt={`Фотография работы PPF PROFI №${i + 1}`}
                loading="lazy"
                decoding="async"
                className="block w-full transition duration-300 group-hover:scale-[1.015]"
              />
              <figcaption className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-white/55">
                <span>Работа PPF PROFI · {String(i + 1).padStart(2, "0")}</span>
                <span className="text-lime-300">Открыть фото ↗</span>
              </figcaption>
            </a>
          </figure>
        ))}
      </div>
    </section>
  );
}
