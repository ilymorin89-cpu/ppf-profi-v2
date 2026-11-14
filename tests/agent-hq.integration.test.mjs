import test from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

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
