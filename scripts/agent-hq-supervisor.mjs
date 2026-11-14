import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const workerId = process.env.AGENT_SUPERVISOR_ID || `supervisor-${process.pid}`;
const pollMs = Number(process.env.AGENT_POLL_MS || 5000);
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 });
const once = process.argv.includes("--once");
let stopping = false;

async function supervise() {
  const parents = await sql`SELECT id,title FROM agent_tasks WHERE assigned_role='coordinator' AND status='review'
    ORDER BY created_at LIMIT 25`;
  for (const parent of parents) {
    await sql.begin(async tx => {
      const [locked] = await tx`SELECT id FROM agent_tasks WHERE id=${parent.id} AND status='review' FOR UPDATE`;
      if (!locked) return;
      const children = await tx`SELECT id,assigned_role,status FROM agent_tasks WHERE parent_task_id=${parent.id} ORDER BY id`;
      if (!children.length) {
        await tx`UPDATE agent_tasks SET status='done',completed_at=now(),updated_at=now() WHERE id=${parent.id}`;
        return;
      }
      const qa = children.find(child => child.assigned_role === 'qa_security');
      const specialists = children.filter(child => child.assigned_role !== 'qa_security');
      if (specialists.some(child => !["done","dead_letter","blocked","cancelled"].includes(child.status))) return;
      if (specialists.some(child => child.status !== "done")) {
        await tx`UPDATE agent_tasks SET status='blocked',updated_at=now() WHERE id=${parent.id}`;
        await tx`INSERT INTO agent_messages
          (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
          VALUES (${parent.id},gen_random_uuid(),'supervisor','coordinator','status','One or more specialist tasks failed or were blocked. Parent task requires coordinator intervention.',${`supervisor-${parent.id}-blocked`}) ON CONFLICT (idempotency_key) DO NOTHING`;
        return;
      }
      if (!qa) {
        await tx`INSERT INTO agent_tasks
          (parent_task_id,assigned_role,title,objective,expected_output,acceptance_criteria,priority,created_by)
          VALUES (${parent.id},'qa_security',${`Independent QA: ${parent.title}`},
            ${`Independently review all specialist outputs for parent task ${parent.id}. Check factual support, completeness, contradictions, risks and whether acceptance criteria are met. Send direct objections to coordinator using send_message. Return a verdict: PASS or REVISE, list blockers and cite artifact IDs. Do not approve unsupported claims.`},
            'Independent verdict, blockers and artifact references','["Review every specialist artifact","Identify unsupported claims and missing evidence","Return PASS or REVISE verdict"]'::jsonb,20,'supervisor')
          ON CONFLICT DO NOTHING`;
        return;
      }
      if (qa.status === "done") {
        const [qaArtifact] = await tx`SELECT content FROM agent_artifacts WHERE task_id=${qa.id} ORDER BY created_at DESC LIMIT 1`;
        const verdict = (qaArtifact?.content || "").match(/VERDICT\\s*:\\s*(PASS|REVISE)/i)?.[1]?.toUpperCase();
        if (verdict !== "PASS") {
          await tx`UPDATE agent_tasks SET status='blocked',updated_at=now() WHERE id=${parent.id}`;
          await tx`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${parent.id},gen_random_uuid(),'qa_security','coordinator','objection',${(qaArtifact?.content || "QA completed without a clear PASS verdict").slice(0,8000)},${`qa-${qa.id}-revision-required`})
            ON CONFLICT (idempotency_key) DO NOTHING`;
          return;
        }
        const artifacts = await tx`SELECT a.id,a.created_by,a.artifact_type,a.title,a.content
          FROM agent_artifacts a JOIN agent_tasks c ON c.id=a.task_id
          WHERE c.parent_task_id=${parent.id} ORDER BY a.created_at`;
        const summary = artifacts.map(a => `[Artifact ${a.id} | ${a.created_by} | ${a.title}]\\n${a.content}`).join("\\n\\n");
        await tx`INSERT INTO agent_artifacts (task_id,created_by,artifact_type,title,content)
          VALUES (${parent.id},'supervisor','consolidated',${parent.title},${summary.slice(0,50000)})`;
        await tx`UPDATE agent_tasks SET status='done',completed_at=now(),updated_at=now() WHERE id=${parent.id}`;
      } else if (["dead_letter","blocked","cancelled"].includes(qa.status)) {
        await tx`UPDATE agent_tasks SET status='blocked',updated_at=now() WHERE id=${parent.id}`;
      }
    });
  }
}

try {
  while (!stopping) {
    await supervise();
    if (once) break;
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
} finally {
  await sql.end({ timeout: 5 });
}
