import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/current";
import { quote } from "@/server/pricing/quote";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "partner" && session.role !== "admin")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const car = String(body.car ?? body.carCode ?? "");
    const pkg = String(body.pkg ?? body.scenario ?? "");
    const film = String(body.film ?? body.filmCode ?? "");

    const q = quote(car, pkg, film);

    if (!q) {
      return NextResponse.json(
        { error: "Цена по запросу. Напишите нам в Telegram." },
        { status: 404 }
      );
    }

    return NextResponse.json({ pp: q.pp, low: q.low, high: q.high });
  } catch (error) {
    console.error("POST /api/quote error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}