import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
const path = process.env.AUDIT_LOG_PATH || "/data/audit.jsonl";
export async function audit(event) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n", { mode: 0o600 });
}
