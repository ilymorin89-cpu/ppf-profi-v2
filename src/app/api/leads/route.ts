import { NextResponse } from "next/server";
import { randomInt, createHash } from "node:crypto";
import { db } from "@/server/db/client";
import { leads } from "@/server/db/schema";
import { sendTelegramNotification } from "@/server/telegram/notify";
import { SCENARIOS, filmLabel, formatRub, type ScenarioCode } from "@/content/site";
import { carName, getPublicPrice, isKnownCar } from "@/server/pricing/public";

const ALLOWED_SCENARIOS = ["FULL", "RISK_ZONES"] as const;
const ALLOWED_FILMS = ["PPF_STANDARD", "SPECTROLL_PREMIUM"] as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function newPublicNumber() {
  const now = new Date();
  const yymmdd =
    String(now.getFullYear()).slice(2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  return `LEAD-${yymmdd}-${randomInt(1000, 10000)}`;
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 10;
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
        { error: "Слишком много заявок. Попробуйте через 10 минут." },
        { status: 429 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const carCode = str(body.carCode, 64);
    const scenario = str(body.scenario, 32);
    const filmCode = str(body.filmCode, 64);
    const clientName = str(body.clientName, 160);
    const clientPhone = str(body.clientPhone, 32);
    const comment = str(body.comment, 1000);
    const consent = body.consent === true;

    // Ошибки по полям: форма показывает их рядом с полями и не теряет введённое.
    const fields: Record<string, string> = {};
    if (clientName.length < 2) fields.clientName = "Укажите имя";
    if (clientPhone.replace(/\D/g, "").length < 10) fields.clientPhone = "Проверьте номер телефона";
    if (!consent) fields.consent = "Необходимо согласие на обработку персональных данных";
    // Белый список: модель из каталога, состав и плёнка из допустимых кодов.
    if (
      !isKnownCar(carCode) ||
      !ALLOWED_SCENARIOS.includes(scenario as (typeof ALLOWED_SCENARIOS)[number]) ||
      !ALLOWED_FILMS.includes(filmCode as (typeof ALLOWED_FILMS)[number])
    ) {
      fields.carCode = "Выберите модель из списка";
    }
    if (Object.keys(fields).length > 0) {
      return NextResponse.json(
        { error: Object.values(fields)[0], fields },
        { status: 400 }
      );
    }

    // Цена только серверная, тем же кодом, что /api/public-quote.
    // Цена из тела запроса и из комментария игнорируется.
    const publicPrice = getPublicPrice(carCode, scenario, filmCode);
    const price = publicPrice ? publicPrice.low : null;

    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);

    let created;
    for (let i = 0; i < 5 && !created; i++) {
      try {
        const rows = await db
          .insert(leads)
          .values({
            publicNumber: newPublicNumber(),
            carCode,
            scenario,
            filmCode,
            price,
            clientName,
            clientPhone,
            comment: comment || null,
            consent,
            status: "NEW",
            ipHash,
          })
          .returning();
        created = rows[0];
      } catch (err) {
        const e = err as { code?: string; cause?: { code?: string } };
        if (e?.code !== "23505" && e?.cause?.code !== "23505") throw err;
      }
    }

    if (!created) throw new Error("Не удалось создать заявку");

    try {
      const base = process.env.APP_URL || "http://localhost:3000";
      await sendTelegramNotification(
        `<b>🆕 ПУБЛИЧНАЯ ЗАЯВКА ${esc(created.publicNumber)}</b>\n\n` +
          `Клиент: ${esc(clientName)}\n` +
          `Телефон: ${esc(clientPhone)}\n` +
          `Авто: ${esc(carName(carCode))}\n` +
          `Состав: ${esc(SCENARIOS[scenario as ScenarioCode].label)}\n` +
          `Плёнка: ${esc(filmLabel(filmCode))}\n` +
          `Расчёт на сайте: ${
            publicPrice
              ? `${formatRub(publicPrice.low)} – ${formatRub(publicPrice.high)}`
              : "нет цены в каталоге"
          }\n` +
          (comment ? `Комментарий: ${esc(comment)}\n` : "") +
          `\n<a href="${base}/admin">Открыть админку</a>`
      );
    } catch (e) {
      console.error("Telegram notify failed:", e);
    }

    return NextResponse.json({
      ok: true,
      publicNumber: created.publicNumber,
    });
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}