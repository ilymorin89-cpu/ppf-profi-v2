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

// ---------- Факты о мастере ----------

export const FACTS = {
  experienceYears: "15+",
  /** Оклеено машин с 2022 года. null — не подтверждено, плитка скрыта. */
  carsDone: null as number | null,
  carsDoneSince: 2022,
  warrantyMonths: 12,
};

// ---------- Fallback-значения (если расчёт недоступен) ----------

/** Пример для /partners и heading главной: BMW X5 G05, полная оклейка, Spectroll Standard. */
export const PRICE_EXAMPLE = {
  carCode: "BMW_X5_G05",
  carName: "X5 G05",
  carFullName: "BMW X5 G05",
  scenario: "FULL" as ScenarioCode,
  film: "PPF_STANDARD" as FilmCode,
  /** Розница X5 G05 FULL Standard «от» — fallback для H1 и метаданных главной. */
  fallbackLow: 286_500,
  fallbackHigh: 304_500,
  /** Цена партнёру — только для /partners. */
  fallbackPartner: 243_500,
};

/** Спред партнёра в тыс. ₽ для тизера на главной (на /partners считается из расчёта). */
export const PARTNER_SPREAD_K = { from: 43, to: 61 };

// ---------- Главная ----------

export const HOME = {
  eyebrow: "Оклейка защитной плёнкой",
  h1Lead: "PPF на BMW, Mercedes, Porsche, Land Cruiser и Monjaro.",
  /** {price} — цена Standard FULL X5 G05. */
  h1Price: "Полная оклейка X5 G05 — от {price}",
  subtitle: `${FACTS.experienceYears} лет опыта, гарантия ${FACTS.warrantyMonths} месяцев на работу и материал, ${CONTACTS.city}. Посчитайте свою машину за минуту.`,
  ctaCalc: "Рассчитать стоимость →",
  ctaTelegram: "Написать в Telegram",
  miniCalcTitle: "Калькулятор",
  miniCalcBrand: "Марка",
  miniCalcModel: "Модель",
  miniCalcMore: "Подробный расчёт →",

  pricesEyebrow: "Цены",
  pricesTitle: "Сколько стоит оклейка",
  pricesFull: "Полная — от {price}",
  pricesRisk: "Зоны риска — от {price}",
  pricesNote: "Цены для плёнки Spectroll Standard. Точную цену подтвердим после осмотра.",

  wrapEyebrow: "Что клеим",
  wrapTitle: "Полная оклейка или зоны риска",

  filmTitle: "Две плёнки Spectroll: выбираем под машину и дорогу",
  filmText: {
    PPF_STANDARD: "Защищает от сколов, песка, камней и реагентов. Подходит для большинства машин.",
    SPECTROLL_PREMIUM: "Тот же набор защит, слой толще, дольше сохраняет вид при езде по трассе.",
  } as Record<FilmCode, string>,
  filmCaption: "Не знаете, что выбрать? Напишите марку и как ездите, подскажем.",
  filmFootnote: "Толщина по данным производителя",

  worksEyebrow: "Работы",
  worksTitle: "Наши работы",
  worksBefore: "До",
  worksAfter: "После",

  howEyebrow: "Как проходит",
  howTitle: "От расчёта до выдачи машины",

  warrantyTitle: `${FACTS.warrantyMonths} месяцев на работу и материал`,
  /** Что покрывает гарантия. Пустой список — строка скрыта. */
  warrantyCovers: [] as string[],
  warrantyCoversLabel: "Покрывает:",
  warrantyNotCovered:
    "Не покрывает: механические повреждения плёнки — сколы, порезы, царапины. Плёнка принимает удар на себя, поэтому следы ударов дефектом не считаются.",

  faqEyebrow: "Вопросы",
  faqTitle: "Частые вопросы",

  partnersEyebrow: "Партнёрам",
  partnersText: "Автосалон, детейлинг или СТО? Зарабатывайте {from}–{to} тыс. ₽ с каждой машины.",
  partnersButton: "Условия для партнёров →",

  finalTitle: "Узнайте цену для своей машины",
  finalText: "Выберите модель, оставьте телефон или напишите в Telegram.",
  finalSubmit: "Отправить заявку",
};

