// Хелпер для test-ppf.ps1: читает и чистит тестовые заявки (client_name LIKE 'ZZ TEST%').
//   node tests/db-leads.cjs get <publicNumber>  -> JSON строки leads
//   node tests/db-leads.cjs cleanup            -> {"deleted": N}
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

(async () => {
  try {
    const [cmd, arg] = process.argv.slice(2);
    if (cmd === "get") {
      const rows = await sql`select * from leads where public_number = ${arg ?? ""}`;
      process.stdout.write(JSON.stringify(rows[0] ?? null));
    } else if (cmd === "cleanup") {
      const rows = await sql`delete from leads where client_name like 'ZZ TEST%' returning id`;
      process.stdout.write(JSON.stringify({ deleted: rows.length }));
    } else {
      throw new Error("usage: get <publicNumber> | cleanup");
    }
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
