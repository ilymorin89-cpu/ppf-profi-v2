import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { partners } from "@/server/db/schema";
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

    const [partner] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.slug, slug), eq(partners.status, "ACTIVE")))
      .limit(1);

    if (!partner) {
      return NextResponse.json(
        { error: "Партнёр не найден" },
        { status: 404 }
      );
    }

    if (partner.pinHash !== pin) {
      return NextResponse.json(
        { error: "Неверный PIN" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      partner: {
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
      },
    });
  } catch (error) {
    console.error("POST /api/partners/login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}