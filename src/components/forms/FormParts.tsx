"use client";

import Link from "next/link";
import { buildTelegramUrl, type TelegramContact } from "@/shared/format";
import type { SubmitResult } from "./submit";

export type FormTexts = {
  rateLimited: string;
  network: string;
  telegramButton: string;
  consentPrefix: string;
  consentLink: string;
  referralLabel: string;
  referralPlaceholder: string;
  sending: string;
};

/** Всё, что формам нужно от src/content/site.ts; передаётся пропсами из серверного компонента. */
export type FormContent = { texts: FormTexts; telegram: TelegramContact };

export const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400";

export const labelClass = "text-[10px] font-bold uppercase tracking-[0.14em] text-white/40";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="mt-1.5 text-xs font-bold text-rose-300">{message}</div>;
}

export function ConsentCheckbox({
  checked,
  onChange,
  texts,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  texts: FormTexts;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          className="mt-1 h-4 w-4 shrink-0 accent-lime-400"
        />
        <span className="text-xs leading-5 text-white/60">
          {texts.consentPrefix}{" "}
          <Link href="/privacy" target="_blank" className="accent hover:underline">
            {texts.consentLink}
          </Link>
        </span>
      </label>
      <FieldError message={error} />
    </div>
  );
}

export function ReferralInput({
  value,
  onChange,
  texts,
}: {
  value: string;
  onChange: (v: string) => void;
  texts: FormTexts;
}) {
  return (
    <div>
      <label className={labelClass}>{texts.referralLabel}</label>
      <input
        type="text"
        value={value}
        maxLength={160}
        onChange={(e) => onChange(e.target.value)}
        placeholder={texts.referralPlaceholder}
        className={inputClass}
      />
    </div>
  );
}

/** Ошибка отправки: 400 (общая строка), 429 (+ кнопка Telegram), сеть/таймаут/5xx. */
export function SubmitError({ result, content }: { result: SubmitResult | null; content: FormContent }) {
  if (!result || result.kind === "ok") return null;
  if (result.kind === "invalid") {
    if (!result.message || Object.keys(result.fields).length > 0) return null;
    return <ErrorBox>{result.message}</ErrorBox>;
  }
  const text = result.kind === "rate-limited" ? content.texts.rateLimited : content.texts.network;
  return (
    <ErrorBox>
      <div>{text}</div>
      <a
        href={buildTelegramUrl(content.telegram)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-3 inline-flex text-sm"
      >
        {content.texts.telegramButton}
      </a>
    </ErrorBox>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200"
    >
      {children}
    </div>
  );
}

/** Ошибки полей из ответа 400. */
export function fieldErrors(result: SubmitResult | null): Record<string, string> {
  return result && result.kind === "invalid" ? result.fields : {};
}
