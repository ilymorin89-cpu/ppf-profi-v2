import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/current";
import { quote } from "@/server/pricing/quote";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "partner" && session.role !== "admin")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      car?: unknown;
      pkg?: unknown;
      film?: unknown;
    };

    const q = quote(
      String(body.car ?? ""),
      String(body.pkg ?? ""),
      String(body.film ?? "")
    );

    if (!q) {
      return NextResponse.json(
        { error: "Цена по запросу. Напишите нам в Telegram." },
        { status: 404 }
      );
    }

    // Партнёру отдаём только цену PPF PROFI и диапазон розницы.
    // Cost Floor, Auto-Approve и breakdown остаются на сервере.
    return NextResponse.json({ pp: q.pp, low: q.low, high: q.high });
  } catch (error) {
    console.error("POST /api/quote error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}