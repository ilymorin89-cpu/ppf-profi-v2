#!/bin/sh
set -eu

AGENT_HQ_TEST_DATABASE_URL="postgres://agent_test:agent_test@postgres:5432/agent_hq_test"
export AGENT_HQ_TEST_DATABASE_URL

echo "Provisioning disposable CI-only PostgreSQL LOGIN roles..."
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/tests/agent-hq-provision-test-roles.sql

echo "Applying Agent HQ production migration chain to disposable agent_hq_test..."
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0003_agent_hq.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0004_agent_budget.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0005_agent_approval_idempotency.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0006_agent_web_search_budget.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0007_agent_task_access.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0008_agent_budget_trusted_settlement.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/drizzle/0009_agent_hq_runtime_rls.sql

echo "Asserting that the migration chain alone installed the runtime RLS boundary..."
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/tests/agent-hq-role-isolation.sql
psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f /workspace/tests/agent-hq-test-helpers.sql

psql "$AGENT_HQ_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
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

INSERT INTO agent_tasks
  (title,objective,expected_output,assigned_role,created_by,priority)
SELECT
  'No-spend all-role E2E: ' || role,
  'Process one deterministic fixture task as the authenticated role ' || role,
  'Persist one result artifact and a zero-cost test_stub settlement',
  role,
  'agent_hq_19role_e2e',
  10
FROM unnest(ARRAY[
  'coordinator','web_engineer','seo','geo','growth','analytics','qa_security',
  'vk_strategist','copywriter','designer','image_generator','storyteller',
  'community_manager','content_seo','ads_manager','trend_scout',
  'auto_news_editor','auto_law_monitor','fact_checker'
]::varchar[]) AS role;
SQL

echo "Disposable database initialized from migrations; seeded 19 role-scoped tasks."
