import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/current";
import { calculateQuote } from "@/server/pricing/quote";

const ALLOWED_SCENARIOS = ["FULL", "RISK_ZONES", "FRONT"] as const;
const ALLOWED_FILMS = ["PPF_STANDARD", "SPECTROLL_PREMIUM"] as const;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "partner") {
      return NextResponse.json(
        { error: "Требуется вход партнёра" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Некорректный запрос" },
        { status: 400 }
      );
    }

    const carCode =
      typeof body.carCode === "string" ? body.carCode.trim() : "";
    const scenario =
      typeof body.scenario === "string" ? body.scenario.trim() : "";
    const filmCode =
      typeof body.filmCode === "string" ? body.filmCode.trim() : "";

    if (
      !carCode ||
      !ALLOWED_SCENARIOS.includes(
        scenario as (typeof ALLOWED_SCENARIOS)[number]
      ) ||
      !ALLOWED_FILMS.includes(filmCode as (typeof ALLOWED_FILMS)[number])
    ) {
      return NextResponse.json(
        { error: "Неизвестная комбинация" },
        { status: 400 }
      );
    }

    const result = calculateQuote({
      carCode,
      scenario: scenario as "FULL" | "RISK_ZONES",
      filmCode: filmCode as "PPF_STANDARD" | "SPECTROLL_PREMIUM",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Не удалось рассчитать" },
        { status: 400 }
      );
    }

    // Партнёру отдаём только target и autoApprove.
    // Cost Floor и breakdown остаются внутри системы.
    return NextResponse.json({
      target: result.target,
      autoApprove: result.autoApprove,
      pricingVersion: result.pricingVersion,
    });
  } catch (error) {
    console.error("POST /api/quote error:", error);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}