type Entry = { count: number; resetAt: number };

const attempts = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000; // 15 минут
const MAX = 8;

export function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    return false;
  }
  return entry.count >= MAX;
}

export function noteFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}