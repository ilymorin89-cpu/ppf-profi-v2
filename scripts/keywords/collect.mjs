#!/usr/bin/env node
// Сбор и разметка поисковых запросов по PPF PROFI.
//
// Команды:
//   webmaster [--from YYYY-MM-DD] [--to YYYY-MM-DD]   запросы сайта из Яндекс Вебмастера (API)
//   import <файл.csv>                                 нормализация выгрузки (Wordstat, Вебмастер)
//   classify <файл.csv>                               группа, интент и релевантность по rules.json
//
// Токен: переменная окружения YANDEX_WEBMASTER_TOKEN (OAuth-токен, scope webmaster:hostinfo).
// Токен в чат и в git не класть. Результаты пишутся в ./keywords-out/ (в .gitignore).
//
// Яндекс Wordstat API требует одобрения Яндекс Директ, поэтому здесь частотность берётся
// из ручной выгрузки Wordstat (команда import) и не запрашивается напрямую.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = JSON.parse(readFileSync(join(HERE, "rules.json"), "utf8"));
const OUT_DIR = join(process.cwd(), "keywords-out");
const HOST_MATCH = "ppfprofi.ru";
const API = "https://api.webmaster.yandex.net/v4";

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function save(name, rows, header) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, name);
  const lines = [header.join(";"), ...rows.map((r) => header.map((h) => String(r[h] ?? "").replace(/;/g, ",")).join(";"))];
  writeFileSync(path, "﻿" + lines.join("\n"), "utf8");
  return path;
}

// ---- CSV ----
function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/)[0] || "";
  const sep = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")));
  return rows;
}

function findCol(header, words, fallback) {
  const idx = header.findIndex((h) => words.some((w) => h.toLowerCase().includes(w)));
  return idx >= 0 ? idx : fallback;
}

function toNum(v) {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function readQueries(file) {
  const rows = parseCsv(readFileSync(file, "utf8"));
  if (rows.length < 2) throw new Error("В файле нет строк с данными");
  const header = rows[0];
  const qCol = findCol(header, ["запрос", "query", "фраза", "phrase", "текст"], 0);
  const fCol = findCol(header, ["частот", "спрос", "показ", "freq", "shows", "demand"], header.length - 1);
  const cCol = findCol(header, ["клик", "click"], -1);
  return rows.slice(1).map((r) => ({
    query: (r[qCol] || "").toLowerCase().replace(/\s+/g, " ").trim(),
    freq: toNum(r[fCol]),
    clicks: cCol >= 0 ? toNum(r[cCol]) : "",
  })).filter((r) => r.query);
}

// ---- Классификация ----
function classify(query) {
  const q = query.toLowerCase();
  const excluded = RULES.exclude.some((w) => q.includes(w));
  const included = RULES.include.some((w) => q.includes(w));
  let group = "прочее";
  for (const [name, words] of Object.entries(RULES.groups)) {
    if (words.some((w) => q.includes(w))) { group = name; break; }
  }
  let intent = "общий";
  for (const [name, words] of Object.entries(RULES.intent)) {
    if (words.some((w) => q.includes(w))) { intent = name; break; }
  }
  const relevant = !excluded && included ? "да" : excluded ? "нет (исключено)" : "проверить";
  return { group, intent, relevant };
}

// ---- Команды ----
async function webmaster(opts) {
  const token = process.env.YANDEX_WEBMASTER_TOKEN;
  if (!token) {
    console.error("Нет YANDEX_WEBMASTER_TOKEN. Получи OAuth-токен на oauth.yandex.ru (scope: webmaster:hostinfo) и передай в переменную окружения.");
    process.exit(1);
  }
  const headers = { Authorization: `OAuth ${token}` };
  const get = async (path, params = {}) => {
    const url = new URL(API + path);
    for (const [k, v] of Object.entries(params)) {
      for (const x of [].concat(v)) url.searchParams.append(k, x);
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
    return res.json();
  };

  const { user_id } = await get("/user");
  const { hosts } = await get(`/user/${user_id}/hosts`);
  const host = hosts.find((h) => (h.ascii_host_url || h.unicode_host_url || "").includes(HOST_MATCH));
  if (!host) throw new Error(`Сайт ${HOST_MATCH} не найден в аккаунте Вебмастера`);

  const rows = [];
  let offset = 0;
  const limit = 500;
  for (;;) {
    const data = await get(`/user/${user_id}/hosts/${encodeURIComponent(host.host_id)}/search-queries/popular`, {
      order_by: "TOTAL_SHOWS",
      query_indicator: ["TOTAL_SHOWS", "TOTAL_CLICKS", "AVG_CLICK_POSITION"],
      date_from: opts.from || daysAgo(90),
      date_to: opts.to || daysAgo(1),
      offset: String(offset),
      limit: String(limit),
    });
    for (const q of data.queries || []) {
      rows.push({
        query: (q.query_text || "").toLowerCase(),
        freq: q.indicators?.TOTAL_SHOWS ?? "",
        clicks: q.indicators?.TOTAL_CLICKS ?? "",
        avg_position: q.indicators?.AVG_CLICK_POSITION ?? "",
      });
    }
    if (!data.queries || data.queries.length < limit) break;
    offset += limit;
  }
  const path = save("webmaster.csv", rows, ["query", "freq", "clicks", "avg_position"]);
  console.log(`Готово: ${rows.length} запросов -> ${path}`);
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function importFile(file) {
  const rows = readQueries(file).sort((a, b) => b.freq - a.freq);
  const uniq = [...new Map(rows.map((r) => [r.query, r])).values()];
  const path = save(`import-${basename(file, ".csv")}.csv`, uniq, ["query", "freq", "clicks"]);
  console.log(`Импортировано ${uniq.length} уникальных запросов -> ${path}`);
}

function classifyFile(file) {
  const rows = readQueries(file).map((r) => ({ ...r, ...classify(r.query) }));
  rows.sort((a, b) => (a.relevant === "да" ? 0 : 1) - (b.relevant === "да" ? 0 : 1) || b.freq - a.freq);
  const path = save(`classified-${basename(file, ".csv")}.csv`, rows, ["query", "freq", "clicks", "group", "intent", "relevant"]);
  const ok = rows.filter((r) => r.relevant === "да").length;
  console.log(`Размечено ${rows.length}, релевантных ${ok}, на проверку ${rows.filter((r) => r.relevant === "проверить").length} -> ${path}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const opts = args(rest);
const usage = "Использование: collect.mjs webmaster [--from D] [--to D] | import <файл> | classify <файл>";

try {
  if (cmd === "webmaster") await webmaster(opts);
  else if (cmd === "import" && opts._[0]) importFile(opts._[0]);
  else if (cmd === "classify" && opts._[0]) classifyFile(opts._[0]);
  else { console.log(usage); process.exit(cmd ? 1 : 0); }
} catch (e) {
  console.error("Ошибка:", e.message);
  process.exit(1);
}
