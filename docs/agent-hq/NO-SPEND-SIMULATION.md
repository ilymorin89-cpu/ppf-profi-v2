# Agent HQ no-spend local simulation

Status: local-only simulation runner; not a production launcher.

The simulator runs exactly one worker pass using a deterministic response fixture. It does not call OpenAI, hosted web search, GitHub, VK, Timeweb or any external service. It is deliberately restricted to a local PostgreSQL database named `agent_hq_test` and the audited core LOGINs. It does not enable the normal worker services.

## Safety boundary

- Only `localhost` or `127.0.0.1` URLs are accepted.
- Both owner and runtime URLs must target `agent_hq_test`.
- The owner URL must use `agent_test`; each role URL must use its exact dedicated `agent_<role>` LOGIN.
- The child process receives a minimal environment, a dummy API key, a fixed model label, web search disabled and a deterministic mock Responses payload.
- The command always uses `--once`; it cannot start a polling worker.
- Supported roles: `coordinator`, `seo`, `qa_security`, `supervisor`.
- The runner never changes the database budget. A non-zero budget row is required by the current worker startup path, so any budget setup below is confined to the disposable local test database.
- This tests worker/database lifecycle with a stubbed response. It is not a live-model quality test and does not prove production RLS ownership.

## 1. Start a disposable PostgreSQL

Run from the repository root:

```sh
docker run --rm --name agent-hq-test-db \
  -e POSTGRES_USER=agent_test \
  -e POSTGRES_PASSWORD=agent_test \
  -e POSTGRES_DB=agent_hq_test \
  -p 55432:5432 -d postgres:16
```

Set local test URLs (do not put production URLs in this shell):

```sh
export AGENT_HQ_TEST_DATABASE_URL='postgres://agent_test:agent_test@127.0.0.1:55432/agent_hq_test'
export AGENT_HQ_ROLE_TEST_URL_COORDINATOR='postgres://agent_coordinator:ci_agent_coordinator@127.0.0.1:55432/agent_hq_test'
export AGENT_HQ_ROLE_TEST_URL_SEO='postgres://agent_seo:ci_agent_seo@127.0.0.1:55432/agent_hq_test'
export AGENT_HQ_ROLE_TEST_URL_QA_SECURITY='postgres://agent_qa_security:ci_agent_qa@127.0.0.1:55432/agent_hq_test'
export AGENT_HQ_ROLE_TEST_URL_SUPERVISOR='postgres://agent_supervisor:ci_agent_supervisor@127.0.0.1:55432/agent_hq_test'
```

Apply the same schema and disposable role harness used in CI:

```sh
for file in \
  drizzle/0003_agent_hq.sql \
  drizzle/0004_agent_budget.sql \
  drizzle/0005_agent_approval_idempotency.sql \
  drizzle/0006_agent_web_search_budget.sql \
  drizzle/0007_agent_task_access.sql \
  tests/agent-hq-role-isolation.sql
do
  psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file" || exit 1
done
```

## 2. Enable a non-zero test-only budget

The worker currently refuses to claim a task if the budget row is disabled or any cap is zero. Set tiny synthetic values only in the disposable database:

```sh
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "
UPDATE agent_budget_config
SET enabled=true,
    daily_cap_microusd=1000000,
    monthly_cap_microusd=5000000,
    per_run_cap_microusd=100000,
    input_price_per_million_microusd=1,
    output_price_per_million_microusd=1,
    web_search_price_microusd_per_call=0,
    updated_at=now()
WHERE id=1;
"
```

These values are simulated accounting data. The stub returns zero token usage and no web-search calls; the run is labeled `test_stub`, no provider is contacted and no money is spent. Never run this update against a non-test database.

## 3. Seed one task and run one simulated worker pass

Seed a task as the disposable database owner. Example for SEO:

```sh
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "
INSERT INTO agent_tasks
  (title,objective,expected_output,assigned_role,created_by)
VALUES
  ('SEO simulation smoke test',
   'Return the deterministic local simulation result.',
   'A stored result artifact and completed task.',
   'seo','owner');
"
```

Validate the target without connecting to PostgreSQL or starting a process:

```sh
npm run agent-hq:simulate -- check seo
```

Run one deterministic pass:

```sh
npm run agent-hq:simulate -- run seo
```

The runner overrides provider settings with a fixed test stub and passes no GitHub token or external integration credentials. The worker runs once and exits. Verify the task and artifact using the owner URL:

```sh
psql "$AGENT_HQ_TEST_DATABASE_URL" -c "
SELECT t.id,t.assigned_role,t.status,a.artifact_type,a.title
FROM agent_tasks t
LEFT JOIN agent_artifacts a ON a.task_id=t.id
WHERE t.title='SEO simulation smoke test'
ORDER BY t.id DESC;
"
```

Repeat only after checking the previous task state, using a new task title for each run. To exercise coordinator, seed a task with `assigned_role='coordinator'` and run `run coordinator`; the coordinator will move its parent task to `review`. Run `run supervisor` only after seeding an appropriate review parent and child task set.

## 4. Stop and remove the disposable database

```sh
docker rm -f agent-hq-test-db
```

## What this simulation proves — and does not prove

CI also executes this exact one-shot simulation after the regular integration suite, then asserts that the task is `done`, exactly one artifact exists, and the successful `test_stub` run has zero recorded cost. It removes the fixture rows and resets the disposable CI budget immediately afterward.

It proves that a local, dedicated PostgreSQL role can claim one queued task, pass through the worker's deterministic model-response seam, persist a result artifact, update the task/run records and exit without an external provider call.

It does not prove live OpenAI response quality, global production budget enforcement, production role ownership, Timeweb networking, production migrations, multi-worker concurrency under real deployment, or production readiness. Those remain separate gates.