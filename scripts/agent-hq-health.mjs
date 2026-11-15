import { createServer } from "node:http";
import postgres from "postgres";

const port = Number(process.env.PORT || 8080);

async function checkDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[db-check] DATABASE_URL is not set");
    return;
  }

  const sql = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 1,
    max: 1,
  });

  try {
    const [row] = await sql`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        inet_server_addr()::text AS server_ip,
        inet_server_port() AS server_port
    `;
    console.log(
      `[db-check] connected database=${row.database_name} user=${row.database_user} server=${row.server_ip}:${row.server_port}`
    );
  } catch (error) {
    // Never print connection strings or credentials to application logs.
    console.error(`[db-check] connection failed code=${error?.code || "unknown"}`);
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

const server = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ service: "ppf-agent-hq", status: "ok" }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Agent HQ health endpoint listening on ${port}`);
  void checkDatabase();
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
