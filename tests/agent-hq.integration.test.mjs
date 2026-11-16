import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { calculateRunCost, mayExecuteToolCalls, parseApprovalPayload, uniqueCitations } from "../scripts/agent-hq-helpers.mjs";

test("Agent HQ worker safety helpers", async () => {
  assert.deepEqual(parseApprovalPayload('{"mode":"review"}'), { mode: "review" });
  assert.deepEqual(parseApprovalPayload("plain text approval context"), { text: "plain text approval context" });
  assert.deepEqual(parseApprovalPayload(""), {});
  assert.equal(parseApprovalPayload("x".repeat(13000)).text.length, 12000);
  assert.equal(mayExecuteToolCalls(0, 4), true);
  assert.equal(mayExecuteToolCalls(2, 4), true);
  assert.equal(mayExecuteToolCalls(3, 4), false);
  assert.equal(mayExecuteToolCalls(-1, 4), false);
  assert.equal(mayExecuteToolCalls(0, 0), false);
  assert.deepEqual(calculateRunCost({
    inputTokens: 1000000, outputTokens: 500000,
    inputPricePerMillion: 2, outputPricePerMillion: 4,
    webSearchCalls: 3, webSearchPricePerCall: 10000
  }), { tokenCost: 4, searchCost: 30000, totalCost: 30004 });
  assert.throws(() => calculateRunCost({
    inputTokens: -1, outputTokens: 0, inputPricePerMillion: 1,
    outputPricePerMillion: 1, webSearchCalls: 0, webSearchPricePerCall: 0
  }), /finite non-negative/);
  assert.deepEqual(uniqueCitations([
    { url: "https://example.com/a", title: "A" },
    { url: "https://example.com/a", title: "duplicate" },
    { url: "javascript:alert(1)", title: "unsafe" },
    { url: "not-a-url" }
  ]), [{ url: "https://example.com/a", title: "A" }]);
});

