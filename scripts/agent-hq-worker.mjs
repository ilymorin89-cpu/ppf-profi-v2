import postgres from "postgres";
import { randomUUID } from "node:crypto";

const role = process.env.AGENT_ROLE;
const workerId = process.env.AGENT_WORKER_ID || `${role || "worker"}-${process.pid}`;
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.AGENT_MODEL;
const databaseUrl = process.env.DATABASE_URL;
const maxOutputTokens = Number(process.env.AGENT_MAX_OUTPUT_TOKENS || 1200);
const maxModelTurns = 4;
const pollMs = Number(process.env.AGENT_POLL_MS || 5000);

const allowedRoles = ["coordinator","web_engineer","seo","geo","growth","analytics","qa_security"];
if (!role || !databaseUrl || !apiKey || !model || !allowedRoles.includes(role)) {
  console.error("Required: AGENT_ROLE, DATABASE_URL, OPENAI_API_KEY, AGENT_MODEL");
  process.exit(1);
}
if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 64 || maxOutputTokens > 8192) {
  throw new Error("AGENT_MAX_OUTPUT_TOKENS must be an integer between 64 and 8192");
}
const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 });
let stopping = false;
const roleInstructions = {
  coordinator: "Coordinate work. Break objectives into verifiable subtasks and route them to the correct specialist. Do not claim work was done unless evidence is present.",
  web_engineer: "Inspect and reason about website engineering tasks. Never claim to have changed or deployed code unless a tool result proves it.",
  seo: "Audit technical and on-page SEO. Separate observed facts from hypotheses. Include URLs, evidence, impact and prioritized fixes.",
  geo: "Improve discoverability in AI answers and local search. Avoid guarantees; distinguish measured evidence from recommendations.",
  growth: "Focus on qualified PPF PROFI leads and conversion. Prefer measurable experiments over vanity metrics.",
  analytics: "Analyze tracking and funnel data. Never invent metrics; explicitly identify missing instrumentation or data.",
  qa_security: "Independently challenge assumptions, check acceptance criteria, security and regressions. Return blockers separately from minor issues."
};
const instructions = roleInstructions[role] || "Complete the assigned specialist task rigorously. State evidence, uncertainty, limitations and next action.";

function outputText(response) {
  const parts = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && part.text) parts.push(part.text);
    }
  }
  return parts.join("\n").trim();
}

async function claim() {
  return sql.begin(async tx => {
    const [task] = await tx`
      WITH candidate AS (
        SELECT id FROM agent_tasks
        WHERE assigned_role=${role} AND status='queued' AND attempts < max_attempts
        ORDER BY priority,created_at FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE agent_tasks t SET status='claimed',lease_owner=${workerId},
        lease_until=now()+interval '3 minutes',attempts=t.attempts+1,updated_at=now()
      FROM candidate WHERE t.id=candidate.id
      RETURNING t.id,t.parent_task_id,t.title,t.objective,t.expected_output,t.acceptance_criteria,t.attempts,t.max_attempts,t.budget_limit_microusd
    `;
    return task || null;
  });
}

