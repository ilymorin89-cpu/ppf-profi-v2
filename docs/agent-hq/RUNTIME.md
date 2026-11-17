# Agent HQ runtime skeleton

This branch adds a PostgreSQL-backed task/message transport, lifecycle CLI and a first model-backed role worker. It is not deployed or running as a service.

## Files
- `drizzle/0003_agent_hq.sql`: durable tables for tasks, messages, runs, artifacts and approvals.
- `drizzle/0004_agent_budget.sql`: fail-closed global daily, monthly and per-run spend limits plus model token pricing.
- `scripts/agent-hq-bus.mjs`: enqueue tasks, exchange role-to-role messages, inspect inboxes, claim tasks, renew leases, complete/fail tasks and recover expired leases. Role-bearing CLI arguments are checked against the role allowlist. Approval decisions require the current OS UID to be included in the root-owned `/etc/ppf-agent-hq/approver-uids` file (root-owned and not group/world-writable); the actor is derived from the UID, never accepted as free text.
- `scripts/agent-hq-worker.mjs`: independent role process that claims tasks, calls the OpenAI Responses API, can use hosted web search with citations, optionally reads text files from one explicitly configured GitHub repository/branch (read-only), renews its lease, stores results and sends result/status messages. Workers can message other roles directly; only coordinator can create child tasks. Any role can submit a pending approval request for restricted actions; requesting permission never executes the action.
- `scripts/agent-hq-supervisor.mjs`: watches coordinator parent tasks, waits for specialist children, creates an independent QA task and consolidates completed artifacts.
- `package.json`: `npm run agent-hq -- <command>` convenience script.

## Safe setup
1. Back up PostgreSQL.
2. Apply `drizzle/0003_agent_hq.sql` and `drizzle/0004_agent_budget.sql` in a staging database first. Do not apply them to production until staging validation and a separate deployment decision.
3. Configure `agent_budget_config` in staging with explicit model pricing and caps. Values are micro-USD: 1 USD = 1,000,000 micro-USD. Example only (replace prices/caps with the actual selected model price and approved spend):
   `UPDATE agent_budget_config SET enabled=TRUE, daily_cap_microusd=5000000, monthly_cap_microusd=50000000, per_run_cap_microusd=500000, input_price_per_million_microusd=<input_USD_per_1M_tokens*1000000>, output_price_per_million_microusd=<output_USD_per_1M_tokens*1000000>, updated_at=now() WHERE id=1;`
   Keep `enabled=FALSE` until these values are verified.
3. Set `DATABASE_URL` only in the server-side worker environment. Never commit it or paste it into chat.
4. Install project dependencies and run the commands below.

## One-command launch (recommended)

For a disposable staging host, copy `.env.agent-hq.example` to `.env` and fill in the role-specific database URLs, model and secret locally. Do not commit `.env`. Every selected role must have a distinct PostgreSQL login; the launcher checks this before starting.

```bash
# Check configuration, database connectivity and budget without starting workers
npm run agent-hq:launch -- check core

# Start coordinator + SEO + QA + supervisor
npm run agent-hq:launch -- start core

# Start a broader research group
npm run agent-hq:launch -- start research

# Stop the selected group (does not require API keys or DB secrets)
npm run agent-hq:launch -- stop core
```

Available groups: `core`, `research`, `all`. The launcher refuses to start if required settings are missing, PostgreSQL logins are reused, the database is unreachable, or the budget is disabled/zero. `check` reports a disabled budget without starting anything. The launcher does not create database users, apply migrations, enable the budget, or deploy the service. Workers remain off by default.

## Commands
```bash
npm run agent-hq -- enqueue seo 'Audit crawlability' 'Check robots, sitemap and key URLs; return evidence.'
npm run agent-hq -- send seo web_engineer 1 request 'Please inspect the crawl response for this URL.'
npm run agent-hq -- inbox web_engineer
npm run agent-hq -- claim seo seo-worker-01
npm run agent-hq -- heartbeat seo-worker-01 1
npm run agent-hq -- complete seo-worker-01 1 'Findings with evidence and recommended next action'
npm run agent-hq -- fail seo-worker-01 1 'Provider timeout'
npm run agent-hq -- recover
npm run agent-hq -- status
npm run agent-hq -- approvals
```

