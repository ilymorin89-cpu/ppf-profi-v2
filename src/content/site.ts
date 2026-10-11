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

/** days — срок в днях; daysMax — верх диапазона, если срок задан вилкой. */
export const SCENARIOS: Record<
  ScenarioCode,
  { label: string; desc: string; days: number; daysMax?: number }
> = {
  FULL: {
    label: "Полная оклейка",
    desc: "Все окрашенные элементы кузова",
    days: 5,
    daysMax: 7,
  },
  RISK_ZONES: {
    label: "Зоны риска",
    desc: "Бампер, капот, крылья, зеркала, фары, стойки, полоса на крышу",
    days: 1,
  },
};

export const SCENARIO_CODES = Object.keys(SCENARIOS) as ScenarioCode[];

/** «1 день», «5 дней»; с max — «5–7 дней». */
export function daysLabel(n: number, max?: number): string {
  const last = max && max > n ? max : n;
  const prefix = last === n ? "" : `${n}–`;
  const m10 = last % 10;
  const m100 = last % 100;
  if (m10 === 1 && m100 !== 11) return `${prefix}${last} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${prefix}${last} дня`;
  return `${prefix}${last} дней`;
}

/** Срок состава работ: «1 день», «5–7 дней». */
export function scenarioDays(code: ScenarioCode): string {
  return daysLabel(SCENARIOS[code].days, SCENARIOS[code].daysMax);
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
  addonsTitle: "Дополнительно",
  addonsNote: "Отметьте то, что есть на вашей машине и что нужно защитить.",
  addonsTotal: "Итого",
  qtyLess: "Меньше",
  qtyMore: "Больше",
};

// ---------- Допы ----------
// Цены — только в src/server/pricing/config.ts (ADDONS). Здесь подписи.

