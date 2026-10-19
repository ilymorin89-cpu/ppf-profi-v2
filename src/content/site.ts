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
  PPF_STANDARD: { name: "Spectroll TPU-S", thickness: 180, short: "Подходит для большинства машин" },
  SPECTROLL_PREMIUM: { name: "Spectroll Premium", thickness: 210, short: "Слой толще, для езды по трассе" },
};

export const FILM_CODES = Object.keys(FILMS) as FilmCode[];

/** «Spectroll TPU-S 180 микрон» — так плёнка подписывается в прайсах. */
export function filmPriceLabel(code: FilmCode): string {
  const f = FILMS[code];
  return `${f.name} ${f.thickness} ${THICKNESS_UNIT}`;
}

/** «Spectroll TPU-S · 180 микрон»; неизвестный код возвращается как есть. */
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

// ---------- Сайт ----------

/** Адрес сайта: canonical, sitemap, robots, разметка JSON-LD. */
export const SITE = {
  url: "https://ppfprofi.ru",
  name: "PPF PROFI",
};

// ---------- Марки (страницы /ppf/[slug]) ----------

export type BrandPage = {
  /** Часть адреса: /ppf/bmw */
  slug: string;
  /** Название на сайте */
  name: string;
  /** Как марка записана в data/pricing-cars.csv (колонка brand). null — моделей в каталоге нет. */
  catalogBrand: string | null;
  /** Короткий вводный абзац, свой для каждой марки. */
  intro: string;
};

/** Марки профиля. Порядок = порядок на /ppf и в выборе «марка → модель». */
export const BRANDS: BrandPage[] = [
  {
    slug: "bmw",
    name: "BMW",
    catalogBrand: "BMW",
    intro: "X3, X4, X5, X6, X7, XM, 5 и 7 серии — цены ниже по поколениям кузова. Для других моделей BMW посчитаю стоимость после осмотра.",
  },
  {
    slug: "mercedes",
    name: "Mercedes-Benz",
    catalogBrand: "Mercedes-Benz",
    intro: "GLE, GLE Coupe, GLS, G-класс, GLC, E- и S-класс — цены ниже по поколениям кузова. Для других моделей Mercedes-Benz посчитаю стоимость после осмотра.",
  },
  {
    slug: "porsche",
    name: "Porsche",
    catalogBrand: "Porsche",
    intro: "Cayenne, Cayenne Coupe, Macan, Panamera, Taycan и 911 — цены ниже по поколениям кузова.",
  },
  {
    slug: "land-rover",
    name: "Land Rover",
    catalogBrand: "Land Rover",
    intro: "Range Rover, Range Rover Sport, Velar, Defender и Discovery — цены ниже по поколениям кузова.",
  },
  {
    slug: "lynk-co",
    name: "Lynk & Co",
    catalogBrand: "Lynk & Co",
    intro: "Lynk & Co 01, 05, 08, 09 и 900 — цены ниже. Точную стоимость подтвердим после осмотра.",
  },
  {
    slug: "toyota",
    name: "Toyota",
    catalogBrand: "Toyota",
    intro: "Land Cruiser 300, Land Cruiser Prado, Highlander, Camry и RAV4 — цены ниже по поколениям кузова.",
  },
  {
    slug: "lexus",
    name: "Lexus",
    catalogBrand: "Lexus",
    intro: "LX, GX, RX, NX, ES и LM — цены ниже по поколениям кузова.",
  },
  {
    slug: "geely",
    name: "Geely",
    catalogBrand: "Geely",
    intro: "Monjaro, Atlas, Coolray, Tugella, Okavango и Preface — цены ниже.",
  },
  {
    slug: "lixiang",
    name: "LiXiang",
    catalogBrand: "LiXiang",
    intro: "LiXiang L6, L7, L8, L9 и Mega — цены ниже. Точную стоимость подтвердим после осмотра.",
  },
  {
    slug: "zeekr",
    name: "Zeekr",
    catalogBrand: "Zeekr",
    intro: "Zeekr 001, 7X, 009, 9X и X — цены ниже. Точную стоимость подтвердим после осмотра.",
  },
];

