# Agent HQ staging runbook

This runbook prepares an isolated staging deployment. It does not authorize production deployment, external messages, advertising, or spend.

## Timeweb App Platform: diagnose PostgreSQL reachability before workers

The existing Timeweb App Platform deployment is not a reason to create another server. Keep the production website application and its database untouched. The current Agent HQ Timeweb app must be treated as staging only after its repository branch and database target have been verified.

The GitHub branch selected in the supplied App Platform screenshot is `feat/vk-content-army`, at commit `d032f9d0fc272e5a0b31872021efad71f6ad23bf`. The exact `docker-compose.yml` at that commit contains only three worker services (`coordinator`, `community_manager`, `qa_security`), plus `gateway` and `supervisor`; all four runtime services reuse the single `AGENT_HQ_DATABASE_URL`. This is not the 19-worker, role-specific-LOGIN configuration in the newer reviewed Agent HQ branch. Do not turn workers on in this currently selected branch. The newer 19-worker Compose remains in Draft PRs and must pass review/CI before it is selected for staging.

The Timeweb screenshots supplied for this project show:
- App Platform framework: Docker Compose; compose path `/docker-compose.yml`.
- Selected deployment branch: `feat/vk-content-army`.
- App variables visible: `AGENT_HQ_DATABASE_URL` and `AGENT_HQ_WORKERS_ENABLED=false`.
- PostgreSQL service: `ppfprofi`; database `agent_hq`; role `agent_hq_user`; port `5432`.
- PostgreSQL public endpoint: `5.42.126.47:5432`; private endpoint: `192.168.0.4:5432`; private network CIDR: `192.168.0.0/24`.
- PostgreSQL users shown in the UI: `agent_hq_user`, `agent_worker`, `gen_user`.
- Existing application logs repeatedly report `EHOSTUNREACH` and `CONNECT_TIMEOUT`.

These observations do not prove that the App Platform container is attached to the PostgreSQL private network. Do not assume that `192.168.0.4` is reachable from App Platform merely because the database owns that private address. Confirm the App Platform network attachment / supported routing in Timeweb first.

Timeweb's current App Platform documentation supports attaching an existing backend/Docker Compose application to a private network after creation. In the Agent HQ app (not the production website), open **App Platform → ppf-agent-hq → Network** and verify that it is attached to the exact same private network shown for PostgreSQL (the supplied DB screenshot names it `Fair Cepheus`). If it is not attached, do not change it until the current deployment is confirmed to be the isolated Agent HQ app and a maintenance window is accepted: Timeweb says changing the network triggers a new deployment and can cause 1–5 minutes of downtime. When both services are in the same private network, use the database's private endpoint `192.168.0.4:5432`. If they are not in the same network, the private address will not route; do not repeatedly retry it. If the platform cannot join that private network, use only a provider-supported public connection with TLS and a firewall rule restricted to the actual App Platform egress source. Do not open PostgreSQL to `0.0.0.0/0`.

Run the secret-safe, read-only diagnostic from inside the Agent HQ application container, if the App Platform console supports an exec shell:

```sh
npm run agent-hq:db-check
```

It reads `AGENT_HQ_DATABASE_URL` (or `DATABASE_URL`), refuses any database other than `agent_hq` or port other than 5432, tests DNS/TCP/PostgreSQL authentication, requires TLS by default, and prints no password or connection URL. For a controlled non-TLS diagnostic only, set `AGENT_HQ_DB_REQUIRE_TLS=false`; do not use that mode for live staging. The command is read-only and makes no migrations or provider calls.

Interpret results:
- `stage=dns`: hostname resolution / DNS configuration issue.
- `stage=tcp`, `EHOSTUNREACH`: no route to the selected address; inspect App Platform network attachment and firewall routing before credentials.
- `stage=tcp`, `CONNECT_TIMEOUT`: packets are being dropped or no route responds; inspect network/firewall.
- `ECONNREFUSED`: route reached the host but PostgreSQL is not accepting connections on that address/port.
- `stage=postgres-authentication-or-tls`: TCP is reachable; inspect TLS setting, database, role and password using Timeweb secret UI, never chat.
- `status=PASS`: the diagnostic authenticated to `agent_hq` with TLS and reported the actual PostgreSQL session identity.

Do not change the existing Timeweb deployment branch, environment variables, firewall, network attachment, or database credentials as part of diagnosis. Capture the JSON diagnostic output with secrets absent, plus the Timeweb network/firewall view, before proposing a change.

The current screenshots show only one Agent HQ database URL and `AGENT_HQ_WORKERS_ENABLED=false`. The current reviewed Compose file expects distinct role-specific database URLs (`AGENT_HQ_DATABASE_URL_<ROLE>`) for each worker and a separate supervisor URL. Do not copy the same `agent_hq_user` URL into all 19 roles. Role-specific PostgreSQL identities and grants must be provisioned and verified before any worker is enabled.

## Timeweb infrastructure incident: 17 November 2026

