import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

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
        status: "NEW",
      })
      .returning();

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
    const list = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));

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