async function runTask(task) {
  const estimatedInputTokens = Math.ceil((task.objective.length + task.title.length + task.expected_output.length + JSON.stringify(task.acceptance_criteria || []).length + 40000) / 4);
  const [run] = await sql.begin(async tx => {
    const [budget] = await tx`SELECT * FROM agent_budget_config WHERE id=1 FOR UPDATE`;
    if (!budget || !budget.enabled || budget.daily_cap_microusd <= 0 || budget.monthly_cap_microusd <= 0 || budget.per_run_cap_microusd <= 0) {
      throw new Error("Agent budget is disabled or has zero caps; refusing model call");
    }
    const estimate = Math.ceil((estimatedInputTokens * maxModelTurns * Number(budget.input_price_per_million_microusd) + maxOutputTokens * maxModelTurns * Number(budget.output_price_per_million_microusd)) / 1000000);
    if (estimate <= 0 || estimate > Number(budget.per_run_cap_microusd) || (Number(task.budget_limit_microusd) > 0 && estimate > Number(task.budget_limit_microusd))) {
      throw new Error("Estimated request exceeds per-run or task budget");
    }
    const [totals] = await tx`SELECT
      COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('day',now())),0) AS daily,
      COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('month',now())),0) AS monthly
      FROM agent_runs`;
    if (Number(totals.daily) + estimate > Number(budget.daily_cap_microusd) || Number(totals.monthly) + estimate > Number(budget.monthly_cap_microusd)) {
      throw new Error("Daily or monthly agent budget exhausted; refusing model call");
    }
    const [created] = await tx`INSERT INTO agent_runs
      (task_id,role,worker_id,provider,model,status,cost_microusd)
      VALUES (${task.id},${role},${workerId},'openai',${model},'running',${estimate}) RETURNING id`;
    return created;
  });
  const heartbeat = setInterval(async () => {
    try {
      const [lease] = await sql`UPDATE agent_tasks SET status='running',
        lease_until=now()+interval '3 minutes',updated_at=now()
        WHERE id=${task.id} AND lease_owner=${workerId} AND status IN ('claimed','running')
        RETURNING id`;
      if (!lease) stopping = true;
    } catch (error) {
      console.error("Heartbeat failed:", error instanceof Error ? error.message : error);
      stopping = true;
    }
  }, 45_000);
  heartbeat.unref?.();

  try {
    const inbox = await sql`SELECT from_role,kind,left(body,1000) AS body,created_at FROM agent_messages WHERE to_role=${role} AND (task_id=${task.id} OR task_id=${task.parent_task_id || task.id} OR task_id IS NULL) ORDER BY created_at DESC LIMIT 6`;
    const siblingArtifacts = task.parent_task_id ? await sql`SELECT a.id,a.created_by,a.title,left(a.content,1500) AS content FROM agent_artifacts a JOIN agent_tasks c ON c.id=a.task_id WHERE c.parent_task_id=${task.parent_task_id} ORDER BY a.created_at LIMIT 5` : [];
    const prompt = [
      `Task: ${task.title}`,
      `Objective: ${task.objective}`,
      `Expected output: ${task.expected_output}`,
      `Acceptance criteria: ${JSON.stringify(task.acceptance_criteria || [])}`,
      `Attempt: ${task.attempts} of ${task.max_attempts}`,
      `Recent inter-agent messages: ${JSON.stringify(inbox)}`,
      `Parent task specialist artifacts for review: ${JSON.stringify(siblingArtifacts)}`,
      "",
      "Return a concise, evidence-backed result. Clearly label facts, assumptions, unknowns, blockers and next action. Do not claim to have accessed systems, changed files, published content, contacted customers or spent money unless an authorized tool actually did so. You have no tools in this worker process; if another role must act, explain the handoff needed."
    ].join("\n");
    const allowedRoles = ["coordinator","web_engineer","seo","geo","growth","analytics","qa_security"];
    const tools = [
      {
        type: "function", name: "send_message",
        description: "Send a direct message to another specialist agent. Use this to request evidence, challenge a finding, or hand off work.",
        parameters: {
          type: "object", additionalProperties: false,
          properties: {
            to_role: { type: "string", enum: allowedRoles },
            kind: { type: "string", enum: ["request","question","objection","handoff","status"] },
            body: { type: "string" }
          },
          required: ["to_role","kind","body"]
        },
        strict: true
      },
      {
        type: "function", name: "request_approval",
        description: "Create an approval request for a restricted external or production action. This only requests permission; it does not perform the action.",
        parameters: {
          type: "object", additionalProperties: false,
          properties: {
            action: { type: "string", enum: ["publish_site","deploy_production","send_external_message","launch_ad","spend_money","database_migration","delete_data","other"] },
            reason: { type: "string" },
            payload: { type: "string" }
          },
          required: ["action","reason","payload"]
        },
        strict: true
      },
      {
        type: "function", name: "delegate_task",
        description: "Create a bounded specialist task. Only coordinator may use this. Delegate only work needed to achieve the parent objective.",
        parameters: {
          type: "object", additionalProperties: false,
          properties: {
            role: { type: "string", enum: allowedRoles.filter(item => item !== "coordinator") },
            title: { type: "string" },
            objective: { type: "string" },
            acceptance_criteria: { type: "array", items: { type: "string" } },
            priority: { type: "integer" }
          },
          required: ["role","title","objective","acceptance_criteria","priority"]
        },
        strict: true
      }
    ];
    let responseInput = prompt;
    let data;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (let turn = 0; turn < maxModelTurns; turn++) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          instructions: `You are the ${role} specialist agent for PPF PROFI. ${instructions} Use tools for direct agent-to-agent communication. Never delegate unrelated work. QA should independently challenge evidence and message coordinator with objections.`,
          input: responseInput,
          tools,
          max_output_tokens: maxOutputTokens
        }),
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1200);
        throw new Error(`OpenAI API ${response.status}: ${detail}`);
      }
      data = await response.json();
      totalInputTokens += Number(data.usage?.input_tokens || 0);
      totalOutputTokens += Number(data.usage?.output_tokens || 0);
      const calls = (data.output || []).filter(item => item.type === "function_call");
      if (!calls.length) break;
      const outputs = [];
      for (const call of calls) {
        const args = JSON.parse(call.arguments || "{}");
        let result;
        if (call.name === "send_message") {
          if (!allowedRoles.includes(args.to_role) || !["request","question","objection","handoff","status"].includes(args.kind) || typeof args.body !== "string" || !args.body.trim()) {
            throw new Error("Invalid send_message arguments");
          }
          const [message] = await sql`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${task.id},${randomUUID()},${role},${args.to_role},${args.kind},${args.body.slice(0,8000)},${randomUUID()})
            RETURNING id,to_role,kind`;
          result = message;
        } else if (call.name === "request_approval") {
          const actions = ["publish_site","deploy_production","send_external_message","launch_ad","spend_money","database_migration","delete_data","other"];
          if (!actions.includes(args.action) || typeof args.reason !== "string" || !args.reason.trim() || typeof args.payload !== "string") {
            throw new Error("Invalid request_approval arguments");
          }
          const [approval] = await sql`INSERT INTO agent_approvals
            (task_id,action,requested_by,payload,status)
            VALUES (${task.id},${args.action},${role},${JSON.stringify({ reason: args.reason.slice(0,3000), payload: JSON.parse(args.payload) })}::jsonb,'pending')
            RETURNING id,task_id,action,status,created_at`;
          await sql`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${task.id},${randomUUID()},${role},'coordinator','approval_request',${JSON.stringify(approval)},${randomUUID()})`;
          result = approval;
        } else if (call.name === "delegate_task") {
          if (role !== "coordinator") throw new Error("Only coordinator may delegate tasks");
          if (!allowedRoles.includes(args.role) || args.role === "coordinator" || typeof args.title !== "string" || typeof args.objective !== "string") {
            throw new Error("Invalid delegate_task arguments");
          }
          const [child] = await sql`INSERT INTO agent_tasks
            (parent_task_id,assigned_role,title,objective,expected_output,acceptance_criteria,priority,created_by)
            VALUES (${task.id},${args.role},${args.title.slice(0,240)},${args.objective.slice(0,8000)},
              'Evidence-backed result with findings and next action',${JSON.stringify(args.acceptance_criteria || [])}::jsonb,
              ${Math.max(1,Math.min(1000,Number(args.priority) || 100))},'coordinator')
            RETURNING id,assigned_role,title,status`;
          result = child;
        } else {
          throw new Error(`Unsupported tool: ${call.name}`);
        }
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      responseInput = [...(data.output || []), ...outputs];
    }
    let result = outputText(data || {});
    if (!result && role === "coordinator") {
      const children = await sql`SELECT id,assigned_role,title,status FROM agent_tasks WHERE parent_task_id=${task.id} ORDER BY created_at`;
      if (children.length) result = `Delegated ${children.length} specialist task(s). The supervisor will wait for their completion and independent QA before closing this parent task.\n${JSON.stringify(children)}`;
    }
    if (!result) throw new Error("Model returned no text output");
    const usage = { input_tokens: totalInputTokens, output_tokens: totalOutputTokens };
    const [budget] = await sql`SELECT input_price_per_million_microusd,output_price_per_million_microusd FROM agent_budget_config WHERE id=1`;
    const actualCost = Math.ceil((usage.input_tokens * Number(budget.input_price_per_million_microusd) + usage.output_tokens * Number(budget.output_price_per_million_microusd)) / 1000000);
    await sql.begin(async tx => {
      const [owned] = await tx`UPDATE agent_tasks SET
        status=CASE WHEN ${role}='coordinator' AND EXISTS (SELECT 1 FROM agent_tasks child WHERE child.parent_task_id=${task.id}) THEN 'review' ELSE 'done' END,
        completed_at=CASE WHEN ${role}='coordinator' AND EXISTS (SELECT 1 FROM agent_tasks child WHERE child.parent_task_id=${task.id}) THEN NULL ELSE now() END,
        lease_owner=NULL,lease_until=NULL,updated_at=now()
        WHERE id=${task.id} AND lease_owner=${workerId} AND status IN ('claimed','running')
        RETURNING id,title,status`;
      if (!owned) throw new Error("Lease lost before completion; result not committed");
      await tx`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content,evidence)
        VALUES (${task.id},${role},'result',${task.title},${result},'[]'::jsonb)`;
      await tx`UPDATE agent_runs SET status='succeeded',input_tokens=${usage.input_tokens || 0},
        output_tokens=${usage.output_tokens || 0},cost_microusd=${actualCost},finished_at=now() WHERE id=${run.id}`;
      await tx`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${task.id},${randomUUID()},${role},'coordinator','result',${result.slice(0,12000)},${randomUUID()})`;
    });
    console.log(JSON.stringify({ taskId: task.id, status: "done", inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql.begin(async tx => {
      await tx`UPDATE agent_tasks SET
        status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
        lease_owner=NULL,lease_until=NULL,updated_at=now()
        WHERE id=${task.id} AND lease_owner=${workerId}`;
      await tx`UPDATE agent_runs SET status='failed',error=${message.slice(0,4000)},finished_at=now() WHERE id=${run.id}`;
      await tx`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${task.id},${randomUUID()},${role},'coordinator','status',${message.slice(0,4000)},${randomUUID()})`;
    });
    console.error(`Task ${task.id} failed:`, message);
  } finally {
    clearInterval(heartbeat);
  }
}

try {
  const [startupBudget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd FROM agent_budget_config WHERE id=1`;
  if (!startupBudget || !startupBudget.enabled || Number(startupBudget.daily_cap_microusd) <= 0 || Number(startupBudget.monthly_cap_microusd) <= 0 || Number(startupBudget.per_run_cap_microusd) <= 0) {
    throw new Error("Agent budget is disabled or has zero caps; worker will not claim tasks");
  }
  const once = process.argv.includes("--once");
  while (!stopping) {
    const task = await claim();
    if (task) {
      try { await runTask(task); }
      catch (error) { console.error("Task setup failed; lease will expire and be recovered:", error instanceof Error ? error.message : error); }
    }
    else if (once) break;
    else await new Promise(resolve => setTimeout(resolve, pollMs));
    if (once) break;
  }
} finally {
  await sql.end({ timeout: 5 });
}
