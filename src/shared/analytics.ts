"use client";

/** Отправляет цель в Яндекс Метрику, если счётчик подключён. */
export function trackGoal(
  goal: string,
  params?: Record<string, string | number>
): void {
  const rawId = process.env.NEXT_PUBLIC_YM_ID;
  if (!rawId || !/^\d{4,12}$/.test(rawId)) return;
  const ym = (window as Window & {
    ym?: (id: number, action: string, goal: string, params?: Record<string, string | number>) => void;
  }).ym;
  ym?.(Number(rawId), "reachGoal", goal, params);
}
