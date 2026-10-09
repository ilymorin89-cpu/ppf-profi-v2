import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/server/db/client";
import { orders, partners } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendTelegramNotification } from "@/server/telegram/notify";
import { getSession } from "@/server/auth/current";
import { calculateQuote } from "@/server/pricing/quote";

const ALLOWED_SCENARIOS = ["FULL", "RISK_ZONES", "FRONT"] as const;
const ALLOWED_FILMS = ["PPF_STANDARD", "SPECTROLL_PREMIUM"] as const;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function isUnique(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function newPublicNumber() {
  const now = new Date();
  const yymmdd =
    String(now.getFullYear()).slice(2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  return `PPF-${yymmdd}-${randomInt(1000, 10000)}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "partner") {
      return NextResponse.json(
        { error: "Требуется вход. Войдите в кабинет заново." },
        { status: 401 }
      );
    }
    const partnerId = Number(session.id);

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

    if (!carCode || !scenario || !filmCode || !clientName || !clientPhone) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    if (clientPhone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Проверьте номер телефона клиента" },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_SCENARIOS.includes(scenario as (typeof ALLOWED_SCENARIOS)[number]) ||
      !ALLOWED_FILMS.includes(filmCode as (typeof ALLOWED_FILMS)[number])
    ) {
      return NextResponse.json(
        { error: "Неизвестная комбинация" },
        { status: 400 }
      );
    }

    // Цену считает СЕРВЕР, а не браузер.
    const q = calculateQuote({
      carCode,
      scenario: scenario as "FULL" | "RISK_ZONES" | "FRONT",
      filmCode: filmCode as "PPF_STANDARD" | "SPECTROLL_PREMIUM",
    });

    if (!q.ok) {
      return NextResponse.json(
        { error: "Неизвестная модель автомобиля" },
        { status: 400 }
      );
    }

    // Цена партнёру — target из серверного расчёта. Body игнорируем.
    const price = q.result.target;

    // Цена клиенту приходит из формы, но должна быть выше партнёрской.
    const clientPriceRaw = Number(body.clientPrice);
    if (
      !Number.isInteger(clientPriceRaw) ||
      clientPriceRaw <= price ||
      clientPriceRaw > 100_000_000
    ) {
      return NextResponse.json(
        { error: "Цена клиенту должна быть выше цены PPF PROFI" },
        { status: 400 }
      );
    }
    const clientPrice = clientPriceRaw;

    const idem = request.headers.get("Idempotency-Key")?.slice(0, 64) || null;

    if (idem) {
      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idem))
        .limit(1);
      if (existing) {
        if (existing.partnerId !== partnerId) {
          return NextResponse.json({ error: "Конфликт запроса" }, { status: 409 });
        }
        return NextResponse.json({ ok: true, order: existing, duplicate: true });
      }
    }

    let created: typeof orders.$inferSelect | undefined;
    let duplicate = false;

    for (let i = 0; i < 5 && !created; i++) {
      try {
        const rows = await db
          .insert(orders)
          .values({
            publicNumber: newPublicNumber(),
            carCode,
            scenario,
            filmCode,
            price,
            clientPrice,
            clientName,
            clientPhone,
            comment: comment || null,
            partnerId,
            status: "NEW",
            idempotencyKey: idem,
          })
          .returning();
        created = rows[0];
      } catch (err) {
        if (!isUnique(err)) throw err;
        if (idem) {
          const [ex] = await db
            .select()
            .from(orders)
            .where(eq(orders.idempotencyKey, idem))
            .limit(1);
          if (ex) {
            created = ex;
            duplicate = true;
          }
        }
      }
    }

    if (!created) throw new Error("Не удалось создать заявку");

    if (!duplicate) {
      try {
        const base = process.env.APP_URL || "http://localhost:3000";
        await sendTelegramNotification(
          `<b>🔔 НОВАЯ ЗАЯВКА ${esc(created.publicNumber)}</b>\n\n` +
            `Клиент: ${esc(clientName)}\n` +
            `Телефон: ${esc(clientPhone)}\n` +
            `Авто: ${esc(carCode)}\n` +
            `Состав: ${esc(scenario)}\n` +
            `Плёнка: ${esc(filmCode)}\n` +
            `Цена PPF PROFI: ${price} ₽\n` +
            `Цена клиенту: ${clientPrice} ₽\n` +
            `Источник: партнёр ID ${partnerId}\n\n` +
            `<a href="${base}/admin">Открыть админку</a>`
        );
      } catch (e) {
        console.error("Telegram notify failed:", e);
      }
    }

    return NextResponse.json({ ok: true, order: created });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    const base = db
      .select({
        id: orders.id,
        publicNumber: orders.publicNumber,
        carCode: orders.carCode,
        scenario: orders.scenario,
        filmCode: orders.filmCode,
        price: orders.price,
        clientPrice: orders.clientPrice,
        clientName: orders.clientName,
        clientPhone: orders.clientPhone,
        comment: orders.comment,
        status: orders.status,
        createdAt: orders.createdAt,
        partnerId: orders.partnerId,
        masterId: orders.masterId,
        partnerName: partners.name,
        partnerSlug: partners.slug,
      })
      .from(orders)
      .leftJoin(partners, eq(orders.partnerId, partners.id));

    let rows;
    if (session.role === "admin") {
      rows = await base.orderBy(desc(orders.createdAt));
    } else if (session.role === "partner") {
      rows = await base
        .where(eq(orders.partnerId, Number(session.id)))
        .orderBy(desc(orders.createdAt));
    } else {
      rows = await base
        .where(eq(orders.masterId, Number(session.id)))
        .orderBy(desc(orders.createdAt));
    }

    const list =
      session.role === "master"
        ? rows.map((o) => ({
            ...o,
            clientPrice: null,
            partnerName: null,
            partnerSlug: null,
          }))
        : rows;

    return NextResponse.json({ orders: list });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (searchParams.has("id")) {
      if (!/^\d+$/.test(id ?? "")) {
        return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
      }
      await db.delete(orders).where(eq(orders.id, Number(id)));
      return NextResponse.json({ ok: true });
    }

    await db.delete(orders);
    return NextResponse.json({ ok: true, cleared: true });
  } catch (error) {
    console.error("DELETE /api/orders error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}