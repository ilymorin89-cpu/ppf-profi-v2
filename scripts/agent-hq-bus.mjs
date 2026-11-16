import postgres from "postgres";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Set it in the worker environment; never commit it.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, idle_timeout: 20 });
const [command, ...args] = process.argv.slice(2);

function required(value, label) {
  if (!value || !String(value).trim()) throw new Error(`Missing ${label}`);
  return String(value).trim();
}
function taskId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("taskId must be a positive integer");
  return id;
}

async function main() {
  if (command === "enqueue") {
    const [role, title, objective] = args;
    required(role, "role"); required(title, "title"); required(objective, "objective");
    const [task] = await sql`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES (${role},${title},${objective},'Evidence-backed result and next action','owner')
      RETURNING id,status,assigned_role,title,created_at`;
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  if (command === "send") {
    const [from, to, rawTaskId, kind, ...bodyParts] = args;
    const body = bodyParts.join(" ");
    required(from, "fromRole"); required(to, "toRole"); required(kind, "kind"); required(body, "message");
    const allowed = ["request","result","question","objection","handoff","approval_request","status"];
    if (!allowed.includes(kind)) throw new Error("Unsupported message kind");
    const id = rawTaskId === "-" ? null : taskId(rawTaskId);
    const [message] = await sql`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      VALUES (${id},${randomUUID()},${from},${to},${kind},${body},${randomUUID()})
      RETURNING id,task_id,from_role,to_role,kind,body,created_at`;
    console.log(JSON.stringify(message, null, 2));
    return;
  }
  if (command === "inbox") {
    const role = required(args[0], "role");
    const rows = await sql`SELECT id,task_id,from_role,to_role,kind,body,evidence,created_at
      FROM agent_messages WHERE to_role=${role} ORDER BY created_at DESC LIMIT 50`;
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "claim") {
    const role = required(args[0], "role");
    const workerId = required(args[1], "workerId");
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
      RETURNING t.id,t.title,t.objective,t.expected_output,t.acceptance_criteria,t.attempts,t.max_attempts,t.lease_until`);
    console.log(JSON.stringify(rows[0] ?? null, null, 2));
    return;
  }
  if (command === "heartbeat") {
    const workerId = required(args[0], "workerId");
    const id = taskId(args[1]);
    const [task] = await sql`UPDATE agent_tasks SET status='running',
      lease_until=now()+interval '3 minutes', updated_at=now()
      WHERE id=${id} AND lease_owner=${workerId} AND status IN ('claimed','running')
      RETURNING id,status,lease_until`;
    if (!task) throw new Error("Lease not owned by this worker or task is no longer active");
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  if (command === "complete") {
    const workerId = required(args[0], "workerId");
    const id = taskId(args[1]);
    const result = required(args.slice(2).join(" "), "result");
    const completed = await sql.begin(async tx => {
      const [task] = await tx`UPDATE agent_tasks SET status='done',completed_at=now(),
        lease_owner=NULL,lease_until=NULL,updated_at=now()
        WHERE id=${id} AND lease_owner=${workerId} AND status IN ('claimed','running')
        RETURNING id,assigned_role,title`;
      if (!task) throw new Error("Lease not owned by this worker or task is no longer active");
      const [artifact] = await tx`INSERT INTO agent_artifacts
        (task_id,created_by,artifact_type,title,content)
        VALUES (${id},${task.assigned_role},'result',${task.title},${result})
        RETURNING id,task_id,artifact_type,title,created_at`;
      return { task, artifact };
    });
    console.log(JSON.stringify(completed, null, 2));
    return;
  }
  if (command === "fail") {
    const workerId = required(args[0], "workerId");
    const id = taskId(args[1]);
    const reason = required(args.slice(2).join(" "), "failure reason");
    const [task] = await sql`UPDATE agent_tasks SET
      status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
      lease_owner=NULL,lease_until=NULL,updated_at=now()
      WHERE id=${id} AND lease_owner=${workerId} AND status IN ('claimed','running')
      RETURNING id,status,attempts,max_attempts`;
    if (!task) throw new Error("Lease not owned by this worker or task is no longer active");
    await sql`INSERT INTO agent_messages
      (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
      SELECT ${id},${randomUUID()},assigned_role,'coordinator','status',${reason},${randomUUID()}
      FROM agent_tasks WHERE id=${id}`;
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  if (command === "status") {
    const [tasks] = await sql`SELECT
      COUNT(*) FILTER (WHERE status='queued') AS queued,
      COUNT(*) FILTER (WHERE status IN ('claimed','running')) AS active,
      COUNT(*) FILTER (WHERE status='review') AS review,
      COUNT(*) FILTER (WHERE status='done') AS done,
      COUNT(*) FILTER (WHERE status IN ('blocked','dead_letter','cancelled')) AS blocked_or_dead
      FROM agent_tasks`;
    const [spend] = await sql`SELECT
      COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('day',now())),0) AS daily_microusd,
      COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('month',now())),0) AS monthly_microusd
      FROM agent_runs`;
    const [budget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd
      FROM agent_budget_config WHERE id=1`;
    const [approvals] = await sql`SELECT COUNT(*) AS pending FROM agent_approvals WHERE status='pending'`;
    console.log(JSON.stringify({ tasks, spend, budget: budget || null, pendingApprovals: approvals.pending }, null, 2));
    return;
  }
  if (command === "approvals") {
    const rows = await sql`SELECT id,task_id,action,requested_by,payload,created_at
      FROM agent_approvals WHERE status='pending' ORDER BY created_at ASC LIMIT 100`;
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "approve" || command === "reject") {
    const [rawId, decidedBy, ...noteParts] = args;
    const id = taskId(rawId);
    const actor = required(decidedBy, "decidedBy");
    const note = noteParts.join(" ").slice(0, 4000);
    const status = command === "approve" ? "approved" : "rejected";
    const [approval] = await sql`UPDATE agent_approvals
      SET status=${status},decided_by=${actor},decision_note=${note || null},decided_at=now()
      WHERE id=${id} AND status='pending'
      RETURNING id,task_id,action,status,decided_by,decision_note,decided_at`;
    if (!approval) throw new Error("Approval not found or already decided");
    console.log(JSON.stringify(approval, null, 2));
    return;
  }
  if (command === "recover") {
    const rows = await sql`UPDATE agent_tasks SET
      status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
      lease_owner=NULL,lease_until=NULL,updated_at=now()
      WHERE status IN ('claimed','running') AND lease_until < now()
      RETURNING id,assigned_role,status,attempts,max_attempts`;
    console.log(JSON.stringify({ recovered: rows.length, tasks: rows }, null, 2));
    return;
  }
  console.log(`Agent HQ bus CLI
Commands:
  enqueue <role> <title> <objective>
  send <fromRole> <toRole> <taskId|-> <kind> <message>
  inbox <role>
  claim <role> <workerId>
  heartbeat <workerId> <taskId>
  complete <workerId> <taskId> <result>
  fail <workerId> <taskId> <reason>
  recover

This is a PostgreSQL task/message transport. It does not call an LLM or run workers by itself.`);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }
finally { await sql.end({ timeout: 5 }); }
