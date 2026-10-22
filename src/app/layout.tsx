import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import UtmCapture from "@/components/forms/UtmCapture";
import YandexMetrika from "@/components/site/YandexMetrika";
import { SITE } from "@/content/site";
import { OG_IMAGE, TWITTER_CARD } from "@/lib/seo";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  openGraph: { siteName: SITE.name, locale: "ru_RU", type: "website", images: [OG_IMAGE] },
  twitter: TWITTER_CARD,
  // Подтверждение прав в Google Search Console (тег HTML). Не удалять: без него Google снимет доступ.
  // Подтверждение прав: Google Search Console и Яндекс Вебмастер (meta-теги). Не удалять.
  verification: {
    google: "rjQuyCsReahhqirzavuVKwHrqzAKCOvooImQ9nQoZpc",
    yandex: "8e84373381798ef4",
  },
  title: "PPF PROFI — Защита автомобиля плёнкой",
  description: "Оклейка авто пленкой в Москве: полиуретановая плёнка Spectroll (бронепленка). Зоны риска от 1 дня. Работаем на проверенных площадках.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans antialiased">
        <UtmCapture />
        {children}
        <YandexMetrika />
      </body>
    </html>
  );
}