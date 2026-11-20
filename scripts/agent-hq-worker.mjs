import postgres from "postgres";
import { createHash, randomUUID } from "node:crypto";
import { mayExecuteToolCalls, parseApprovalPayload, uniqueCitations } from "./agent-hq-helpers.mjs";
import { createWorkerLifecycle } from "./agent-hq-worker-lifecycle.mjs";
import { MAX_REQUEST_INPUT_BYTES, assertRequestInputWithinLimit, buildModelInstructions, readProviderUsage } from "./agent-hq-budget-envelope.mjs";

const role = process.env.AGENT_ROLE;
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
const [databaseIdentity] = await sql`
  SELECT session_user AS login,
    public.agent_role_for_session() AS role,
    public.agent_worker_id_for_session() AS worker_id
`;
if (!databaseIdentity?.login || databaseIdentity.role !== role ||
    typeof databaseIdentity.worker_id !== "string" || !databaseIdentity.worker_id) {
  await sql.end({ timeout: 5 });
  throw new Error(`Worker LOGIN "${databaseIdentity?.login || "unknown"}" has no enabled authenticated Agent HQ principal for configured role "${role}".`);
}
const workerId = databaseIdentity.worker_id;
if (process.env.AGENT_WORKER_ID && process.env.AGENT_WORKER_ID !== workerId) {
  await sql.end({ timeout: 5 });
  throw new Error("AGENT_WORKER_ID does not match the authenticated PostgreSQL worker principal; environment identity is not trusted.");
}
const lifecycle = createWorkerLifecycle();
process.once("SIGTERM", () => lifecycle.requestStop("SIGTERM"));
process.once("SIGINT", () => lifecycle.requestStop("SIGINT"));
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
let testInputAssertionsChecked = false;
async function requestModel(payload, signal) {
  // Test mode is fail-closed: never fall through to the hosted provider.
  // A deterministic fixture is mandatory to exercise the real worker/DB path.
  if (process.env.NODE_ENV === "test") {
    if (!testStubMode) {
      throw new Error("Provider requests are disabled in NODE_ENV=test; AGENT_HQ_TEST_RESPONSES_JSON is required.");
    }
    const configured = JSON.parse(process.env.AGENT_HQ_TEST_RESPONSES_JSON);
    // Optional test-only contract: prove that a worker received required context
    // before a deterministic response fixture is allowed to answer.
    if (!testInputAssertionsChecked && process.env.AGENT_HQ_TEST_EXPECT_INPUT_JSON) {
      let expectedInput;
      try {
        expectedInput = JSON.parse(process.env.AGENT_HQ_TEST_EXPECT_INPUT_JSON);
      } catch {
        throw new Error("AGENT_HQ_TEST_EXPECT_INPUT_JSON must contain valid JSON.");
      }
      if (!Array.isArray(expectedInput) || expectedInput.length < 1 || expectedInput.length > 20 ||
          expectedInput.some(value => typeof value !== "string" || !value.trim() || value.length > 300)) {
        throw new Error("AGENT_HQ_TEST_EXPECT_INPUT_JSON must be a non-empty array of 1-20 short strings.");
      }
      const actualInput = typeof payload?.input === "string"
        ? payload.input
        : JSON.stringify(payload?.input ?? "");
      const missing = expectedInput.filter(value => !actualInput.includes(value));
      if (missing.length) {
        throw new Error("Deterministic test input assertion failed; required context is missing: " + missing.join(", "));
      }
      testInputAssertionsChecked = true;
    }
    const mocked = Array.isArray(configured)
      ? configured[Math.min(testResponseIndex++, configured.length - 1)]
      : configured;
    return { ok: true, json: async () => mocked, text: async () => JSON.stringify(mocked) };
  }
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000)
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
  const [task] = await sql`SELECT * FROM public.agent_task_claim(${workerId})`;
  return task || null;
}

