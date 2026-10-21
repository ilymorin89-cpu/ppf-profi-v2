#!/usr/bin/env node
/**
 * Отправка адресов сайта в IndexNow (Яндекс, Bing и др.).
 *
 * Запуск после деплоя:   npm run indexnow
 * Проверка без отправки: npm run indexnow -- --dry-run
 *
 * Берёт все адреса из https://ppfprofi.ru/sitemap.xml и отправляет пачкой.
 * Ключ лежит в public/<ключ>.txt: IndexNow требует, чтобы файл открывался по адресу сайта.
 * Ключ не секрет, он публичен по замыслу протокола.
 */

const HOST = "ppfprofi.ru";
const KEY = "891c05e04bf799f1610987a9106b0625";
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const res = await fetch(SITEMAP, { headers: { "user-agent": "ppfprofi-indexnow/1.0" } });
  if (!res.ok) throw new Error(`sitemap: HTTP ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (urls.length === 0) throw new Error("В sitemap не найдено ни одного адреса");
  if (urls.length > 10000) throw new Error("Больше 10 000 адресов: разбейте список");

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  };

  console.log(`Адресов в sitemap: ${urls.length}`);
  if (dryRun) {
    console.log("Сухой прогон, ничего не отправлено. Первые адреса:");
    console.log(urls.slice(0, 5).join("\n"));
    return;
  }

  const send = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  // 200 — принято; 202 — ключ ещё проверяется; 403 — файл ключа не найден; 422 — адреса не с этого хоста.
  console.log(`IndexNow: HTTP ${send.status} ${send.statusText}`);
  if (![200, 202].includes(send.status)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
