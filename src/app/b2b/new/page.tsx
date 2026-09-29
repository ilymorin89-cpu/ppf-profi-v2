"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

// ВРЕМЕННО: расчёт на клиенте. Формулы видны в браузере любому посетителю.
// Нужно заменить на серверный расчёт (запрос к API, цены из pricing CSV).
function quote(car: string, pkg: string, film: string) {
  const base = 50000;
  const carMul = car === "BMW_X5_G05" ? 1.1 : car === "BMW_X7_G07" ? 1.3 : 1;
  const pkgMul = pkg === "FULL" ? 2.4 : pkg === "RISK_ZONES" ? 0.9 : 1;
  const filmMul = film === "SPECTROLL_PREMIUM" ? 1.15 : 1;
  const pp = Math.round((base * carMul * pkgMul * filmMul) / 500) * 500;
  const low = Math.round(pp / 0.85 / 500) * 500;
  const high = Math.round(pp / 0.8 / 500) * 500;
  return { pp, low, high };
}

type Summary = {
  car: string;
  pkg: string;
  film: string;
  clientPrice: number;
  spread: number;
};

const optionClass = (active: boolean) =>
  `rounded-2xl border px-5 py-4 text-left transition ${
    active
      ? "border-lime-400 bg-lime-400/10 ring-1 ring-lime-400"
      : "border-white/8 bg-white/[0.03] hover:border-white/20"
  }`;

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-sm font-extrabold uppercase tracking-[0.14em]">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-lime-400 text-[11px] text-black">
        {n}
      </span>
      {children}
    </h2>
  );
}

