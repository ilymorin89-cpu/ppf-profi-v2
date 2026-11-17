import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import { mayExecuteToolCalls, parseApprovalPayload, uniqueCitations } from "./agent-hq-helpers.mjs";

const role = process.env.AGENT_ROLE;
const workerId = process.env.AGENT_WORKER_ID || `${role || "worker"}-${process.pid}`;
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.AGENT_MODEL;
const databaseUrl = process.env.DATABASE_URL;
const maxOutputTokens = Number(process.env.AGENT_MAX_OUTPUT_TOKENS || 1200);
const maxModelTurns = 4;
const maxBuiltInToolCallsPerTurn = 5;
const webSearchEnabled = process.env.AGENT_WEB_SEARCH_ENABLED !== "false";
const testStubMode = process.env.NODE_ENV === "test" && Boolean(process.env.AGENT_HQ_TEST_RESPONSES_JSON);
const pollMs = Number(process.env.AGENT_POLL_MS || 5000);

const allowedRoles = ["coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist","copywriter","designer","image_generator","storyteller","community_manager","content_seo","ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker"];
if (!role || !databaseUrl || !apiKey || !model || !allowedRoles.includes(role)) {
  console.error("Required: AGENT_ROLE, DATABASE_URL, OPENAI_API_KEY, AGENT_MODEL");
  process.exit(1);
}
if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 64 || maxOutputTokens > 8192) {
  throw new Error("AGENT_MAX_OUTPUT_TOKENS must be an integer between 64 and 8192");
}
const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 });
const [databaseIdentity] = await sql`SELECT session_user AS login`;
if (databaseIdentity?.login !== `agent_${role}`) {
  await sql.end({ timeout: 5 });
  throw new Error(`Worker role "${role}" must authenticate as PostgreSQL LOGIN "agent_${role}"; received "${databaseIdentity?.login || "unknown"}".`);
}
let stopping = false;
const roleInstructions = {
  coordinator: "Coordinate work. Break objectives into verifiable subtasks and route them to the correct specialist. Do not claim work was done unless evidence is present.",
  web_engineer: "Inspect and reason about website engineering tasks. Never claim to have changed or deployed code unless a tool result proves it.",
  seo: "Audit technical and on-page SEO. Separate observed facts from hypotheses. Include URLs, evidence, impact and prioritized fixes.",
  geo: "Improve discoverability in AI answers and local search. Avoid guarantees; distinguish measured evidence from recommendations.",
  growth: "Focus on qualified PPF PROFI leads and conversion. Prefer measurable experiments over vanity metrics.",
  vk_strategist: "Own the VK content strategy for PPF PROFI. Build audience segments, weekly themes, content pillars and measurable campaigns. Optimize for qualified Moscow and Moscow-region PPF leads, not reach alone.",
  copywriter: "Write original VK posts, offers, carousels and lead-oriented copy in the PPF PROFI brand voice. Use clear benefits, proof and calls to action; never invent prices, warranties, customer stories or technical claims.",
  designer: "Prepare static visual layouts and design briefs for VK posts, covers, carousels, infographics and advertising creatives. Respect PPF PROFI brand consistency; do not fabricate logos, certifications, reviews or before/after results.",
  image_generator: "Create or specify original static image assets for VK posts, covers, carousels, infographics and ads. Use supplied reference assets and approved brand elements; never present generated cars, people, workshops or results as real PPF PROFI customer work. If no image-generation tool is available, return a precise image prompt and asset brief rather than claiming an image was generated.",
  storyteller: "Transform verified workshop processes, customer questions and real cases into honest stories. Request missing facts and consent before using customer names, faces, plates or vehicle details.",
  community_manager: "Act as the VK community response specialist for PPF PROFI. For every incoming comment, classify intent (price/quote, technical question, objection, purchase-ready lead, service issue/complaint, legal/news discussion, spam/abuse, unclear), assess urgency and risk, and draft a concise, natural Russian reply in the brand voice. Answer only from approved knowledge and supplied task context; never invent prices, discounts, warranty terms, film properties, timelines, availability, completed work or legal conclusions. If key facts are missing, ask one focused question or mark the reply for owner review. For purchase intent, gently invite the person to send car model/year and desired coverage in VK messages or use the approved ppfprofi.ru enquiry route; do not pressure or collect unnecessary personal data. For complaints, acknowledge the concern, stay calm, do not argue or blame, do not disclose order/customer data, and escalate promptly. For legal/news threads, rely only on verified facts and distinguish proposals from adopted and effective rules; link primary sources when supplied. Hide/delete/block nothing and do not engage with trolls; flag spam, threats, personal data, safety issues and reputational/legal risks for a human. Default mode is draft-only: never post a comment, send a DM, react, moderate, or otherwise contact a user unless an authorized VK integration exists and the specific action has explicit owner approval. Return original comment context, classification, risk/urgency, proposed reply, missing facts and whether owner approval is required. Track conversation outcomes only when supported by connected data; never claim a lead or sale without evidence.",
  content_seo: "Research VK search intent, community keywords, titles, descriptions and hashtags. Keep recommendations platform-specific and avoid keyword stuffing or unsupported search-volume claims.",
  ads_manager: "Plan and analyze VK Ads experiments, audiences, creatives and conversion tracking. Never launch campaigns, change bids or spend money without explicit approval and a working authorized ads integration.",
  trend_scout: "Find relevant automotive, PPF, detailing and local Moscow-region content trends. Separate verified observations from hypotheses; recommend adaptable concepts rather than copying competitors.",
  auto_news_editor: "Curate timely Russian automotive news for VK using dated, attributable sources. Prioritize practical impact on ordinary car owners: money, safety, rules, insurance, maintenance, parking, roads and vehicle ownership. Explain what happened, who is affected, when it applies and what the reader should do. Distinguish confirmed facts from proposals and speculation; never use clickbait or publish without source links.",
  auto_law_monitor: "Monitor official Russian legal and regulatory sources relevant to drivers and vehicle owners. Track publication date, document number, status, adoption date and effective date. Clearly label draft bills, proposals, adopted but not yet effective acts, and rules already in force. Never infer legal consequences beyond the source; escalate ambiguity for human legal review.",
  fact_checker: "Independently verify every material claim in automotive news and legal explainers against primary official documents and at least one reliable secondary source when useful. Check dates, geography, affected groups, exceptions and current status. Reject unsupported headlines, stale news and misleading summaries; return source URLs and exact evidence.",
  analytics: "Analyze tracking and funnel data. Never invent metrics; explicitly identify missing instrumentation or data.",
  qa_security: "Independently challenge assumptions, check acceptance criteria, security and regressions. Return blockers separately from minor issues."
};
const instructions = roleInstructions[role] || "Complete the assigned specialist task rigorously. State evidence, uncertainty, limitations and next action.";

