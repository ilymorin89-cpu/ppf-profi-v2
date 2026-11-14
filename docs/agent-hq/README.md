# PPF PROFI Agent HQ

Status: architecture foundation only. No autonomous workers are running yet.

## Goal
Build a real multi-agent system. Agents are separate worker processes with distinct role instructions, permissions, budgets and run histories. They communicate through durable PostgreSQL messages and tasks; the coordinator does not manually relay every message.

## MVP roles
1. Coordinator: decomposes goals, assigns work, resolves dependencies and escalates decisions.
2. Web Engineer: analyzes and proposes code changes on feature branches and opens PRs.
3. SEO / Indexing: audits crawlability, metadata, sitemap, robots, Yandex and Google indexation.
4. GEO / AI Visibility: measures visibility in Alice and answer engines and produces evidence-backed recommendations.
5. Growth / Leads: proposes experiments for qualified PPF leads, landing pages and channels.
6. Analytics: evaluates funnel, Metrika events, lead quality and experiments.
7. Independent QA / Security: challenges findings, checks evidence and blocks unsafe releases.

MVP uses seven logical roles but only 1–3 worker processes initially. Roles do not imply seven simultaneously running paid model sessions.

## Communication model
PostgreSQL is the durable source of truth. Planned tables: agent_tasks, agent_messages, agent_runs, agent_artifacts and agent_approvals. Messages are append-only and addressed to roles/tasks with correlation IDs. Workers claim tasks transactionally, post messages, and can create bounded child tasks. The QA agent can return an objection with evidence. The coordinator resolves it or escalates to the owner.

## Task lifecycle
queued -> claimed -> running -> review -> done. Alternative states: blocked, cancelled, dead_letter. Workers use leases and heartbeats. Expired leases return to queue with an incremented attempt count. Exceeded retry, cost or time limits go to dead letter.

## Guardrails
- No production deploy, paid advertising, external outreach, deletion, schema migration or secret changes without explicit owner approval.
- No secrets in prompts, logs, messages, artifacts or Git.
- Read-only research first. Code changes on isolated branches; tests and QA required before PR approval.
- Per-task and daily spend ceilings; hard timeouts; max attempts; circuit breaker; dead-letter state.
- No unbounded agent spawning. MVP cap: 3 concurrent worker processes, 7 logical roles, max 3 retries and max 10 child tasks per parent.
- Claims require evidence (URL, file path, test output, metric range) or must be labelled as a hypothesis.

## Proposed stack
Keep the existing Next.js customer website independent. Use the existing PostgreSQL database as durable task/message store and a separate Node.js worker service. Add an orchestration layer with explicit state transitions. Select LangGraph or a small typed state machine after architecture research. Do not add Redis, vector DB or paid SaaS until a measured need exists.

## Current repository status
This branch contains architecture docs only. No worker runtime, API key, database migration, server process or deployment has been created. Production main branch is untouched.

## Implementation increments
1. Finalize provider and cost policy.
2. Add schema migration and typed task/message repository.
3. Add worker runtime with lease, heartbeat, retry and dead-letter.
4. Add model adapter, role prompts and tool permission registry.
5. Add coordinator and QA handoff loop.
6. Add read-only admin dashboard and audit log.
7. Run sandbox simulation with mock agents; connect live providers only after approval.
8. Deploy worker separately after credentials and hosting approval.

## Acceptance criteria
At least three independent worker processes can exchange messages through PostgreSQL; agents can create bounded child tasks; QA can block and request revision; restart does not lose tasks or duplicate side effects; retry/time/spend ceilings are enforced; production actions require recorded owner approval.