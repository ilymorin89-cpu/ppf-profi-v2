import postgres from "postgres";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Set it in the worker environment; never commit it.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, idle_timeout: 20 });
const [command, ...args] = process.argv.slice(2);

async function main() {
  if (command === "enqueue") {
    const [role, title, objective] = args;
    if (!role || !title || !objective) throw new Error("Usage: enqueue <role> <title> <objective>");
    const [task] = await sql`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES (${role},${title},${objective},'Evidence-backed result and next action','owner') RETURNING id,status,assigned_role,title`;
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  if (command === "send") {
    const [from, to, taskId, kind, ...bodyParts] = args;
    const body = bodyParts.join(" ");
    if (!from || !to || !kind || !body) throw new Error("Usage: send <fromRole> <toRole> <taskId|-> <kind> <message>");
    const allowed = ["request","result","question","objection","handoff","approval_request","status"];
    if (!allowed.includes(kind)) throw new Error("Unsupported message kind");
    const [message] = await sql`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${taskId === "-" ? null : Number(taskId)},${randomUUID()},${from},${to},${kind},${body},${randomUUID()})
      RETURNING id,task_id,from_role,to_role,kind,body,created_at`;
    console.log(JSON.stringify(message, null, 2));
    return;
  }
  if (command === "inbox") {
    const [role] = args;
    if (!role) throw new Error("Usage: inbox <role>");
    const rows = await sql`SELECT id,task_id,from_role,to_role,kind,body,evidence,created_at
      FROM agent_messages WHERE to_role=${role} ORDER BY created_at DESC LIMIT 50`;
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "claim") {
    const [role, workerId] = args;
    if (!role || !workerId) throw new Error("Usage: claim <role> <workerId>");
    const rows = await sql.begin(async tx => tx`
      WITH candidate AS (
        SELECT id FROM agent_tasks
        WHERE assigned_role=${role} AND status='queued' AND attempts < max_attempts
        ORDER BY priority ASC, created_at ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE agent_tasks t SET status='claimed', lease_owner=${workerId},
        lease_until=now()+interval '3 minutes', attempts=t.attempts+1, updated_at=now()
      FROM candidate WHERE t.id=candidate.id
      RETURNING t.id,t.title,t.objective,t.expected_output,t.acceptance_criteria,t.attempts,t.max_attempts
    `);
    console.log(JSON.stringify(rows[0] ?? null, null, 2));
    return;
  }
  console.log("Agent HQ bus CLI\nCommands: enqueue, send, inbox, claim");
  console.log("This is a transport/queue utility, not an LLM agent runtime.");
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }
finally { await sql.end({ timeout: 5 }); }