const databaseUrl = process.env.AGENT_HQ_TEST_DATABASE_URL;
test("Agent HQ queue lifecycle (requires isolated migrated test database)", async t => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database; production DATABASE_URL is not used.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 5, idle_timeout: 5 });
  const role = `test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const workers = [`${role}_a`, `${role}_b`];
  let taskId;
  try {
    const [task] = await sql`INSERT INTO agent_tasks
      (assigned_role,title,objective,expected_output,created_by,max_attempts)
      VALUES (${role},'Integration test','Verify exclusive claim','Artifact','test',2)
      RETURNING id`;
    taskId = task.id;

    await t.test("budget config is fail-closed by default", async () => {
      const [budget] = await sql`SELECT enabled,daily_cap_microusd,monthly_cap_microusd,per_run_cap_microusd,web_search_price_microusd_per_call
        FROM agent_budget_config WHERE id=1`;
      assert.ok(budget, "0004_agent_budget.sql must be applied to the test database");
      assert.equal(budget.enabled, false);
      assert.equal(Number(budget.daily_cap_microusd), 0);
      assert.equal(Number(budget.monthly_cap_microusd), 0);
      assert.equal(Number(budget.per_run_cap_microusd), 0);
      assert.equal(Number(budget.web_search_price_microusd_per_call), 0);
    });

    await t.test("approval decisions are one-way and auditable", async () => {
      const [pending] = await sql`INSERT INTO agent_approvals
        (task_id,action,requested_by,payload,status)
        VALUES (${taskId},'other','test','{"reason":"test"}'::jsonb,'pending')
        RETURNING id`;
      const [duplicatePending] = await sql`INSERT INTO agent_approvals
        (task_id,action,requested_by,payload,status)
        VALUES (${taskId},'other','test','{"reason":"duplicate"}'::jsonb,'pending')
        ON CONFLICT (task_id,action) WHERE status='pending' DO NOTHING
        RETURNING id`;
      assert.equal(duplicatePending, undefined);
      const [approved] = await sql`UPDATE agent_approvals
        SET status='approved',decided_by='owner-test',decision_note='approved in integration test',decided_at=now()
        WHERE id=${pending.id} AND status='pending'
        RETURNING status,decided_by,decision_note,decided_at`;
      assert.equal(approved.status, "approved");
      assert.equal(approved.decided_by, "owner-test");
      const [secondDecision] = await sql`UPDATE agent_approvals
        SET status='rejected',decided_by='owner-test',decided_at=now()
        WHERE id=${pending.id} AND status='pending' RETURNING id`;
      assert.equal(secondDecision, undefined);
      await sql`DELETE FROM agent_approvals WHERE id=${pending.id}`;
    });

    await t.test("parallel workers cannot claim the same task", async () => {
      const claim = worker => sql.begin(tx => tx`
        WITH candidate AS (
          SELECT id FROM agent_tasks WHERE assigned_role=${role} AND status='queued'
          ORDER BY priority,created_at FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE agent_tasks t SET status='claimed',lease_owner=${worker},
          lease_until=now()+interval '3 minutes',attempts=t.attempts+1
        FROM candidate WHERE t.id=candidate.id RETURNING t.id,t.lease_owner`);
      const results = await Promise.all(workers.map(claim));
      const winners = results.flat();
      assert.equal(winners.length, 1);
      assert.equal(winners[0].id, taskId);
    });

    const [claimed] = await sql`SELECT lease_owner FROM agent_tasks WHERE id=${taskId}`;
    const owner = claimed.lease_owner;
    await t.test("only lease owner can heartbeat and complete", async () => {
      const [wrongOwner] = await sql`UPDATE agent_tasks SET lease_until=now()+interval '3 minutes'
        WHERE id=${taskId} AND lease_owner='not-the-owner' RETURNING id`;
      assert.equal(wrongOwner, undefined);
      const [heartbeat] = await sql`UPDATE agent_tasks SET status='running',
        lease_until=now()+interval '3 minutes' WHERE id=${taskId} AND lease_owner=${owner}
        AND status IN ('claimed','running') RETURNING id`;
      assert.equal(String(heartbeat.id), String(taskId));
      await sql.begin(async tx => {
        const [done] = await tx`UPDATE agent_tasks SET status='done',completed_at=now(),
          lease_owner=NULL,lease_until=NULL WHERE id=${taskId} AND lease_owner=${owner}
          RETURNING id,title,assigned_role`;
        assert.ok(done);
        await tx`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
          VALUES (${taskId},${done.assigned_role},'result',${done.title},'test result')`;
      });
      const [finalTask] = await sql`SELECT status FROM agent_tasks WHERE id=${taskId}`;
      const [artifact] = await sql`SELECT content FROM agent_artifacts WHERE task_id=${taskId}`;
      assert.equal(finalTask.status, "done");
      assert.equal(artifact.content, "test result");
    });

    await t.test("failure retries and expired lease recovery are bounded", async () => {
      const [retryTask] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,max_attempts,attempts,status,lease_owner,lease_until)
        VALUES (${role},'Retry test','Retry once','Artifact','test',2,1,'running',${workers[0]},now()-interval '1 minute')
        RETURNING id`;
      const [recovered] = await sql`UPDATE agent_tasks SET
        status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
        lease_owner=NULL,lease_until=NULL WHERE id=${retryTask.id} AND lease_until < now()
        RETURNING status`;
      assert.equal(recovered.status, "queued");
      const [deadTask] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,max_attempts,attempts,status,lease_owner,lease_until)
        VALUES (${role},'Exhausted test','No retries left','Artifact','test',2,2,'claimed',${workers[0]},now()-interval '1 minute')
        RETURNING id`;
      const [dead] = await sql`UPDATE agent_tasks SET
        status=CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead_letter' END,
        lease_owner=NULL,lease_until=NULL WHERE id=${deadTask.id} AND lease_until < now()
        RETURNING status`;
      assert.equal(dead.status, "dead_letter");
    });
  } finally {
    if (taskId) await sql`DELETE FROM agent_tasks WHERE assigned_role=${role}`;
    await sql.end({ timeout: 5 });
  }
});


test("Agent HQ supervisor and approval lifecycle (disposable database only)", async t => {
  assert.ok(databaseUrl, "Set AGENT_HQ_TEST_DATABASE_URL to a disposable PostgreSQL database.");
  assert.notEqual(databaseUrl, process.env.DATABASE_URL, "Test database must not equal DATABASE_URL.");
  const sql = postgres(databaseUrl, { max: 4, idle_timeout: 5 });
  const marker = randomUUID();
  let parentId;
  try {
    await t.test("coordinator → specialist → QA PASS → consolidated artifact", async () => {
      const [parent] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,acceptance_criteria,created_by,status)
        VALUES ('coordinator',${"Lifecycle " + marker},'Test parent objective','Consolidated artifact',
          '["specialist result is included","QA must PASS"]'::jsonb,'integration-test','review')
        RETURNING id`;
      parentId = parent.id;
      const [specialist] = await sql`INSERT INTO agent_tasks
        (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
        VALUES (${parentId},'seo','Specialist result','Produce evidence','Artifact','integration-test','done')
        RETURNING id`;
      await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${specialist.id},'seo','result','SEO findings','Verified finding from disposable test')`;

      const [qa] = await sql`INSERT INTO agent_tasks
        (parent_task_id,assigned_role,title,objective,expected_output,acceptance_criteria,priority,created_by)
        VALUES (${parentId},'qa_security','Independent QA','Review specialist artifact','Verdict',
          '["Review every specialist artifact"]'::jsonb,20,'supervisor')
        RETURNING id`;
      const [qaPending] = await sql`SELECT id,status FROM agent_tasks WHERE id=${qa.id}`;
      assert.equal(qaPending.status, "queued");

      await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${qa.id}`;
      await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: PASS\\nAll acceptance criteria met')`;

      const [qaArtifact] = await sql`SELECT content FROM agent_artifacts WHERE task_id=${qa.id}`;
      assert.match(qaArtifact.content, /VERDICT:\\s*PASS/i);
      const artifacts = await sql`SELECT a.id,a.created_by,a.title,a.content
        FROM agent_artifacts a JOIN agent_tasks c ON c.id=a.task_id
        WHERE c.parent_task_id=${parentId} ORDER BY a.created_at`;
      const summary = artifacts.map(a => `[Artifact ${a.id} | ${a.created_by} | ${a.title}]\\n${a.content}`).join("\\n\\n");
      await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${parentId},'supervisor','consolidated','Lifecycle result',${summary})`;
      await sql`UPDATE agent_tasks SET status='done',completed_at=now() WHERE id=${parentId}`;
      const [finalParent] = await sql`SELECT status FROM agent_tasks WHERE id=${parentId}`;
      const [finalArtifact] = await sql`SELECT content FROM agent_artifacts WHERE task_id=${parentId} AND artifact_type='consolidated'`;
      assert.equal(finalParent.status, "done");
      assert.match(finalArtifact.content, /Verified finding from disposable test/);
      assert.match(finalArtifact.content, /VERDICT: PASS/);
    });

    await t.test("QA without PASS blocks parent; approvals can be listed and decided once", async () => {
      const [parent] = await sql`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,status)
        VALUES ('coordinator',${"Blocked lifecycle " + marker},'Test rejection','Blocked','integration-test','review')
        RETURNING id`;
      const [qa] = await sql`INSERT INTO agent_tasks
        (parent_task_id,assigned_role,title,objective,expected_output,created_by,status)
        VALUES (${parent.id},'qa_security','QA reject','Review','Verdict','integration-test','done')
        RETURNING id`;
      await sql`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
        VALUES (${qa.id},'qa_security','review','QA verdict','VERDICT: REVISE\\nMissing evidence')`;
      const [qaArtifact] = await sql`SELECT content FROM agent_artifacts WHERE task_id=${qa.id}`;
      const verdict = qaArtifact.content.match(/VERDICT\\s*:\\s*(PASS|REVISE)/i)?.[1]?.toUpperCase();
      if (verdict !== "PASS") await sql`UPDATE agent_tasks SET status='blocked' WHERE id=${parent.id}`;
      const [blocked] = await sql`SELECT status FROM agent_tasks WHERE id=${parent.id}`;
      assert.equal(blocked.status, "blocked");

      const [pending] = await sql`INSERT INTO agent_approvals
        (task_id,action,requested_by,payload,status)
        VALUES (${parent.id},'spend_money','integration-test','{"reason":"test only"}'::jsonb,'pending')
        RETURNING id`;
      const listed = await sql`SELECT id,action,status FROM agent_approvals WHERE status='pending' AND id=${pending.id}`;
      assert.equal(listed.length, 1);
      const [approved] = await sql`UPDATE agent_approvals SET status='approved',decided_by='test-owner',
        decision_note='integration approval record only',decided_at=now()
        WHERE id=${pending.id} AND status='pending' RETURNING status,decided_by`;
      assert.equal(approved.status, "approved");
      assert.equal(approved.decided_by, "test-owner");
      const [secondDecision] = await sql`UPDATE agent_approvals SET status='rejected'
        WHERE id=${pending.id} AND status='pending' RETURNING id`;
      assert.equal(secondDecision, undefined);
      await sql`DELETE FROM agent_approvals WHERE id=${pending.id}`;
      await sql`DELETE FROM agent_tasks WHERE id=${parent.id}`;
    });
  } finally {
    if (parentId) await sql`DELETE FROM agent_tasks WHERE id=${parentId}`;
    await sql.end({ timeout: 5 });
  }
});
