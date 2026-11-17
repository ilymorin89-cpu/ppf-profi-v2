import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const ownerUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
const roles = ["coordinator","web_engineer","seo","geo","growth","analytics","qa_security","vk_strategist","copywriter","designer","image_generator","storyteller","community_manager","content_seo","ads_manager","trend_scout","auto_news_editor","auto_law_monitor","fact_checker"];

test("every Agent HQ worker login sees only its own role and cannot forge message sender", async () => {
  assert.ok(ownerUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(ownerUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const owner = postgres(ownerUrl, { max: 2, idle_timeout: 5 });
  const marker = randomUUID();
  const [fnOwner] = await owner`SELECT rolcanlogin,rolbypassrls FROM pg_roles WHERE rolname='agent_hq_fn_owner_ci'`;
  assert.ok(fnOwner, "Trusted aggregate must have a dedicated CI function owner.");
  assert.equal(fnOwner.rolcanlogin, false, "Function owner must not be a LOGIN.");
  assert.equal(fnOwner.rolbypassrls, false, "Function owner must not bypass RLS.");
  const [membership] = await owner`SELECT COUNT(*)::int AS count FROM pg_auth_members WHERE roleid='agent_hq_fn_owner_ci'::regrole`;
  assert.equal(membership.count, 0, "Runtime roles must not be members of the function owner.");
  const taskIds = [];
  const idByRole = new Map();
  const messageKeys = [];
  const artifactIds = [];
  const runIds = [];
  try {
    for (const role of roles) {
      const [task] = await owner`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,status)
        VALUES (${role},${"Role matrix " + role + " " + marker},'Role isolation test','One visible row','role-matrix-test','queued')
        RETURNING id`;
      taskIds.push(task.id);
      idByRole.set(role, task.id);
    }

    const [seoArtifact] = await owner`INSERT INTO agent_artifacts
      (task_id,created_by,artifact_type,title,content)
      VALUES (${idByRole.get("seo")},'seo','result','SEO scoped artifact','Only QA and SEO may see this artifact') RETURNING id`;
    const [geoArtifact] = await owner`INSERT INTO agent_artifacts
      (task_id,created_by,artifact_type,title,content)
      VALUES (${idByRole.get("geo")},'geo','result','GEO scoped artifact','Only coordinator and GEO may see this artifact') RETURNING id`;
    artifactIds.push(seoArtifact.id, geoArtifact.id);
    const [seoRun] = await owner`INSERT INTO agent_runs
      (task_id,role,worker_id,provider,model,status,cost_microusd)
      VALUES (${idByRole.get("seo")},'seo','matrix-seo','ci','mock','running',100) RETURNING id`;
    const [geoRun] = await owner`INSERT INTO agent_runs
      (task_id,role,worker_id,provider,model,status,cost_microusd)
      VALUES (${idByRole.get("geo")},'geo','matrix-geo','ci','mock','running',200) RETURNING id`;
    runIds.push(seoRun.id, geoRun.id);
    await owner`INSERT INTO agent_task_access (task_id,principal,access_reason)
      VALUES (${idByRole.get("seo")},'qa_security','qa_review'),
             (${idByRole.get("geo")},'coordinator','coordinator_oversight')`;

    // The test-only SECURITY DEFINER aggregate is intentionally callable
    // only by the disposable DB owner, never by runtime LOGINs.
    const [trustedBudget] = await owner`SELECT daily_cost,monthly_cost
      FROM public.agent_test_budget_totals()`;
    assert.ok(Number(trustedBudget.daily_cost) >= 300,
      "Trusted owner aggregate must include costs hidden by per-role RLS.");
    assert.ok(Number(trustedBudget.monthly_cost) >= 300);

    for (const role of roles) {
      const suffix = "ROLE_" + role.toUpperCase();
      const url = process.env["AGENT_HQ_ROLE_TEST_URL_" + suffix];
      assert.ok(url, "Missing disposable PostgreSQL login for " + role + " (" + suffix + ").");
      const sql = postgres(url, { max: 1, idle_timeout: 5 });
      try {
        const [identity] = await sql`SELECT session_user AS login, public.agent_role_for_session() AS mapped_role`;
        assert.equal(identity.login, "agent_" + role);
        assert.equal(identity.mapped_role, role);

        // RLS intentionally hides other roles' run rows. A worker-side SUM is
        // therefore role-local; global caps must use a trusted aggregate function.
        const visibleRuns = await sql`SELECT id,role,cost_microusd FROM agent_runs
          WHERE id = ANY(${runIds}::bigint[]) ORDER BY id`;
        const expectedRuns = role === "seo" ? [seoRun] : role === "geo" ? [geoRun] : [];
        assert.deepEqual(visibleRuns.map(row => String(row.id)).sort(),
          expectedRuns.map(row => String(row.id)).sort(),
          role + " must not read other roles' run rows; global budget totals need a separate trusted aggregate.");
        const [visibleSpend] = await sql`SELECT COALESCE(SUM(cost_microusd),0) AS total
          FROM agent_runs WHERE id = ANY(${runIds}::bigint[])`;
        const expectedSpend = role === "seo" ? 100 : role === "geo" ? 200 : 0;
        assert.equal(Number(visibleSpend.total), expectedSpend,
          role + " must not aggregate another role's hidden run cost.");
        const visible = await sql`SELECT id,assigned_role FROM agent_tasks
          WHERE id = ANY(${taskIds}::bigint[]) ORDER BY id`;
        const expectedVisibleIds = role === "qa_security"
          ? [idByRole.get(role), idByRole.get("seo")]
          : role === "coordinator"
            ? [idByRole.get(role), idByRole.get("geo")]
            : [idByRole.get(role)];
        assert.deepEqual(visible.map(row => String(row.id)).sort(),
          expectedVisibleIds.map(String).sort(),
          role + " must see only its own task and explicitly granted task access.");

        const scopedArtifacts = await sql`SELECT id,task_id FROM agent_artifacts
          WHERE id = ANY(${artifactIds}::bigint[]) ORDER BY id`;
        const expectedArtifactIds = role === "qa_security" ? [seoArtifact.id]
          : role === "coordinator" ? [geoArtifact.id]
          : role === "seo" ? [seoArtifact.id]
          : role === "geo" ? [geoArtifact.id] : [];
        assert.deepEqual(scopedArtifacts.map(row => String(row.id)).sort(),
          expectedArtifactIds.map(String).sort(),
          role + " must see only artifacts on its own task or explicitly granted task.");

        await assert.rejects(
          () => sql`UPDATE agent_tasks SET assigned_role='coordinator' WHERE id=${idByRole.get(role)}`,
          undefined,
          role + " must not change task routing identity."
        );
        await assert.rejects(
          () => sql`UPDATE agent_tasks SET budget_limit_microusd=1 WHERE id=${idByRole.get(role)}`,
          undefined,
          role + " must not change task budget ownership."
        );

        const ownInboxKey = "role-matrix-inbox-" + marker + "-" + role;
        messageKeys.push(ownInboxKey);
        await sql`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${idByRole.get(role)},${randomUUID()},${role},${role},'status','Message addressed to own role',${ownInboxKey})`;
        const ownInbox = await sql`SELECT id FROM agent_messages WHERE idempotency_key=${ownInboxKey}`;
        assert.equal(ownInbox.length, 1, role + " must read messages addressed to itself.");

        const ownKey = "role-matrix-own-" + marker + "-" + role;
        messageKeys.push(ownKey);
        await sql`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${idByRole.get(role)},${randomUUID()},${role},'coordinator','status','Own sender identity',${ownKey})`;
        if (role !== "coordinator") {
          const hidden = await sql`SELECT id FROM agent_messages WHERE idempotency_key=${ownKey}`;
          assert.equal(hidden.length, 0, role + " must not read messages addressed to another role.");
        }

        const forgedRole = role === "coordinator" ? "seo" : "coordinator";
        const forgedKey = "role-matrix-forged-" + marker + "-" + role;
        messageKeys.push(forgedKey);
        await assert.rejects(
          () => sql`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${idByRole.get(role)},${randomUUID()},${forgedRole},'coordinator','status','Forged sender',${forgedKey})`,
          undefined,
          role + " must not forge another role's sender identity."
        );
      } finally {
        await sql.end({ timeout: 5 });
      }
    }
  } finally {
    if (messageKeys.length) await owner`DELETE FROM agent_messages WHERE idempotency_key = ANY(${messageKeys}::varchar[])`;
    if (runIds.length) await owner`DELETE FROM agent_runs WHERE id = ANY(${runIds}::bigint[])`;
    if (artifactIds.length) await owner`DELETE FROM agent_artifacts WHERE id = ANY(${artifactIds}::bigint[])`;
    if (taskIds.length) await owner`DELETE FROM agent_tasks WHERE id = ANY(${taskIds}::bigint[])`;
    await owner.end({ timeout: 5 });
  }
});
