import { createHmac, timingSafeEqual } from "node:crypto";

export type Session = {
  role: "master" | "partner" | "admin";
  id: string | number;
  exp: number;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET не задан или короче 32 символов");
  }
  return s;
}

function b64u(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64u(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export function signSession(session: Session): string {
  const payload = b64u(Buffer.from(JSON.stringify(session)));
  const sig = b64u(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function readSession(cookie: string | undefined): Session | null {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const got = fromB64u(sig);
  if (expected.length !== got.length) return null;
  if (!timingSafeEqual(expected, got)) return null;

  try {
    const data = JSON.parse(fromB64u(payload).toString("utf8")) as Session;
    if (!data || typeof data !== "object") return null;
    if (data.exp && Date.now() > data.exp) return null;
    if (data.role !== "master" && data.role !== "partner" && data.role !== "admin") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}