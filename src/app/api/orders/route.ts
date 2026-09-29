import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
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
    try {
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
    } catch (e) {
      console.error("Telegram notify failed:", e);
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
  return NextResponse.json(
    {
      error:
        "Временно отключено. Используйте админ-панель после авторизации.",
    },
    { status: 403 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Удаление отключено." },
    { status: 403 }
  );
}