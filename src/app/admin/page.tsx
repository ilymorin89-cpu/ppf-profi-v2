"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    fetch("/api/masters")
      .then((res) => res.json())
      .then((data) => setMasters(data.masters || []))
      .catch(() => setMasters([]));
  }, []);

  const removeOrder = async (id: number) => {
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

  const clearAll = async () => {
    if (confirm("Удалить все заявки?")) {
      await fetch("/api/orders", { method: "DELETE" });
      await load();
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

  const partnerOrders = orders.filter((o) => o.partnerId !== null).length;
  const directOrders = orders.length - partnerOrders;

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
          <div className="text-xs font-bold text-slate-400">Панель администратора</div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Заявки</div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Список заявок
            </h1>
            <p className="mt-3 text-slate-400">Все заявки из базы данных.</p>
          </div>
          {orders.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-extrabold text-rose-200 transition hover:bg-rose-500/20"
            >
              Очистить всё
            </button>
          )}
        </div>

        <div className="premium-panel mt-8 grid grid-cols-1 gap-6 p-6 sm:grid-cols-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-blue-300">
              Всего заявок
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">
              {orders.length}
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
              От партнёров
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-blue-400">
              {partnerOrders}
            </div>
          </div>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-400">
              Напрямую
            </div>
            <div className="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-slate-300">
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
                      {o.partnerName ? (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-200">
                          Партнёр: {o.partnerName}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-300">
                          Напрямую
                        </span>
                      )}
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
                  <div className="w-52 shrink-0">
                    <div className="text-right text-2xl font-extrabold text-white">
                      {o.price.toLocaleString("ru-RU")} ₽
                    </div>
                    <div className="mt-1 text-right text-xs text-slate-500">
                      предварительно
                    </div>
                    <select
                      value={o.masterId ?? ""}
                      onChange={(e) =>
                        assignMaster(o.id, e.target.value ? Number(e.target.value) : null)
                      }
                      className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="" className="bg-slate-900">
                        — Не назначен —
                      </option>
                      {masters.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-900">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}