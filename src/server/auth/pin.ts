import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, KEYLEN, { N, r, p });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPin(
  pin: string,
  stored: string
): { ok: boolean; needsRehash: boolean } {
  // Новый формат: scrypt$salt$hash
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return { ok: false, needsRehash: false };
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const got = scryptSync(pin, salt, expected.length, { N, r, p });
    if (expected.length !== got.length) return { ok: false, needsRehash: false };
    return { ok: timingSafeEqual(expected, got), needsRehash: false };
  }

  // Старый формат: PIN в открытом виде (тестовые данные).
  // При первом успешном входе пароль пересчитывается в scrypt.
  if (stored === pin) {
    return { ok: true, needsRehash: true };
  }
  return { ok: false, needsRehash: false };
}