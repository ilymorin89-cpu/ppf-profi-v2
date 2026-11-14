import postgres from "postgres";
import { randomUUID } from "node:crypto";

const role = process.env.AGENT_ROLE;
const workerId = process.env.AGENT_WORKER_ID || `${role || "worker"}-${process.pid}`;
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.AGENT_MODEL;
const databaseUrl = process.env.DATABASE_URL;
const maxOutputTokens = Number(process.env.AGENT_MAX_OUTPUT_TOKENS || 1200);
const pollMs = Number(process.env.AGENT_POLL_MS || 5000);

if (!role || !databaseUrl || !apiKey || !model) {
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
  const [run] = await sql`INSERT INTO agent_runs (task_id,role,worker_id,provider,model,status)
    VALUES (${task.id},${role},${workerId},'openai',${model},'running') RETURNING id`;
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
    const inbox = await sql`SELECT from_role,kind,body,created_at FROM agent_messages WHERE to_role=${role} AND (task_id=${task.id} OR task_id=${task.parent_task_id || task.id} OR task_id IS NULL) ORDER BY created_at DESC LIMIT 12`;\n    const siblingArtifacts = task.parent_task_id ? await sql`SELECT a.id,a.created_by,a.title,a.content FROM agent_artifacts a JOIN agent_tasks c ON c.id=a.task_id WHERE c.parent_task_id=${task.parent_task_id} ORDER BY a.created_at LIMIT 20` : [];\n    const prompt = [
      `Task: ${task.title}`,
      `Objective: ${task.objective}`,
      `Expected output: ${task.expected_output}`,
      `Acceptance criteria: ${JSON.stringify(task.acceptance_criteria || [])}`,
      `Attempt: ${task.attempts} of ${task.max_attempts}`,\n      `Recent inter-agent messages: ${JSON.stringify(inbox)}`,\n      `Parent task specialist artifacts for review: ${JSON.stringify(siblingArtifacts)}`,
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
    for (let turn = 0; turn < 7; turn++) {
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
    const result = outputText(data || {});
    if (!result) throw new Error("Model returned no text output");
    const usage = data.usage || {};
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
        output_tokens=${usage.output_tokens || 0},finished_at=now() WHERE id=${run.id}`;
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
  const once = process.argv.includes("--once");
  while (!stopping) {
    const task = await claim();
    if (task) await runTask(task);
    else if (once) break;
    else await new Promise(resolve => setTimeout(resolve, pollMs));
    if (once) break;
  }
} finally {
  await sql.end({ timeout: 5 });
}
