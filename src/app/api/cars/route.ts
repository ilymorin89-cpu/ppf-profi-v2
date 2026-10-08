import { NextResponse } from "next/server";
import { getPublicCars } from "@/server/pricing/catalog";

export async function GET() {
  try {
    const cars = getPublicCars();
    return NextResponse.json({ cars });
  } catch (error) {
    console.error("GET /api/cars error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}