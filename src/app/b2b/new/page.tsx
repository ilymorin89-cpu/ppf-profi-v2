"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CarSearch from "@/components/CarSearch";
import { CARS_LIST } from "@/shared/cars";

type Partner = {
  id: number;
  name: string;
  slug: string;
};

type Quote = {
  target: number;
  autoApprove: number;
  pricingVersion: string;
};

const SCENARIOS = [
  { code: "FULL", label: "Полная оклейка", desc: "Все основные элементы кузова" },
  { code: "RISK_ZONES", label: "Зоны риска", desc: "Капот, бампер, зеркала, пороги, фары" },
];

const FILMS = [
  { code: "PPF_STANDARD", label: "PPF PROFI Standard", desc: "Надёжная защита" },
  { code: "SPECTROLL_PREMIUM", label: "Spectroll Premium", desc: "Премиальная защита" },
];

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  }
  return Math.random().toString(36).slice(2, 18) + Date.now().toString(36);
}

export default function B2BNewPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [checking, setChecking] = useState(true);

  const [step, setStep] = useState(1);
  const [car, setCar] = useState<string | null>(null);
  const [scenario, setScenario] = useState(SCENARIOS[0].code);
  const [film, setFilm] = useState(FILMS[0].code);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");

  const [clientPrice, setClientPrice] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [submissionKey, setSubmissionKey] = useState(() => newKey());

  const selectedCar = car ? CARS_LIST.find((c) => c.code === car) : undefined;

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.role === "partner" && data.user) {
          setPartner(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const calculate = async () => {
    if (!car) {
      setQuoteError("Выберите автомобиль");
      return;
    }
    setQuoteError("");
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carCode: car, scenario, filmCode: film }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuoteError(data.error || "Не удалось рассчитать");
        return;
      }
      setQuote(data as Quote);
      setClientPrice(0);
      setSubmissionKey(newKey());
      setStep(3);
    } catch {
      setQuoteError("Ошибка сети");
    } finally {
      setQuoteLoading(false);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!partner) return;
    if (!name.trim() || !phone.trim()) {
      setFormError("Заполните имя и телефон клиента");
      return;
    }
    if (!quote || !car) return;
    if (clientPrice <= quote.target) {
      setFormError("Цена клиенту должна быть выше цены PPF PROFI");
      return;
    }
    if (!consent) {
      setFormError("Подтвердите право передачи данных клиента и согласие с политикой");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": submissionKey,
        },
        body: JSON.stringify({
          carCode: car,
          scenario,
          filmCode: film,
          price: quote.target,
          clientPrice,
          clientName: name,
          clientPhone: phone,
          comment,
          consent: true,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setFormError(data.error || "Не удалось отправить заявку");
        return;
      }

      setSent(true);
    } catch {
      setFormError("Ошибка сети. Проверьте соединение.");
    } finally {
      setSending(false);
    }
  };

  const resetAll = () => {
    setSent(false);
    setStep(1);
    setCar(null);
    setQuote(null);
    setClientPrice(0);
    setName("");
    setPhone("");
    setComment("");
    setConsent(false);
    setFormError("");
    setQuoteError("");
    setShowForm(false);
    setSubmissionKey(newKey());
  };

  const spread = quote ? clientPrice - quote.target : 0;

  if (checking) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center text-white">
        <div className="text-sm text-white/50">Проверяем вход...</div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center px-6 text-white">
        <div className="dark-card max-w-md p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-extrabold">Требуется вход</h1>
          <p className="mt-3 text-sm text-white/60">
            Чтобы создать заявку от имени партнёра, войдите в кабинет.
          </p>
          <Link href="/b2b" className="btn-accent mt-6 inline-flex justify-center">
            Войти в кабинет
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Link href="/b2b" className="flex items-center gap-3">
            <div className="text-base font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
          </Link>
          <div className="text-xs font-bold text-white/50">{partner.name}</div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {sent ? (
          <div className="reveal text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-400/15 ring-1 ring-lime-400/40">
              <span className="text-4xl accent">✓</span>
            </div>
            <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Заявка создана
            </h1>
            <p className="mt-4 text-white/60">
              Заявка привязана к вашему аккаунту и передана PPF PROFI.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={resetAll} className="btn-accent justify-center">
                Новая заявка
              </button>
              <Link href="/b2b" className="btn-ghost justify-center">
                В кабинет
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-10 flex items-center gap-2">
              {["Авто", "Состав", "Расчёт"].map((label, i) => {
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
                  Автомобиль клиента
                </h1>
                <p className="mt-3 text-white/60">
                  Введите марку или модель — система найдёт в базе.
                </p>

                <div className="mt-8">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Автомобиль
                  </label>
                  <CarSearch value={car} onChange={setCar} />
                </div>

                {selectedCar && (
                  <div className="mt-4 rounded-xl border border-lime-400/20 bg-lime-400/[0.06] p-4 text-xs">
                    <div className="font-extrabold text-white">
                      {selectedCar.brand} {selectedCar.model}
                    </div>
                    <div className="mt-1 text-white/50">
                      Класс {selectedCar.class} · полная {selectedCar.areaFull} м ·{" "}
                      {selectedCar.daysFull} дн
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(2)}
                  disabled={!car}
                  className="btn-accent mt-8 w-full justify-center disabled:opacity-50"
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
                <div className="mt-8">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    Состав работ
                  </div>
                  <div className="mt-3 grid gap-2">
                    {SCENARIOS.map((s) => (
                      <button
                        key={s.code}
                        onClick={() => setScenario(s.code)}
                        className={`rounded-2xl border px-5 py-4 text-left transition ${
                          scenario === s.code
                            ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
                            : "border-white/8 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        <div className="font-extrabold text-white">{s.label}</div>
                        <div className="mt-1 text-xs text-white/50">{s.desc}</div>
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

                {quoteError && (
                  <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
                    {quoteError}
                  </div>
                )}

                <div className="mt-8 flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-ghost">
                    ← Назад
                  </button>
                  <button
                    onClick={calculate}
                    disabled={quoteLoading}
                    className="btn-accent flex-1 justify-center disabled:opacity-50"
                  >
                    {quoteLoading ? "Считаем..." : "Рассчитать"}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && quote && selectedCar && (
              <div className="reveal">
                <div className="eyebrow">Шаг 3 из 3</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Расчёт для клиента
                </h1>

                <div className="dark-card mt-8 p-8">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] accent">
                    {selectedCar.brand} {selectedCar.model}
                  </div>
                  <div className="mt-2 text-sm text-white/50">
                    {SCENARIOS.find((s) => s.code === scenario)?.label} ·{" "}
                    {FILMS.find((f) => f.code === film)?.label}
                  </div>

                  <div className="mt-6 border-t border-white/8 pt-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                      Цена PPF PROFI для вас
                    </div>
                    <div className="mt-2 text-3xl font-extrabold">
                      {quote.target.toLocaleString("ru-RU")} ₽
                    </div>
                    <p className="mt-1 text-[10px] text-white/40">
                      Версия прайса: {quote.pricingVersion}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-white/8 pt-6">
                    <label className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                      Ваша цена клиенту
                    </label>
                    <input
                      type="number"
                      value={clientPrice || ""}
                      onChange={(e) => setClientPrice(Number(e.target.value) || 0)}
                      step={500}
                      min={quote.target + 500}
                      placeholder="Введите цену для клиента"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-extrabold text-white focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                    />
                    <p className="mt-2 text-xs text-white/40">
                      Должна быть выше цены PPF PROFI. Разница — ваш спред.
                    </p>
                  </div>

                  <div className="mt-6 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
                      Ваш валовый спред
                    </div>
                    <div className="mt-2 text-3xl font-extrabold accent">
                      {spread > 0 ? spread.toLocaleString("ru-RU") : 0} ₽
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setShowForm(true)}
                    disabled={clientPrice <= quote.target}
                    className="btn-accent justify-center disabled:opacity-50"
                  >
                    Создать заявку
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="btn-ghost justify-center"
                  >
                    Изменить расчёт
                  </button>
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
              Данные клиента
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Контакты будут переданы в PPF PROFI.
            </p>

            <form onSubmit={submitForm} className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Имя клиента
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
                  Телефон клиента
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
                  Подтверждаю, что имею право передать контактные данные клиента
                  для подготовки и исполнения предложения, и принимаю{" "}
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