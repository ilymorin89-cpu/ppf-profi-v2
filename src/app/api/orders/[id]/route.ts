import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { masterId } = body as { masterId?: number | null };

    const [updated] = await db
      .update(orders)
      .set({ masterId: masterId ?? null })
      .where(eq(orders.id, Number(id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}