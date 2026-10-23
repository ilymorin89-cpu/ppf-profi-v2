/* eslint-disable @next/next/no-img-element -- фото из public/, фото не обрезаются и не сжимаются */

/**
 * Галерея реальных работ владельца. Фото показываются целиком, без обрезки:
 * колонки (CSS columns) сохраняют пропорции каждого кадра. Подписей с маркой нет:
 * их добавит владелец, когда подтвердит модели.
 */
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
      <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {WORKS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Работа PPF PROFI ${i + 1}`}
            loading="lazy"
            decoding="async"
            className="mb-4 block w-full break-inside-avoid rounded-xl"
          />
        ))}
      </div>
    </section>
  );
}
