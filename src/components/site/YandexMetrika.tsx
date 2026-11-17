"use client";

import { useEffect } from "react";
import Script from "next/script";
import { trackGoal } from "@/shared/analytics";

/** Метрика включается только при наличии NEXT_PUBLIC_YM_ID. Включены карта кликов и Вебвизор. */
export default function YandexMetrika() {
  const id = (process.env.NEXT_PUBLIC_YM_ID || "").trim();

  useEffect(() => {
    if (!/^\d{4,12}$/.test(id)) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";

      if (href.startsWith("tel:")) trackGoal("phone_click");
      else if (/^(https?:\/\/(t\.me|telegram\.me)\/|tg:\/\/)/i.test(href)) {
        trackGoal("telegram_click");
      } else if (href === "#calculator" || href.startsWith("/calculator")) {
        trackGoal("calculator_open");
      }
    };

    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      const form = target.closest("form");
      if (!form || form.dataset.ymStarted === "1") return;
      form.dataset.ymStarted = "1";
      trackGoal("lead_form_start");
    };

    const onChange = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement || target instanceof HTMLInputElement)) return;
      if (target.type === "radio" && target.name.includes("variant")) {
        trackGoal("calculator_package_selected", { package: target.value });
      } else if (target.id.endsWith("-brand") || target.id.endsWith("-model") || target.id.endsWith("-gen")) {
        trackGoal("calculator_car_selected", { field: target.id.split("-").pop() || "unknown", value: target.value });
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("change", onChange, true);
    };
  }, [id]);

  if (!/^\d{4,12}$/.test(id)) return null;

  return (
    <Script id="ym-init" strategy="afterInteractive">
      {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});`}
    </Script>
  );
}
