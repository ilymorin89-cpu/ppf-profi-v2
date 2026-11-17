# Agent HQ on Timeweb App Platform

This deployment uses a separate App Platform application and a dedicated PostgreSQL database. It must never use the website production database.

## Target configuration

- App: `ppf-agent-hq`
- Region: Moscow (MSK-1)
- Runtime: Docker Compose
- Resources: 2 vCPU, 4 GB RAM, 50 GB NVMe (the selected Timeweb tariff)
- First Compose service: `gateway`, exposing container port 8080 through host port 8080
- Persistent state: external PostgreSQL only. App Platform Compose does not support Compose volumes.
- Worker roles enabled initially: coordinator, community_manager, qa_security, plus supervisor.
- All workers remain disabled until staging DB migrations, API key, model, verified token prices and owner-approved spend caps are configured.

## Repository and panel settings

1. Select repository `ilymorin89-cpu/ppf-profi-v2`.
2. Select branch `feat/vk-content-army`.
3. Select Docker → Docker Compose (not the default Next.js framework).
4. Confirm `docker-compose.yml` is detected at the repository root.
5. Select Moscow and the agreed 2 vCPU / 4 GB / 50 GB configuration.
6. Do not attach the website domain. Use the generated technical domain for initial health checks.
7. Keep automatic deployment disabled until the reviewed branch is approved.
8. Do not start deployment until the isolated database is provisioned and the configuration is reviewed.

## Environment variables

Set these in the App Platform application settings, never in Git:

- `AGENT_HQ_WORKERS_ENABLED=false` (mandatory initial state)
- `AGENT_HQ_DATABASE_URL`: runtime URL for a dedicated Agent HQ database and runtime-only DB user
- `OPENAI_API_KEY`: dedicated API key for this workload
- `AGENT_MODEL`: exact model identifier approved for staging
- `AGENT_MAX_OUTPUT_TOKENS=1200`
- `AGENT_POLL_MS=5000`

Do not use the website's `DATABASE_URL`, production DB credentials, or website environment file. The migration owner and runtime DB user should be separate where practical.

## Database preparation

Create a separate database in the existing PostgreSQL cluster (or another dedicated cluster if isolation requirements demand it). Never apply Agent HQ migrations to the website database.

Apply only:

```sh
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0003_agent_hq.sql
psql "$AGENT_HQ_MIGRATION_URL" -v ON_ERROR_STOP=1 -f drizzle/0004_agent_budget.sql
```

Verify that `agent_budget_config` exists and remains disabled with zero caps and prices. Do not enable the workers before exact model prices and owner-approved limits are entered.

## What is included in this initial container layout

- `gateway`: lightweight HTTP health endpoint; it does not yet implement VK Callback API.
- `coordinator`, `community_manager`, `qa_security`: worker containers, held idle while `AGENT_HQ_WORKERS_ENABLED=false`.
- `supervisor`: supervisor container, also held idle while workers are disabled.

The VK Callback API receiver, owner approval UI/channel, and full end-to-end lifecycle still require implementation and testing. Do not configure a VK callback URL to this health endpoint.

## Safety and limitations

- No production DB access or website deployment.
- No VK event ingestion yet; health endpoint is not a callback receiver.
- No external posts, replies, DMs, moderation, ad campaigns or spend.
- No persistent container filesystem assumptions; task state and artifacts belong in PostgreSQL.
- App Platform Compose restrictions must be respected: no `volumes`, no privileged mode, no host networking, and no host ports 80/443.
- Compose first service is the only one proxied through the main app domain. The gateway is deliberately first.
- A deployment is not considered successful until health, logs, database isolation, worker gating and budget fail-closed behavior are tested.
