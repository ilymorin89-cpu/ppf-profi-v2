# Agent HQ staging runbook

This runbook prepares an isolated staging deployment. It does not authorize production deployment, external messages, advertising, or spend.

## Preconditions

- A dedicated Linux host or VM for long-running Node.js processes (not a serverless web-function runtime).
- A dedicated staging PostgreSQL database. Never point this service at the production database.
- Node.js 22 and npm installed.
- Repository checked out at the reviewed Agent HQ branch/commit.
- An OpenAI API key created for this workload and stored only in the host secret store.
- Owner-approved model name, exact input/output prices, and daily/monthly/per-run caps.

## 1. Prepare the host

Use a dedicated service account and a read-only application checkout where possible.

```sh
sudo useradd --system --create-home --shell /usr/sbin/nologin ppf-agent
sudo install -d -o root -g ppf-agent -m 0750 /opt/ppf-agent-hq
sudo install -d -o root -g ppf-agent -m 0750 /etc/ppf-agent-hq
```

Check out the reviewed branch into `/opt/ppf-agent-hq`, then install dependencies:

```sh
cd /opt/ppf-agent-hq
npm ci --omit=dev
```

Do not put `.env` files or credentials in the repository.

## 2. Create and migrate the staging database

Create a new database and a dedicated login for Agent HQ. Keep the migration owner separate from the runtime login where practical. Apply only the Agent HQ migrations to the new database:

```sh
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0003_agent_hq.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0004_agent_budget.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0005_agent_approval_idempotency.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0006_agent_web_search_budget.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0007_agent_task_access.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0008_agent_budget_trusted_settlement.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0009_agent_hq_runtime_rls.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0010_agent_hq_authenticated_worker_identity.sql
```

Use a separate staging database URL for runtime. The staging database name is pinned to `agent_hq_staging`; do not point this procedure at the production database. Before creating worker services, register all 19 unique worker LOGINs and immutable worker IDs in `agent_worker_principals`, and create distinct `agent_supervisor` and `agent_operator` LOGINs. Keep both SECURITY DEFINER function-owner roles as NOLOGIN.

Run the fail-closed preflight with a TLS-enabled, read-only-capable staging migration/verification account. It checks the exact database name, TLS, the disabled budget, all 19 enabled principals, unique LOGINs/worker IDs, least-privilege LOGIN attributes, separate supervisor/operator LOGINs and NOLOGIN function owners. It makes no changes and makes no provider calls:

```sh
STAGING_DATABASE_URL='postgresql://<staging-verifier>:<secret>@<staging-host>:5432/agent_hq_staging?sslmode=require' npm run agent-hq:staging-preflight
```

Do not paste the URL into chat, shell history or CI logs. Supply it through the host secret manager/environment injection. The command must print `result: PASS`; otherwise stop and fix the reported blocker.

Use a separate staging database URL for runtime. Verify that the budget row exists and remains disabled:

```sql
SELECT enabled, daily_cap_microusd, monthly_cap_microusd,
       per_run_cap_microusd, input_price_per_million_microusd,
       output_price_per_million_microusd,
       web_search_price_microusd_per_call
FROM agent_budget_config WHERE id = 1;
```

Expected initial state: `enabled = false` and all caps/prices, including the web-search call price, are zero. Do not enable workers until real model prices and owner-approved caps have been entered.

## 3. Configure secrets

Create one root-owned environment file per worker role under `/etc/ppf-agent-hq`. Each role must use its own PostgreSQL LOGIN and its own connection URL; never reuse one shared runtime login for all agents. Compose variables are `AGENT_HQ_DATABASE_URL_COORDINATOR`, `AGENT_HQ_DATABASE_URL_COMMUNITY_MANAGER`, `AGENT_HQ_DATABASE_URL_QA_SECURITY`, `AGENT_HQ_DATABASE_URL_WEB_ENGINEER`, `AGENT_HQ_DATABASE_URL_SEO`, `AGENT_HQ_DATABASE_URL_ANALYTICS`, and `AGENT_HQ_DATABASE_URL_SUPERVISOR`. Set permissions to `0640` and group `ppf-agent`.

Required variables:

