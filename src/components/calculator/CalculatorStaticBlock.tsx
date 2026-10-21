import Link from "next/link";
import type { CalcCar } from "@/components/calculator/Calculator";
import { formatRub } from "@/shared/format";

/**
 * Статический блок калькулятора: fallback у <Suspense> на / и /calculator.
 * Попадает в HTML до загрузки JS. Когда клиентский калькулятор отрисуется,
 * React заменяет блок целиком, поэтому после гидратации дублей нет.
 *
 * Цены — только публичные «от» из getCalculatorProps().cars, тот же источник,
 * что у калькулятора. Цену партнёра и себестоимость сюда не передают.
 * Серверный компонент: без "use client" и без useSearchParams.
 */

/** Базовая плёнка Spectroll TPU-S 180 мкм (PPF_STANDARD). Премиум и NAR здесь не показываем. */
const FILM = "PPF_STANDARD";

const TITLE = "Калькулятор оклейки авто плёнкой PPF в Москве";
const DESCRIPTION =
  "Выберите марку и модель: покажем цену полной оклейки и зон риска на плёнке Spectroll. Цены указаны «от», точную сумму подтверждаем после осмотра.";

type Props = { cars: CalcCar[] };

export default function CalculatorStaticBlock({ cars }: Props) {
  const rows = cars
    .map((c) => ({
      code: c.code,
      label: c.label,
      gen: c.gen,
      risk: c.prices.RISK_ZONES?.[FILM]?.low,
      full: c.prices.FULL?.[FILM]?.low,
    }))
    .filter((r) => r.risk !== undefined || r.full !== undefined);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <h2 className="text-3xl font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[44px]">
        {TITLE}
      </h2>
      <p className="mt-4 max-w-2xl text-white/60">{DESCRIPTION}</p>

      {rows.length > 0 && (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.code} className="dark-card p-4">
              <div className="font-extrabold">{r.label}</div>
              {r.gen && <div className="text-xs text-white/50">{r.gen}</div>}
              {r.risk !== undefined && <div className="mt-3 text-sm">Зоны риска — от {formatRub(r.risk)}</div>}
              {r.full !== undefined && (
                <div className="mt-1 text-sm text-white/65">Полная оклейка — от {formatRub(r.full)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/ceny" className="btn-ghost">
          Все марки и цены
        </Link>
        <Link href="/ppf" className="btn-ghost">
          Марки и модели
        </Link>
      </div>
    </div>
  );
}