/**
 * Вопросы-ответы для страницы марки. Только подтверждённые факты: цены из каталога, сроки, плёнки, гарантия.
 * minRisk / minFull — минимальные цены «от» по моделям марки (null — нет цен).
 */
export function brandFaq(
  brandName: string,
  minRisk: number | null,
  minFull: number | null
): { q: string; a: string }[] {
  const items: { q: string; a: string }[] = [];
  if (minRisk !== null && minFull !== null) {
    items.push({
      q: `Сколько стоит оклейка ${brandName} плёнкой?`,
      a: `Зоны риска — от ${formatRub(minRisk)}, полная оклейка — от ${formatRub(minFull)} на плёнке ${filmLabel("PPF_STANDARD")}. Точную цену подтвердим после осмотра.`,
    });
  }
  items.push(
    {
      q: `Сколько времени занимает оклейка ${brandName}?`,
      a: `Зоны риска — ${scenarioDays("RISK_ZONES")}, полная оклейка — ${scenarioDays("FULL")}.`,
    },
    {
      q: "Какую плёнку выбрать?",
      a: `${filmLabel("PPF_STANDARD")} подходит для большинства машин. ${filmLabel("SPECTROLL_PREMIUM")} — слой толще, дольше сохраняет вид при езде по трассе.`,
    },
    {
      q: "Какая гарантия?",
      a: `Гарантия ${WARRANTY_WORK}: отслоение, пузыри, поднятые края по вине монтажа. ${FILM_LIFE}. Сколы, порезы и царапины на плёнке гарантией не покрываются.`,
    },
    {
      q: "Где проходит оклейка?",
      a: WORKPLACE.answer,
    }
  );
  return items;
}

export function getBrand(slug: string): BrandPage | undefined {
  return BRANDS.find((b) => b.slug === slug);
}

export const BRAND_PAGE = {
  listEyebrow: "Марки",
  listTitle: "Оклейка защитной плёнкой по маркам",
  listText: "Выберите марку и модель: покажу цену или посчитаю индивидуально.",
  listSeoTitle: "Оклейка авто плёнкой PPF по маркам в Москве | PPF PROFI",
  listSeoDescription:
    "Оклейка BMW, Mercedes-Benz, Porsche, Land Rover, Toyota, Lexus, Geely, LiXiang, Zeekr защитной плёнкой Spectroll в Москве. Цены «от» и расчёт онлайн.",
  /** {brand} */
  h1: "Оклейка {brand} защитной плёнкой PPF в Москве",
  /** {brand}, {price} */
  seoTitleWithPrice: "Оклейка {brand} плёнкой PPF в Москве — от {price} | PPF PROFI",
  seoTitle: "Оклейка {brand} плёнкой PPF в Москве | PPF PROFI",
  /** {brand}, {models} */
  seoDescriptionWithModels:
    "Защитная плёнка Spectroll на {brand}: {models}. Цены «от», гарантия {warranty}. Работаем на проверенных площадках в Москве.",
  seoDescription:
    "Защитная плёнка Spectroll на {brand} в Москве. Стоимость считаю индивидуально, гарантия {warranty}. Напишите модель в Telegram.",
  modelsTitle: "Цены на модели",
  riskTpu: `Зоны риска · ${filmPriceLabel("PPF_STANDARD")} — от {price}`,
  fullTpu: `FULL · ${filmPriceLabel("PPF_STANDARD")} — от {price}`,
  fullPremium: `FULL · ${filmPriceLabel("SPECTROLL_PREMIUM")} — от {price}`,
  calcLink: "Подробный расчёт →",
  noModelsTitle: "Стоимость — индивидуально",
  noModelsText:
    "Для этой марки готовых цен на сайте пока нет. Напишите модель и год — посчитаю стоимость и сроки.",
  ctaTelegram: "Написать в Telegram",
  ctaCalc: "Открыть калькулятор",
  ctaPhone: "Позвонить",
  pricesNote: "Цены «от». Точную стоимость подтвердим после осмотра.",
  pickerTitle: "Подбор по автомобилю",
  pickerBrand: "Марка",
  pickerModel: "Модель",
  pickerGen: "Поколение / кузов",
  pickerOther: "Другая модель",
  pickerButton: "Показать цену",
  allBrands: "Все марки →",
  partsLink: "Цены на отдельные детали →",
  formTitle: "Узнайте цену для своей машины",
  faqTitle: "Частые вопросы",
  breadcrumbHome: "Главная",
  breadcrumbList: "Марки",
};

