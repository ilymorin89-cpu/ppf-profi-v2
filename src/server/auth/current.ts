import { cookies } from "next/headers";
import { readSession, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSession(store.get("session")?.value);
}