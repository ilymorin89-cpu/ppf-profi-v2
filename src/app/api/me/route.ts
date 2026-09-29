import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/current";
import { db } from "@/server/db/client";
import { partners, masters } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ session: null, user: null });
  }

  if (session.role === "admin") {
    return NextResponse.json({
      session,
      user: { id: 0, name: "Администратор", slug: "admin" },
    });
  }

  if (session.role === "partner") {
    const [p] = await db
      .select({ id: partners.id, name: partners.name, slug: partners.slug })
      .from(partners)
      .where(eq(partners.id, Number(session.id)))
      .limit(1);
    return NextResponse.json({ session, user: p ?? null });
  }

  const [m] = await db
    .select({ id: masters.id, name: masters.name, slug: masters.slug })
    .from(masters)
    .where(eq(masters.id, Number(session.id)))
    .limit(1);
  return NextResponse.json({ session, user: m ?? null });
}