// ---------- Площадка ----------

/** Основная площадка, где проходит оклейка (площадка-партнёр). */
export const WORKPLACE = {
  address: "Москва, шоссе Энтузиастов, 12, корп. 2 (ТЦ «Город»)",
  /** Ответ на вопрос «Где проходит оклейка?» */
  answer:
    "Москва, шоссе Энтузиастов, 12, корп. 2 (ТЦ «Город»). Три поста под оклейку, мойка, детейлинг. В том же ТЦ работают соседние сервисы: шиномонтаж, замена масла, слесарные работы.",
};

// ---------- /ceny ----------

export const PRICES_PAGE = {
  seoTitle: "Цены на оклейку авто плёнкой PPF в Москве — от {price} | PPF PROFI",
  seoDescription:
    "Цены на оклейку защитной плёнкой Spectroll по маркам и моделям: зоны риска, полная оклейка, допы. BMW, Mercedes-Benz, Porsche, Land Rover, Lexus, Toyota и другие.",
  eyebrow: "Цены",
  h1: "Цены на оклейку авто защитной плёнкой PPF в Москве",
  lead: "Цены «от» на плёнке Spectroll по маркам, моделям и поколениям кузова. Точную стоимость подтвердим после осмотра.",
  colModel: "Модель",
  colYears: "Поколение",
  // Шапка таблицы: пакет крупно, плёнка с толщиной — второй строкой.
  priceCols: [
    { title: "Зоны риска", film: filmPriceLabel("PPF_STANDARD") },
    { title: "FULL", film: filmPriceLabel("PPF_STANDARD") },
    { title: "FULL", film: filmPriceLabel("SPECTROLL_PREMIUM") },
  ],
  otherBrands: "Другие марки",
  partsTitle: "Оклейка отдельных деталей",
  partsLead: "Цены «от» на плёнке Spectroll TPU-S 180 микрон по размеру кузова. Точную стоимость подтвердим после осмотра.",
  partsColPart: "Деталь",
  partsCols: [
    { title: "Средние", hint: "X3, GLC, Macan" },
    { title: "Крупные", hint: "X5, GLE, Cayenne" },
    { title: "Полно\u00ADразмерные", hint: "X7, GLS, Range Rover" },
  ],
  addonsTitle: "Дополнительные работы",
  addonsNote: "Цены допов одинаковые для всех моделей.",
  calcCta: "Посчитать свою машину →",
  brandLink: "Страница марки →",
  /** Строка «от {price}» для допов с диапазоном: {from}–{to} */
  addonRange: "{from}–{to}",
};

// ---------- Контакты ----------

const TG_USERNAME = (process.env.NEXT_PUBLIC_TG_USERNAME || "").trim().replace(/^@/, "");

export const CONTACTS = {
  phone: "+7 (952) 857-54-23",
  phoneHref: "tel:+79528575423",
  /** Ссылка, если NEXT_PUBLIC_TG_USERNAME не задан (без ?text). */
  telegramFallbackUrl: "https://t.me/partner_detiling",
  telegramFallbackHandle: "@partner_detiling",
  email: "ilymorin89@gmail.com",
  city: "Москва и область",
};