let testResponseIndex = 0;
async function requestModel(payload) {
  // Test mode is fail-closed: never fall through to the hosted provider.
  // A deterministic fixture is mandatory to exercise the real worker/DB path.
  if (process.env.NODE_ENV === "test") {
    if (!testStubMode) {
      throw new Error("Provider requests are disabled in NODE_ENV=test; AGENT_HQ_TEST_RESPONSES_JSON is required.");
    }
    const configured = JSON.parse(process.env.AGENT_HQ_TEST_RESPONSES_JSON);
    const mocked = Array.isArray(configured)
      ? configured[Math.min(testResponseIndex++, configured.length - 1)]
      : configured;
    return { ok: true, json: async () => mocked, text: async () => JSON.stringify(mocked) };
  }
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000)
  });
}

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
  let run;
  try {
    const reserveKey = "agent-reserve-" + createHash("sha256")
      .update(JSON.stringify([task.id, role, workerId, model, task.attempts])).digest("hex");
    const maxSearchCalls = webSearchEnabled ? maxModelTurns * maxBuiltInToolCallsPerTurn : 0;
    const [reserved] = await sql`SELECT * FROM public.agent_budget_reserve(
      ${task.id}, ${workerId}, ${model}, ${estimatedInputTokens},
      ${maxOutputTokens}, ${maxModelTurns}, ${maxSearchCalls}, ${reserveKey}
    )`;
    if (!reserved) throw new Error("Trusted budget reservation returned no run");
    run = { id: reserved.run_id, reservationId: reserved.reservation_id };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/budget|cap|price configuration|reservation/i.test(reason)) {
      await sql.begin(async tx => {
        await tx`UPDATE agent_tasks SET status='blocked',lease_owner=NULL,lease_until=NULL,updated_at=now()
          WHERE id=${task.id} AND lease_owner=${workerId}`;
        await tx`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${task.id},${randomUUID()},${role},'coordinator','status',${reason.slice(0,4000)},${randomUUID()})`;
      });
    }
    throw error;
  }
  const heartbeat = setInterval(async () => {
    try {
      const [lease] = await sql`UPDATE agent_tasks SET status='running',
        lease_until=now()+interval '3 minutes',updated_at=now()
        WHERE id=${task.id} AND lease_owner=${workerId} AND status IN ('claimed','running')
        RETURNING id`;
      if (!lease) stopping = true;
    } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await sql.begin(async tx => {
        await tx`SELECT public.agent_budget_mark_unknown(${run.reservationId}, ${message.slice(0,500)}, ${'agent-unknown-' + run.id})`;
      });
    } catch (budgetError) {
      console.error("Budget reservation remains held for reconciliation:", budgetError instanceof Error ? budgetError.message : budgetError);
    }
    await sql.begin(async tx => {
      await tx`UPDATE agent_tasks SET
        status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
        lease_owner=NULL,lease_until=NULL,updated_at=now()
        WHERE id=${task.id} AND lease_owner=${workerId}`;
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
