"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Partner = {
  id: number;
  name: string;
  slug: string;
};

type Order = {
  id: number;
  publicNumber: string;
  clientName: string;
  clientPhone: string;
  carCode: string;
  scenario: string;
  filmCode: string;
  price: number;
  clientPrice: number | null;
  status: string;
  createdAt: string;
};

const CAR_LABELS: Record<string, string> = {
  BMW_X5_G05: "BMW X5 G05",
  BMW_X7_G07: "BMW X7 G07",
  MB_GLE_V167: "Mercedes-Benz GLE V167",
  PORSCHE_CAYENNE_E3: "Porsche Cayenne E3",
  TOYOTA_LC300: "Toyota Land Cruiser 300",
};

const PKG_LABELS: Record<string, string> = {
  FRONT: "Передняя часть",
  RISK_ZONES: "Зоны риска",
  FULL: "Полная оклейка",
};

const FILM_LABELS: Record<string, string> = {
  PPF_STANDARD: "PPF PROFI Standard",
  SPECTROLL_PREMIUM: "Spectroll Premium",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  NEEDS_CHECK: "На проверке",
  QUOTED: "Расчёт готов",
  APPROVED: "Подтверждена",
  COMPLETED: "Выполнена",
};

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-sky-400/15 text-sky-200",
  NEEDS_CHECK: "bg-amber-400/15 text-amber-200",
  QUOTED: "bg-violet-400/15 text-violet-200",
  APPROVED: "bg-lime-400/15 text-lime-200",
  COMPLETED: "bg-white/10 text-white/60",
};

const IS_DEV = process.env.NODE_ENV !== "production";

