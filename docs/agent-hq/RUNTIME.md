# Agent HQ runtime skeleton

This branch adds a PostgreSQL-backed task/message transport, lifecycle CLI and a first model-backed role worker. It is not deployed or running as a service.

## Files
- `drizzle/0003_agent_hq.sql`: durable tables for tasks, messages, runs, artifacts and approvals.\n- `drizzle/0004_agent_budget.sql`: fail-closed global daily, monthly and per-run spend limits plus model token pricing.
- `scripts/agent-hq-bus.mjs`: enqueue tasks, exchange role-to-role messages, inspect inboxes, claim tasks, renew leases, complete/fail tasks and recover expired leases.\n- `scripts/agent-hq-worker.mjs`: independent role process that claims tasks, calls the OpenAI Responses API, renews its lease, stores results and sends result/status messages. Workers can message other roles directly; only coordinator can create child tasks.\n- `scripts/agent-hq-supervisor.mjs`: watches coordinator parent tasks, waits for specialist children, creates an independent QA task and consolidates completed artifacts.
- `package.json`: `npm run agent-hq -- <command>` convenience script.

## Safe setup
1. Back up PostgreSQL.
2. Apply `drizzle/0003_agent_hq.sql` and `drizzle/0004_agent_budget.sql` in a staging database first. Do not apply them to production until staging validation and a separate deployment decision.\n3. Configure `agent_budget_config` in staging with explicit model pricing and caps. Values are micro-USD: 1 USD = 1,000,000 micro-USD. Example only (replace prices/caps with the actual selected model price and approved spend):\n   `UPDATE agent_budget_config SET enabled=TRUE, daily_cap_microusd=5000000, monthly_cap_microusd=50000000, per_run_cap_microusd=500000, input_price_per_million_microusd=<input_USD_per_1M_tokens*1000000>, output_price_per_million_microusd=<output_USD_per_1M_tokens*1000000>, updated_at=now() WHERE id=1;`\n   Keep `enabled=FALSE` until these values are verified.
3. Set `DATABASE_URL` only in the server-side worker environment. Never commit it or paste it into chat.
4. Install project dependencies and run the commands below.

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
```

- `claim` uses `FOR UPDATE SKIP LOCKED` and grants a three-minute lease.
- `heartbeat` renews the lease and moves the task to running.
- `complete` verifies lease ownership, marks the task done and saves a result artifact atomically.
- `fail` verifies lease ownership, records a status message and requeues the task until its attempt limit; exhausted tasks go to `dead_letter`.
- `recover` requeues expired leases or dead-letters tasks whose attempts are exhausted.

The model-backed worker renews its lease every 45 seconds and sends results to the coordinator inbox. Run one separate process per role/worker identity, plus one supervisor process. Coordinator tasks with delegated children remain in review; the supervisor waits for specialist work, creates a QA task, provides sibling artifacts to QA, then consolidates results. A blocked or failed specialist blocks the parent for manual coordinator intervention. QA must return an explicit `VERDICT: PASS`; `REVISE`, missing verdicts or unclear output block parent completion and notify coordinator. It currently has no website, shell, GitHub, ad-platform or messaging-provider tools; its only external action is a model API request. `AGENT_MAX_OUTPUT_TOKENS` defaults to 1200 and is capped at 8192. Model/API spend is not yet priced or hard-capped in currency, so do not launch unattended workers until provider billing limits are set. The CLI remains a manual transport/operations utility.\n\n## Integration tests\n\nAfter applying the migration to a disposable PostgreSQL test database, set `AGENT_HQ_TEST_DATABASE_URL` to that database and run `npm run agent-hq:test`. The test refuses to use the same URL as `DATABASE_URL`; it creates uniquely named test tasks and deletes them afterward. Never point it at production.

## Security and autonomy boundaries
- Each worker identity may renew, complete or fail only a task whose lease it owns.
- No worker receives database credentials in prompts or messages.
- External publishing, advertising spend, customer outreach, destructive database changes and production deployment must remain behind explicit approval records.
- Apply least-privilege tool permissions per role; QA must be independent from the worker being reviewed.

## Verification status
Static code review only. No database connection was made, no migration was applied, no live task was created, no tests were run against PostgreSQL, and no worker process was launched. The public website and production database were not changed.

## Remaining implementation
1. Add provider adapter and per-run cost/token accounting with hard limits.
2. Add persistent worker processes, scheduler/coordinator and automated lease heartbeat.
3. Add QA objection/revision loop, evidence validation and approval queue.
4. Add integration tests for concurrent claims, ownership, idempotency, retry exhaustion and lease expiry.
5. Add a protected admin view for task state, messages, artifacts, approvals and spend.
6. Deploy worker service separately from the public Next.js website after staging validation.
