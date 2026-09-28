"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Partner = {
  id: number;
  name: string;
  slug: string;
};

const CARS = [
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

export default function B2BNewPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [step, setStep] = useState(1);
  const [car, setCar] = useState(CARS[0].code);
  const [pkg, setPkg] = useState(PACKAGES[0].code);
  const [film, setFilm] = useState(FILMS[0].code);
  const [partnerPrice, setPartnerPrice] = useState<number | null>(null);
  const [retailLow, setRetailLow] = useState<number | null>(null);
  const [retailHigh, setRetailHigh] = useState<number | null>(null);
  const [clientPrice, setClientPrice] = useState<number>(0);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ppf_partner");
    if (saved) {
      try {
        setPartner(JSON.parse(saved));
      } catch {
        localStorage.removeItem("ppf_partner");
      }
    }
    setLoaded(true);
  }, []);

  const calculate = () => {
    const base = 50000;
    const carMul = car === "BMW_X5_G05" ? 1.1 : car === "BMW_X7_G07" ? 1.3 : 1;
    const pkgMul = pkg === "FULL" ? 2.4 : pkg === "RISK_ZONES" ? 0.9 : 1;
    const filmMul = film === "SPECTROLL_PREMIUM" ? 1.15 : 1;
    const pp = Math.round((base * carMul * pkgMul * filmMul) / 500) * 500;
    const low = Math.round((pp / 0.85) / 500) * 500;
    const high = Math.round((pp / 0.8) / 500) * 500;
    setPartnerPrice(pp);
    setRetailLow(low);
    setRetailHigh(high);
    setClientPrice(low);
    setStep(3);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    if (!name.trim() || !phone.trim()) return;
    if (partnerPrice === null) return;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carCode: car,
          scenario: pkg,
          filmCode: film,
          price: partnerPrice,
          clientName: name,
          clientPhone: phone,
          comment,
          partnerId: partner.id,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error || "Не удалось отправить заявку");
        return;
      }

      setSent(true);
    } catch {
      alert("Ошибка сети. Проверьте соединение.");
    }
  };

  if (!loaded) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center text-white">
        Загрузка...
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center px-6 text-white">
        <div className="premium-panel max-w-md p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-extrabold">Требуется вход</h1>
          <p className="mt-3 text-sm text-slate-400">
            Чтобы создать заявку от имени партнёра, войдите в кабинет.
          </p>
          <Link
            href="/b2b"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-extrabold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
          >
            Войти в кабинет
          </Link>
        </div>
      </div>
    );
  }

  const spread = partnerPrice !== null ? clientPrice - partnerPrice : 0;

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="border-b border-white/10 bg-[#061426]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-6">
          <Link href="/b2b" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-base font-black italic">
              P
            </div>
            <span className="text-sm font-extrabold tracking-[0.13em]">PPF PROFI</span>
          </Link>
          <div className="text-xs font-bold text-slate-400">{partner.name}</div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {sent ? (
          <div className="reveal text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Заявка создана
            </h1>
            <p className="mt-4 text-slate-400">
              Заявка привязана к вашему аккаунту и передана PPF PROFI.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => {
                  setSent(false);
                  setStep(1);
                  setPartnerPrice(null);
                  setRetailLow(null);
                  setRetailHigh(null);
                  setClientPrice(0);
                  setName("");
                  setPhone("");
                  setComment("");
                }}
                className="rounded-xl bg-blue-600 px-6 py-3 font-extrabold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
              >
                Новая заявка
              </button>
              <Link
                href="/b2b"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
              >
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
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {done ? "✓" : n}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        active ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                    {i < 2 && (
                      <div
                        className={`h-px flex-1 ${
                          done ? "bg-emerald-400" : "bg-white/10"
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
                <div className="mt-8 grid gap-2">
                  {CARS.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => setCar(c.code)}
                      className={`rounded-2xl border px-5 py-4 text-left transition ${
                        car === c.code
                          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                          : "border-white/10 bg-white/[0.04] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white">{c.label}</span>
                        {car === c.code && <span className="text-blue-400">●</span>}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="mt-8 w-full rounded-xl bg-blue-600 px-6 py-4 font-extrabold shadow-xl shadow-blue-600/25 transition hover:bg-blue-500"
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
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    Состав работ
                  </div>
                  <div className="mt-3 grid gap-2">
                    {PACKAGES.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => setPkg(p.code)}
                        className={`rounded-2xl border px-5 py-4 text-left transition ${
                          pkg === p.code
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        }`}
                      >
                        <div className="font-extrabold text-white">{p.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-8">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    Плёнка
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {FILMS.map((f) => (
                      <button
                        key={f.code}
                        onClick={() => setFilm(f.code)}
                        className={`rounded-2xl border px-5 py-4 text-left transition ${
                          film === f.code
                            ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        }`}
                      >
                        <div className="font-extrabold text-white">{f.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
                  >
                    ← Назад
                  </button>
                  <button
                    onClick={calculate}
                    className="flex-1 rounded-xl bg-blue-600 px-6 py-4 font-extrabold shadow-xl shadow-blue-600/25 transition hover:bg-blue-500"
                  >
                    Рассчитать
                  </button>
                </div>
              </div>
            )}

            {step === 3 && partnerPrice !== null && (
              <div className="reveal">
                <div className="eyebrow">Шаг 3 из 3</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Расчёт для клиента
                </h1>

                <div className="premium-panel mt-8 p-8">
                  <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-300">
                    {CARS.find((c) => c.code === car)?.label}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {PACKAGES.find((p) => p.code === pkg)?.label} ·{" "}
                    {FILMS.find((f) => f.code === film)?.label}
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-6">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Цена PPF PROFI для вас
                    </div>
                    <div className="mt-2 text-3xl font-extrabold">
                      {partnerPrice.toLocaleString("ru-RU")} ₽
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-6">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Рекомендованная розница
                    </div>
                    <div className="mt-2 text-lg font-bold text-blue-300">
                      {retailLow?.toLocaleString("ru-RU")} –{" "}
                      {retailHigh?.toLocaleString("ru-RU")} ₽
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Вы сами решаете, за сколько продавать клиенту.
                    </p>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-6">
                    <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Ваша цена клиенту
                    </label>
                    <input
                      type="number"
                      value={clientPrice || ""}
                      onChange={(e) => setClientPrice(Number(e.target.value) || 0)}
                      step={500}
                      min={partnerPrice}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-2xl font-extrabold text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="mt-6 rounded-xl bg-emerald-500/10 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
                      Ваш спред
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-emerald-300">
                      {spread > 0 ? spread.toLocaleString("ru-RU") : 0} ₽
                    </div>
                    <p className="mt-2 text-xs text-emerald-200/70">
                      Разница между ценой клиенту и ценой PPF PROFI.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setShowForm(true)}
                    disabled={clientPrice <= partnerPrice}
                    className="rounded-xl bg-blue-600 px-6 py-4 font-extrabold shadow-xl shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    Создать заявку
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="premium-panel w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-extrabold tracking-tight">
              Данные клиента
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Контакты клиента будут переданы в PPF PROFI.
            </p>

            <form onSubmit={submitForm} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Имя клиента
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Телефон клиента
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Комментарий
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Адрес, удобное время, особенности"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 px-5 py-3 font-extrabold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                >
                  Отправить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}