const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`;

export default function B2BPage() {
  const [slug, setSlug] = useState(IS_DEV ? "detailing-moscow" : "");
  const [pin, setPin] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ppf_partner");
    if (saved) {
      try {
        setPartner(JSON.parse(saved));
      } catch {
        localStorage.removeItem("ppf_partner");
      }
    }
  }, []);

  useEffect(() => {
    if (!partner) return;
    setOrdersLoading(true);
    fetch(`/api/orders?partner_id=${partner.id}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("ppf_partner");
          setPartner(null);
          setOrders([]);
          setError("Сессия истекла. Войдите снова.");
          return;
        }
        const data = await res.json();
        setOrders(data.orders || []);
      })
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [partner]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/partners/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }

      localStorage.setItem("ppf_partner", JSON.stringify(data.partner));
      setPartner(data.partner);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // выход всё равно выполняем локально
    }
    localStorage.removeItem("ppf_partner");
    setPartner(null);
    setPin("");
    setOrders([]);
    setError("");
  };

  // Текст для клиента: только его цена, без партнёрской цены и спреда.
  const copyOffer = async (o: Order) => {
    if (o.clientPrice == null) return;
    const text =
      `${CAR_LABELS[o.carCode] || o.carCode}\n` +
      `${PKG_LABELS[o.scenario] || o.scenario} · ${FILM_LABELS[o.filmCode] || o.filmCode}\n` +
      `Стоимость: ${rub(o.clientPrice)} (предварительно)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(o.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // буфер обмена недоступен, ничего не делаем
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const withPrice = orders.filter((o) => o.clientPrice != null);
  const totalSpread = withPrice.reduce(
    (sum, o) => sum + ((o.clientPrice as number) - (o.price || 0)),
    0
  );

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-xl font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
          </Link>
          <div className="text-xs font-bold text-white/50">Кабинет партнёра</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {!partner ? (
          <div className="reveal mx-auto max-w-2xl">
            <div className="eyebrow">Вход для партнёров</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Кабинет партнёра
            </h1>
            <p className="mt-3 text-white/60">Введите свой slug и PIN-код.</p>

            <form onSubmit={handleLogin} className="dark-card mt-8 p-8">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Slug партнёра
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="detailing-moscow"
                  autoComplete="username"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              <div className="mt-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  PIN-код
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  placeholder="••••••"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-extrabold tracking-[0.5em] text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="btn-accent mt-6 w-full justify-center disabled:opacity-50"
              >
                {loading ? "Проверяем..." : "Войти"}
              </button>

              <p className="mt-5 text-center text-xs text-white/40">
                Нет доступа?{" "}
                <a
                  href="https://t.me/partner_detiling"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-white/70 hover:text-white"
                >
                  Напишите нам в Telegram
                </a>
              </p>

              {IS_DEV && (
                <div className="mt-6 rounded-xl bg-white/5 p-4 text-xs leading-5 text-white/50">
                  <div className="font-bold text-white/70">
                    Тестовые доступы (только в режиме разработки):
                  </div>
                  <div className="mt-2">
                    <div>
                      <span className="font-mono accent">detailing-moscow</span> · PIN{" "}
                      <span className="font-mono accent">123456</span>
                    </div>
                    <div className="mt-1">
                      <span className="font-mono accent">auto-plus</span> · PIN{" "}
                      <span className="font-mono accent">654321</span>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="reveal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Партнёр</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {partner.name}
                </h1>
                <p className="mt-2 text-sm text-white/50">
                  slug: <span className="font-mono">{partner.slug}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/b2b/new" className="btn-accent text-sm">
                  + Новый расчёт
                </Link>
                <button onClick={handleLogout} className="btn-ghost text-sm">
                  Выйти
                </button>
              </div>
            </div>

            <div className="dark-card mt-8 flex items-center justify-between p-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
                  Моих заявок
                </div>
                <div className="mt-2 text-5xl font-extrabold tracking-[-0.04em]">
                  {orders.length}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Ваш спред по заявкам
                </div>
                <div className="mt-2 text-2xl font-extrabold accent">
                  {withPrice.length ? rub(totalSpread) : "—"}
                </div>
                <div className="mt-1 text-[11px] text-white/40">
                  предварительно, по заявкам с ценой клиенту
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">Мои заявки</h2>
              </div>

              {ordersLoading && (
                <div className="dark-card p-8 text-center text-white/50">
                  Загружаем...
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
                  <div className="text-4xl">📭</div>
                  <div className="mt-4 font-extrabold text-white">Заявок пока нет</div>
                  <p className="mt-2 text-sm text-white/50">
                    Создайте первую заявку для клиента.
                  </p>
                  <Link href="/b2b/new" className="btn-accent mt-6 inline-flex">
                    Создать заявку
                  </Link>
                </div>
              )}

              {!ordersLoading && orders.length > 0 && (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="dark-card p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-extrabold accent">
                              {o.publicNumber}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                                STATUS_STYLES[o.status] || "bg-white/10 text-white/60"
                              }`}
                            >
                              {STATUS_LABELS[o.status] || o.status}
                            </span>
                            <span className="text-xs text-white/40">
                              {formatDate(o.createdAt)}
                            </span>
                          </div>
                          <div className="mt-3 text-lg font-extrabold text-white">
                            {o.clientName} · {o.clientPhone}
                          </div>
                          <div className="mt-2 text-sm text-white/50">
                            {CAR_LABELS[o.carCode] || o.carCode} ·{" "}
                            {PKG_LABELS[o.scenario] || o.scenario} ·{" "}
                            {FILM_LABELS[o.filmCode] || o.filmCode}
                          </div>

                          {o.clientPrice != null && (
                            <button
                              type="button"
                              onClick={() => copyOffer(o)}
                              className="mt-4 rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/60 transition hover:border-lime-400 hover:text-white"
                            >
                              {copiedId === o.id
                                ? "Скопировано ✓"
                                : "Скопировать предложение клиенту"}
                            </button>
                          )}
                        </div>

                        <div className="text-right">
                          {o.clientPrice != null ? (
                            <>
                              <div className="text-2xl font-extrabold text-white">
                                {rub(o.clientPrice)}
                              </div>
                              <div className="mt-1 text-xs text-white/40">цена клиенту</div>
                              <div className="mt-2 text-sm font-extrabold accent">
                                спред {rub(o.clientPrice - o.price)}
                              </div>
                              <div className="mt-1 text-[11px] text-white/40">
                                цена PPF PROFI: от {rub(o.price)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-extrabold text-white">
                                {rub(o.price)}
                              </div>
                              <div className="mt-1 text-xs text-white/40">
                                цена PPF PROFI, предварительно
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}