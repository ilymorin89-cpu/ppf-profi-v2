import Script from "next/script";

/**
 * Google Analytics 4. Включается только если задана переменная NEXT_PUBLIC_GA_ID (вида G-XXXXXXXXXX).
 * Без переменной ничего не загружается.
 */
export default function GoogleAnalytics() {
  const id = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
  if (!/^G-[A-Z0-9]{6,12}$/.test(id)) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}');`}
      </Script>
    </>
  );
}
