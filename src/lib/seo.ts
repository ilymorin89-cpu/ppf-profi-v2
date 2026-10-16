/**
 * Общие настройки превью для соцсетей и мессенджеров.
 * Картинка 1200×630 лежит в public/og/. Страницы сами задают title, description и url;
 * картинку подставляем отсюда, чтобы она не терялась при переопределении openGraph.
 */
export const OG_IMAGE = {
  url: "/og/ppfprofi-default.jpg",
  width: 1200,
  height: 630,
  alt: "PPF PROFI — защитная оклейка автомобилей",
};

export const TWITTER_CARD = {
  card: "summary_large_image" as const,
  images: [OG_IMAGE.url],
};
