import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { masters } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const list = await db
      .select({ id: masters.id, name: masters.name, slug: masters.slug })
      .from(masters)
      .where(eq(masters.status, "ACTIVE"));
    return NextResponse.json({ masters: list });
  } catch (error) {
    console.error("GET /api/masters error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}