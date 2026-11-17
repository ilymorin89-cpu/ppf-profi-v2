-- Read-only, aggregate-only monitoring boundary for the staging supervisor.
-- The monitor owner cannot log in, bypass RLS, or inherit another role.
DO $owner$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_monitor_owner') THEN
    CREATE ROLE agent_hq_monitor_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  ALTER ROLE agent_hq_monitor_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE r.rolname='agent_hq_monitor_owner' OR member.rolname='agent_hq_monitor_owner'
  ) THEN
    RAISE EXCEPTION 'agent_hq_monitor_owner must not have or receive role memberships';
  END IF;
END
$owner$;

GRANT USAGE ON SCHEMA public TO agent_hq_monitor_owner;
GRANT SELECT ON public.agent_tasks,public.agent_budget_config,
  public.agent_budget_reservations,public.agent_worker_principals
  TO agent_hq_monitor_owner;

DROP POLICY IF EXISTS monitor_owner_task_read ON public.agent_tasks;
CREATE POLICY monitor_owner_task_read ON public.agent_tasks
  FOR SELECT TO agent_hq_monitor_owner USING (true);
DROP POLICY IF EXISTS monitor_owner_reservation_read ON public.agent_budget_reservations;
CREATE POLICY monitor_owner_reservation_read ON public.agent_budget_reservations
  FOR SELECT TO agent_hq_monitor_owner USING (true);
DROP POLICY IF EXISTS monitor_owner_principal_read ON public.agent_worker_principals;
CREATE POLICY monitor_owner_principal_read ON public.agent_worker_principals
  FOR SELECT TO agent_hq_monitor_owner USING (true);

CREATE OR REPLACE FUNCTION public.agent_hq_monitor_snapshot()
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $snapshot$
  SELECT jsonb_build_object(
    'budget',(SELECT jsonb_build_object(
      'enabled',enabled,'daily_cap_microusd',daily_cap_microusd,
      'monthly_cap_microusd',monthly_cap_microusd,'per_run_cap_microusd',per_run_cap_microusd
    ) FROM public.agent_budget_config WHERE id=1),
    'principals',(SELECT jsonb_build_object(
      'total',count(*),'enabled',count(*) FILTER (WHERE p.enabled),
      'distinct_logins',count(DISTINCT p.login_role),'distinct_worker_ids',count(DISTINCT p.worker_id),
      'roles',jsonb_agg(p.role ORDER BY p.role),
      'safe_login_flags',COALESCE(bool_and(r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb
        AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolbypassrls),false)
    ) FROM public.agent_worker_principals p
      LEFT JOIN pg_roles r ON r.rolname=p.login_role),
    'privileged',(SELECT jsonb_build_object(
      'safe_supervisor_operator_logins',count(*) FILTER (
        WHERE rolname IN ('agent_supervisor','agent_operator') AND rolcanlogin
          AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolbypassrls),
      'safe_function_owners',count(*) FILTER (
        WHERE rolname IN ('agent_hq_budget_owner','agent_hq_runtime_fn_owner','agent_hq_monitor_owner')
          AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
          AND NOT rolinherit AND NOT rolbypassrls),
      'login_memberships',(SELECT count(*) FROM pg_auth_members m
        JOIN pg_roles member ON member.oid=m.member
        WHERE member.rolname = ANY(ARRAY[
          'agent_coordinator','agent_web_engineer','agent_seo','agent_geo','agent_growth',
          'agent_analytics','agent_qa_security','agent_vk_strategist','agent_copywriter',
          'agent_designer','agent_image_generator','agent_storyteller','agent_community_manager',
          'agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor',
          'agent_auto_law_monitor','agent_fact_checker','agent_supervisor','agent_operator'
        ]))
    ) FROM pg_roles),
    'tasks',(SELECT jsonb_build_object(
      'queued',count(*) FILTER (WHERE status='queued'),
      'active',count(*) FILTER (WHERE status IN ('claimed','running')),
      'review',count(*) FILTER (WHERE status='review'),
      'dead_letter',count(*) FILTER (WHERE status='dead_letter'),
      'expired_leases',count(*) FILTER (WHERE status IN ('claimed','running') AND lease_until<now())
    ) FROM public.agent_tasks),
    'reservations',(SELECT jsonb_build_object(
      'unknown',count(*) FILTER (WHERE state='unknown'),
      'active',count(*) FILTER (WHERE state='active')
    ) FROM public.agent_budget_reservations)
  )
$snapshot$;

ALTER FUNCTION public.agent_hq_monitor_snapshot() OWNER TO agent_hq_monitor_owner;
REVOKE ALL ON FUNCTION public.agent_hq_monitor_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_hq_monitor_snapshot() TO agent_supervisor;
