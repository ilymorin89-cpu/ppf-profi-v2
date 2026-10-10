"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { filmLabel } from "@/content/site";

type Order = {
  id: number;
  publicNumber: string;
  carCode: string;
  scenario: string;
  filmCode: string;
  price: number;
  clientPrice: number | null;
  clientName: string;
  clientPhone: string;
  comment: string | null;
  status: string;
  createdAt: string;
  partnerId: number | null;
  partnerName: string | null;
  partnerSlug: string | null;
  masterId: number | null;
};

type Master = { id: number; name: string; slug: string };

const CAR_LABELS: Record<string, string> = {
  BMW_X5_G05: "BMW X5 G05",
  BMW_X7_G07: "BMW X7 G07",
  MB_GLE_V167: "Mercedes-Benz GLE V167",
  PORSCHE_CAYENNE_E3: "Porsche Cayenne E3",
  TOYOTA_LC300: "Toyota Land Cruiser 300",
};

const PKG_LABELS: Record<string, string> = {
  RISK_ZONES: "Зоны риска",
  FULL: "Полная оклейка",
};


const STATUS_LABELS: Record<string, string> = {
  NEW: "Новая",
  NEEDS_CHECK: "На проверке",
  QUOTED: "Расчёт готов",
  APPROVED: "Подтверждена",
  COMPLETED: "Выполнена",
};

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setAuthorized(false);
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
      setAuthorized(true);
    } catch {
      setOrders([]);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/masters")
      .then((res) => (res.ok ? res.json() : { masters: [] }))
      .then((data) => setMasters(data.masters || []))
      .catch(() => setMasters([]));
  }, []);

  const removeOrder = async (id: number) => {
    if (!confirm("Удалить эту заявку?")) return;
    await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
    await load();
  };

  const assignMaster = async (orderId: number, masterId: number | null) => {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterId }),
    });
    await load();
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/admin/login";
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

  if (!loaded) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center text-white">
        <div className="text-sm text-white/50">Загрузка...</div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="dark-grid min-h-screen grid place-items-center px-6 text-white">
        <div className="dark-card max-w-md p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-4 text-2xl font-extrabold">Требуется вход</h1>
          <p className="mt-3 text-sm text-white/60">
            Панель администратора защищена паролем.
          </p>
          <Link
            href="/admin/login"
            className="btn-accent mt-6 inline-flex justify-center"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  const partnerOrders = orders.filter((o) => o.partnerId !== null).length;
  const directOrders = orders.length - partnerOrders;

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
            <span className="text-xs font-bold text-white/50">
              Панель администратора
            </span>
            <button
              onClick={logout}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Заявки</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Список заявок
            </h1>
            <p className="mt-3 text-white/60">Все заявки из базы данных.</p>
          </div>
        </div>

        <div className="dark-card mt-8 grid grid-cols-1 gap-6 p-6 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] accent">
              Всего заявок
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">
              {orders.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              От партнёров
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em] accent">
              {partnerOrders}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              Напрямую
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-white/70">
              {directOrders}
            </div>
          </div>
        </div>

        {loaded && orders.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-16 text-center">
            <div className="text-4xl">📭</div>
            <div className="mt-4 font-extrabold text-white">Заявок пока нет</div>
          </div>
        )}

        {orders.length > 0 && (
          <div className="mt-8 space-y-3">
            {orders.map((o) => {
              const spread =
                o.clientPrice && o.clientPrice > o.price
                  ? o.clientPrice - o.price
                  : null;
              return (
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
                        {o.partnerName ? (
                          <span className="rounded-full bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-lime-300">
                            Партнёр: {o.partnerName}
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
                            Напрямую
                          </span>
                        )}
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
                        {filmLabel(o.filmCode)}
                      </div>
                      {o.comment && (
                        <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70">
                          {o.comment}
                        </div>
                      )}
                    </div>

                    <div className="w-52 shrink-0">
                      <div className="text-right text-2xl font-extrabold text-white">
                        {o.price.toLocaleString("ru-RU")} ₽
                      </div>
                      <div className="mt-1 text-right text-[10px] uppercase tracking-[0.14em] text-white/40">
                        PPF PROFI
                      </div>

                      {spread && (
                        <div className="mt-2 text-right">
                          <div className="text-lg font-extrabold accent">
                            + {spread.toLocaleString("ru-RU")} ₽
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                            спред партнёра
                          </div>
                        </div>
                      )}

                      <select
                        value={o.masterId ?? ""}
                        onChange={(e) =>
                          assignMaster(
                            o.id,
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white focus:border-lime-400 focus:outline-none"
                      >
                        <option value="" className="bg-neutral-900">
                          — Не назначен —
                        </option>
                        {masters.map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            className="bg-neutral-900"
                          >
                            {m.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => removeOrder(o.id)}
                        className="mt-2 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}