async function runTask(task) {
  // Reserve the full hard input envelope for every possible model turn.
  // Each actual turn is checked against this same limit immediately before dispatch.
  const estimatedInputTokens = MAX_REQUEST_INPUT_BYTES;
  let run;
  let providerCallStarted = false;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalWebSearchCalls = 0;
  const providerReferences = [];
  try {
    const reserveKey = "agent-reserve-" + createHash("sha256")
      .update(JSON.stringify([task.id, role, workerId, model, task.attempts])).digest("hex");
    const [reserved] = await sql`SELECT * FROM public.agent_budget_reserve(
      ${task.id}, ${workerId}, ${testStubMode ? "test_stub" : "openai"}, ${model},
      ${estimatedInputTokens}, ${maxOutputTokens}, ${maxModelTurns},
      ${webSearchEnabled ? maxModelTurns * maxBuiltInToolCallsPerTurn : 0}, ${reserveKey}
    )`;
    if (!reserved) throw new Error("Trusted budget reservation returned no run");
    run = { id: reserved.run_id, reservationId: reserved.reservation_id };
  
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/budget|cap|exceeds per-run/i.test(reason)) {
      await sql.begin(async tx => {
        await tx`SELECT public.agent_task_transition(${task.id},${workerId},'blocked')`;
        await tx`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${task.id},${randomUUID()},${role},'coordinator','status',${reason.slice(0,4000)},${randomUUID()})`;
      });
    }
    throw error;
  }
  const requestAbortController = new AbortController();
  lifecycle.setActiveRequest(requestAbortController);
  const heartbeat = setInterval(async () => {
    try {
      const [lease] = await sql`SELECT public.agent_task_heartbeat(${task.id},${workerId}) AS ok`;
      if (!lease?.ok) lifecycle.loseLease("Task lease was lost; aborting active provider request");
    } catch (error) {
      console.error("Heartbeat failed:", error instanceof Error ? error.message : error);
      lifecycle.loseLease(error instanceof Error ? error : new Error("Heartbeat failed"));
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
      "Return a concise, evidence-backed result. Clearly label facts, assumptions, unknowns, blockers and next action. Do not claim to have accessed systems, changed files, published content, contacted customers or spent money unless an authorized tool actually did so. Use only the tools explicitly provided in this request. You may search the web, read the configured GitHub repository, message other agents, request approval, or delegate if permitted by your role. You cannot write repository files, deploy, publish, spend money, or contact customers."
    ].join("\n");
    const allowedRoles = ["coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist","copywriter","designer","image_generator","storyteller","community_manager","content_seo","ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker"];
    const tools = [
      ...(process.env.GITHUB_TOKEN && process.env.AGENT_GITHUB_REPOSITORY ? [{
        type: "function", name: "github_read_file",
        description: "Read a text file from the configured GitHub repository and branch. Read-only. Never use this to claim code was changed.",
        parameters: { type: "object", additionalProperties: false, properties: { path: { type: "string" } }, required: ["path"] },
        strict: true
      }] : []),
      // Hosted OpenAI web search gives research-capable roles live, cited sources.
      // It does not grant access to private systems or execute external actions.
      ...(webSearchEnabled ? [{ type: "web_search", search_context_size: "medium", external_web_access: true }] : []),
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
    const modelInstructions = buildModelInstructions(role, instructions);
    let responseInput = prompt;
    let data;
    const citations = [];
    for (let turn = 0; turn < maxModelTurns; turn++) {
      // Include the complete current input, instructions and tool schemas in the cap.
      // This also catches oversized search/tool output before the next provider call.
      assertRequestInputWithinLimit({ instructions: modelInstructions, input: responseInput, tools });
      // Deterministic fixture mode never contacts a provider; only real provider attempts are billable-unknown risks.
      if (!testStubMode) providerCallStarted = true;
      const response = await requestModel({
        model,
        instructions: modelInstructions,
        input: responseInput,
        tools,
        max_output_tokens: maxOutputTokens,
        max_tool_calls: maxBuiltInToolCallsPerTurn
      }, requestAbortController.signal);
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 1200);
        throw new Error(`OpenAI API ${response.status}: ${detail}`);
      }
      data = await response.json();
      // The deterministic test provider can model an ambiguous accepted request
      // without making a network call. Honor this marker only in NODE_ENV=test.
      if (testStubMode && data.__test_provider_outcome === "ambiguous") {
        // The deterministic provider accepted the request, but its outcome is unknown.
        // Stop before parsing output or settling; retain the reservation for reconciliation.
        providerCallStarted = true;
        throw new Error("Deterministic test provider simulated an ambiguous accepted request");
      }
      if (!testStubMode && (typeof data.id !== "string" || !data.id.trim())) {
        throw new Error("Provider response omitted its response ID; reservation requires reconciliation.");
      }
      if (typeof data.id === "string" && data.id.trim() && !providerReferences.includes(data.id)) {
        providerReferences.push(data.id);
      }
      if (providerReferences.join(",").length > 200) {
        throw new Error("Provider response references exceed the auditable settlement field; reservation requires reconciliation.");
      }
      const usage = readProviderUsage(data, MAX_REQUEST_INPUT_BYTES, maxOutputTokens);
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalWebSearchCalls += (data.output || []).filter(item => item.type === "web_search_call").length;
      if (totalWebSearchCalls > maxModelTurns * maxBuiltInToolCallsPerTurn) {
        throw new Error("Hosted web-search call count exceeded the configured per-run reservation");
      }
      for (const item of data.output || []) {
        if (item.type !== "message") continue;
        for (const part of item.content || []) {
          for (const annotation of part.annotations || []) {
            if (annotation.type === "url_citation" && annotation.url) citations.push({ url: annotation.url, title: annotation.title || null });
          }
        }
      }
      const calls = (data.output || []).filter(item => item.type === "function_call");
      if (!calls.length) break;
      if (!mayExecuteToolCalls(turn, maxModelTurns)) throw new Error("Tool-call turn limit reached before a final answer; no further tool actions were executed");
      const outputs = [];
      for (const call of calls) {
        if (lifecycle.stopping) throw new Error("Worker stopping or task lease lost; tool execution cancelled");
        const args = JSON.parse(call.arguments || "{}");
        let result;
        if (call.name === "github_read_file") {
          const path = String(args.path || "").replace(/^\/+/, "");
          if (!path || path.split("/").some(part => !part || part === "." || part === "..") || path.includes("\\") || path.length > 240) {
            throw new Error("Invalid GitHub repository path");
          }
          const repository = process.env.AGENT_GITHUB_REPOSITORY;
          if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) throw new Error("Invalid AGENT_GITHUB_REPOSITORY");
          const ref = process.env.AGENT_GITHUB_REF || "main";
          const endpoint = "https://api.github.com/repos/" + repository + "/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(ref);
          const gh = await fetch(endpoint, { headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal: AbortSignal.timeout(20000) });
          if (!gh.ok) throw new Error("GitHub read failed: HTTP " + gh.status);
          const file = await gh.json();
          if (file.type !== "file" || typeof file.content !== "string" || file.encoding !== "base64") throw new Error("GitHub path is not a supported text file");
          const decoded = Buffer.from(file.content.replace(/\s/g, ""), "base64");
          if (decoded.length > 30000 || decoded.includes(0)) throw new Error("GitHub file exceeds 30 KB or is binary");
          result = { repository, ref, path, sha: file.sha, content: decoded.toString("utf8") };
        } else if (call.name === "send_message") {
          if (!allowedRoles.includes(args.to_role) || !["request","question","objection","handoff","status"].includes(args.kind) || typeof args.body !== "string" || !args.body.trim()) {
            throw new Error("Invalid send_message arguments");
          }
          const body = args.body.slice(0,8000);
          const idempotencyKey = "agent-" + createHash("sha256")
            .update(JSON.stringify([task.id, role, args.to_role, args.kind, body])).digest("hex");
          const [message] = await sql`SELECT *
            FROM public.agent_insert_own_message(
              ${task.id},${randomUUID()},${role},${args.to_role},${args.kind},${body},${idempotencyKey}
            )`;
          result = message;
        } else if (call.name === "request_approval") {
          const actions = ["publish_site","deploy_production","send_external_message","launch_ad","spend_money","database_migration","delete_data","other"];
          if (!actions.includes(args.action) || typeof args.reason !== "string" || !args.reason.trim() || typeof args.payload !== "string") {
            throw new Error("Invalid request_approval arguments");
          }
          const approvalPayload = parseApprovalPayload(args.payload);
          let [approval] = await sql`INSERT INTO agent_approvals
            (task_id,action,requested_by,payload,status)
            VALUES (${task.id},${args.action},${role},${JSON.stringify({ reason: args.reason.slice(0,3000), payload: approvalPayload })}::jsonb,'pending')
            ON CONFLICT (task_id,action) WHERE status='pending' DO NOTHING
            RETURNING id,task_id,action,status,created_at`;
          if (!approval) {
            [approval] = await sql`SELECT id,task_id,action,status,created_at FROM agent_approvals
              WHERE task_id=${task.id} AND action=${args.action} AND status='pending' LIMIT 1`;
          }
          if (!approval) throw new Error("Approval request could not be persisted");
          const approvalMessageKey = "approval-" + approval.id;
          await sql`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${task.id},${randomUUID()},${role},'coordinator','approval_request',${JSON.stringify(approval)},${approvalMessageKey})
            ON CONFLICT (idempotency_key) DO NOTHING`;
          result = approval;
        } else if (call.name === "delegate_task") {
          if (role !== "coordinator") throw new Error("Only coordinator may delegate tasks");
          if (!allowedRoles.includes(args.role) || args.role === "coordinator" || typeof args.title !== "string" || typeof args.objective !== "string") {
            throw new Error("Invalid delegate_task arguments");
          }
          const child = await sql.begin(async tx => {
            await tx`INSERT INTO agent_tasks
              (parent_task_id,assigned_role,title,objective,expected_output,acceptance_criteria,priority,created_by)
              VALUES (${task.id},${args.role},${args.title.slice(0,240)},${args.objective.slice(0,8000)},
                'Evidence-backed result with findings and next action',${JSON.stringify(args.acceptance_criteria || [])}::jsonb,
                ${Math.max(1,Math.min(1000,Number(args.priority) || 100))},'coordinator')`;
            // RETURNING would require the coordinator to SELECT the new child
            // before the supervisor grants scoped visibility. currval stays on
            // this connection and does not bypass row-level security.
            const [created] = await tx`SELECT currval('agent_tasks_id_seq') AS id`;
            return { id: created.id, assigned_role: args.role, title: args.title.slice(0,240), status: "queued" };
          });
          result = child;
        } else {
          throw new Error(`Unsupported tool: ${call.name}`);
        }
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      responseInput = [...(data.output || []), ...outputs];
    }
    let result = outputText(data || {});
    const deduplicatedCitations = uniqueCitations(citations);
    if (deduplicatedCitations.length) {
      result += "\n\nSources checked by the agent:\n" + deduplicatedCitations.map(item => "- " + (item.title ? item.title + ": " : "") + item.url).join("\n");
    }
    if (!result && role === "coordinator") {
      result = "Delegation submitted. The supervisor will inspect child tasks, wait for completion and independent QA, then consolidate the result.";
    }
    if (!result) throw new Error("Model returned no text output");
    if (lifecycle.stopping) throw new Error("Worker stopping or task lease lost; result will not be committed");
    const providerReference = providerReferences.length ? providerReferences.join(",") : null;
    const settlementKey = "agent-settle-" + createHash("sha256")
      .update(JSON.stringify([run.id, totalInputTokens, totalOutputTokens, totalWebSearchCalls, providerReference])).digest("hex");
    const [settlement] = await sql`SELECT public.agent_budget_settle(
      ${run.reservationId}, ${workerId}, ${totalInputTokens}, ${totalOutputTokens},
      ${totalWebSearchCalls}, ${settlementKey}, ${providerReference}
    ) AS cost`;
    if (!settlement) throw new Error("Trusted budget settlement returned no result");
    const actualCost = settlement.cost;
    await sql.begin(async tx => {
      const [owned] = await tx`SELECT public.agent_task_transition(${task.id},${workerId},'complete',${run.reservationId}) AS status`;
      if (!owned?.status) throw new Error("Lease lost before completion; result not committed");
      await tx`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content,evidence)
        VALUES (${task.id},${role},'result',${task.title},${result},'[]'::jsonb)`;
      await tx`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${task.id},${randomUUID()},${role},'coordinator','result',${result.slice(0,12000)},${randomUUID()})`;
    });
    console.log(JSON.stringify({ taskId: task.id, status: "done", inputTokens: totalInputTokens, outputTokens: totalOutputTokens, webSearchCalls: totalWebSearchCalls, costMicrousd: actualCost }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let safeToRetry = false;
    if (run?.reservationId) {
      try {
        if (providerCallStarted) {
          // Provider outcome may be billable: retain the reservation and require operator reconciliation.
          const reconciliationReason = [
            message.slice(0,140),
            "input_tokens=" + totalInputTokens,
            "output_tokens=" + totalOutputTokens,
            "web_search_calls=" + totalWebSearchCalls,
            "provider_refs=" + providerReferences.join(",")
          ].join("; ").slice(0,500);
          await sql`SELECT public.agent_budget_mark_unknown(${run.reservationId}, ${workerId}, ${reconciliationReason}, ${"agent-unknown-" + run.id})`;
        } else {
          await sql`SELECT public.agent_budget_release(${run.reservationId}, ${workerId}, ${message.slice(0,500)}, ${"agent-release-" + run.id})`;
          safeToRetry = true;
        }
      } catch (budgetError) {
        console.error("Budget reservation remains held for reconciliation:", budgetError instanceof Error ? budgetError.message : budgetError);
      }
    }
    await sql.begin(async tx => {
      const transition = Number(task.attempts) >= Number(task.max_attempts)
        ? "dead_letter" : safeToRetry ? "retry" : "blocked";
      await tx`SELECT public.agent_task_transition(${task.id},${workerId},${transition})`;
      await tx`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${task.id},${randomUUID()},${role},'coordinator','status',${message.slice(0,4000)},${randomUUID()})`;
    });
    console.error(`Task ${task.id} failed:`, message);
  } finally {
    clearInterval(heartbeat);
    lifecycle.clearActiveRequest(requestAbortController);
  }
}

try {
  const [startupBudget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd FROM agent_budget_config WHERE id=1`;
  if (!startupBudget || !startupBudget.enabled || Number(startupBudget.daily_cap_microusd) <= 0 || Number(startupBudget.monthly_cap_microusd) <= 0 || Number(startupBudget.per_run_cap_microusd) <= 0) {
    throw new Error("Agent budget is disabled or has zero caps; worker will not claim tasks");
  }
  const once = process.argv.includes("--once");
  while (!lifecycle.stopping) {
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