export const LEGAL = {
  owner: "ИП Морин И. В.",
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
  h1: "Калькулятор",
  h1Mid: "оклейки",
  h1Accent: "авто плёнкой",
  lead: "Выберите автомобиль — сразу увидите цены на все варианты защиты плёнкой Spectroll в Москве.",
  step1: "1. Выберите марку",
  step2: "2. Выберите модель и поколение",
  step3: "Выберите пакет защиты",
  brandLabel: "Марка",
  modelLabel: "Модель",
  genLabel: "Поколение",
  onlyFull: "только к полной оклейке",
  illustration: "Иллюстрация",
  brandsCount: "{n} марок",
  pricesHint: "Цены «от» для выбранной машины",
  summaryTitle: "Ваш выбор",
  bookButton: "Записаться",
  newCalc: "Новый расчёт",
  toHome: "На главную",
  showAll: "Показать все",
  hideAll: "Свернуть",
  priceNote: "Точную цену подтвердим после осмотра",
  noModelTitle: "Нет вашей модели?",
  noModelText: "Напишите марку и год, посчитаю вручную",
  telegramTemplate: "Здравствуйте! Хочу оклеить {model}, {scenario}, {film}. Расчёт на сайте: {price}",
  leadTitle: "Записаться на оклейку",
  leadText: "Оставьте имя и телефон — перезвоним, подтвердим цену и подберём дату.",
  successTitle: "Заявка принята",
  successText: "Мы свяжемся с вами в течение 15 минут для подтверждения расчёта.",
  addonsTitle: "Дополнительные услуги",
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
  MATTE: { label: "Матовая плёнка", desc: "Доплата к полной оклейке" },
};

/** Названия отдельных деталей (коды — PART_PRICES_XL в src/server/pricing/config.ts). */
export const PART_TEXTS: Record<string, string> = {
  HOOD_STRIPE: "Полоса на капот",
  HOOD: "Капот",
  TRUNK_LID: "Крышка багажника",
  ROOF: "Крыша",
  ROOF_STRIPE: "Полоса на крыше",
  LOADING_ZONE: "Зона погрузки заднего бампера",
  FRONT_BUMPER: "Передний бампер",
  FRONT_FENDER: "Переднее крыло",
  REAR_BUMPER: "Задний бампер",
  REAR_FENDER: "Заднее крыло",
  DOOR: "Дверь",
  HANDLE_CUPS: "Под ручки дверей, 4 шт",
  SILL_OUTER: "Порог снаружи, 1 шт",
  SILLS_INNER_4: "Пороги внутри, 4 шт",
  HEADLIGHTS: "Фары головного света, 2 шт",
  MIRRORS: "Зеркала, 2 шт",
  A_PILLARS: "Стойки передние, 2 шт",
  FOG_LIGHTS: "ПТФ, 2 шт",
  SPOILER: "Спойлер",
};

// ---------- Факты о мастере ----------

export const FACTS = {
  experienceYears: "15+",
  /** Оклеено машин с 2022 года. null — не подтверждено, плитка скрыта. */
  carsDone: null as number | null,
  carsDoneSince: 2022,
  /** Гарантия только на работу (монтаж). На материал гарантию не обещаем. */
  warrantyMonths: 24,
  /** Срок службы плёнки по данным производителя. Это не гарантия. */
  filmLifeYears: 10,
};

/** Склонение «месяц»: 1 месяц, 2 месяца, 5 месяцев. */
export function monthsWord(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return "месяц";
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return "месяца";
  return "месяцев";
}

/** «24 месяца на работу» */
export const WARRANTY_WORK = `${FACTS.warrantyMonths} ${monthsWord(FACTS.warrantyMonths)} на работу`;
/** Формулировка про плёнку: только срок службы, не гарантия. */
export const FILM_LIFE = `Срок службы плёнки Spectroll — до ${FACTS.filmLifeYears} лет по данным производителя`;

