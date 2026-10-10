"use client";

import { useState } from "react";
import { carsLabel, fillTemplate, formatRub } from "@/shared/format";

type Props = {
  /** pp, low, high — только пропсами из серверного компонента /partners (пример X5 G05). */
  pp: number;
  low: number;
  high: number;
  texts: {
    title: string;
    partner: string;
    client: string;
    cars: string;
    carsMin: number;
    carsMax: number;
    result: string;
    noSpread: string;
  };
};

const fmt = (n: number) => n.toLocaleString("ru-RU");

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const n = Number(value) || 0;
  return (
    <label className="block rounded-xl border border-white/8 bg-white/[0.03] p-4 transition focus-within:border-lime-400 focus-within:ring-1 focus-within:ring-lime-400">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="mt-2 flex items-baseline gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={focused ? value : value ? fmt(n) : ""}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="0"
          className="w-full min-w-0 bg-transparent text-2xl font-extrabold text-white placeholder:text-white/30 focus:outline-none"
        />
        <span className="text-2xl font-extrabold text-white/60">₽</span>
      </span>
    </label>
  );
}

export default function EconomyCalculator({ pp, low, high, texts }: Props) {
  const [partner, setPartner] = useState(String(pp));
  const [client, setClient] = useState(String(Math.round((low + high) / 2)));
  const [cars, setCars] = useState(10);

  const x = (Number(client) || 0) - (Number(partner) || 0);

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
      <div className="text-lg font-extrabold">{texts.title}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MoneyInput label={texts.partner} value={partner} onChange={setPartner} />
        <MoneyInput label={texts.client} value={client} onChange={setClient} />
      </div>

      <label className="mt-5 block">
        <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
          <span>{texts.cars}</span>
          <span className="text-base text-white">{cars}</span>
        </span>
        <input
          type="range"
          min={texts.carsMin}
          max={texts.carsMax}
          value={cars}
          onChange={(e) => setCars(Number(e.target.value))}
          className="mt-3 w-full accent-lime-400"
        />
      </label>

      <div
        className={`mt-5 rounded-xl border p-4 text-base font-extrabold ${
          x > 0 ? "border-lime-400/25 bg-lime-400/[0.06] accent" : "border-rose-400/30 bg-rose-500/10 text-rose-200"
        }`}
      >
        {x > 0
          ? fillTemplate(texts.result, { x: formatRub(x), n: carsLabel(cars), total: formatRub(x * cars) })
          : texts.noSpread}
      </div>
    </div>
  );
}
