import { createServer } from "node:http";
import postgres from "postgres";

const port = Number(process.env.PORT || 8080);
const databaseUrl = process.env.DATABASE_URL;
const healthIntervalMs = Number(process.env.AGENT_HQ_HEALTH_INTERVAL_MS || 15_000);

let databaseReady = false;
let lastDatabaseCheck = null;
let databaseClient = null;
let stopping = false;

if (databaseUrl) {
  databaseClient = postgres(databaseUrl, {
    connect_timeout: 5,
    idle_timeout: 10,
    max: 1,
    onnotice: () => {},
  });
} else {
  console.error("[db-check] DATABASE_URL is not set");
}

async function checkDatabase() {
  if (!databaseClient || stopping) {
    databaseReady = false;
    lastDatabaseCheck = new Date().toISOString();
    return;
  }

  try {
    await databaseClient`SELECT 1`;
    databaseReady = true;
  } catch (error) {
    databaseReady = false;
    console.error(`[db-check] connection failed code=${error?.code || "unknown"}`);
  } finally {
    lastDatabaseCheck = new Date().toISOString();
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const path = new URL(req.url || "/", "http://localhost").pathname;

  if (path === "/live") {
    sendJson(res, 200, { service: "ppf-agent-hq", status: "alive" });
    return;
  }

  if (path === "/ready" || path === "/health" || path === "/") {
    const statusCode = databaseReady ? 200 : 503;
    sendJson(res, statusCode, {
      service: "ppf-agent-hq",
      status: databaseReady ? "ready" : "not_ready",
      checks: { database: databaseReady ? "ok" : "unavailable" },
      last_database_check: lastDatabaseCheck,
    });
    return;
  }

  sendJson(res, 404, { error: "not_found" });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Agent HQ health endpoint listening on ${port}`);
  void checkDatabase();
});

const healthTimer = setInterval(() => void checkDatabase(), healthIntervalMs);
healthTimer.unref();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(healthTimer);
  console.log(`Agent HQ health endpoint stopping after ${signal}`);

  server.close(async () => {
    if (databaseClient) {
      await databaseClient.end({ timeout: 5 }).catch(() => {});
    }
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => void shutdown(signal));
}
