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
  const taskIds = [];
  const idByRole = new Map();
  const messageKeys = [];
  try {
    for (const role of roles) {
      const [task] = await owner`INSERT INTO agent_tasks
        (assigned_role,title,objective,expected_output,created_by,status)
        VALUES (${role},${"Role matrix " + role + " " + marker},'Role isolation test','One visible row','role-matrix-test','queued')
        RETURNING id`;
      taskIds.push(task.id);
      idByRole.set(role, task.id);
    }

    for (const role of roles) {
      const suffix = "ROLE_" + role.toUpperCase();
      const url = process.env["AGENT_HQ_ROLE_TEST_URL_" + suffix];
      assert.ok(url, "Missing disposable PostgreSQL login for " + role + " (" + suffix + ").");
      const sql = postgres(url, { max: 1, idle_timeout: 5 });
      try {
        const [identity] = await sql`SELECT session_user AS login, public.agent_role_for_session() AS mapped_role`;
        assert.equal(identity.login, "agent_" + role);
        assert.equal(identity.mapped_role, role);

        const visible = await sql`SELECT id,assigned_role FROM agent_tasks
          WHERE id = ANY(${taskIds}::bigint[]) ORDER BY id`;
        assert.equal(visible.length, 1, role + " must not see another role's task.");
        assert.equal(String(visible[0].id), String(idByRole.get(role)));
        assert.equal(visible[0].assigned_role, role);

        const ownKey = "role-matrix-own-" + marker + "-" + role;
        messageKeys.push(ownKey);
        await sql`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${idByRole.get(role)},${randomUUID()},${role},'coordinator','status','Own sender identity',${ownKey})`;

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
    if (taskIds.length) await owner`DELETE FROM agent_tasks WHERE id = ANY(${taskIds}::bigint[])`;
    await owner.end({ timeout: 5 });
  }
});
