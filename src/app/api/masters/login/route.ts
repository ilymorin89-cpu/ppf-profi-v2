import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { masters } from "@/server/db/schema";
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
    const key = `master:${ip}:${slug}`;
    if (tooManyAttempts(key)) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      );
    }

    const [master] = await db
      .select()
      .from(masters)
      .where(and(eq(masters.slug, slug), eq(masters.status, "ACTIVE")))
      .limit(1);

    if (!master) {
      noteFailure(key);
      return NextResponse.json(BAD, { status: 401 });
    }

    const { ok, needsRehash } = verifyPin(pin, master.pinHash);
    if (!ok) {
      noteFailure(key);
      return NextResponse.json(BAD, { status: 401 });
    }

    if (needsRehash) {
      await db
        .update(masters)
        .set({ pinHash: hashPin(pin) })
        .where(eq(masters.id, master.id));
    }
    clearAttempts(key);

    const maxAge = 60 * 60 * 24 * 7;
    const res = NextResponse.json({
      ok: true,
      master: { id: master.id, name: master.name, slug: master.slug },
    });
    res.cookies.set(
      "session",
      signSession({
        role: "master",
        id: master.id,
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
    console.error("POST /api/masters/login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}