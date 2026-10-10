"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import LeadForm from "@/components/forms/LeadForm";
import type { FormContent } from "@/components/forms/FormParts";
import { buildTelegramUrl, fillTemplate, formatRub } from "@/shared/format";

type Price = { low: number; high: number } | null;

export type CalcCar = {
  code: string;
  label: string;
  /** prices[scenario][film] — только диапазон для клиента. */
  prices: Record<string, Record<string, Price>>;
};

export type CalcOption = { code: string; label: string; desc: string };

export type CalculatorTexts = {
  showAll: string;
  hideAll: string;
  priceNote: string;
  noModelTitle: string;
  noModelText: string;
  telegramTemplate: string;
  leadTitle: string;
  leadText: string;
  successTitle: string;
  successText: string;
};

type Props = {
  topCars: CalcCar[];
  otherCars: CalcCar[];
  scenarios: CalcOption[];
  films: (CalcOption & { name: string })[];
  texts: CalculatorTexts;
  form: FormContent;
};

const cardClass = (active: boolean) =>
  `rounded-2xl border px-5 py-4 text-left transition ${
    active
      ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
      : "border-white/8 bg-white/[0.03] hover:border-white/20"
  }`;

export default function Calculator({ topCars, otherCars, scenarios, films, texts, form }: Props) {
  const allCars = [...topCars, ...otherCars];
  const searchParams = useSearchParams();
  const carFromUrl = searchParams.get("car");
  const initialCar = allCars.find((c) => c.code === carFromUrl);

  const [step, setStep] = useState(initialCar ? 2 : 1);
  const [car, setCar] = useState(initialCar?.code ?? allCars[0]?.code ?? "");
  const [showAll, setShowAll] = useState(
    Boolean(initialCar && otherCars.some((c) => c.code === initialCar.code))
  );
  const [pkg, setPkg] = useState(scenarios[0]?.code ?? "");
  const [film, setFilm] = useState(films[0]?.code ?? "");
  const [sent, setSent] = useState(false);

  const carObj = allCars.find((c) => c.code === car);
  const pkgObj = scenarios.find((p) => p.code === pkg);
  const filmObj = films.find((f) => f.code === film);
  const price: Price = carObj?.prices[pkg]?.[film] ?? null;

  const reset = () => {
    setStep(1);
    setSent(false);
  };

  const noModel = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="font-extrabold">{texts.noModelTitle}</div>
      <p className="mt-1 text-sm text-white/60">{texts.noModelText}</p>
      <a
        href={buildTelegramUrl(form.telegram)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-4 inline-flex text-sm"
      >
        {form.texts.telegramButton}
      </a>
    </div>
  );

  const tgText =
    carObj && pkgObj && filmObj && price
      ? fillTemplate(texts.telegramTemplate, {
          model: carObj.label,
          scenario: pkgObj.label.toLowerCase(),
          film: filmObj.name,
          price: `от ${formatRub(price.low)}`,
        })
      : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {sent ? (
        <div className="reveal text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-400/15 ring-1 ring-lime-400/40">
            <span className="text-4xl accent">✓</span>
          </div>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {texts.successTitle}
          </h1>
          <p className="mt-4 text-white/60">{texts.successText}</p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={reset} className="btn-accent justify-center">
              Новый расчёт
            </button>
            <Link href="/" className="btn-ghost justify-center">
              На главную
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-10 flex items-center gap-2">
            {["Авто", "Состав", "Результат"].map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={label} className="flex flex-1 items-center gap-2">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold transition ${
                      active
                        ? "bg-lime-400 text-black shadow-lg shadow-lime-400/30"
                        : done
                        ? "bg-lime-400/20 text-lime-300"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {done ? "✓" : n}
                  </div>
                  <span
                    className={`hidden text-sm font-bold sm:inline ${
                      active ? "text-white" : "text-white/40"
                    }`}
                  >
                    {label}
                  </span>
                  {i < 2 && (
                    <div className={`h-px flex-1 ${done ? "bg-lime-400/40" : "bg-white/10"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <div className="reveal">
              <div className="eyebrow">Шаг 1 из 3</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Какой автомобиль?
              </h1>
              <p className="mt-3 text-white/60">Выберите марку и поколение кузова.</p>

              <div className="mt-8 grid gap-2">
                {topCars.map((c) => (
                  <button key={c.code} onClick={() => setCar(c.code)} className={cardClass(car === c.code)}>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white">{c.label}</span>
                      {car === c.code && <span className="accent">●</span>}
                    </div>
                  </button>
                ))}
                {showAll &&
                  otherCars.map((c) => (
                    <button key={c.code} onClick={() => setCar(c.code)} className={cardClass(car === c.code)}>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white">{c.label}</span>
                        {car === c.code && <span className="accent">●</span>}
                      </div>
                    </button>
                  ))}
                {otherCars.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="rounded-2xl border border-dashed border-white/15 px-5 py-3 text-sm font-bold text-white/60 transition hover:text-white"
                  >
                    {showAll ? texts.hideAll : `${texts.showAll} (${otherCars.length})`}
                  </button>
                )}
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!carObj}
                className="btn-accent mt-8 w-full justify-center disabled:opacity-50"
              >
                Далее →
              </button>

              <div className="mt-8">{noModel}</div>
            </div>
          )}

          {step === 2 && (
            <div className="reveal">
              <div className="eyebrow">Шаг 2 из 3</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Состав и плёнка
              </h1>
              <p className="mt-3 text-white/60">Что нужно защитить и какой плёнкой.</p>

              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                  Состав работ
                </div>
                <div className="mt-3 grid gap-2">
                  {scenarios.map((p) => (
                    <button key={p.code} onClick={() => setPkg(p.code)} className={cardClass(pkg === p.code)}>
                      <div className="font-extrabold text-white">{p.label}</div>
                      <div className="mt-1 text-xs text-white/50">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                  Плёнка
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {films.map((f) => (
                    <button key={f.code} onClick={() => setFilm(f.code)} className={cardClass(film === f.code)}>
                      <div className="font-extrabold text-white">{f.label}</div>
                      <div className="mt-1 text-xs text-white/50">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setStep(1)} className="btn-ghost">
                  ← Назад
                </button>
                <button onClick={() => setStep(3)} className="btn-accent flex-1 justify-center">
                  Рассчитать
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="reveal">
              <div className="eyebrow">Шаг 3 из 3</div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Предварительный расчёт
              </h1>

              <div className="dark-card mt-8 p-6 sm:p-8">
                <div className="text-sm font-extrabold uppercase tracking-[0.14em] accent">
                  {carObj?.label}
                </div>
                <div className="mt-2 text-base text-white/60">
                  {pkgObj?.label} · {filmObj?.label}
                </div>

                {price ? (
                  <>
                    <div className="mt-6 text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
                      от <span className="accent">{formatRub(price.low)}</span>
                    </div>
                    <p className="mt-3 text-base text-white/60">{texts.priceNote}</p>
                  </>
                ) : (
                  <div className="mt-6">{noModel}</div>
                )}
              </div>

              {price && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <a
                    href={buildTelegramUrl(form.telegram, tgText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent justify-center"
                  >
                    {form.texts.telegramButton}
                  </a>
                  <button onClick={() => setStep(2)} className="btn-ghost justify-center">
                    Изменить расчёт
                  </button>
                </div>
              )}

              {price && (
                <div className="dark-card mt-6 p-6 sm:p-8">
                  <h2 className="text-2xl font-extrabold tracking-tight">{texts.leadTitle}</h2>
                  <p className="mt-2 text-base text-white/60">{texts.leadText}</p>
                  <div className="mt-6">
                    <LeadForm
                      content={form}
                      selection={{ carCode: car, scenario: pkg, filmCode: film }}
                      submitLabel="Отправить"
                      onSuccess={() => setSent(true)}
                    />
                  </div>
                </div>
              )}

              {!price && (
                <button onClick={reset} className="btn-ghost mt-6 w-full justify-center">
                  Изменить расчёт
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