export const ADDON_TEXTS: Record<string, { label: string; desc?: string; unit?: string }> = {
  PILLARS: { label: "Стойки", desc: "Цена за штуку", unit: "шт" },
  SILLS_INNER: { label: "Пороги внутри" },
  SCREENS: { label: "Экраны в салоне" },
  PANORAMA: { label: "Панорамная крыша, если есть", desc: "Бронирование стекла" },
  WINDSHIELD: { label: "Броня лобового стекла" },
  TINT: {
    label: "Тонировка",
    desc: "В рамках требований к светопропусканию стёкол",
  },
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

/** Пример для /partners и heading главной: BMW X5 G05, полная оклейка, Spectroll Standard.
 *  Цена «от» для главной — прямая цена из src/server/pricing/config.ts (DIRECT_PRICES).
 *  fallbackLow/High/Partner — расчётные значения, используются только /partners, если расчёт недоступен. */
export const PRICE_EXAMPLE = {
  carCode: "BMW_X5_G05",
  carName: "X5 G05",
  carFullName: "BMW X5 G05",
  scenario: "FULL" as ScenarioCode,
  film: "PPF_STANDARD" as FilmCode,
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
  h1Lead: "Оклейка авто защитной плёнкой PPF в Москве.",
  /** {price} — цена Standard FULL X5 G05. */
  h1Price: "Гарантия 12 месяцев на работу и материал",
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
  /** Пример расчёта: {car}, {items} — список допов, {total} — итог «от». */
  exampleTitle: "Пример расчёта",
  exampleText: "{car}, полная оклейка, Spectroll Standard",
  exampleBase: "Полная оклейка — от {price}",
  exampleTotal: "Итого — от {price}",

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
  { value: `${FACTS.experienceYears} лет`, label: "опыт мастеров" },
  {
    value: `${scenarioDays("RISK_ZONES")} / ${scenarioDays("FULL")}`,
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
    text: `Зоны риска — ${scenarioDays("RISK_ZONES")}, полная оклейка — ${scenarioDays("FULL")}.`,
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
    a: `Зоны риска — ${scenarioDays("RISK_ZONES")}, полная оклейка — ${scenarioDays("FULL")}.`,
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

// ---------- /partners ----------

export const PARTNERS = {
  eyebrow: "PPF PROFI для бизнеса",
  h1: "Зарабатывайте {from}–{to} тыс. ₽ с каждой машины на оклейке PPF",
  subtitle: "Вы называете клиенту цену, мы оклеиваем. Без участка и команды.",
  ctaCalc: "Рассчитать под ваш поток →",
  ctaJoin: "Стать партнёром →",
  cabinet: "Войти в кабинет",

  econEyebrow: "Экономика сделки",
  econTitle: "Сколько вы зарабатываете с одной машины",
  /** {car}, {scenario}, {film}, {days} */
  econSubtitle: "Пример: {car}, {scenario}, плёнка {film}, срок {days}.",
  econYouPay: "Вы платите нам",
  econClientPays: "Клиент платит вам",
  econSpread: "Ваш спред",
  econSpreadSuffix: "с машины",
  econTenCars: "{n} в месяц — {from}–{to} ₽ спреда.",
  econTenCarsCount: 10,
  econClientGets: `Что получает ваш клиент: плёнка Spectroll, гарантия ${FACTS.warrantyMonths} месяцев на работу и материал, зоны риска за ${scenarioDays("RISK_ZONES")}.`,
  econFootnote:
    "Спред — разница между ценой, которую вы назвали клиенту, и ценой для партнёра. Диапазон розницы — рекомендация, цену клиенту назначаете вы. Цены на другие модели — в кабинете партнёра.",

  calcTitle: "Посчитайте под свой поток",
  calcPartner: "Цена для партнёра",
  calcClient: "Цена для клиента",
  calcCars: "Машин в месяц",
  calcCarsMin: 1,
  calcCarsMax: 20,
  /** {x} — спред с машины, {n} — машин, {total} — спред в месяц. */
  calcResult: "Ваш спред: {x} с машины. {n} в месяц — {total}",
  calcNoSpread: "Цена клиента не выше цены для партнёра — спреда нет.",

  howEyebrow: "Как это работает",
  howTitle: "От расчёта до готового автомобиля",
  steps: [
    { title: "Рассчитать", text: "Автомобиль, состав работ, плёнка." },
    { title: "Цена для партнёра", text: "Система показывает вашу цену." },
    { title: "Своя цена клиенту", text: "Вы назначаете цену предложения." },
    { title: "Отправить клиенту", text: "Ссылка на предложение без вашей цены." },
    { title: "Мы оклеиваем", text: "Сделка ведётся в системе до результата." },
  ],

  segmentsEyebrow: "Кому подходит",
  segmentsTitle: "С кем мы работаем",
  segments: [
    {
      title: "Автосалоны",
      text: "Предложите защиту покупателям сразу после сделки. Дополнительная прибыль без расширения штата.",
    },
    {
      title: "СТО и кузовные",
      text: "Клиенты после ремонта хотят защитить элементы. Мы оклеиваем — вы получаете спред.",
    },
    {
      title: "Детейлинг-центры",
      text: "Передавайте PPF-заказы, которые не берёте. Сохраняете клиента, получаете доход.",
    },
  ],

  finalTitle: "Станьте партнёром",
  finalText: "Оставьте заявку — свяжемся, расскажем условия и выдадим доступ в кабинет.",
};

// ---------- Заявка партнёра ----------

export const PARTNER_TYPES: { code: string; label: string }[] = [
  { code: "dealer", label: "Автосалон" },
  { code: "detailing", label: "Детейлинг" },
  { code: "sto", label: "СТО" },
  { code: "body", label: "Кузовной" },
  { code: "carpicking", label: "Автоподбор" },
];

export const PARTNER_FORM = {
  company: "Компания",
  companyPlaceholder: "Название",
  type: "Тип",
  city: "Город",
  cityPlaceholder: "Москва",
  carsPerMonth: "Сколько машин в месяц проходит у вас",
  contact: "Телефон или Telegram",
  contactPlaceholder: "+7 999 123-45-67 или @username",
  submit: "Отправить заявку",
  successTitle: "Заявка отправлена",
  successText: "Свяжемся, расскажем условия и выдадим доступ в кабинет.",
};

// ---------- SEO ----------
// Ограничения: title ≤ 65 символов, description ≤ 160.

export const SEO = {
  home: {
    title: "PPF оклейка BMW, Mercedes, Porsche, LC300 в Москве | PPF PROFI",
    /** {price} — цена «от» Standard FULL X5 G05. */
    description: `Защитная плёнка Spectroll на премиум-авто. Полная оклейка X5 G05 от {price}, зоны риска за ${scenarioDays("RISK_ZONES")}, гарантия ${FACTS.warrantyMonths} месяцев. Расчёт онлайн.`,
  },
  partners: {
    title: "PPF партнёрам: спред {from}–{to} тыс. ₽ с машины | PPF PROFI",
    description:
      "Продавайте PPF своим клиентам без участка и команды. Пример: X5 G05, полная оклейка, ваш спред {from}–{to} тыс. ₽. Заявка за минуту.",
  },
};
