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
  const [checking, setChecking] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Проверка: вошёл ли мастер
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.role === "master" && data.user) {
          setMaster(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Загрузка работ мастера
  useEffect(() => {
    if (!master) return;
    setOrdersLoading(true);
    fetch("/api/orders", { cache: "no-store" })
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

      setMaster(data.master);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const markCompleted = async (orderId: number) => {
    if (!confirm("Отметить работу как выполненную?")) return;
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (!res.ok) {
      alert("Не удалось обновить статус");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "COMPLETED" } : o))
    );
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
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

  if (checking) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center text-white">
        <div className="text-sm text-white/50">Проверяем вход...</div>
      </div>
    );
  }

  return (
    <div className="dark-grid min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="text-xl font-extrabold tracking-[0.12em]">
              PPF <span className="accent">PROFI</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-white/50">Кабинет мастера</span>
            {master && (
              <button
                onClick={handleLogout}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Выйти
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        {!master ? (
          <div className="reveal mx-auto max-w-2xl">
            <div className="eyebrow">Вход для мастеров</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Кабинет мастера
            </h1>
            <p className="mt-3 text-white/60">Введите свой slug и PIN-код.</p>

            <form onSubmit={handleLogin} className="dark-card mt-8 p-8">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                  Slug мастера
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ilya"
                  required
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                />
              </div>

              <div className="mt-5">
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
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
                <p className="mt-2 text-sm text-white/50">
                  slug: <span className="font-mono">{master.slug}</span>
                </p>
              </div>
            </div>

            <div className="dark-card mt-8 flex items-center justify-between p-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
                  Моих работ
                </div>
                <div className="mt-2 text-5xl font-extrabold tracking-[-0.04em]">
                  {orders.length}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Общая стоимость
                </div>
                <div className="mt-2 text-2xl font-extrabold accent">
                  {orders
                    .reduce((sum, o) => sum + (o.price || 0), 0)
                    .toLocaleString("ru-RU")}{" "}
                  ₽
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="mb-4 text-xl font-extrabold">Назначенные работы</h2>

              {ordersLoading && (
                <div className="dark-card p-8 text-center text-white/50">
                  Загружаем...
                </div>
              )}

              {!ordersLoading && orders.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
                  <div className="text-4xl">🔧</div>
                  <div className="mt-4 font-extrabold text-white">
                    Работ пока нет
                  </div>
                  <p className="mt-2 text-sm text-white/50">
                    Как только администратор назначит вас на заявку — она появится здесь.
                  </p>
                </div>
              )}

              {!ordersLoading && orders.length > 0 && (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="dark-card p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-extrabold accent">
                              {o.publicNumber}
                            </span>
                            <span className="rounded-full bg-lime-400/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-lime-200">
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
                          {o.comment && (
                            <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">
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
                              className="mt-3 w-full rounded-lg bg-lime-400 px-3 py-2 text-xs font-extrabold text-black transition hover:bg-lime-300"
                            >
                              ✓ Выполнено
                            </button>
                          ) : (
                            <div className="mt-3 w-full rounded-lg bg-lime-400/15 px-3 py-2 text-xs font-extrabold text-lime-300">
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