"use client";

import Link from "next/link";
import { useState } from "react";

const CARS = [
  { code: "GEELY_MONJARO", label: "Geely Monjaro" },
  { code: "BMW_X5_G05", label: "BMW X5 G05" },
  { code: "BMW_X7_G07", label: "BMW X7 G07" },
  { code: "MB_GLE_V167", label: "Mercedes-Benz GLE V167" },
  { code: "PORSCHE_CAYENNE_E3", label: "Porsche Cayenne E3" },
  { code: "TOYOTA_LC300", label: "Toyota Land Cruiser 300" },
];

const PACKAGES = [
  { code: "FRONT", label: "Передняя часть", desc: "Бампер, капот, крылья, зеркала" },
  { code: "RISK_ZONES", label: "Зоны риска", desc: "Бампер, зеркала, фары, пороги" },
  { code: "FULL", label: "Полная оклейка", desc: "Все основные элементы кузова" },
];

const FILMS = [
  { code: "PPF_STANDARD", label: "PPF PROFI Standard", desc: "Надёжная защита" },
  { code: "SPECTROLL_PREMIUM", label: "Spectroll Premium", desc: "Премиальная защита" },
];

export default function CalculatorPage() {
  const [step, setStep] = useState(1);
  const [car, setCar] = useState(CARS[0].code);
  const [pkg, setPkg] = useState(PACKAGES[0].code);
  const [film, setFilm] = useState(FILMS[0].code);
  const [result, setResult] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const calculate = () => {
    const base = 50000;
    const carMul = car === "GEELY_MONJARO" ? 1.1 : car === "BMW_X7_G07" ? 1.3 : 1;
    const pkgMul = pkg === "FULL" ? 2.4 : pkg === "RISK_ZONES" ? 0.9 : 1;
    const filmMul = film === "SPECTROLL_PREMIUM" ? 1.15 : 1;
    setResult(Math.round((base * carMul * pkgMul * filmMul) / 500) * 500);
    setStep(3);
  };

  const reset = () => {
    setResult(null);
    setStep(1);
    setShowForm(false);
    setSent(false);
    setName("");
    setPhone("");
    setComment("");
    setConsent(false);
    setFormError("");
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim() || !phone.trim()) return;
    if (result === null) return;
    if (!consent) {
      setFormError("Поставьте галочку согласия на обработку данных");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carCode: car,
          scenario: pkg,
          filmCode: film,
          price: result,
          clientName: name,
          clientPhone: phone,
          comment,
          consent: true,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(err.error || "Не удалось отправить заявку");
        return;
      }

      setSent(true);
    } catch {
      setFormError("Ошибка сети. Проверьте соединение.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-lg font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-white/50 hover:text-white"
          >
            ← На главную
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {sent ? (
          <div className="reveal text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-400/15 ring-1 ring-lime-400/40">
              <span className="text-4xl accent">✓</span>
            </div>
            <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Заявка принята
            </h1>
            <p className="mt-4 text-white/60">
              Мы свяжемся с вами в течение 15 минут для подтверждения расчёта.
            </p>
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
                      className={`text-xs font-bold ${
                        active ? "text-white" : "text-white/40"
                      }`}
                    >
                      {label}
                    </span>
                    {i < 2 && (
                      <div
                        className={`h-px flex-1 ${
                          done ? "bg-lime-400/40" : "bg-white/10"
                        }`}
                      />
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
                <p className="mt-3 text-white/60">
                  Выберите марку и поколение кузова.
                </p>

                <div className="mt-8 grid gap-2">
                  {CARS.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCar(c.code)}
                      className={`rounded-2xl border px-5 py-4 text-left transition ${
                        car === c.code
                          ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
                          : "border-white/8 bg-white/[0.03] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white">{c.label}</span>
                        {car === c.code && <span className="accent">●</span>}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="btn-accent mt-8 w-full justify-center"
                >
                  Далее →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="reveal">
                <div className="eyebrow">Шаг 2 из 3</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Состав и плёнка
                </h1>
                <p className="mt-3 text-white/60">
                  Что нужно защитить и какой плёнкой.
                </p>

                <div className="mt-8">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Состав работ
                  </div>
                  <div className="mt-3 grid gap-2">
                    {PACKAGES.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => setPkg(p.code)}
                        className={`rounded-2xl border px-5 py-4 text-left transition ${
                          pkg === p.code
                            ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
                            : "border-white/8 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <div className="font-extrabold text-white">{p.label}</div>
                        <div className="mt-1 text-xs text-white/50">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Плёнка
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {FILMS.map((f) => (
                      <button
                        key={f.code}
                        onClick={() => setFilm(f.code)}
                        className={`rounded-2xl border px-5 py-4 text-left transition ${
                          film === f.code
                            ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
                            : "border-white/8 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
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
                  <button onClick={calculate} className="btn-accent flex-1 justify-center">
                    Рассчитать
                  </button>
                </div>
              </div>
            )}

            {step === 3 && result !== null && (
              <div className="reveal">
                <div className="eyebrow">Шаг 3 из 3</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Предварительный расчёт
                </h1>

                <div className="dark-card mt-8 p-8">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] accent">
                    {CARS.find((c) => c.code === car)?.label}
                  </div>
                  <div className="mt-2 text-sm text-white/50">
                    {PACKAGES.find((p) => p.code === pkg)?.label} ·{" "}
                    {FILMS.find((f) => f.code === film)?.label}
                  </div>
                  <div className="mt-6 text-5xl font-extrabold tracking-[-0.04em]">
                    от <span className="accent">{result.toLocaleString("ru-RU")}</span> ₽
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/50">
                    Финальная стоимость подтверждается после проверки фотографий
                    автомобиля. Разница возможна при обнаружении повреждений,
                    перекрасов или старой плёнки.
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setShowForm(true)}
                    className="btn-accent justify-center"
                  >
                    Оставить заявку
                  </button>
                  <button onClick={reset} className="btn-ghost justify-center">
                    Изменить расчёт
                  </button>
                </div>

                <div className="mt-8 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-5 text-sm leading-6 text-lime-100">
                  <strong className="accent">Что дальше:</strong>{" "}
                  <span className="text-white/80">
                    вы оставляете заявку, прикладываете 4 фотографии автомобиля. Мы
                    подтверждаем финальную цену в течение 15 минут и назначаем мастера.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && !sent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="dark-card w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-extrabold tracking-tight">
              Оставить заявку
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Перезвоним в течение 15 минут.
            </p>

            <form onSubmit={submitForm} className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Ваше имя
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Комментарий
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Адрес, удобное время, особенности"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-lime-400"
                />
                <span className="text-xs leading-5 text-white/60">
                  Я согласен на обработку персональных данных и принимаю{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="accent hover:underline"
                  >
                    Политику конфиденциальности
                  </Link>
                </span>
              </label>

              {formError && (
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-ghost"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={sending || !consent}
                  className="btn-accent flex-1 justify-center disabled:opacity-50"
                >
                  {sending ? "Отправляем..." : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}