import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { partners } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { hashPin, verifyPin } from "@/server/auth/pin";
import { signSession } from "@/server/auth/session";
import {
  tooManyAttempts,
  noteFailure,
  clearAttempts,
} from "@/server/auth/rate-limit";

const BAD = { error: "Неверный slug или PIN" };

export async function POST(request: Request) {
  try {
    let body: { slug?: string; pin?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    const { slug, pin } = body;
    if (!slug || !pin) {
      return NextResponse.json(
        { error: "Укажите slug и PIN" },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = `partner:${ip}:${slug}`;
    if (tooManyAttempts(key)) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      );
    }

    const [partner] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.slug, slug), eq(partners.status, "ACTIVE")))
      .limit(1);

    if (!partner) {
      noteFailure(key);
      return NextResponse.json(BAD, { status: 401 });
    }

    const { ok, needsRehash } = verifyPin(pin, partner.pinHash);
    if (!ok) {
      noteFailure(key);
      return NextResponse.json(BAD, { status: 401 });
    }

    if (needsRehash) {
      await db
        .update(partners)
        .set({ pinHash: hashPin(pin) })
        .where(eq(partners.id, partner.id));
    }
    clearAttempts(key);

    const maxAge = 60 * 60 * 24 * 7;
    const res = NextResponse.json({
      ok: true,
      partner: { id: partner.id, name: partner.name, slug: partner.slug },
    });
    res.cookies.set(
      "session",
      signSession({
        role: "partner",
        id: partner.id,
        exp: Date.now() + maxAge * 1000,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge,
      }
    );
    return res;
  } catch (error) {
    console.error("POST /api/partners/login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}