import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/server/auth/current";

const STATUSES = ["NEW", "NEEDS_CHECK", "QUOTED", "APPROVED", "COMPLETED"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }
    if (session.role === "partner") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return NextResponse.json({ error: "Bad id" }, { status: 400 });
    }

    let body: { masterId?: number | null; status?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    const { masterId, status } = body;

    const updates: { masterId?: number | null; status?: string } = {};

    if (masterId !== undefined) {
      if (session.role !== "admin") {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      if (masterId !== null && !Number.isInteger(masterId)) {
        return NextResponse.json({ error: "Bad masterId" }, { status: 400 });
      }
      updates.masterId = masterId;
    }

    if (status !== undefined) {
      if (typeof status !== "string" || !STATUSES.includes(status)) {
        return NextResponse.json({ error: "Bad status" }, { status: 400 });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    if (session.role === "master") {
      const [order] = await db
        .select({ masterId: orders.masterId })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (!order || order.masterId !== Number(session.id)) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
    }

    const [updated] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, orderId))
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