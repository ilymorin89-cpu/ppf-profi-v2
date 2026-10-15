"use client";

import { useState } from "react";

type Props = {
  code: string;
  label: string;
  className?: string;
  priority?: boolean;
};

/**
 * Resolves the car photo by the catalog's stable unique code.
 * Until a verified image is committed, gracefully shows the neutral placeholder.
 */
export default function CarVisual({ code, label, className = "", priority = false }: Props) {
  const [failed, setFailed] = useState(false);
  const src = `/images/cars/${code.toLowerCase()}-main.webp`;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#111] ${className}`}>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${label} — изображение автомобиля`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
          <svg viewBox="0 0 120 64" aria-hidden="true" className="w-28 text-lime-300/70" fill="none">
            <path d="M12 42 18 27Q20 22 27 21L40 12H78L91 23 101 27Q107 29 108 36L109 44H101A9 9 0 0 1 83 44H38A9 9 0 0 1 20 44H12Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
            <path d="M43 16H75L84 25H31L43 16Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <circle cx="29" cy="44" r="6" stroke="currentColor" strokeWidth="2.5"/>
            <circle cx="92" cy="44" r="6" stroke="currentColor" strokeWidth="2.5"/>
          </svg>
          <span className="text-sm font-bold text-white/80">{label}</span>
          <span className="text-xs text-white/40">Фотография готовится</span>
        </div>
      )}
    </div>
  );
}
