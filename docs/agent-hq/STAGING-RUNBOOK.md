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
```

Use a separate staging database URL for runtime. Verify that the budget row exists and remains disabled:

```sql
SELECT enabled, daily_cap_microusd, monthly_cap_microusd,
       per_run_cap_microusd, input_price_per_million_microusd,
       output_price_per_million_microusd
FROM agent_budget_config WHERE id = 1;
```

Expected initial state: `enabled = false` and all caps/prices are zero. Do not enable workers until real model prices and owner-approved caps have been entered.

## 3. Configure secrets

Create one root-owned environment file per worker role under `/etc/ppf-agent-hq`. Set permissions to `0640` and group `ppf-agent`.

Required variables:

- `DATABASE_URL`: staging-only PostgreSQL URL.
- `OPENAI_API_KEY`: secret for this workload.
- `AGENT_MODEL`: exact model identifier approved for staging.
- `AGENT_ROLE`: one of `coordinator`, `web_engineer`, `seo`, `geo`, `growth`, `analytics`, `qa_security`.
- Optional: `AGENT_MAX_OUTPUT_TOKENS`, `AGENT_POLL_MS`, `AGENT_WORKER_ID`.

Do not paste secrets into chat, commit them, or reuse production credentials. Use the host's secret manager if available.

## 4. Enable a bounded staging budget

Only after the exact model pricing and caps have been confirmed, update the singleton row in staging. Values are integer micro-USD; 1 USD = 1,000,000 micro-USD. The price columns are micro-USD per million tokens.

Example SQL template (replace every placeholder with an explicitly approved numeric value; do not execute with placeholders):

```sql
UPDATE agent_budget_config
SET enabled = TRUE,
    daily_cap_microusd = <approved_daily_cap>,
    monthly_cap_microusd = <approved_monthly_cap>,
    per_run_cap_microusd = <approved_per_run_cap>,
    input_price_per_million_microusd = <verified_input_price>,
    output_price_per_million_microusd = <verified_output_price>,
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
- Confirm pending approvals are only recorded; no worker can execute them.
- Inspect `node scripts/agent-hq-bus.mjs status` and host logs after every test.

## 7. Service management and rollback

Use systemd (or an equivalent process supervisor) with one service instance per role and a separate supervisor process. Keep automatic restart enabled, but rate-limit restarts and alert on repeated failures. Do not expose worker ports publicly; workers do not need inbound HTTP access.

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

## Not included yet

- No production deployment, production migration, or production secrets.
- No web-site, GitHub-write, shell, advertising, payment, or customer-outreach tools.
- No approval execution UI or automatic approval execution.
- No claim that a full end-to-end live model/QA test has passed until it is run in staging and independently reviewed.
