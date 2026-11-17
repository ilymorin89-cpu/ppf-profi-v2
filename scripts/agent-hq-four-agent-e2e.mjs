import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const marker = "ci-four-agent-orchestration";
const databaseUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const roles = {
  coordinator: "agent_coordinator",
  seo: "agent_seo",
  qa_security: "agent_qa_security",
  supervisor: "agent_supervisor"
};

function parseTestUrl(value, label, expectedLogin) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error(label + " must be a valid PostgreSQL URL."); }
  if (url.hostname !== "postgres") {
    throw new Error(label + " must point to the isolated Compose PostgreSQL service.");
  }
  if (url.pathname !== "/agent_hq_test") {
    throw new Error(label + " must target the disposable database agent_hq_test.");
  }
  if (url.search || url.hash) throw new Error(label + " must not contain URL options or fragments.");
  if (expectedLogin && decodeURIComponent(url.username) !== expectedLogin) {
    throw new Error(label + " must authenticate as " + expectedLogin + ".");
  }
  return url;
}

const admin = parseTestUrl(databaseUrl, "AGENT_HQ_TEST_DATABASE_URL", "agent_test");
const roleUrls = {};
for (const [role, login] of Object.entries(roles)) {
  const key = "AGENT_HQ_ROLE_TEST_URL_" + role.toUpperCase();
  const url = parseTestUrl(process.env[key], key, login);
  if (url.hostname !== admin.hostname || url.port !== admin.port || url.pathname !== admin.pathname) {
    throw new Error(key + " must target the same disposable PostgreSQL database.");
  }
  roleUrls[role] = url.toString();
}

const sql = postgres(databaseUrl, { max: 3, connect_timeout: 10, idle_timeout: 5 });
let parentId = null;

const response = text => ({
  output: [{ type: "message", content: [{ type: "output_text", text }] }],
  usage: { input_tokens: 0, output_tokens: 0 }
});
const call = (callId, name, args) => ({
  output: [{
    type: "function_call",
    call_id: callId,
    name,
    arguments: JSON.stringify(args)
  }],
  usage: { input_tokens: 0, output_tokens: 0 }
});

const fixtures = {
  coordinator: [
    call("coord-delegate-seo", "delegate_task", {
      role: "seo",
      title: "Four-agent E2E: SEO analysis",
      objective: "Produce a deterministic SEO finding for the PPF PROFI test page. Include one evidence marker and a prioritized recommendation.",
      acceptance_criteria: [
        "Return the exact evidence marker SEO_E2E_EVIDENCE",
        "Include one actionable recommendation"
      ],
      priority: 1
    }),
    response("Coordinator delegated the SEO analysis to the authenticated SEO worker. Supervisor must arrange independent QA before consolidation.")
  ],
  seo: response("SEO_E2E_EVIDENCE: deterministic fixture confirms the test page title is missing. Recommendation: add a unique descriptive title and verify the canonical URL."),
  qa_security: [
    call("qa-send-verdict", "send_message", {
      to_role: "coordinator",
      kind: "objection",
      body: "Independent QA reviewed the SEO artifact and found the evidence marker SEO_E2E_EVIDENCE. Verdict: PASS. No unsupported production claim was introduced."
    }),
    response("VERDICT: PASS\nReviewed the SEO_E2E_EVIDENCE artifact. Acceptance criteria are met; no blocker remains.")
  ]
};