export default function B2BNewPage() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [car, setCar] = useState(CARS[0].code);
  const [pkg, setPkg] = useState(PACKAGES[0].code);
  const [film, setFilm] = useState(FILMS[0].code);
  const [customPrice, setCustomPrice] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Ключ идемпотентности привязан к содержимому заявки: повторный клик
  // с теми же данными не создаёт дубль, изменённые данные получают новый ключ.
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

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

  const q = useMemo(() => quote(car, pkg, film), [car, pkg, film]);
  const clientPrice = customPrice ?? q.low;
  const spread = clientPrice - q.pp;
  const belowCost = clientPrice <= q.pp;
  const spreadPct = clientPrice > 0 ? Math.round((spread / clientPrice) * 100) : 0;

  const carLabel = CARS.find((c) => c.code === car)?.label ?? "";
  const pkgLabel = PACKAGES.find((p) => p.code === pkg)?.label ?? "";
  const filmLabel = FILMS.find((f) => f.code === film)?.label ?? "";

  // При смене авто/состава/плёнки цена клиенту возвращается к рекомендованной.
  const pick = (fn: () => void) => {
    fn();
    setCustomPrice(null);
  };

  const adjust = (delta: number) => setCustomPrice(Math.max(0, clientPrice + delta));

  const resetAll = () => {
    keyRef.current = null;
    setSent(false);
    setSummary(null);
    setShowForm(false);
    setCustomPrice(null);
    setName("");
    setPhone("");
    setComment("");
    setFormError(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !partner) return;
    setFormError(null);

    if (!name.trim()) {
      setFormError("Укажите имя клиента");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setFormError("Проверьте номер телефона клиента");
      return;
    }
    if (belowCost) {
      setFormError("Цена клиенту должна быть выше вашей цены PPF PROFI");
      return;
    }

    const payload = {
      carCode: car,
      scenario: pkg,
      filmCode: film,
      price: q.pp,
      clientPrice,
      clientName: name,
      clientPhone: phone,
      comment,
      partnerId: partner.id,
    };
    const sig = JSON.stringify(payload);
    if (!keyRef.current || keyRef.current.sig !== sig) {
      keyRef.current = { sig, key: crypto.randomUUID() };
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": keyRef.current.key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setFormError(err.error || "Не удалось отправить заявку");
        return;
      }

      setSummary({ car: carLabel, pkg: pkgLabel, film: filmLabel, clientPrice, spread });
      setShowForm(false);
      setSent(true);
    } catch {
      setFormError("Ошибка сети. Проверьте соединение и попробуйте снова.");
    } finally {
      setSubmitting(false);
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
          <div className="flex items-center gap-4">
            <div className="text-xs font-bold text-white/50">{partner.name}</div>
            <Link
              href="/b2b"
              className="text-xs font-bold text-white/50 transition hover:text-white"
            >
              ← Кабинет
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 pt-10 pb-32">
        {sent && summary ? (
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

            <div className="dark-card mx-auto mt-8 max-w-md p-6 text-left">
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] accent">
                {summary.car}
              </div>
              <div className="mt-1 text-sm text-white/50">
                {summary.pkg} · {summary.film}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-sm">
                <span className="text-white/50">Цена клиенту</span>
                <span className="font-extrabold">{rub(summary.clientPrice)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-white/50">Ваш валовый спред</span>
                <span className="font-extrabold accent">{rub(summary.spread)}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={resetAll} className="btn-accent justify-center">
                Новая заявка
              </button>
              <Link href="/b2b" className="btn-ghost justify-center">
                В кабинет
              </Link>
            </div>
          </div>
        ) : (
          <div className="reveal">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Расчёт для клиента
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Выберите авто и состав работ, цена обновляется сразу.
            </p>

            {/* 1. Автомобиль */}
            <div className="mt-8">
              <SectionTitle n={1}>Автомобиль</SectionTitle>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CARS.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => pick(() => setCar(c.code))}
                    className={optionClass(car === c.code)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white">{c.label}</span>
                      {car === c.code && <span className="accent">●</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Что клеим */}
            <div className="mt-8">
              <SectionTitle n={2}>Что клеим</SectionTitle>
              <div className="mt-3 grid gap-2">
                {PACKAGES.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => pick(() => setPkg(p.code))}
                    className={optionClass(pkg === p.code)}
                  >
                    <div className="font-extrabold text-white">{p.label}</div>
                    <div className="mt-1 text-xs text-white/50">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Плёнка */}
            <div className="mt-8">
              <SectionTitle n={3}>Плёнка</SectionTitle>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {FILMS.map((f) => (
                  <button
                    key={f.code}
                    type="button"
                    onClick={() => pick(() => setFilm(f.code))}
                    className={optionClass(film === f.code)}
                  >
                    <div className="font-extrabold text-white">{f.label}</div>
                    <div className="mt-1 text-xs text-white/50">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Ваш расчёт */}
            <div className="mt-8">
              <SectionTitle n={4}>Ваш расчёт</SectionTitle>
              <div className="dark-card mt-3 p-6">
                <div className="text-xs font-extrabold uppercase tracking-[0.14em] accent">
                  {carLabel}
                </div>
                <div className="mt-1 text-sm text-white/50">
                  {pkgLabel} · {filmLabel}
                </div>

                <div className="mt-5 grid gap-4 border-t border-white/8 pt-5 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                      Цена PPF PROFI для вас
                    </div>
                    <div className="mt-2 text-2xl font-extrabold">от {rub(q.pp)}</div>
                    <p className="mt-1 text-xs text-white/40">
                      Предварительно. Итог подтверждает PPF PROFI.
                    </p>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                      Рекомендованная розница
                    </div>
                    <div className="mt-2 text-2xl font-extrabold accent">
                      {q.low.toLocaleString("ru-RU")} – {rub(q.high)}
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                      Итоговую цену выбираете вы.
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-white/8 pt-5">
                  <label
                    htmlFor="client-price"
                    className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40"
                  >
                    Ваша цена клиенту
                  </label>
                  <div className="mt-2 flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => adjust(-1000)}
                      className="btn-ghost px-4"
                      aria-label="Уменьшить на 1000"
                    >
                      −
                    </button>
                    <div className="relative flex-1">
                      <input
                        id="client-price"
                        type="text"
                        inputMode="numeric"
                        value={clientPrice ? String(clientPrice) : ""}
                        onChange={(e) =>
                          setCustomPrice(Number(e.target.value.replace(/\D/g, "")) || 0)
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-2xl font-extrabold text-white focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                        ₽
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjust(1000)}
                      className="btn-ghost px-4"
                      aria-label="Увеличить на 1000"
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCustomPrice(q.low)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/60 transition hover:border-lime-400 hover:text-white"
                    >
                      Мин. розница {rub(q.low)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPrice(q.high)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/60 transition hover:border-lime-400 hover:text-white"
                    >
                      Макс. розница {rub(q.high)}
                    </button>
                  </div>

                  {belowCost ? (
                    <p className="mt-3 text-xs font-bold text-red-400">
                      Цена клиенту должна быть выше вашей цены PPF PROFI (от {rub(q.pp)}).
                    </p>
                  ) : clientPrice < q.low ? (
                    <p className="mt-3 text-xs text-white/50">
                      Ниже рекомендованной розницы, спред будет меньше.
                    </p>
                  ) : clientPrice > q.high ? (
                    <p className="mt-3 text-xs text-white/50">
                      Выше рекомендованной розницы.
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
                    Ваш валовый спред · предварительно
                  </div>
                  <div className="mt-2 flex items-baseline gap-3">
                    <div className="text-3xl font-extrabold accent">
                      {rub(spread > 0 ? spread : 0)}
                    </div>
                    {spread > 0 && (
                      <div className="text-sm font-bold text-lime-100/70">
                        {spreadPct}% от цены клиенту
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-lime-100/70">
                    Разница между ценой клиенту и ценой PPF PROFI.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Липкая панель: цена и главная кнопка всегда под рукой */}
      {!sent && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-black/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center gap-4 px-6 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                Ваша цена PPF PROFI · предварительно
              </div>
              <div className="text-xl font-extrabold">от {rub(q.pp)}</div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                Спред
              </div>
              <div className="text-xl font-extrabold accent">
                {rub(spread > 0 ? spread : 0)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowForm(true);
              }}
              disabled={belowCost}
              className="btn-accent justify-center disabled:opacity-50"
            >
              Создать заявку
            </button>
          </div>
        </div>
      )}

      {showForm && !sent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setShowForm(false)}
        >
          <div
            className="dark-card w-full max-w-md p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-extrabold tracking-tight">Данные клиента</h2>
            <p className="mt-2 text-sm text-white/50">
              {carLabel} · {pkgLabel} · {rub(clientPrice)}
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
                  autoFocus
                  autoComplete="off"
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
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 999 123-45-67"
                  autoComplete="off"
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

              {formError && (
                <p className="text-sm font-bold text-red-400">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="btn-ghost disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-accent flex-1 justify-center disabled:opacity-50"
                >
                  {submitting ? "Отправка..." : "Отправить заявку"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}