- `DATABASE_URL`: the staging-only PostgreSQL URL for this exact role's dedicated login. The coordinator, every specialist, QA and supervisor must not share a database login.
- `OPENAI_API_KEY`: secret for this workload.
- `AGENT_MODEL`: exact model identifier approved for staging.
- `AGENT_ROLE`: one of `coordinator`, `web_engineer`, `seo`, `geo`, `growth`, `analytics`, `qa_security`, `vk_strategist`, `copywriter`, `designer`, `image_generator`, `storyteller`, `community_manager`, `content_seo`, `ads_manager`, `trend_scout`, `auto_news_editor`, `auto_law_monitor`, `fact_checker`.
- Optional: `AGENT_MAX_OUTPUT_TOKENS`, `AGENT_POLL_MS`, `AGENT_WORKER_ID`, `AGENT_WEB_SEARCH_ENABLED`.
- For the local operator CLI only: create `/etc/ppf-agent-hq/approver-uids` as a root-owned file containing comma-separated numeric Linux UIDs authorized to approve/reject requests. Set owner `root`, group `ppf-agent`, mode `0640`. The CLI verifies root ownership and rejects group/world-writable files, then derives the actor from the process UID; callers cannot supply an arbitrary owner name. This is an OS-account gate, not a substitute for a protected authenticated dashboard or database-enforced role isolation.
- Optional read-only repository inspection: `GITHUB_TOKEN` with only Contents: Read permission, `AGENT_GITHUB_REPOSITORY=owner/repo`, and `AGENT_GITHUB_REF` set to the reviewed branch. Never grant Contents: Write to the agent token.

Do not paste secrets into chat, commit them, or reuse production credentials. Use the host's secret manager if available.

## 4. Enable a bounded staging budget

Only after the exact model pricing and caps have been confirmed, update the singleton row in staging. Values are integer micro-USD; 1 USD = 1,000,000 micro-USD. The token price columns are micro-USD per million tokens. The hosted web-search call price is micro-USD per search call; configure it from the current provider price schedule before enabling web search.

Example SQL template (replace every placeholder with an explicitly approved numeric value; do not execute with placeholders):

```sql
UPDATE agent_budget_config
SET enabled = TRUE,
    daily_cap_microusd = <approved_daily_cap>,
    monthly_cap_microusd = <approved_monthly_cap>,
    per_run_cap_microusd = <approved_per_run_cap>,
    input_price_per_million_microusd = <verified_input_price>,
    output_price_per_million_microusd = <verified_output_price>,
    web_search_price_microusd_per_call = <verified_search_price_per_call>,
    updated_at = now()
WHERE id = 1;
```

Set conservative staging-only limits. The worker reserves a worst-case estimate before making a model call and refuses to run when limits are disabled or exhausted. Also set a provider-side spend limit as an independent backstop.

## 5. Run a single smoke test

First enqueue a harmless task, then start exactly one coordinator worker in a controlled terminal/session. The worker's `--once` mode exits after one claim cycle, so enqueue must happen first.

```sh
set -a
. /etc/ppf-agent-hq/coordinator.env
set +a
node scripts/agent-hq-bus.mjs enqueue coordinator "Staging smoke test" "Verify the staging queue and report that no external actions are available."
node scripts/agent-hq-worker.mjs --once
node scripts/agent-hq-bus.mjs status
```

The environment file must contain the staging-only `DATABASE_URL`, `OPENAI_API_KEY`, `AGENT_MODEL`, and `AGENT_ROLE=coordinator`. Run the bus command with the same staging `DATABASE_URL`. Never run a command with an unset or production `DATABASE_URL`.

For a full delegated lifecycle, start the specialist workers with their own role-specific environment files, keep the supervisor running, and enqueue a coordinator task whose acceptance criteria require specialist work and independent QA. Do not start all roles until the single-worker smoke test succeeds.

## 6. Validate before expanding

- Confirm tasks move through queued, claimed/running, review, and terminal states as expected.
- Confirm messages and artifacts are persisted and visible to the intended roles.
- Confirm QA blocks a parent without an explicit `VERDICT: PASS`.
- Confirm disabled/exhausted budgets prevent model calls and block tasks with a coordinator notification.
- Confirm expired leases recover and retries stop at `max_attempts`.
- Confirm pending approvals are only recorded; no worker can execute them. Owner decisions can be recorded through the trusted local bus CLI with `approve <id> [note]` or `reject <id> [note]`, but only when the process UID is listed in the root-owned `/etc/ppf-agent-hq/approver-uids` file; the audit actor is recorded as `uid:<number>`. These commands do not execute the requested action. Do not expose the CLI directly over a network.
- Inspect `node scripts/agent-hq-bus.mjs status` and host logs after every test.

## 7. Service management and rollback

