-- Catalog assertions only. Runtime roles, grants and RLS policies must come from migrations.
-- Disposable test LOGINs are provisioned separately by agent-hq-provision-test-roles.sql.
DO $assert$
DECLARE
  table_name TEXT;
  role_name TEXT;
  required_tables TEXT[] := ARRAY[
    'agent_tasks','agent_messages','agent_runs','agent_artifacts','agent_approvals',
    'agent_task_access','agent_worker_principals','agent_budget_config','agent_budget_reservations',
    'agent_budget_ledger','agent_budget_settlements'
  ];
  worker_roles TEXT[] := ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator'
  ];
BEGIN
  FOREACH table_name IN ARRAY required_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=table_name
        AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'migration-only RLS/FORCE RLS missing for public.%',table_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=table_name) THEN
      RAISE EXCEPTION 'migration-only policy set missing for public.%',table_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_runtime_fn_owner'
    AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit) THEN
    RAISE EXCEPTION 'dedicated NOLOGIN runtime function owner is missing or unsafe';
  END IF;

  FOREACH role_name IN ARRAY worker_roles LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name
      AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit) THEN
      RAISE EXCEPTION 'worker LOGIN role % is missing or has unsafe attributes',role_name;
    END IF;
    IF has_column_privilege(role_name,'public.agent_tasks','title','UPDATE')
       OR has_column_privilege(role_name,'public.agent_tasks','assigned_role','UPDATE')
       OR has_column_privilege(role_name,'public.agent_runs','provider','UPDATE')
       OR has_column_privilege(role_name,'public.agent_runs','cost_microusd','UPDATE') THEN
      RAISE EXCEPTION 'worker role % has forbidden direct UPDATE privileges',role_name;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_auth_members m
      JOIN pg_roles member_role ON member_role.oid=m.member
      WHERE member_role.rolname=role_name) THEN
      RAISE EXCEPTION 'worker LOGIN % must not be a member of any PostgreSQL role',role_name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.agent_worker_principals p
      WHERE p.login_role=role_name AND p.role=substr(role_name,7) AND p.enabled) THEN
      RAISE EXCEPTION 'worker LOGIN % is not bound to its expected enabled principal',role_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='agent_worker_principals' AND policyname='worker_principal_budget_owner_read')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='agent_worker_principals' AND policyname='worker_principal_runtime_owner_read') THEN
    RAISE EXCEPTION 'authenticated worker principal registry RLS policies are missing';
  END IF;

  IF (SELECT count(*) FROM public.agent_worker_principals WHERE enabled) <> 19
     OR (SELECT count(DISTINCT worker_id) FROM public.agent_worker_principals WHERE enabled) <> 19 THEN
    RAISE EXCEPTION 'expected 19 enabled unique test worker principals';
  END IF;

  FOREACH role_name IN ARRAY worker_roles LOOP
    IF has_table_privilege(role_name,'public.agent_worker_principals','SELECT')
       OR has_table_privilege(role_name,'public.agent_worker_principals','INSERT')
       OR has_table_privilege(role_name,'public.agent_worker_principals','UPDATE') THEN
      RAISE EXCEPTION 'worker role % has direct access to the principal registry',role_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='agent_tasks' AND policyname='task_read_own_role')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='agent_artifacts' AND policyname='artifact_insert_own_task')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='agent_approvals' AND policyname='approval_operator_decide') THEN
    RAISE EXCEPTION 'required task/artifact/approval authorization policies are missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='public'
      AND p.proname IN ('agent_has_task_access','agent_can_grant_task_access',
        'agent_is_valid_coordinator_parent','agent_role_for_session','agent_can_insert_own_artifact',
        'agent_worker_id_for_session')
      AND (r.rolname<>'agent_hq_runtime_fn_owner' OR NOT p.prosecdef)
  ) THEN
    RAISE EXCEPTION 'runtime SECURITY DEFINER helper owner or security mode is incorrect';
  END IF;
END
$assert$;
