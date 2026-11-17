import dns from "node:dns/promises";
import net from "node:net";
import postgres from "postgres";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

export function classifyAddress(address) {
  if (address === "127.0.0.1" || address === "::1") return "loopback";
  if (address.startsWith("10.") || address.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address) || address.startsWith("fd") ||
      address.startsWith("fc") || address.startsWith("fe80:")) return "private";
  return "public-or-provider-routed";
}

export function safeConnectionTarget(rawUrl) {
  const url = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database URL must use postgres:// or postgresql://");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (database !== "agent_hq") {
    throw new Error("Refusing to probe a database other than agent_hq");
  }
  const port = Number(url.port || 5432);
  if (port !== 5432) throw new Error("Refusing unexpected PostgreSQL port");
  return {
    host: url.hostname,
    port,
    database,
    username: decodeURIComponent(url.username),
    addressType: isIP(url.hostname) ? classifyAddress(url.hostname) : "hostname"
  };
}

function tcpProbe(host, port, timeoutMs = 5000) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, code: "CONNECT_TIMEOUT" }));
    socket.once("error", error => finish({ ok: false, code: error.code || "SOCKET_ERROR" }));
  });
}

export async function runConnectivityCheck(rawUrl, { requireTls = true } = {}) {
  const target = safeConnectionTarget(rawUrl);
  let addresses;
  try {
    addresses = isIP(target.host)
      ? [{ address: target.host, family: isIP(target.host) }]
      : await dns.lookup(target.host, { all: true, verbatim: true });
  } catch (error) {
    return { status: "FAIL", stage: "dns", code: error.code || "DNS_ERROR", target };
  }

  const tcp = await tcpProbe(target.host, target.port);
  if (!tcp.ok) {
    return {
      status: "FAIL", stage: "tcp", code: tcp.code, target,
      resolvedAddresses: addresses.map(item => ({
        address: item.address, addressType: classifyAddress(item.address)
      }))
    };
  }

  const sql = postgres(rawUrl, {
    max: 1, connect_timeout: 5, idle_timeout: 3,
    ssl: requireTls ? "require" : undefined,
    onnotice: () => {}
  });
  try {
    const [identity] = await sql`
      SELECT current_database() AS database_name,
        session_user AS login,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port,
        COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS tls
    `;
    if (identity.database_name !== "agent_hq") {
      return { status: "FAIL", stage: "database-identity", code: "UNEXPECTED_DATABASE", target };
    }
    if (requireTls && identity.tls !== true) {
      return { status: "FAIL", stage: "tls", code: "TLS_NOT_ACTIVE", target, identity };
    }
    return {
      status: "PASS", stage: "postgres-authenticated",
      target: { ...target, username: identity.login },
      resolvedAddresses: addresses.map(item => ({
        address: item.address, addressType: classifyAddress(item.address)
      })),
      identity
    };
  } catch (error) {
    return {
      status: "FAIL", stage: "postgres-authentication-or-tls",
      code: error.code || "POSTGRES_CONNECT_ERROR", target
    };
  } finally {
    await sql.end({ timeout: 3 }).catch(() => {});
  }
}

async function main() {
  const rawUrl = process.env.AGENT_HQ_DATABASE_URL || process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error(JSON.stringify({
      status: "FAIL", stage: "configuration", code: "DATABASE_URL_MISSING",
      expectedVariables: ["AGENT_HQ_DATABASE_URL", "DATABASE_URL"],
      secretsPrinted: false
    }, null, 2));
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    result = await runConnectivityCheck(rawUrl, {
      requireTls: process.env.AGENT_HQ_DB_REQUIRE_TLS !== "false"
    });
  } catch (error) {
    result = {
      status: "FAIL", stage: "configuration",
      code: "INVALID_DATABASE_TARGET", detail: error.message
    };
  }
  console.log(JSON.stringify({ ...result, secretsPrinted: false }, null, 2));
  if (result.status !== "PASS") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
