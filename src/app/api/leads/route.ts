import { NextResponse } from "next/server";
import { randomInt, createHash } from "node:crypto";
import { db } from "@/server/db/client";
import { leads } from "@/server/db/schema";
import { sendTelegramNotification } from "@/server/telegram/notify";
import { PARTNER_TYPES, SCENARIOS, filmLabel, formatRub, type ScenarioCode } from "@/content/site";
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

    const kind = body.kind === "partner" ? "partner" : "client";
    const clientPhone = str(body.clientPhone, 32);
    const comment = str(body.comment, 1000);
    const consent = body.consent === true;
    // Общие для всех форм: «Откуда узнали» и UTM.
    const referral = str(body.referral, 160) || null;
    const utmSource = str(body.utm_source, 120) || null;
    const utmMedium = str(body.utm_medium, 120) || null;
    const utmCampaign = str(body.utm_campaign, 120) || null;

    // Ошибки по полям: форма показывает их рядом с полями и не теряет введённое.
    const fields: Record<string, string> = {};
    if (!consent) fields.consent = "Необходимо согласие на обработку персональных данных";

    let lead: {
      carCode: string;
      scenario: string;
      filmCode: string;
      clientName: string;
      price: number | null;
      company: string | null;
      companyType: string | null;
      city: string | null;
      carsPerMonth: number | null;
    };
    let publicPrice: { low: number; high: number } | null = null;

    if (kind === "partner") {
      const company = str(body.company, 160);
      const companyType = str(body.companyType, 32);
      const city = str(body.city, 120);
      const carsRaw = Number(body.carsPerMonth);
      const isTelegram = /^@?[A-Za-z0-9_]{5,32}$/.test(clientPhone);
      if (company.length < 2) fields.company = "Укажите компанию";
      if (!PARTNER_TYPES.some((t) => t.code === companyType)) fields.companyType = "Выберите тип";
      if (city.length < 2) fields.city = "Укажите город";
      if (!Number.isInteger(carsRaw) || carsRaw < 0 || carsRaw > 100000) {
        fields.carsPerMonth = "Укажите число машин";
      }
      if (!isTelegram && clientPhone.replace(/\D/g, "").length < 10) {
        fields.clientPhone = "Укажите телефон или Telegram";
      }
      lead = {
        carCode: "",
        scenario: "",
        filmCode: "",
        clientName: company,
        price: null,
        company,
        companyType,
        city,
        carsPerMonth: carsRaw,
      };
    } else {
      const carCode = str(body.carCode, 64);
      const scenario = str(body.scenario, 32);
      const filmCode = str(body.filmCode, 64);
      const clientName = str(body.clientName, 160);
      if (clientName.length < 2) fields.clientName = "Укажите имя";
      if (clientPhone.replace(/\D/g, "").length < 10) fields.clientPhone = "Проверьте номер телефона";
      // Белый список: модель из каталога, состав и плёнка из допустимых кодов.
      if (
        !isKnownCar(carCode) ||
        !ALLOWED_SCENARIOS.includes(scenario as (typeof ALLOWED_SCENARIOS)[number]) ||
        !ALLOWED_FILMS.includes(filmCode as (typeof ALLOWED_FILMS)[number])
      ) {
        fields.carCode = "Выберите модель из списка";
      } else {
        // Цена только серверная, тем же кодом, что /api/public-quote.
        // Цена из тела запроса и из комментария игнорируется.
        publicPrice = getPublicPrice(carCode, scenario, filmCode);
      }
      lead = {
        carCode,
        scenario,
        filmCode,
        clientName,
        price: publicPrice ? publicPrice.low : null,
        company: null,
        companyType: null,
        city: null,
        carsPerMonth: null,
      };
    }

    if (Object.keys(fields).length > 0) {
      return NextResponse.json(
        { error: Object.values(fields)[0], fields },
        { status: 400 }
      );
    }

    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);

    let created;
    for (let i = 0; i < 5 && !created; i++) {
      try {
        const rows = await db
          .insert(leads)
          .values({
            publicNumber: newPublicNumber(),
            kind,
            ...lead,
            clientPhone,
            comment: comment || null,
            consent,
            status: "NEW",
            ipHash,
            referral,
            utmSource,
            utmMedium,
            utmCampaign,
          })
          .returning();
        created = rows[0];
      } catch (err) {
        const e = err as { code?: string; cause?: { code?: string } };
        if (e?.code !== "23505" && e?.cause?.code !== "23505") throw err;
      }
    }

    if (!created) throw new Error("Не удалось создать заявку");

    const utm = [utmSource, utmMedium, utmCampaign].filter(Boolean).join(" / ");
    const source =
      (referral ? `Откуда узнали: ${esc(referral)}\n` : "") + (utm ? `UTM: ${esc(utm)}\n` : "");

    try {
      const base = process.env.APP_URL || "http://localhost:3000";
      const text =
        kind === "partner"
          ? `<b>🤝 ПАРТНЁР · ЗАЯВКА ${esc(created.publicNumber)}</b>\n\n` +
            `Компания: ${esc(lead.company ?? "")}\n` +
            `Тип: ${esc(PARTNER_TYPES.find((t) => t.code === lead.companyType)?.label ?? "")}\n` +
            `Город: ${esc(lead.city ?? "")}\n` +
            `Машин в месяц: ${lead.carsPerMonth}\n` +
            `Контакт: ${esc(clientPhone)}\n` +
            source
          : `<b>🆕 ПУБЛИЧНАЯ ЗАЯВКА ${esc(created.publicNumber)}</b>\n\n` +
            `Клиент: ${esc(lead.clientName)}\n` +
            `Телефон: ${esc(clientPhone)}\n` +
            `Авто: ${esc(carName(lead.carCode))}\n` +
            `Состав: ${esc(SCENARIOS[lead.scenario as ScenarioCode].label)}\n` +
            `Плёнка: ${esc(filmLabel(lead.filmCode))}\n` +
            `Расчёт на сайте: ${
              publicPrice
                ? `${formatRub(publicPrice.low)} – ${formatRub(publicPrice.high)}`
                : "нет цены в каталоге"
            }\n` +
            (comment ? `Комментарий: ${esc(comment)}\n` : "") +
            source;
      await sendTelegramNotification(text + `\n<a href="${base}/admin">Открыть админку</a>`);
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