Timeweb published a postmortem for a Cloud networking incident on 17 November 2026. The provider states that from 13:18 to 15:05 MSK some Cloud services in all locations except Novosibirsk lost network connectivity during a hypervisor network-stack update: the dynamic-routing service did not fully restart, so some hypervisors did not re-advertise routes. The VMs themselves continued running. Timeweb reports that it restarted the hypervisor network stack, restored most reachability by 14:17 MSK, and declared the incident fully recovered at 15:05 MSK. Source: Timeweb Cloud Alerts postmortem, reproduced at https://habr.com/ru/articles/1108972/ and https://telemetr.io/ru/channels/1826583437-timewebcloud_alerts/posts.

This incident is consistent with transient EHOSTUNREACH / CONNECT_TIMEOUT symptoms observed in the supplied Agent HQ logs on 17 November. It is not, by itself, proof that every later connection failure has the same cause or that this specific app/database pair recovered. Preserve the existing known-good endpoint and settings; do not rotate credentials, recreate the database, change private networking, or redeploy solely because of the incident. After the provider's recovery window, repeat read-only checks from the actual Agent HQ container: DNS (if hostname), TCP to the configured PostgreSQL host/5432, then TLS and authenticated SELECT current_database(), session_user, inet_server_addr(), inet_server_port(). Record timestamp (MSK), exact deployment commit, endpoint type (private/public), stage and error code. Never log the full database URL or credentials. If TCP still fails after the provider incident is closed, escalate with the timestamps and diagnostic evidence to Timeweb support before changing network configuration.

The user supplied a screenshot of the live Agent HQ environment variable showing AGENT_HQ_DATABASE_URL targeting 192.168.0.4:5432/agent_hq (credentials redacted) and AGENT_HQ_WORKERS_ENABLED=false. The user also supplied the PostgreSQL connection UI showing public IPv4 5.42.126.47:5432; prior verified project context records the PostgreSQL private endpoint as 192.168.0.4:5432, private network Fair Cepheus, and Agent HQ app private IP 192.168.0.6. The environment-variable host therefore matches the previously recorded private PostgreSQL endpoint. Do not ask the user to rediscover this unless a fresh Timeweb screenshot contradicts it.

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

## 2. Create the staging database and provision LOGINs BEFORE migrations

Create a dedicated database named `agent_hq_staging`. Keep the database/migration owner separate from all runtime LOGINs. Never use the PPF PROFI website database or production credentials.

**Order matters:** provision all runtime LOGIN roles before applying migrations `0008` and `0009`. Those migrations issue GRANT statements to the named roles and will fail if the roles do not exist. Migration `0010` also grants the worker-identity function to the 19 worker LOGINs; migration `0011` grants the monitoring function to `agent_supervisor`.

Provision exactly these 21 LOGIN roles using a trusted database administrator and one unique, randomly generated password per role:

- 19 worker LOGINs: `agent_coordinator`, `agent_web_engineer`, `agent_seo`, `agent_geo`, `agent_growth`, `agent_analytics`, `agent_qa_security`, `agent_vk_strategist`, `agent_copywriter`, `agent_designer`, `agent_image_generator`, `agent_storyteller`, `agent_community_manager`, `agent_content_seo`, `agent_ads_manager`, `agent_trend_scout`, `agent_auto_news_editor`, `agent_auto_law_monitor`, `agent_fact_checker`.
- Dedicated control LOGINs: `agent_supervisor` and `agent_operator`.

Every LOGIN must be `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`, with no PostgreSQL role memberships. Use this shape for each role, supplying a distinct password directly from the secret manager (do not reuse the placeholder or CI fixture passwords):

```sql
CREATE ROLE agent_coordinator
  LOGIN PASSWORD '<INJECT_UNIQUE_SECRET_FROM_SECRET_MANAGER>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE agent_hq_staging TO agent_coordinator;
```

Repeat for all 21 role names above. Do not put passwords in migrations, scripts, GitHub Actions, chat, shell history, or committed environment files. Grant no role memberships. Do not create the three SECURITY DEFINER function-owner roles manually: migrations `0008`, `0009`, and `0011` create and harden the budget, runtime, and monitor owners as NOLOGIN roles.

Apply only the Agent HQ migration chain to the verified staging database, in this exact order, using the separate migration-owner connection:

```sh
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0003_agent_hq.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0004_agent_budget.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0005_agent_approval_idempotency.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0006_agent_web_search_budget.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0007_agent_task_access.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0008_agent_budget_trusted_settlement.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0009_agent_hq_runtime_rls.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0010_agent_hq_authenticated_worker_identity.sql
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0011_agent_hq_readonly_monitor.sql
```

After migrations `0003–0011`, register the 19 worker LOGINs with their approved unique immutable worker IDs. The repository includes a password-free manifest that inserts the expected worker identities and fails closed if an existing mapping differs, a LOGIN is unsafe, or extra principals exist:

