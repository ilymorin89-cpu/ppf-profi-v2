import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { signSession } from "@/server/auth/session";
import {
  tooManyAttempts,
  noteFailure,
  clearAttempts,
} from "@/server/auth/rate-limit";

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  try {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || expected.length < 12) {
      return NextResponse.json(
        { error: "Вход администратора не настроен" },
        { status: 503 }
      );
    }

    let body: { password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (!body.password) {
      return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = `admin:${ip}`;
    if (tooManyAttempts(key)) {
      return NextResponse.json(
        { error: "Слишком много попыток. Попробуйте позже." },
        { status: 429 }
      );
    }

    if (!timingSafeEqual(sha(body.password), sha(expected))) {
      noteFailure(key);
      return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
    }
    clearAttempts(key);

    const maxAge = 60 * 60 * 12;
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      "session",
      signSession({ role: "admin", id: 0, exp: Date.now() + maxAge * 1000 }),
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
    console.error("POST /api/admin/login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}