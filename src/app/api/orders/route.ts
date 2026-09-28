import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders, partners } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";
import { sendTelegramNotification } from "@/server/telegram/notify";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCode,
      scenario,
      filmCode,
      price,
      clientName,
      clientPhone,
      comment,
      partnerId,
    } = body;

    if (!carCode || !scenario || !filmCode || !clientName || !clientPhone) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 }
      );
    }

    const now = new Date();
    const yymmdd =
      String(now.getFullYear()).slice(2) +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const publicNumber = `PPF-${yymmdd}-${rand}`;

    const [created] = await db
      .insert(orders)
      .values({
        publicNumber,
        carCode,
        scenario,
        filmCode,
        price: Number(price) || 0,
        clientName,
        clientPhone,
        comment: comment || null,
        partnerId: partnerId ? Number(partnerId) : null,
        status: "NEW",
      })
      .returning();

    const partnerLine = partnerId ? `Партнёр: ID ${partnerId}` : "Напрямую";
    await sendTelegramNotification(
      `<b>🔔 НОВАЯ ЗАЯВКА ${publicNumber}</b>\n\n` +
        `Клиент: ${clientName}\n` +
        `Телефон: ${clientPhone}\n` +
        `Авто: ${carCode}\n` +
        `Состав: ${scenario}\n` +
        `Плёнка: ${filmCode}\n` +
        `Цена: ${price} ₽\n` +
        `Источник: ${partnerLine}\n\n` +
        `<a href="http://localhost:3000/admin">Открыть админку</a>`
    );

    return NextResponse.json({ ok: true, order: created });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partner_id");
    const masterId = searchParams.get("master_id");

    const query = db
      .select({
        id: orders.id,
        publicNumber: orders.publicNumber,
        carCode: orders.carCode,
        scenario: orders.scenario,
        filmCode: orders.filmCode,
        price: orders.price,
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

    let list;
    if (partnerId) {
      list = await query
        .where(eq(orders.partnerId, Number(partnerId)))
        .orderBy(desc(orders.createdAt));
    } else if (masterId) {
      list = await query
        .where(eq(orders.masterId, Number(masterId)))
        .orderBy(desc(orders.createdAt));
    } else {
      list = await query.orderBy(desc(orders.createdAt));
    }

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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
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