```sh
psql "$STAGING_MIGRATION_URL" -v ON_ERROR_STOP=1 -v worker_id_prefix=staging- -f scripts/agent-hq-staging-register-workers.sql
```

The manifest enables the 19 identity records but does not start any worker process, grant passwords, or enable model spending. Keep the singleton budget disabled with zero caps/prices. `agent_supervisor` and `agent_operator` are separate control logins and are not entries in `agent_worker_principals`.

Verify the target identity before continuing:

```sql
SELECT current_database() AS database_name, session_user AS login, inet_server_addr() AS server_ip;
SELECT enabled, daily_cap_microusd, monthly_cap_microusd,
       per_run_cap_microusd, input_price_per_million_microusd,
       output_price_per_million_microusd,
       web_search_price_microusd_per_call
FROM public.agent_budget_config WHERE id = 1;
```

The database must be `agent_hq_staging`; the budget must be disabled and every cap and price must be zero. Stop on any mismatch. Do not publish the connection URL, password, or server address in logs or chat.

Run the fail-closed preflight with a TLS-enabled, read-only-capable staging migration/verification account. It checks the exact database name, TLS, the disabled budget, all 19 enabled principals, unique LOGINs/worker IDs, least-privilege LOGIN attributes, separate supervisor/operator LOGINs and three NOLOGIN function owners (budget, runtime and monitor). It makes no changes and makes no provider calls:

```sh
STAGING_DATABASE_URL='postgresql://agent_supervisor:<secret>@<staging-host>:5432/agent_hq_staging?sslmode=require' npm run agent-hq:staging-preflight
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

Create one root-owned environment file per worker role under `/etc/ppf-agent-hq`. Each role must use its own PostgreSQL LOGIN and its own connection URL; never reuse one shared runtime login for all agents. Compose expects the following distinct variables (19 worker identities plus supervisor): `AGENT_HQ_DATABASE_URL_ADS_MANAGER`, `AGENT_HQ_DATABASE_URL_ANALYTICS`, `AGENT_HQ_DATABASE_URL_AUTO_LAW_MONITOR`, `AGENT_HQ_DATABASE_URL_AUTO_NEWS_EDITOR`, `AGENT_HQ_DATABASE_URL_COMMUNITY_MANAGER`, `AGENT_HQ_DATABASE_URL_CONTENT_SEO`, `AGENT_HQ_DATABASE_URL_COORDINATOR`, `AGENT_HQ_DATABASE_URL_COPYWRITER`, `AGENT_HQ_DATABASE_URL_DESIGNER`, `AGENT_HQ_DATABASE_URL_FACT_CHECKER`, `AGENT_HQ_DATABASE_URL_GEO`, `AGENT_HQ_DATABASE_URL_GROWTH`, `AGENT_HQ_DATABASE_URL_IMAGE_GENERATOR`, `AGENT_HQ_DATABASE_URL_QA_SECURITY`, `AGENT_HQ_DATABASE_URL_SEO`, `AGENT_HQ_DATABASE_URL_STORYTELLER`, `AGENT_HQ_DATABASE_URL_SUPERVISOR`, `AGENT_HQ_DATABASE_URL_TREND_SCOUT`, `AGENT_HQ_DATABASE_URL_VK_STRATEGIST`, `AGENT_HQ_DATABASE_URL_WEB_ENGINEER`. The gateway's optional health profile separately reads `AGENT_HQ_DATABASE_URL`. Set permissions to `0640` and group `ppf-agent`.

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

Runtime RLS is implemented in migration `0009_agent_hq_runtime_rls.sql`; authenticated worker identity binding is implemented in `0010_agent_hq_authenticated_worker_identity.sql`. These migrations enable and FORCE RLS on the protected Agent HQ tables, install role-scoped policies and column-level grants, and bind each worker LOGIN to an enabled principal record. Migration `0007_agent_task_access.sql` provides the scoped access registry used for coordinator-parent and QA-review visibility. Migration `0011_agent_hq_readonly_monitor.sql` adds an aggregate-only monitor function with a dedicated NOLOGIN owner.

The complete migration chain and catalog/negative-access assertions pass in disposable CI. This is not yet proof that the actual Timeweb database has been provisioned correctly or that its existing roles have the required attributes/passwords. Before live workers can start, provision the exact 19 worker LOGINs plus `agent_supervisor` and `agent_operator`, provision the NOLOGIN function-owner roles, register each unique worker ID, apply the migrations to a verified staging database after backup, and run the staging preflight. Then execute live staging integration tests for claim, heartbeat, messages, runs, artifacts, approvals, supervisor recovery and shutdown. Do not enable workers until those checks pass. Compose role-specific database URL variables are separate and default empty.

## Not included yet

- No production deployment, production migration, or production secrets.
- No web-site, GitHub-write, shell, advertising, payment, or customer-outreach tools.
- No approval execution UI or automatic approval execution.
- No claim that a full end-to-end live model/QA test has passed until it is run in staging and independently reviewed.
