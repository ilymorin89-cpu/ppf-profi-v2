import postgres from "postgres";
import { readFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { requireAgentRole, resolveApproverIdentity } from "./agent-hq-helpers.mjs";

const [command, ...args] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Set it in the worker environment; never commit it.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, idle_timeout: 20 });
let operatorSql;
if (["approvals", "approve", "reject"].includes(command)) {
  const operatorUrl = process.env.AGENT_HQ_OPERATOR_DATABASE_URL;
  if (!operatorUrl) throw new Error("AGENT_HQ_OPERATOR_DATABASE_URL is required for approval decisions; shared DATABASE_URL is never used.");
  let mainUsername;
  let operatorUsername;
  try {
    mainUsername = decodeURIComponent(new URL(url).username);
    operatorUsername = decodeURIComponent(new URL(operatorUrl).username);
  } catch {
    throw new Error("DATABASE_URL and AGENT_HQ_OPERATOR_DATABASE_URL must be valid PostgreSQL URLs.");
  }
  if (!mainUsername || operatorUsername !== "agent_operator" || operatorUsername === mainUsername) {
    throw new Error("Approval decisions require a distinct PostgreSQL login named agent_operator.");
  }
  operatorSql = postgres(operatorUrl, { max: 1, idle_timeout: 20 });
}

function required(value, label) {
  if (!value || !String(value).trim()) throw new Error(`Missing ${label}`);
  return String(value).trim();
}
function taskId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("taskId must be a positive integer");
  return id;
}

async function assertAuthenticatedRole(role) {
  const [identity] = await sql`SELECT session_user AS login`;
  if (identity?.login !== "agent_" + role) {
    throw new Error("Command requires the authenticated PostgreSQL LOGIN agent_" + role + "; shared or elevated logins are forbidden.");
  }
}

async function assertTaskRole(id) {
  const [task] = await sql`SELECT assigned_role FROM agent_tasks WHERE id=${id}`;
  if (!task?.assigned_role) throw new Error("Task is not visible to this authenticated role.");
  await assertAuthenticatedRole(task.assigned_role);
}

async function main() {
  if (["enqueue", "status", "recover"].includes(command)) {
    throw new Error('Command "' + command + '" is disabled until a dedicated least-privilege authorization path is implemented.');
  }
  if (command === "enqueue") {
    const [role, title, objective] = args;
    requireAgentRole(required(role, "role")); required(title, "title"); required(objective, "objective");
    const [task] = await sql`INSERT INTO agent_tasks (assigned_role,title,objective,expected_output,created_by)
      VALUES (${role},${title},${objective},'Evidence-backed result and next action','owner')
      RETURNING id,status,assigned_role,title,created_at`;
    console.log(JSON.stringify(task, null, 2));
    return;
  }
  if (command === "send") {
    const [from, to, rawTaskId, kind, ...bodyParts] = args;
    const body = bodyParts.join(" ");
    requireAgentRole(required(from, "fromRole"), "fromRole"); requireAgentRole(required(to, "toRole"), "toRole"); required(kind, "kind"); required(body, "message");
    await assertAuthenticatedRole(from);
    const allowed = ["request","result","question","objection","handoff","approval_request","status"];
    if (!allowed.includes(kind)) throw new Error("Unsupported message kind");
    const id = rawTaskId === "-" ? null : taskId(rawTaskId);
    const message = await sql.begin(async tx => {
      await tx`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${id},${randomUUID()},${from},${to},${kind},${body},${randomUUID()})`;
      // INSERT is allowed for the authenticated sender, but SELECT RLS only
      // exposes recipient inbox rows. Read the generated id from this session's
      // sequence instead of RETURNING the newly inserted, non-inbox row.
      const [created] = await tx`SELECT currval('agent_messages_id_seq') AS id`;
      return { id: created.id, task_id: id, from_role: from, to_role: to, kind, body };
    });
    console.log(JSON.stringify(message, null, 2));
    return;
  }
  if (command === "inbox") {
    const role = requireAgentRole(required(args[0], "role"));
    await assertAuthenticatedRole(role);
    const rows = await sql`SELECT id,task_id,from_role,to_role,kind,body,evidence,created_at
      FROM agent_messages WHERE to_role=${role} ORDER BY created_at DESC LIMIT 50`;
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "claim") {
    const role = requireAgentRole(required(args[0], "role"));
    await assertAuthenticatedRole(role);
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
    await assertTaskRole(id);
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
    await assertTaskRole(id);
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
    await assertTaskRole(id);
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
    const rows = await operatorSql`SELECT id,task_id,action,requested_by,payload,created_at
      FROM agent_approvals WHERE status='pending' ORDER BY created_at ASC LIMIT 100`;
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "approve" || command === "reject") {
    const [rawId, ...noteParts] = args;
    const id = taskId(rawId);
    const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
    let allowedUids;
    if (process.env.NODE_ENV === "test") {
      allowedUids = process.env.AGENT_HQ_TEST_APPROVER_UIDS;
    } else {
      const allowlistPath = "/etc/ppf-agent-hq/approver-uids";
      const metadata = statSync(allowlistPath);
      if (metadata.uid !== 0 || (metadata.mode & 0o022) !== 0) {
        throw new Error("Approver allowlist must be owned by root and not group/world writable");
      }
      allowedUids = readFileSync(allowlistPath, "utf8");
    }
    const actor = resolveApproverIdentity({ uid, allowedUids });
    const note = noteParts.join(" ").slice(0, 4000);
    const status = command === "approve" ? "approved" : "rejected";
    const [approval] = await operatorSql`UPDATE agent_approvals
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
  approvals (requires distinct agent_operator LOGIN)
  approve <approvalId> [note] (requires root-owned /etc/ppf-agent-hq/approver-uids)
  reject <approvalId> [note] (requires root-owned /etc/ppf-agent-hq/approver-uids)
  inbox <role>
  claim <role> <workerId>
  heartbeat <workerId> <taskId>
  complete <workerId> <taskId> <result>
  fail <workerId> <taskId> <reason>
  recover (disabled pending least-privilege lifecycle function)

Global enqueue/status/recover commands are fail-closed until separately authorized; approvals uses the isolated agent_operator LOGIN.
This is a PostgreSQL task/message transport. It does not call an LLM or run workers by itself.`);
}
try { await main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }
finally {
  if (operatorSql) await operatorSql.end({ timeout: 5 });
  await sql.end({ timeout: 5 });
}
