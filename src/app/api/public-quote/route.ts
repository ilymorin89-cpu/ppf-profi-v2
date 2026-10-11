import { NextResponse } from "next/server";
import { getPublicTotal, parsePublicAddons } from "@/server/pricing/public";

const ALLOWED_SCENARIOS = ["FULL", "RISK_ZONES"] as const;
const ALLOWED_FILMS = ["PPF_STANDARD", "SPECTROLL_PREMIUM"] as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// Rate limit: 30 запросов / 10 мин на IP (мягче, чем для leads)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

function getIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_HITS) return false;
  b.count++;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = getIp(request);
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const carCode  = str(body.carCode, 64);
    const scenario = str(body.scenario, 32);
    const filmCode = str(body.filmCode, 64);

    if (
      !ALLOWED_SCENARIOS.includes(scenario as (typeof ALLOWED_SCENARIOS)[number]) ||
      !ALLOWED_FILMS.includes(filmCode as (typeof ALLOWED_FILMS)[number])
    ) {
      return NextResponse.json({ error: "Неизвестная комбинация" }, { status: 400 });
    }
    if (!carCode) {
      return NextResponse.json({ error: "Не указан автомобиль" }, { status: 400 });
    }
    const addons = parsePublicAddons(body.addons);
    if (!addons) {
      return NextResponse.json({ error: "Некорректные допы" }, { status: 400 });
    }

    // Итог = оклейка + допы, считается только здесь, на сервере.
    const totals = getPublicTotal(carCode, scenario, filmCode, addons);
    const price = totals ? totals.total : null;

    if (!price) {
      // Не verified / нет замеров / неизвестная модель — публично отдаём
      // «Цена по запросу», без деталей, чтобы не раскрывать экономику.
      return NextResponse.json(
        { ok: false, reason: "on-request", message: "Цена по запросу. Мы свяжемся с вами." },
        { status: 200 }
      );
    }

    // Публично отдаём ТОЛЬКО диапазон для клиента (low..high).
    // pp, target, costFloor, autoApprove наружу не отдаём.
    return NextResponse.json({ ok: true, low: price.low, high: price.high });
  } catch (error) {
    console.error("POST /api/public-quote error:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}