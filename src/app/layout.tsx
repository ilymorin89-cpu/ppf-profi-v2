import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import UtmCapture from "@/components/forms/UtmCapture";
import { SITE } from "@/content/site";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  openGraph: { siteName: SITE.name, locale: "ru_RU", type: "website" },
  // Подтверждение прав в Google Search Console (тег HTML). Не удалять: без него Google снимет доступ.
  verification: { google: "rjQuyCsReahhqirzavuVKwHrqzAKCOvooImQ9nQoZpc" },
  title: "PPF PROFI — Защита автомобиля плёнкой",
  description: "Оклейка авто защитной плёнкой PPF в Москве. Работаем на проверенных площадках.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="font-sans antialiased">
        <UtmCapture />
        {children}
      </body>
    </html>
  );
}