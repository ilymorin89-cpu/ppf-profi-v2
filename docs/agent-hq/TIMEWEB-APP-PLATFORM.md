# Agent HQ on Timeweb App Platform

This is a staging deployment guide for the separate Agent HQ application. It is not the PPF PROFI website deployment. Agent HQ must use its own PostgreSQL database and must never use the website production database.

## Target configuration

- App: `ppf-agent-hq`
- Region: Moscow (MSK-1), if this is the region shown in the existing app
- Runtime: Docker Compose
- Intended resources: 2 vCPU, 4 GB RAM, 50 GB NVMe (verify against the actual Timeweb tariff)
- First Compose service: `gateway`, exposing container port 8080
- Persistent state: external PostgreSQL; do not rely on container filesystem persistence
- Initial worker state: `AGENT_HQ_WORKERS_ENABLED=false`
- Automatic deployment: disabled until the branch, migrations, secrets, database isolation and health checks have been reviewed

## Repository and panel settings

1. Select repository `ilymorin89-cpu/ppf-profi-v2`.
2. Use the reviewed Agent HQ branch `agent-hq/enable-research-tools` only after its pull request has been approved. Do not use the older `feat/vk-content-army` branch as the deployment source for this version.
3. Select Docker → Docker Compose (not the default Next.js framework).
4. Confirm `docker-compose.yml` is detected at the repository root.
5. Verify the actual app resources and region in Timeweb; values above are the intended configuration, not a live panel confirmation.
6. Do not attach the PPF PROFI website domain. Use the generated technical domain for initial health checks.
7. Keep automatic deployment disabled until the reviewed branch is approved and a deliberate staging deployment is authorized.
8. Do not enable workers or start model calls as part of the initial health check.

## Environment variables

Set these in the App Platform application settings, never in Git. The example file `.env.agent-hq.example` lists variable names only; do not copy empty placeholders into production.

Required for the gateway health endpoint:
- `AGENT_HQ_DATABASE_URL`: runtime URL for the dedicated Agent HQ staging database. Compose maps this value to the gateway's `DATABASE_URL`. If it is absent or cannot connect, `/live` can return 200 but `/ready`, `/health` and `/` return 503.

Required before any worker can be enabled (keep disabled for initial deployment):
- `AGENT_HQ_WORKERS_ENABLED=false`
- `OPENAI_API_KEY`: dedicated key for this workload, stored as a secret
- `AGENT_MODEL`: exact model identifier approved for staging
- `AGENT_HQ_DATABASE_URL_COORDINATOR`
- `AGENT_HQ_DATABASE_URL_SEO`
- `AGENT_HQ_DATABASE_URL_QA_SECURITY`
- `AGENT_HQ_DATABASE_URL_SUPERVISOR`
- `AGENT_HQ_DATABASE_URL_WEB_ENGINEER`
- `AGENT_HQ_DATABASE_URL_ANALYTICS`
- `AGENT_HQ_DATABASE_URL_COMMUNITY_MANAGER`
- `AGENT_MAX_OUTPUT_TOKENS=1200`
- `AGENT_POLL_MS=5000`
- `AGENT_WEB_SEARCH_ENABLED=false`

Each worker role must use a distinct PostgreSQL login. Do not reuse the website's `DATABASE_URL`, production DB credentials, or website environment file. Keep the worker flag false and worker role URLs unset until role permissions and staging acceptance tests are complete. Never paste secrets into chat or commit them.

## Database preparation

Create or confirm a separate database dedicated to Agent HQ. A separate database on the same PostgreSQL cluster is acceptable only if the credentials and grants are isolated. Never apply Agent HQ migrations to the website database.

For the current Agent HQ branch, the disposable staging database schema includes migrations 0003–0007. Apply them in order using a migration-owner connection against the isolated Agent HQ database only:

```sh
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0003_agent_hq.sql
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0004_agent_budget.sql
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0005_agent_approval_idempotency.sql
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0006_agent_web_search_budget.sql
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0007_agent_task_access.sql
```

Do not run these commands until the target database identity has been independently verified. Keep the migration owner separate from all runtime logins. The budget must remain disabled with zero caps and prices. Do not enable workers before model pricing, search pricing, provider-side spend limits and owner-approved caps are verified.

**Important:** migration 0007 adds scoped task-access registry behavior; it does not by itself complete production RLS or prove full least-privilege isolation. The runbook explicitly states that live workers must remain disabled until role-specific grants, column restrictions and end-to-end access tests are completed.

## Health checks

After a deliberately authorized staging deployment, test the generated technical domain:

- `/live`: process liveness only; HTTP 200 does not prove database connectivity.
- `/ready`: readiness including a successful PostgreSQL `SELECT 1`; expect HTTP 200 only when the dedicated Agent HQ database is reachable.
- `/health` and `/`: same readiness behavior as `/ready`.

Do not treat a successful container build or `/live` response as proof that Agent HQ is operational. Review container logs and verify the database target without exposing passwords or full connection strings.

## What is and is not included

- The `gateway` is a health endpoint; it is not a VK Callback API receiver.
- No VK event ingestion is implemented by this health endpoint. Do not configure a VK callback URL to it.
- The approval CLI records owner decisions; it does not execute approved external actions.
- No production DB access, website deployment, external posts, replies, DMs, moderation, ad campaigns or spend are authorized by this guide.
- No production deployment or worker activation is authorized by this guide.
- Compose first service is the only one proxied through the main app domain; keep the gateway first.
- Respect Timeweb App Platform Compose restrictions and verify them against the current platform documentation before deployment.

A staging deployment is not accepted until database isolation, migration state, health/readiness, worker gating, budget fail-closed behavior, logs and rollback have all been verified.
