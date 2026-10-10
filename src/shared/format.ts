// Чистые хелперы без данных: безопасно импортировать в клиентские компоненты.

export function formatRub(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

/** Подставляет {key} из vars; неизвестные ключи остаются как есть. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Telegram-контакт для клиентских компонентов. username = null → fallbackUrl без ?text. */
export type TelegramContact = { username: string | null; fallbackUrl: string };

export function buildTelegramUrl(tg: TelegramContact, text?: string): string {
  if (!tg.username) return tg.fallbackUrl;
  const base = `https://t.me/${tg.username}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** «1 машина», «3 машины», «10 машин». */
export function carsLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} машина`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} машины`;
  return `${n} машин`;
}