// ---------- Fallback-значения (если расчёт недоступен) ----------

/** Пример для /partners и heading главной: BMW X5 G05, полная оклейка, Spectroll TPU-S.
 *  Цена «от» для главной — прямая цена из src/server/pricing/config.ts (DIRECT_PRICES).
 *  fallbackLow/High/Partner — расчётные значения, используются только /partners, если расчёт недоступен. */
export const PRICE_EXAMPLE = {
  carCode: "BMW_X5_G05",
  carName: "X5 G05",
  carFullName: "BMW X5 G05",
  scenario: "FULL" as ScenarioCode,
  film: "PPF_STANDARD" as FilmCode,
  fallbackLow: 350_000,
  fallbackHigh: 350_000,
  /** Цена партнёру — только для /partners. */
  fallbackPartner: 243_500,
};

// ---------- Главная ----------

export const HOME = {
  eyebrow: "Оклейка защитной плёнкой",
  h1Lead: "Оклейка авто защитной плёнкой PPF в Москве — BMW, Mercedes, Porsche, Range Rover",
  /** {price} — минимальная цена «от» (зоны риска) среди моделей главной. */
  h1Price: "Плёнка Spectroll, цены от {price}",
  subtitle: `${FACTS.experienceYears} лет опыта, гарантия ${WARRANTY_WORK}, плёнка Spectroll, ${CONTACTS.city}. Посчитайте свою машину за минуту.`,
  ctaCalc: "Рассчитать стоимость →",
  ctaTelegram: "Написать в Telegram",
  miniCalcTitle: "Калькулятор",
  miniCalcBrand: "Марка",
  miniCalcModel: "Модель",
  miniCalcMore: "Подробный расчёт →",

  pricesEyebrow: "Цены",
  pricesTitle: "Сколько стоит защита",
  /** {price} — минимальная цена зон риска среди моделей на главной. */
  pricesLead: "Начните с зон риска — от {price} на моделях: {models}. Капот, бампер, фары и зеркала первыми ловят сколы. Полную оклейку можно добавить позже.",
  pricesFull: `FULL · ${filmPriceLabel("PPF_STANDARD")} — от {price}`,
  pricesRisk: `Зоны риска · ${filmPriceLabel("PPF_STANDARD")} — от {price}`,
  pricesNote: "Цены «от» для плёнки Spectroll TPU-S 180 микрон. Spectroll Premium 210 микрон — в калькуляторе. Точную цену подтвердим после осмотра.",
  /** Показывать ли на главной пример с допами. Выключен: большая итоговая сумма отпугивает, допы видны в калькуляторе. */
  showExample: false,
  /** Пример расчёта: {car}, {items} — список допов, {total} — итог «от». */
  exampleTitle: "Пример расчёта",
  exampleText: "{car}, FULL · Spectroll TPU-S",
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

  warrantyTitle: `Гарантия ${WARRANTY_WORK}`,
  /** Что покрывает гарантия. Пустой список — строка скрыта. */
  warrantyCovers: ["отслоение, пузыри и поднятые края по вине монтажа"] as string[],
  /** Строка про плёнку под гарантией: срок службы, не гарантия. */
  warrantyFilmLife: `${FILM_LIFE}.`,
  warrantyCoversLabel: "Покрывает:",
  warrantyNotCovered:
    "Не покрывает: механические повреждения плёнки — сколы, порезы, царапины. Плёнка принимает удар на себя, поэтому следы ударов дефектом не считаются.",

  faqEyebrow: "Вопросы",
  faqTitle: "Частые вопросы",

  partnersEyebrow: "Партнёрам",
  partnersText: "Автосалон, СТО, автоподбор или импорт? Зарабатывайте {spread} тыс. ₽ с каждой машины.",
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
  { value: `${FACTS.warrantyMonths} мес`, label: "гарантия на работу" },
  {
    value: `${FILMS.PPF_STANDARD.thickness} / ${FILMS.SPECTROLL_PREMIUM.thickness} ${THICKNESS_UNIT}`,
    label: `плёнка Spectroll, срок службы до ${FACTS.filmLifeYears} лет`,
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
    text: `Принимаете работу. Гарантия ${WARRANTY_WORK}.`,
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
    a: `${WARRANTY_WORK[0].toUpperCase()}${WARRANTY_WORK.slice(1)}: отслоение, пузыри, поднятые края по вине монтажа. ${FILM_LIFE}. Механические повреждения плёнки — сколы, порезы, царапины — гарантией не покрываются.`,
  },
  { q: "Где проходит оклейка?", a: WORKPLACE.answer },
  {
    q: "Можно ли наклеить плёнку самому?",
    a: `Можно, но ровно и без пузырей получается не всегда. Типичные ошибки: пузыри, поднятые края, пыль под плёнкой. Гарантия ${WARRANTY_WORK} распространяется только на наш монтаж.`,
  },
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
  { label: "Цены", href: "/ceny" },
  ...(CASES.length > 0 ? [{ label: "Работы", href: "/#works", anchor: "works" }] : []),
  { label: "Марки", href: "/ppf" },
  { label: "Гарантия", href: "/#warranty", anchor: "warranty" },
  { label: "Вход для мастеров", href: "/master" },
  { label: "Партнёрам", href: "/partners" },
];