- `claim` uses `FOR UPDATE SKIP LOCKED` and grants a three-minute lease.
- `heartbeat` renews the lease and moves the task to running.
- `complete` verifies lease ownership, marks the task done and saves a result artifact atomically.
- `fail` verifies lease ownership, records a status message and requeues the task until its attempt limit; exhausted tasks go to `dead_letter`.
- `recover` requeues expired leases or dead-letters tasks whose attempts are exhausted.
- `status` reports task counts, recorded spend, configured caps and pending approvals.
- `approvals` lists pending approval requests without approving them.

The model-backed worker renews its lease every 45 seconds and sends results to the coordinator inbox. Run one separate process per role/worker identity, plus one supervisor process. Coordinator tasks with delegated children remain in review; the supervisor waits for specialist work, creates a QA task, provides sibling artifacts to QA, then consolidates results. A blocked or failed specialist blocks the parent for manual coordinator intervention. QA must return an explicit `VERDICT: PASS`; `REVISE`, missing verdicts or unclear output block parent completion and notify coordinator. It currently has no website, shell, ad-platform or messaging-provider tools. Its external capabilities are hosted web search and optional read-only GitHub file inspection; it cannot modify repositories, publish content, deploy, spend money or contact customers. `AGENT_MAX_OUTPUT_TOKENS` defaults to 1200 and is capped at 8192. Before launch, configure the exact selected model's input/output prices and approved caps in `agent_budget_config`; the migration defaults to disabled and workers refuse to start or claim tasks until valid caps are enabled. Worker reservations are conservative: they reserve estimated input plus the full output-token allowance before each call, serialize budget checks, and reconcile successful runs to reported usage. Provider-side billing limits are still recommended as a second barrier. The CLI remains a manual transport/operations utility.

## Integration tests

After applying the migration to a disposable PostgreSQL test database, set `AGENT_HQ_TEST_DATABASE_URL` to that database and run `npm run agent-hq:test`. The test refuses to use the same URL as `DATABASE_URL`; it creates uniquely named test tasks and deletes them afterward. Never point it at production.

## Security and autonomy boundaries
- Each worker identity may renew, complete or fail only a task whose lease it owns.
- No worker receives database credentials in prompts or messages.
- External publishing, advertising spend, customer outreach, destructive database changes and production deployment must remain behind explicit approval records. The worker exposes `request_approval` to create a pending record and notify coordinator; it has no tool to approve or execute that request.
- Apply least-privilege tool permissions per role; QA must be independent from the worker being reviewed.
- The manual CLI's OS-UID approval gate is suitable only for a trusted local operator account. It is not a network authentication system. The database currently uses one configured connection identity across roles; application-level role checks do not provide database-enforced tenant isolation. Do not expose a multi-user dashboard or run untrusted role processes until per-role DB identities/RLS or narrowly scoped database procedures have been implemented and tested.

## Verification status
The GitHub Actions workflow now provisions a disposable PostgreSQL 16 service, applies the two Agent HQ migrations, checks JavaScript syntax and runs the integration suite. The suite covers fail-closed budget defaults, concurrent exclusive claims, lease ownership, artifact completion, retry exhaustion and lease recovery. Check the PR's latest Actions run before treating the suite as passed. No production database connection or migration was made, no live task was created, and no worker process was launched. The public website and production database were not changed.

## Remaining implementation
1. Validate the CI run and expand tests for budget reservation races, approval integrity and supervisor QA lifecycle.
2. Add a protected owner/admin view for task state, messages, artifacts, approvals and spend.
3. Add least-privilege website and analytics read adapters; design GitHub write access as branch/PR-only and approval-gated. Keep publish, deploy, ads, external messages, spend and destructive database actions approval-gated.
4. Deploy persistent worker and supervisor processes separately from the public Next.js website only after staging validation and explicit production approval.
