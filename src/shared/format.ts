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
