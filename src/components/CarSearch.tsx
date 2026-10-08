"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CARS_LIST, type CarEntry } from "@/shared/cars";

type Props = {
  value: string | null;
  onChange: (carCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_]/g, "");
}

export default function CarSearch({
  value,
  onChange,
  placeholder = "Введите марку или модель...",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected: CarEntry | undefined = useMemo(
    () => CARS_LIST.find((c) => c.code === value),
    [value]
  );

  useEffect(() => {
    if (selected && !open) {
      setQuery(`${selected.brand} ${selected.model}`);
    }
  }, [selected, open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (selected) {
          setQuery(`${selected.brand} ${selected.model}`);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selected]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return CARS_LIST.slice(0, 20);
    return CARS_LIST.filter((c) => {
      const brand = normalize(c.brand);
      const model = normalize(c.model);
      const full = `${brand}${model}`;
      return brand.includes(q) || model.includes(q) || full.includes(q);
    }).slice(0, 40);
  }, [query]);

  const handleSelect = (car: CarEntry) => {
    onChange(car.code);
    setQuery(`${car.brand} ${car.model}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const car = filtered[highlight];
      if (car) handleSelect(car);
    } else if (e.key === "Escape") {
      setOpen(false);
      if (selected) setQuery(`${selected.brand} ${selected.model}`);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400 disabled:opacity-50"
      />

      {selected && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.14em] accent">
          {selected.class}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black/60">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-white/40">
              Ничего не найдено. Напишите нам — рассчитаем вручную.
            </div>
          )}

          {filtered.map((car, idx) => (
            <button
              key={car.code}
              type="button"
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => handleSelect(car)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                idx === highlight
                  ? "bg-lime-400/10 text-white"
                  : "text-white/80 hover:bg-white/5"
              }`}
            >
              <span>
                <span className="font-extrabold">{car.brand}</span>{" "}
                <span className="text-white/70">{car.model}</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                {car.class}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}