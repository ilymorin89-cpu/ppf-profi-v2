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

export default function B2BPage() {
  const [slug, setSlug] = useState("detailing-moscow");
  const [pin, setPin] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

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
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
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

  const handleLogout = () => {
    localStorage.removeItem("ppf_partner");
    setPartner(null);
    setPin("");
    setOrders([]);
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

  const totalSpread = orders.reduce((sum, o) => sum + (o.price || 0), 0);

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="border-b border-white/10 bg-[#061426]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-base font-black italic">
              P
            </div>
            <span className="text-sm font-extrabold tracking-[0.13em]">PPF PROFI</span>
          </Link>
          <div className="text-xs font-bold text-slate-400">Кабинет партнёра</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {!partner ? (
          <div className="reveal mx-auto max-w-2xl">
            <div className="eyebrow">Вход для партнёров</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Кабинет партнёра
            </h1>
            <p className="mt-3 text-slate-400">Введите свой slug и PIN-код.</p>

            <form onSubmit={handleLogin} className="premium-panel mt-8 p-8">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Slug партнёра
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="detailing-moscow"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="mt-5">
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  PIN-код
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  placeholder="••••••"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-2xl font-extrabold tracking-[0.5em] text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 font-extrabold shadow-xl shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Проверяем..." : "Войти"}
              </button>

              <div className="mt-6 rounded-xl bg-white/5 p-4 text-xs leading-5 text-slate-400">
                <div className="font-bold text-slate-300">Тестовые доступы:</div>
                <div className="mt-2">
                  <div>
                    <span className="font-mono text-blue-300">detailing-moscow</span> · PIN{" "}
                    <span className="font-mono text-blue-300">123456</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-mono text-blue-300">auto-plus</span> · PIN{" "}
                    <span className="font-mono text-blue-300">654321</span>
                  </div>
                </div>
              </div>
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
                <p className="mt-2 text-sm text-slate-400">
                  slug: <span className="font-mono">{partner.slug}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/b2b/new"
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                >
                  + Новый расчёт
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Выйти
                </button>
              </div>
            </div>

            <div className="premium-panel mt-8 flex items-center justify-between p-6">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-300">
                  Моих заявок
                </div>
                <div className="mt-2 text-5xl font-extrabold tracking-[-0.04em]">
                  {orders.length}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Общая сумма
                </div>
                <div className="mt-2 text-2xl font-extrabold text-blue-400">
                  {totalSpread.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-extrabold">Мои заявки</h2>
              </div>

              {ordersLoading && (
                <div className="premium-panel p-8 text-center text-slate-400">
                  Загружаем...
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
                  <div className="text-4xl">📭</div>
                  <div className="mt-4 font-extrabold text-white">Заявок пока нет</div>
                  <p className="mt-2 text-sm text-slate-400">
                    Создайте первую заявку для клиента.
                  </p>
                  <Link
                    href="/b2b/new"
                    className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-extrabold shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                  >
                    Создать заявку
                  </Link>
                </div>
              )}

              {!ordersLoading && orders.length > 0 && (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="premium-panel p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-extrabold text-blue-300">
                              {o.publicNumber}
                            </span>
                            <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-200">
                              {STATUS_LABELS[o.status] || o.status}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(o.createdAt)}
                            </span>
                          </div>
                          <div className="mt-3 text-lg font-extrabold text-white">
                            {o.clientName} · {o.clientPhone}
                          </div>
                          <div className="mt-2 text-sm text-slate-400">
                            {CAR_LABELS[o.carCode] || o.carCode} ·{" "}
                            {PKG_LABELS[o.scenario] || o.scenario} ·{" "}
                            {FILM_LABELS[o.filmCode] || o.filmCode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-extrabold text-white">
                            {o.price.toLocaleString("ru-RU")} ₽
                          </div>
                          <div className="mt-1 text-xs text-slate-500">предварительно</div>
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