function runProcess(role, script, fixture) {
  const env = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    TMP: process.env.TMP || "",
    TEMP: process.env.TEMP || "",
    NODE_ENV: "test",
    DATABASE_URL: roleUrls[role],
    AGENT_ROLE: role,
    AGENT_WORKER_ID: role === "supervisor" ? "" : "test-" + role,
    AGENT_HQ_WORKERS_ENABLED: "false",
    AGENT_HQ_TEST_ONCE: "true",
    AGENT_POLL_MS: "5",
    AGENT_WEB_SEARCH_ENABLED: "false",
    OPENAI_API_KEY: "test-no-provider-call",
    AGENT_MODEL: "test-model",
    AGENT_MAX_OUTPUT_TOKENS: "128",
    GITHUB_TOKEN: "",
    AGENT_GITHUB_REPOSITORY: "",
    ...(fixture ? { AGENT_HQ_TEST_RESPONSES_JSON: JSON.stringify(fixture) } : {}),
    ...(role === "qa_security"
      ? { AGENT_HQ_TEST_EXPECT_INPUT_JSON: JSON.stringify(["SEO_E2E_EVIDENCE"]) }
      : {})
  };

  const preflight = spawnSync(process.execPath, ["scripts/agent-hq-test-preflight.mjs"], {
    cwd: root, env, stdio: "inherit", timeout: 30_000
  });
  if (preflight.error) throw preflight.error;
  if (preflight.status !== 0) throw new Error(role + " test preflight failed with exit code " + preflight.status);

  const run = spawnSync(process.execPath, [script, "--once"], {
    cwd: root, env, stdio: "inherit", timeout: 90_000
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(role + " process failed with exit code " + run.status);
}

async function cleanup() {
  if (parentId !== null) {
    await sql.begin(async tx => {
      await tx`DELETE FROM public.agent_budget_ledger
        WHERE reservation_id IN (
          SELECT id FROM public.agent_budget_reservations
          WHERE task_id IN (SELECT id FROM public.agent_tasks WHERE id=${parentId} OR parent_task_id=${parentId})
        )`;
      await tx`DELETE FROM public.agent_budget_settlements
        WHERE reservation_id IN (
          SELECT id FROM public.agent_budget_reservations
          WHERE task_id IN (SELECT id FROM public.agent_tasks WHERE id=${parentId} OR parent_task_id=${parentId})
        )`;
      await tx`DELETE FROM public.agent_budget_reservations
        WHERE task_id IN (SELECT id FROM public.agent_tasks WHERE id=${parentId} OR parent_task_id=${parentId})`;
      await tx`DELETE FROM public.agent_runs
        WHERE task_id IN (SELECT id FROM public.agent_tasks WHERE id=${parentId} OR parent_task_id=${parentId})`;
      await tx`DELETE FROM public.agent_messages
        WHERE task_id IN (SELECT id FROM public.agent_tasks WHERE id=${parentId} OR parent_task_id=${parentId})`;
      await tx`DELETE FROM public.agent_tasks WHERE parent_task_id=${parentId}`;
      await tx`DELETE FROM public.agent_tasks WHERE id=${parentId}`;
    });
  }
  await sql`UPDATE public.agent_budget_config
    SET enabled=false,daily_cap_microusd=0,monthly_cap_microusd=0,per_run_cap_microusd=0,
      input_price_per_million_microusd=0,output_price_per_million_microusd=0,
      web_search_price_microusd_per_call=0,updated_at=now()
    WHERE id=1`;
}

try {
  await sql`UPDATE public.agent_budget_config
    SET enabled=true,daily_cap_microusd=1000000,monthly_cap_microusd=5000000,
      per_run_cap_microusd=100000,input_price_per_million_microusd=1,
      output_price_per_million_microusd=1,web_search_price_microusd_per_call=0,
      updated_at=now() WHERE id=1`;

  const [parent] = await sql`INSERT INTO public.agent_tasks
    (title,objective,expected_output,acceptance_criteria,assigned_role,created_by,priority)
    VALUES (
      'Four-agent deterministic orchestration',
      'Coordinator delegates to SEO; Supervisor assigns independent QA; QA sends a verdict; Supervisor consolidates.',
      'Consolidated artifact containing SEO evidence and QA PASS verdict',
      '["Coordinator delegates SEO task","SEO persists its artifact","Supervisor creates QA task and grants scoped access","QA sends independent verdict to Coordinator","Supervisor consolidates only after PASS"]'::jsonb,
      'coordinator',${marker},1
    ) RETURNING id`;
  parentId = parent.id;

  // 1. Coordinator claims the parent task and creates a real child through delegate_task.
  runProcess("coordinator", "scripts/agent-hq-worker.mjs", fixtures.coordinator);
  const [delegated] = await sql`SELECT id,status,assigned_role,parent_task_id
    FROM public.agent_tasks WHERE parent_task_id=${parentId} AND assigned_role='seo'
    ORDER BY id LIMIT 1`;
  assert.ok(delegated, "Coordinator must create an actual SEO child task.");
  assert.equal(String(delegated.parent_task_id), String(parentId));
  assert.ok(["queued","claimed","running","done","blocked"].includes(delegated.status));
  const [parentAfterCoordinator] = await sql`SELECT status FROM public.agent_tasks WHERE id=${parentId}`;
  assert.equal(parentAfterCoordinator?.status, "review",
    "Coordinator must hand the parent task to Supervisor in review state.");

  // 2. SEO runs under its own PostgreSQL LOGIN and persists an evidence artifact.
  runProcess("seo", "scripts/agent-hq-worker.mjs", fixtures.seo);
  const [seoTask] = await sql`SELECT status FROM public.agent_tasks WHERE id=${delegated.id}`;
  assert.equal(seoTask.status, "done", "SEO child task must be completed by the SEO worker.");
  const [seoArtifact] = await sql`SELECT content FROM public.agent_artifacts
    WHERE task_id=${delegated.id} AND created_by='seo' ORDER BY id DESC LIMIT 1`;
  assert.match(seoArtifact?.content || "", /SEO_E2E_EVIDENCE/,
    "SEO must persist the deterministic evidence marker.");

  // 3. Supervisor creates the QA task and grants QA scoped read access to the SEO artifact.
  runProcess("supervisor", "scripts/agent-hq-supervisor.mjs");
  const [qaTask] = await sql`SELECT id,status FROM public.agent_tasks
    WHERE parent_task_id=${parentId} AND assigned_role='qa_security'
    ORDER BY id DESC LIMIT 1`;
  assert.ok(qaTask, "Supervisor must create an independent QA task.");
  assert.equal(qaTask.status, "queued");
  const [qaAccess] = await sql`SELECT access_reason FROM public.agent_task_access
    WHERE task_id=${delegated.id} AND principal='qa_security'`;
  assert.equal(qaAccess?.access_reason, "qa_review",
    "Supervisor must grant QA scoped access to the SEO task, not global access.");

  // Verify the exact artifact query is visible under QA's authenticated PostgreSQL LOGIN.
  // The real QA worker repeats this query when building its sibling-artifact context.
  const qaDb = postgres(roleUrls.qa_security, { max: 1, connect_timeout: 10 });
  try {
    const visibleArtifacts = await qaDb`SELECT a.id,a.content
      FROM public.agent_artifacts a
      JOIN public.agent_tasks child ON child.id=a.task_id
      WHERE child.parent_task_id=${parentId} AND child.assigned_role='seo'`;
    assert.equal(visibleArtifacts.length, 1,
      "QA's dedicated LOGIN must be able to read the scoped SEO artifact.");
    assert.match(visibleArtifacts[0].content, /SEO_E2E_EVIDENCE/,
      "QA's database session must see the exact SEO evidence it is assigned to review.");
  } finally {
    await qaDb.end({ timeout: 5 });
  }

  // 4. QA runs under its own LOGIN, reads SEO evidence and sends an objection/verdict message.
  runProcess("qa_security", "scripts/agent-hq-worker.mjs", fixtures.qa_security);
  const [qaDone] = await sql`SELECT status FROM public.agent_tasks WHERE id=${qaTask.id}`;
  assert.equal(qaDone.status, "done", "QA worker must complete the assigned review task.");
  const [qaArtifact] = await sql`SELECT content FROM public.agent_artifacts
    WHERE task_id=${qaTask.id} AND created_by='qa_security' ORDER BY id DESC LIMIT 1`;
  assert.match(qaArtifact?.content || "", /VERDICT:\s*PASS/,
    "QA must persist a machine-readable PASS verdict.");
  const [qaMessage] = await sql`SELECT body FROM public.agent_messages
    WHERE task_id=${qaTask.id} AND from_role='qa_security'
      AND to_role='coordinator' AND kind='objection' ORDER BY id DESC LIMIT 1`;
  assert.match(qaMessage?.body || "", /SEO_E2E_EVIDENCE|VERDICT:\s*PASS/,
    "QA must send an explicit verdict message to Coordinator.");

  // The receiving Coordinator must be able to read the QA message under its own LOGIN.
  const coordinatorDb = postgres(roleUrls.coordinator, { max: 1, connect_timeout: 10 });
  try {
    const [coordinatorInbox] = await coordinatorDb`SELECT body FROM public.agent_messages
      WHERE task_id=${qaTask.id} AND from_role='qa_security'
        AND to_role='coordinator' AND kind='objection' ORDER BY id DESC LIMIT 1`;
    assert.match(coordinatorInbox?.body || "", /SEO_E2E_EVIDENCE|VERDICT:\\s*PASS/,
      "Coordinator's authenticated inbox must contain the QA verdict.");
  } finally {
    await coordinatorDb.end({ timeout: 5 });
  }

  // 5. Supervisor reads the QA verdict and consolidates the parent task.
  runProcess("supervisor", "scripts/agent-hq-supervisor.mjs");
  const [finalParent] = await sql`SELECT status FROM public.agent_tasks WHERE id=${parentId}`;
  assert.equal(finalParent.status, "done", "Supervisor may complete the parent only after QA PASS.");
  const [finalArtifact] = await sql`SELECT content FROM public.agent_artifacts
    WHERE task_id=${parentId} AND created_by='supervisor' AND artifact_type='consolidated'
    ORDER BY id DESC LIMIT 1`;
  assert.match(finalArtifact?.content || "", /SEO_E2E_EVIDENCE/,
    "Consolidated result must include the SEO artifact.");
  assert.match(finalArtifact?.content || "", /VERDICT:\s*PASS/,
    "Consolidated result must include the independent QA PASS verdict.");

  const [usage] = await sql`SELECT
    count(*) FILTER (WHERE r.status='succeeded' AND r.provider='test_stub')::int AS successful_stub_runs,
    COALESCE(sum(r.cost_microusd),0)::bigint AS cost_microusd,
    count(*) FILTER (WHERE br.state IN ('active','unknown'))::int AS open_reservations
    FROM public.agent_runs r
    JOIN public.agent_tasks t ON t.id=r.task_id
    LEFT JOIN public.agent_budget_reservations br ON br.run_id=r.id
    WHERE t.id=${parentId} OR t.parent_task_id=${parentId}`;
  assert.equal(usage.successful_stub_runs, 3, "Coordinator, SEO and QA must each complete a deterministic run.");
  assert.equal(Number(usage.cost_microusd), 0, "All four-agent worker runs must cost zero.");
  assert.equal(usage.open_reservations, 0, "No active/unknown budget reservation may remain.");

  console.log(JSON.stringify({
    result: "PASS",
    test: "coordinator-seo-qa-security-supervisor-no-egress",
    parentTaskId: String(parentId),
    childRoles: ["seo","qa_security"],
    successfulDeterministicRuns: usage.successful_stub_runs,
    zeroCost: true,
    noOpenReservations: true,
    verified: [
      "Coordinator delegated a real SEO child task",
      "SEO ran under its separate PostgreSQL LOGIN and persisted evidence",
      "Supervisor created an independent QA task and granted scoped artifact access",
      "QA ran under its separate PostgreSQL LOGIN, persisted PASS and messaged Coordinator",
      "Supervisor consolidated the parent only after QA PASS"
    ]
  }, null, 2));
} finally {
  try { await cleanup(); }
  finally { await sql.end({ timeout: 5 }); }
}
