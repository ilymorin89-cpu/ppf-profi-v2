"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Master = {
  id: number;
  name: string;
  slug: string;
};

type Order = {
  id: number;
  publicNumber: string;
  carCode: string;
  scenario: string;
  filmCode: string;
  price: number;
  clientName: string;
  clientPhone: string;
  comment: string | null;
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

export default function MasterPage() {
  const [slug, setSlug] = useState("ilya");
  const [pin, setPin] = useState("");
  const [master, setMaster] = useState<Master | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ppf_master");
    if (saved) {
      try {
        setMaster(JSON.parse(saved));
      } catch {
        localStorage.removeItem("ppf_master");
      }
    }
  }, []);

  useEffect(() => {
    if (!master) return;
    setOrdersLoading(true);
    fetch(`/api/orders?master_id=${master.id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [master]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/masters/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }

      localStorage.setItem("ppf_master", JSON.stringify(data.master));
      setMaster(data.master);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (orderId: number) => {
    if (!confirm("Отметить работу как выполненную?")) return;
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "COMPLETED" } : o))
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("ppf_master");
    setMaster(null);
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
          <div className="text-xs font-bold text-slate-400">Кабинет мастера</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {!master ? (
          <div className="reveal mx-auto max-w-2xl">
            <div className="eyebrow">Вход для мастеров</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Кабинет мастера
            </h1>
            <p className="mt-3 text-slate-400">Введите свой slug и PIN-код.</p>

            <form onSubmit={handleLogin} className="premium-panel mt-8 p-8">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Slug мастера
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ilya"
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
                    <span className="font-mono text-blue-300">ilya</span> · PIN{" "}
                    <span className="font-mono text-blue-300">111111</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-mono text-blue-300">andrey</span> · PIN{" "}
                    <span className="font-mono text-blue-300">222222</span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div className="reveal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">Мастер</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {master.name}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  slug: <span className="font-mono">{master.slug}</span>
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Выйти
              </button>
            </div>

            <div className="premium-panel mt-8 flex items-center justify-between p-6">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-300">
                  Моих работ
                </div>
                <div className="mt-2 text-5xl font-extrabold tracking-[-0.04em]">
                  {orders.length}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
                  Общая стоимость
                </div>
                <div className="mt-2 text-2xl font-extrabold text-blue-400">
                  {orders.reduce((sum, o) => sum + (o.price || 0), 0).toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="mb-4 text-xl font-extrabold">Назначенные работы</h2>

              {ordersLoading && (
                <div className="premium-panel p-8 text-center text-slate-400">
                  Загружаем...
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
                  <div className="text-4xl">🔧</div>
                  <div className="mt-4 font-extrabold text-white">Работ пока нет</div>
                  <p className="mt-2 text-sm text-slate-400">
                    Как только администратор назначит вас на заявку — она появится здесь.
                  </p>
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
                          {o.comment && (
                            <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">
                              {o.comment}
                            </div>
                          )}
                        </div>
                        <div className="w-40 shrink-0 text-right">
                          <div className="text-2xl font-extrabold text-white">
                            {o.price.toLocaleString("ru-RU")} ₽
                          </div>
                          {o.status !== "COMPLETED" ? (
                            <button
                              onClick={() => markCompleted(o.id)}
                              className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-500"
                            >
                              ✓ Выполнено
                            </button>
                          ) : (
                            <div className="mt-3 w-full rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-300">
                              Завершено
                            </div>
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