Use systemd (or an equivalent process supervisor) with one service instance per role and a separate supervisor process. Keep automatic restart enabled, but rate-limit restarts and alert on repeated failures. Do not expose worker ports publicly; workers do not need inbound HTTP access. The supplied units send SIGTERM, use mixed process-group termination and allow 150 seconds for graceful shutdown. The supervisor finishes its current database cycle, wakes immediately from its polling sleep, and closes its database pool. Verify `systemctl stop` completes within the configured timeout and inspect service logs before restarting.

Workers handle `SIGTERM` and `SIGINT` by stopping new claims and aborting an in-flight provider request. A failed heartbeat also aborts the active request and stops further tool execution. If a provider request may already have been accepted, the reservation is marked `unknown` and retained for operator reconciliation; it is never automatically released merely because shutdown or lease loss interrupted the response. Allow the service manager a bounded stop timeout longer than the provider request cancellation and database cleanup window, then verify the worker exited and inspect unknown reservations before restarting affected tasks.

To stop the system, stop the supervisor and every worker service, then disable the staging budget row:

```sql
UPDATE agent_budget_config SET enabled = FALSE, updated_at = now() WHERE id = 1;
```

Keep staging data for diagnosis or remove it only through an explicitly reviewed cleanup procedure.

## 8. Install systemd units

The repository includes hardened unit templates in `deploy/systemd/`. After checking the paths and service account on the host:

```sh
sudo install -o root -g root -m 0644 deploy/systemd/agent-hq-worker@.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/agent-hq-supervisor.service /etc/systemd/system/
sudo systemctl daemon-reload
```

Create one environment file per role at `/etc/ppf-agent-hq/<role>.env`, including the matching `AGENT_ROLE`. Then enable only the roles needed for the staging test, for example:

```sh
sudo systemctl enable --now agent-hq-worker@coordinator
sudo systemctl enable --now agent-hq-worker@seo
sudo systemctl enable --now agent-hq-worker@qa_security
sudo systemctl enable --now agent-hq-supervisor
```

Do not enable all roles by default. Add specialists only when a test requires them. Review logs with `journalctl -u agent-hq-worker@coordinator -f` and `journalctl -u agent-hq-supervisor -f`. To stop staging, stop and disable each enabled worker instance and the supervisor before disabling the budget.

## 9. Install read-only staging monitoring

The monitor is pinned to `agent_hq_staging`, requires TLS and the authenticated `agent_supervisor` LOGIN, and performs read-only checks for the 19 worker principals, budget safety, expired leases and unknown/active reservations. It emits a JSON result to the system journal and exits non-zero on critical conditions. It does not send external notifications.

Create `/etc/ppf-agent-hq/monitor.env` using the secret manager with a staging-only `DATABASE_URL` authenticated as `agent_supervisor`; do not reuse a production URL. Install and enable the timer:

```sh
sudo install -o root -g root -m 0644 deploy/systemd/agent-hq-monitor.service /etc/systemd/system/
sudo install -o root -g root -m 0644 deploy/systemd/agent-hq-monitor.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now agent-hq-monitor.timer
sudo systemctl start agent-hq-monitor.service
sudo journalctl -u agent-hq-monitor.service --since "10 minutes ago"
```

A successful check prints `"status": "OK"`. A `CRITICAL` result or non-zero service result requires operator investigation. Configure the host's existing monitoring/alerting platform to alert on failed `agent-hq-monitor.service` runs and repeated worker/supervisor restarts. No webhook, email, Telegram or other external alert destination is configured by this repository.

## Database role isolation status

The current branch contains a disposable-CI-only RLS harness at `tests/agent-hq-role-isolation.sql` and negative tests using distinct PostgreSQL logins. Migration `0007_agent_task_access.sql` creates the scoped access registry; the supervisor grants coordinator visibility to a parent's child tasks and QA visibility to sibling specialist tasks before QA runs. Supervisor lifecycle tests assert these grants. This migration does **not** enable RLS or create role logins. The RLS policies remain a CI prototype and do not yet cover every runtime operation/column with final least privilege. Do not connect live workers or enable RLS until role-specific PostgreSQL logins, table/sequence grants, column-level restrictions, and end-to-end tests for claim, heartbeat, messages, runs, artifacts, approvals and supervisor lifecycle have been reviewed on a disposable staging database. The compose variables are deliberately separate and default empty.

## Not included yet

- No production deployment, production migration, or production secrets.
- No web-site, GitHub-write, shell, advertising, payment, or customer-outreach tools.
- No approval execution UI or automatic approval execution.
- No claim that a full end-to-end live model/QA test has passed until it is run in staging and independently reviewed.
