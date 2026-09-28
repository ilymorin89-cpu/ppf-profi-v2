import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { masters } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, pin } = body as { slug?: string; pin?: string };

    if (!slug || !pin) {
      return NextResponse.json(
        { error: "Укажите slug и PIN" },
        { status: 400 }
      );
    }

    const [master] = await db
      .select()
      .from(masters)
      .where(and(eq(masters.slug, slug), eq(masters.status, "ACTIVE")))
      .limit(1);

    if (!master) {
      return NextResponse.json(
        { error: "Мастер не найден" },
        { status: 404 }
      );
    }

    if (master.pinHash !== pin) {
      return NextResponse.json(
        { error: "Неверный PIN" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      master: {
        id: master.id,
        name: master.name,
        slug: master.slug,
      },
    });
  } catch (error) {
    console.error("POST /api/masters/login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}