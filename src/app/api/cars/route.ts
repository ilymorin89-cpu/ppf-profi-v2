import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type CarRow = {
  code: string;
  brand: string;
  model: string;
  class: string;
  verified: boolean;
};

function readCars(): CarRow[] {
  const csvPath = path.join(process.cwd(), "data", "pricing-cars.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0].split(";").map((s) => s.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(";");
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = (cols[i] ?? "").trim(); });
    return {
      code: row.code ?? "",
      brand: row.brand ?? "",
      model: row.model ?? "",
      class: row.class ?? "",
      verified: row.verified === "yes",
    };
  });
}

export async function GET() {
  try {
    const cars = readCars();
    const brands = Array.from(new Set(cars.map((c) => c.brand))).sort();
    return NextResponse.json({ cars, brands });
  } catch (e) {
    console.error("GET /api/cars error:", e);
    return NextResponse.json({ error: "Не удалось прочитать прайс" }, { status: 500 });
  }
}