-- Test-only aggregate helper. Applied only after migration-only RLS assertions.
-- This role and function must never be part of production migrations.
DO $test_owner$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_fn_owner_ci') THEN
    CREATE ROLE agent_hq_fn_owner_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$test_owner$;
GRANT USAGE,CREATE ON SCHEMA public TO agent_hq_fn_owner_ci;
GRANT SELECT ON public.agent_runs TO agent_hq_fn_owner_ci;
DROP POLICY IF EXISTS run_budget_aggregate_test_owner ON public.agent_runs;
CREATE POLICY run_budget_aggregate_test_owner ON public.agent_runs
  FOR SELECT TO agent_hq_fn_owner_ci USING (true);
CREATE OR REPLACE FUNCTION public.agent_test_budget_totals()
RETURNS TABLE(daily_cost BIGINT,monthly_cost BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = pg_catalog,public
AS $budget_totals$
  SELECT
    COALESCE(SUM(cost_microusd) FILTER (WHERE started_at>=date_trunc('day',now())),0)::BIGINT,
    COALESCE(SUM(cost_microusd) FILTER (WHERE started_at>=date_trunc('month',now())),0)::BIGINT
  FROM public.agent_runs
$budget_totals$;
ALTER FUNCTION public.agent_test_budget_totals() OWNER TO agent_hq_fn_owner_ci;
REVOKE CREATE ON SCHEMA public FROM agent_hq_fn_owner_ci;
REVOKE ALL ON FUNCTION public.agent_test_budget_totals() FROM PUBLIC;
