import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import UtmCapture from "@/components/forms/UtmCapture";
import YandexMetrika from "@/components/site/YandexMetrika";
import GoogleAnalytics from "@/components/site/GoogleAnalytics";
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
  // Подтверждения Google Search Console и Яндекс Вебмастера. Не удалять.
  verification: {
    google: "rjQuyCsReahhqirzavuVKwHrqzAKCOvooImQ9nQoZpc",
    yandex: "8e84373381798ef4",
  },
  title: "PPF PROFI — Защита автомобиля плёнкой",
  description:
    "Оклейка автомобилей полиуретановой антигравийной плёнкой PPF в Москве и области. Полная защита кузова и зоны риска. Цены по моделям, онлайн-калькулятор.",
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
        <GoogleAnalytics />
      </body>
    </html>
  );
}
