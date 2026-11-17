import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const workerId = process.env.AGENT_SUPERVISOR_ID || `supervisor-${process.pid}`;
const pollMs = Number(process.env.AGENT_POLL_MS || 5000);
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { max: 2, idle_timeout: 20 });
const [databaseIdentity] = await sql`SELECT session_user AS login`;
if (databaseIdentity?.login !== "agent_supervisor") {
  await sql.end({ timeout: 5 });
  throw new Error(`Supervisor must authenticate as PostgreSQL LOGIN "agent_supervisor"; received "${databaseIdentity?.login || "unknown"}".`);
}
const once = process.argv.includes("--once");
let stopping = false;

async function supervise() {
  const recovered = await sql`SELECT * FROM public.agent_budget_recover_expired_tasks()`;
  for (const item of recovered) {
    if (item.recovery_status === "blocked" && item.has_open_reservation) {
      await sql`INSERT INTO agent_messages
        (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
        VALUES (${item.task_id},gen_random_uuid(),'supervisor','coordinator','status',
          'Expired worker lease has an active or unknown budget reservation. Automatic retry is blocked pending operator reconciliation.',
          ${"budget-recovery-" + item.task_id})
        ON CONFLICT (idempotency_key) DO NOTHING`;
    }
  }
  const parents = await sql`SELECT id,title,objective,acceptance_criteria,attempts,max_attempts FROM agent_tasks WHERE assigned_role='coordinator' AND status='review'
    ORDER BY created_at LIMIT 25`;
  for (const parent of parents) {
    await sql.begin(async tx => {
      const [locked] = await tx`SELECT id FROM agent_tasks WHERE id=${parent.id} AND status='review' FOR UPDATE`;
      if (!locked) return;
      const children = await tx`SELECT id,assigned_role,status,created_at FROM agent_tasks WHERE parent_task_id=${parent.id} ORDER BY created_at,id`;
      // The supervisor is the only component that grants cross-role visibility.
      // Coordinator access is scoped to this parent's child tasks; QA access is
      // added below only for specialist artifacts that QA must independently review.
      for (const child of children) {
        await tx`INSERT INTO agent_task_access (task_id,principal,access_reason)
          VALUES (${child.id},'coordinator','coordinator_oversight')
          ON CONFLICT (task_id,principal) DO NOTHING`;
      }
      if (!children.length) {
        await tx`UPDATE agent_tasks SET status='done',completed_at=now(),updated_at=now() WHERE id=${parent.id}`;
        return;
      }
      const qa = children.filter(child => child.assigned_role === 'qa_security').at(-1);
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
            ${`Parent objective: ${parent.objective}\nParent acceptance criteria: ${JSON.stringify(parent.acceptance_criteria || [])}\nIndependently review all specialist outputs for parent task ${parent.id}. Check factual support, completeness, contradictions, risks and whether each acceptance criterion is met. Send direct objections to coordinator using send_message. Return a verdict: PASS or REVISE, list blockers and cite artifact IDs. Do not approve unsupported claims.`},
            'Independent verdict, blockers and artifact references','["Review every specialist artifact","Identify unsupported claims and missing evidence","Return PASS or REVISE verdict"]'::jsonb,20,'supervisor')
          ON CONFLICT DO NOTHING`;
        const [createdQa] = await tx`SELECT id FROM agent_tasks
          WHERE parent_task_id=${parent.id} AND assigned_role='qa_security'
          ORDER BY created_at DESC LIMIT 1`;
        if (createdQa) {
          for (const specialist of specialists) {
            await tx`INSERT INTO agent_task_access (task_id,principal,access_reason)
              VALUES (${specialist.id},'qa_security','qa_review')
              ON CONFLICT (task_id,principal) DO NOTHING`;
          }
        }
        return;
      }
      if (qa.status === "done") {
        const [qaArtifact] = await tx`SELECT content FROM agent_artifacts WHERE task_id=${qa.id} ORDER BY created_at DESC LIMIT 1`;
        const verdict = (qaArtifact?.content || "").match(/VERDICT\s*:\s*(PASS|REVISE)/i)?.[1]?.toUpperCase();
        if (verdict !== "PASS") {
          const revisionTasks = specialists.filter(child =>
            new Date(child.created_at).getTime() > new Date(qa.created_at).getTime()
          );
          if (verdict === "REVISE" && revisionTasks.length > 0) {
            // Coordinator has submitted revised specialist work after the last QA.
            // Wait until every specialist is complete (checked above), then create a fresh independent QA pass.
            await tx`INSERT INTO agent_tasks
              (parent_task_id,assigned_role,title,objective,expected_output,acceptance_criteria,priority,created_by)
              VALUES (${parent.id},'qa_security',${`Independent QA revision: ${parent.title}`},
                ${`Previous QA task ${qa.id} returned REVISE. Re-review the complete specialist output set after Coordinator revision for parent task ${parent.id}. Prior QA findings: ${(qaArtifact?.content || "").slice(0,5000)}. Verify each acceptance criterion independently and return VERDICT: PASS or VERDICT: REVISE with blockers and artifact IDs.`},
                'Independent revision verdict, blockers and artifact references',
                '["Review all specialist artifacts created for this revision","Verify prior QA blockers are resolved","Return explicit PASS or REVISE verdict"]'::jsonb,20,'supervisor')
              ON CONFLICT DO NOTHING`;
            for (const specialist of specialists) {
              await tx`INSERT INTO agent_task_access (task_id,principal,access_reason)
                VALUES (${specialist.id},'qa_security','qa_review')
                ON CONFLICT (task_id,principal) DO NOTHING`;
            }
            return;
          }

          const objection = (qaArtifact?.content || "QA completed without a clear PASS verdict").slice(0,8000);
          if (verdict === "REVISE" && Number(parent.attempts) < Number(parent.max_attempts)) {
            // Requeue the coordinator parent so it can act on QA's objection.
            // The next QA task is created only after new specialist tasks exist and finish.
            await tx`UPDATE agent_tasks SET status='queued',completed_at=NULL,updated_at=now() WHERE id=${parent.id}`;
          } else {
            await tx`UPDATE agent_tasks SET status='blocked',updated_at=now() WHERE id=${parent.id}`;
          }
          await tx`INSERT INTO agent_messages
            (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
            VALUES (${parent.id},gen_random_uuid(),'qa_security','coordinator','objection',
              ${objection + (verdict === "REVISE" && Number(parent.attempts) < Number(parent.max_attempts)
                ? "\\n\\nCoordinator task requeued. Create revised specialist tasks addressing the blockers before requesting another QA pass."
                : "\\n\\nRevision limit reached or QA verdict invalid. Owner intervention is required.")},
              ${`qa-${qa.id}-revision-required`})
            ON CONFLICT (idempotency_key) DO NOTHING`;
          return;
        }
        const artifacts = await tx`SELECT a.id,a.created_by,a.artifact_type,a.title,a.content
          FROM agent_artifacts a JOIN agent_tasks c ON c.id=a.task_id
          WHERE c.parent_task_id=${parent.id} ORDER BY a.created_at`;
        const summary = artifacts.map(a => `[Artifact ${a.id} | ${a.created_by} | ${a.title}]\n${a.content}`).join("\n\n");
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