/** Полоса фактов. Плитка с числом машин добавляется, только если FACTS.carsDone задан. */
export const FACT_TILES: { value: string; label: string }[] = [
  { value: `${FACTS.experienceYears} лет`, label: "опыт мастера" },
  {
    value: `${daysLabel(SCENARIOS.RISK_ZONES.days)} / ${daysLabel(SCENARIOS.FULL.days)}`,
    label: "зоны риска / полная оклейка",
  },
  { value: `${FACTS.warrantyMonths} мес`, label: "гарантия на работу и материал" },
  {
    value: `${FILMS.PPF_STANDARD.thickness} / ${FILMS.SPECTROLL_PREMIUM.thickness} ${THICKNESS_UNIT}`,
    label: "плёнка Spectroll",
  },
  ...(FACTS.carsDone
    ? [{ value: `${FACTS.carsDone}+ машин`, label: `оклеено с ${FACTS.carsDoneSince} года` }]
    : []),
];

/** Этапы работы. ЗАГЛУШКА: формулировки этапов 1, 2 и 4 нужно подтвердить у владельца. */
export const HOW_STEPS: { title: string; text: string }[] = [
  { title: "Расчёт", text: "Выберите модель на сайте или напишите в Telegram." },
  { title: "Осмотр", text: "Смотрим машину и подтверждаем точную цену." },
  {
    title: "Оклейка",
    text: `Зоны риска — ${daysLabel(SCENARIOS.RISK_ZONES.days)}, полная оклейка — ${daysLabel(SCENARIOS.FULL.days)}.`,
  },
  {
    title: "Выдача",
    text: `Принимаете работу. Гарантия ${FACTS.warrantyMonths} месяцев на работу и материал.`,
  },
];

/** ЗАГЛУШКА: вопросы собраны из подтверждённых фактов; список нужно согласовать с владельцем. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Сколько времени занимает оклейка?",
    a: `Зоны риска — ${daysLabel(SCENARIOS.RISK_ZONES.days)}, полная оклейка — ${daysLabel(SCENARIOS.FULL.days)}.`,
  },
  {
    q: "Какую плёнку выбрать?",
    a: `${filmLabel("PPF_STANDARD")} подходит для большинства машин. ${filmLabel("SPECTROLL_PREMIUM")} — слой толще, дольше сохраняет вид при езде по трассе.`,
  },
  {
    q: "Цена на сайте окончательная?",
    a: "На сайте цена «от». Точную цену подтвердим после осмотра машины.",
  },
  {
    q: "Что входит в гарантию?",
    a: `${FACTS.warrantyMonths} месяцев на работу и материал. Механические повреждения плёнки — сколы, порезы, царапины — гарантией не покрываются.`,
  },
  { q: "Где вы работаете?", a: CONTACTS.city + "." },
];

// ---------- Работы (кейсы) ----------
// Медиа кладутся в public/cases/. Фото: webp, до 300 КБ, ширина 1200 px.
// Видео: mp4 вертикальное 1080×1920, до 5 МБ. Пустой массив — блок «Работы» и пункт меню скрыты.

export type Case = {
  model: string;
  scope: "FULL" | "RISK_ZONES";
  film: "STANDARD" | "PREMIUM";
  city?: string;
  year?: number;
  days?: number;
  /** Путь от корня сайта, например "/cases/x5-before.webp". */
  photoBefore: string;
  photoAfter: string;
  video?: string;
};

export const CASES: Case[] = [];

export const CASE_FILM: Record<Case["film"], FilmCode> = {
  STANDARD: "PPF_STANDARD",
  PREMIUM: "SPECTROLL_PREMIUM",
};

// ---------- Навигация ----------

export type NavItem = { label: string; href: string; anchor?: string };

/** Пункты шапки. anchor — id блока на главной; «Работы» скрыт, если CASES пуст. */
export const NAV: NavItem[] = [
  { label: "Калькулятор", href: "/#calculator", anchor: "calculator" },
  { label: "Цены", href: "/#prices", anchor: "prices" },
  ...(CASES.length > 0 ? [{ label: "Работы", href: "/#works", anchor: "works" }] : []),
  { label: "Гарантия", href: "/#warranty", anchor: "warranty" },
  { label: "Партнёрам", href: "/partners" },
];

export const FOOTER_LINKS: NavItem[] = [
  { label: "Калькулятор", href: "/calculator" },
  { label: "Партнёрам", href: "/partners" },
  { label: "Мастерам", href: "/master" },
  { label: "Политика конфиденциальности", href: "/privacy" },
];