export const FOOTER_LINKS: NavItem[] = [
  { label: "Калькулятор", href: "/calculator" },
  { label: "Марки", href: "/ppf" },
  { label: "Цены", href: "/ceny" },
  { label: "Партнёрам", href: "/partners" },
  { label: "Вход для мастеров", href: "/master" },
  { label: "Политика конфиденциальности", href: "/privacy" },
];

// ---------- /partners ----------

export const PARTNERS = {
  eyebrow: "PPF PROFI для бизнеса",
  h1: "Разница {spread} тыс. ₽ с каждой машины на оклейке PPF — до налогов и расходов",
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
  econTenCars: "{n} в месяц — {total} ₽ спреда.",
  econTenCarsCount: 10,
  econClientGets: `Что получает ваш клиент: плёнка Spectroll, гарантия ${WARRANTY_WORK}, срок службы плёнки до ${FACTS.filmLifeYears} лет, зоны риска за ${scenarioDays("RISK_ZONES")}.`,
  econFootnote:
    "Спред — разница между ценой, которую вы назвали клиенту, и ценой для партнёра. Это не чистая прибыль: налоги, ваши расходы и затраты на продвижение не учтены. Цена для клиента — рекомендация, цену назначаете вы. Цены на другие модели — в кабинете партнёра.",

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
    {
      title: "Автоподбор",
      text: "Клиент только купил машину и хочет её защитить. Вы называете цену, мы оклеиваем, вы получаете спред.",
    },
    {
      title: "Импортёры авто",
      text: "Машины из Китая, Японии, Кореи и ОАЭ: защита до передачи клиенту.",
    },
    {
      title: "Независимые сервисы",
      text: "Сервисы BMW, Mercedes, Porsche, Land Rover без своего PPF.",
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
  { code: "importer", label: "Импорт авто" },
  { code: "service", label: "Независимый сервис" },
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
    /** {price} — цена «от» FULL X5 G05 на Spectroll TPU-S. */
    description: `Защитная плёнка Spectroll на премиум-авто. Полная оклейка X5 G05 от {price}, зоны риска за ${scenarioDays("RISK_ZONES")}, гарантия ${WARRANTY_WORK}. Расчёт онлайн.`,
  },
  partners: {
    title: "PPF партнёрам: спред {spread} тыс. ₽ с машины | PPF PROFI",
    description:
      "Продавайте PPF своим клиентам без участка и команды. Пример: X5 G05, полная оклейка, ваш спред {spread} тыс. ₽. Заявка за минуту.",
  },
};
