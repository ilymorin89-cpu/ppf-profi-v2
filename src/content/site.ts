// Единый источник текстов, чисел и контактов публичного сайта.
// Ключи PPF_STANDARD / SPECTROLL_PREMIUM / FULL / RISK_ZONES не переименовывать —
// они хранятся в БД. Меняются только отображаемые названия.
// Пустое значение (null, "", []) = блок или строка на сайте не рендерится.

import { buildTelegramUrl, formatRub, type TelegramContact } from "@/shared/format";

export type FilmCode = "PPF_STANDARD" | "SPECTROLL_PREMIUM";
export type ScenarioCode = "FULL" | "RISK_ZONES";

// ---------- Плёнки ----------

export const THICKNESS_UNIT = "микрон";

export const FILMS: Record<FilmCode, { name: string; thickness: number; short: string }> = {
  PPF_STANDARD: { name: "Spectroll Standard", thickness: 170, short: "Подходит для большинства машин" },
  SPECTROLL_PREMIUM: { name: "Spectroll Premium", thickness: 210, short: "Слой толще, для езды по трассе" },
};

export const FILM_CODES = Object.keys(FILMS) as FilmCode[];

/** «Spectroll Standard · 170 микрон»; неизвестный код возвращается как есть. */
export function filmLabel(code: string): string {
  const f = FILMS[code as FilmCode];
  return f ? `${f.name} · ${f.thickness} ${THICKNESS_UNIT}` : code;
}

// ---------- Состав работ ----------

export const SCENARIOS: Record<ScenarioCode, { label: string; desc: string; days: number }> = {
  FULL: {
    label: "Полная оклейка",
    desc: "Все окрашенные элементы кузова",
    days: 5,
  },
  RISK_ZONES: {
    label: "Зоны риска",
    desc: "Бампер, капот, крылья, зеркала, фары, стойки, полоса на крышу",
    days: 1,
  },
};

export const SCENARIO_CODES = Object.keys(SCENARIOS) as ScenarioCode[];

/** «1 день», «5 дней». */
export function daysLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

// ---------- Модели ----------

/** Шесть моделей, которые показываются первыми (калькулятор, блок цен). */
export const TOP_MODELS: string[] = [
  "BMW_X5_G05",
  "BMW_X7_G07",
  "MB_GLE_V167",
  "PORSCHE_CAYENNE_E3",
  "TOYOTA_LC300",
  "GEELY_MONJARO",
];

// ---------- Контакты ----------

const TG_USERNAME = (process.env.NEXT_PUBLIC_TG_USERNAME || "").trim().replace(/^@/, "");

export const CONTACTS = {
  phone: "+7 (952) 857-54-23",
  phoneHref: "tel:+79528575423",
  /** Ссылка, если NEXT_PUBLIC_TG_USERNAME не задан (без ?text). */
  telegramFallbackUrl: "https://t.me/partner_detiling",
  telegramFallbackHandle: "@partner_detiling",
  email: "kent777_09@mail.ru",
  city: "Москва и область",
};

export const LEGAL = {
  owner: "ИП Морин Илья Владимирович",
  inn: "ИНН 740414579370",
  ogrnip: "ОГРНИП 321745600022340",
};

export const telegramHandle = TG_USERNAME ? `@${TG_USERNAME}` : CONTACTS.telegramFallbackHandle;

/** Данные Telegram для клиентских компонентов (передаются пропсами). */
export const TELEGRAM: TelegramContact = {
  username: TG_USERNAME || null,
  fallbackUrl: CONTACTS.telegramFallbackUrl,
};

/** Ссылка на Telegram; готовый текст подставляется, только если username задан в env. */
export function telegramUrl(text?: string): string {
  return buildTelegramUrl(TELEGRAM, text);
}

export { formatRub };

// ---------- Формы ----------

export const FORM_TEXTS = {
  rateLimited: "Слишком много попыток. Подождите несколько минут или напишите в Telegram.",
  network: `Не удалось отправить заявку. Проверьте соединение, напишите в Telegram или позвоните ${CONTACTS.phone}.`,
  telegramButton: "Написать в Telegram",
  consentPrefix: "Я согласен на обработку персональных данных и принимаю",
  consentLink: "Политику конфиденциальности",
  referralLabel: "Откуда узнали о нас",
  referralPlaceholder: "Поиск, соцсети, знакомые…",
  sending: "Отправляем...",
};

// ---------- Калькулятор ----------

export const CALCULATOR = {
  showAll: "Показать все",
  hideAll: "Свернуть",
  priceNote: "точную цену подтвердим после осмотра",
  noModelTitle: "Нет вашей модели?",
  noModelText: "Напишите марку и год, посчитаю вручную",
  telegramTemplate: "Здравствуйте! Хочу оклеить {model}, {scenario}, {film}. Расчёт на сайте: {price}",
  leadTitle: "Оставить телефон",
  leadText: "Перезвоним и подтвердим расчёт.",
  successTitle: "Заявка принята",
  successText: "Мы свяжемся с вами в течение 15 минут для подтверждения расчёта.",
};
