-- Disposable CI-only least-privilege harness. NEVER apply to a live database.
-- The CI database owner is the only seeding/cleanup identity.
-- Keep the DO block's opening and closing dollar-quote delimiters identical.
DO $roles$ DECLARE role_name TEXT; BEGIN

  FOREACH role_name IN ARRAY ARRAY['agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', role_name, 'ci_' || role_name);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_seo') THEN CREATE ROLE agent_seo LOGIN PASSWORD 'ci_agent_seo' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_qa_security') THEN CREATE ROLE agent_qa_security LOGIN PASSWORD 'ci_agent_qa' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_coordinator') THEN CREATE ROLE agent_coordinator LOGIN PASSWORD 'ci_agent_coordinator' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_supervisor') THEN CREATE ROLE agent_supervisor LOGIN PASSWORD 'ci_agent_supervisor' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_operator') THEN CREATE ROLE agent_operator LOGIN PASSWORD 'ci_agent_operator' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_fn_owner_ci') THEN CREATE ROLE agent_hq_fn_owner_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $roles$;

GRANT CONNECT ON DATABASE agent_hq_test TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor,agent_operator;
GRANT USAGE ON SCHEMA public TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor,agent_operator;

CREATE TABLE IF NOT EXISTS agent_task_access (
  task_id BIGINT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  principal VARCHAR(48) NOT NULL,
  access_reason VARCHAR(32) NOT NULL CHECK (access_reason IN ('qa_review','coordinator_oversight')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, principal)
);

-- Start from zero privileges. Never grant whole-table UPDATE to worker roles.
REVOKE ALL ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config,agent_task_access FROM PUBLIC;
REVOKE ALL ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config,agent_task_access FROM agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT SELECT ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT SELECT ON agent_task_access TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

-- Task state/lease fields only. Identity, routing, parent and budget fields are immutable to workers.
GRANT UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at)
  ON agent_tasks TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT INSERT (parent_task_id,title,objective,expected_output,acceptance_criteria,assigned_role,status,priority,attempts,max_attempts,budget_limit_microusd,created_by)
  ON agent_tasks TO agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key)
  ON agent_messages TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,role,worker_id,provider,model,status,cost_microusd)
  ON agent_runs TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at)
  ON agent_runs TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

GRANT INSERT (task_id,created_by,artifact_type,title,content,evidence)
  ON agent_artifacts TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT INSERT (task_id,action,requested_by,payload,status)
  ON agent_approvals TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT SELECT (id,task_id,action,status,decided_by,decision_note,decided_at),
  UPDATE (status,decided_by,decision_note,decided_at)
  ON agent_approvals TO agent_operator;
GRANT INSERT (task_id,principal,access_reason) ON agent_task_access TO agent_supervisor;

GRANT USAGE,SELECT ON SEQUENCE agent_tasks_id_seq,agent_messages_id_seq,agent_runs_id_seq,agent_artifacts_id_seq,agent_approvals_id_seq
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

-- Give every specialist the same narrow baseline; RLS below scopes rows by session_user.
DO $roles$ DECLARE role_name TEXT; BEGIN
  FOREACH role_name IN ARRAY ARRAY['agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE agent_hq_test TO %I', role_name);
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', role_name);
    EXECUTE format('GRANT SELECT ON agent_tasks,agent_messages,agent_runs,agent_artifacts,agent_approvals,agent_budget_config TO %I', role_name);
    EXECUTE format('GRANT UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at) ON agent_tasks TO %I', role_name);
    EXECUTE format('GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key) ON agent_messages TO %I', role_name);
    EXECUTE format('GRANT INSERT (task_id,role,worker_id,provider,model,status,cost_microusd) ON agent_runs TO %I', role_name);
    EXECUTE format('GRANT UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at) ON agent_runs TO %I', role_name);
    EXECUTE format('GRANT INSERT (task_id,created_by,artifact_type,title,content,evidence) ON agent_artifacts TO %I', role_name);
    EXECUTE format('GRANT INSERT (task_id,action,requested_by,payload,status) ON agent_approvals TO %I', role_name);
    EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE agent_tasks_id_seq,agent_messages_id_seq,agent_runs_id_seq,agent_artifacts_id_seq,agent_approvals_id_seq TO %I', role_name);
  END LOOP;
END $roles$;

-- CI-only SECURITY DEFINER helper avoids recursive RLS evaluation between
-- agent_tasks and agent_task_access. Production owner must be a dedicated,
-- non-login, narrowly privileged function owner (not a superuser).
CREATE OR REPLACE FUNCTION public.agent_has_task_access(p_task_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $agent_access$
  SELECT CASE session_user
    WHEN 'agent_qa_security' THEN EXISTS (
      SELECT 1 FROM public.agent_task_access a WHERE a.task_id=p_task_id AND a.principal='qa_security'
    )
    WHEN 'agent_coordinator' THEN EXISTS (
      SELECT 1 FROM public.agent_task_access a WHERE a.task_id=p_task_id AND a.principal='coordinator'
    )
    ELSE FALSE
  END
$agent_access$;
REVOKE ALL ON FUNCTION public.agent_has_task_access(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_has_task_access(BIGINT)
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

CREATE OR REPLACE FUNCTION public.agent_can_grant_task_access(p_principal TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $grant_check$
  SELECT session_user='agent_supervisor' AND p_principal IN ('qa_security','coordinator')
$grant_check$;
REVOKE ALL ON FUNCTION public.agent_can_grant_task_access(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_can_grant_task_access(TEXT) TO agent_supervisor;

CREATE OR REPLACE FUNCTION public.agent_is_valid_coordinator_parent(p_parent_task_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $parent_check$
  SELECT session_user='agent_coordinator' AND EXISTS (
    SELECT 1 FROM public.agent_tasks parent
    WHERE parent.id=p_parent_task_id
      AND parent.assigned_role='coordinator'
      AND parent.status IN ('claimed','running','review')
  )
$parent_check$;
REVOKE ALL ON FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) TO agent_coordinator,agent_supervisor;


CREATE OR REPLACE FUNCTION public.agent_role_for_session()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $role_map$
  SELECT CASE session_user
    WHEN 'agent_web_engineer' THEN 'web_engineer'
    WHEN 'agent_geo' THEN 'geo'
    WHEN 'agent_growth' THEN 'growth'
    WHEN 'agent_analytics' THEN 'analytics'
    WHEN 'agent_vk_strategist' THEN 'vk_strategist'
    WHEN 'agent_copywriter' THEN 'copywriter'
    WHEN 'agent_designer' THEN 'designer'
    WHEN 'agent_image_generator' THEN 'image_generator'
    WHEN 'agent_storyteller' THEN 'storyteller'
    WHEN 'agent_community_manager' THEN 'community_manager'
    WHEN 'agent_content_seo' THEN 'content_seo'
    WHEN 'agent_ads_manager' THEN 'ads_manager'
    WHEN 'agent_trend_scout' THEN 'trend_scout'
    WHEN 'agent_auto_news_editor' THEN 'auto_news_editor'
    WHEN 'agent_auto_law_monitor' THEN 'auto_law_monitor'
    WHEN 'agent_fact_checker' THEN 'fact_checker'
    WHEN 'agent_seo' THEN 'seo'
    WHEN 'agent_qa_security' THEN 'qa_security'
    WHEN 'agent_coordinator' THEN 'coordinator'
    ELSE NULL
  END
$role_map$;
REVOKE ALL ON FUNCTION public.agent_role_for_session() FROM PUBLIC;

-- CI-only proof of the required trusted aggregate boundary. This function is
-- owned by the disposable database owner and MUST NOT be copied to production.
CREATE OR REPLACE FUNCTION public.agent_test_budget_totals()
RETURNS TABLE(daily_cost BIGINT, monthly_cost BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $budget_totals$
  SELECT
    COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('day',now())),0)::BIGINT,
    COALESCE(SUM(cost_microusd) FILTER (WHERE started_at >= date_trunc('month',now())),0)::BIGINT
  FROM public.agent_runs
$budget_totals$;
GRANT USAGE,CREATE ON SCHEMA public TO agent_hq_fn_owner_ci;
GRANT SELECT ON public.agent_runs TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_test_budget_totals() OWNER TO agent_hq_fn_owner_ci;
REVOKE CREATE ON SCHEMA public FROM agent_hq_fn_owner_ci;
REVOKE ALL ON FUNCTION public.agent_test_budget_totals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_test_budget_totals()
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;

CREATE OR REPLACE FUNCTION public.agent_can_insert_own_artifact(p_task_id BIGINT, p_created_by TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $artifact_check$
  SELECT p_created_by = COALESCE(public.agent_role_for_session(), '__denied__')
    AND EXISTS (SELECT 1 FROM public.agent_tasks t
      WHERE t.id=p_task_id AND t.assigned_role=p_created_by)
$artifact_check$;
REVOKE ALL ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT)
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT EXECUTE ON FUNCTION public.agent_role_for_session()
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO agent_operator;
DO $roles$ DECLARE role_name TEXT; BEGIN
  FOREACH role_name IN ARRAY ARRAY['agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO %I', role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_test_budget_totals() TO %I', role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_has_task_access(BIGINT) TO %I', role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) TO %I', role_name);
  END LOOP;
END $roles$;

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access FORCE ROW LEVEL SECURITY;

CREATE POLICY task_read_explicit_access ON agent_tasks FOR SELECT USING (
  public.agent_has_task_access(agent_tasks.id)
);
CREATE POLICY task_read_own_role ON agent_tasks FOR SELECT USING (
  session_user='agent_supervisor' OR assigned_role = COALESCE(public.agent_role_for_session(), '__denied__')
);
CREATE POLICY task_update_own_role ON agent_tasks FOR UPDATE USING (
  session_user='agent_supervisor' OR assigned_role = COALESCE(public.agent_role_for_session(), '__denied__')
) WITH CHECK (
  session_user='agent_supervisor' OR assigned_role = COALESCE(public.agent_role_for_session(), '__denied__')
);
CREATE POLICY task_insert_coordinator ON agent_tasks FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    session_user='agent_coordinator' AND created_by='coordinator'
    AND assigned_role IN ('web_engineer','seo','geo','growth','analytics','qa_security','vk_strategist','copywriter','designer','image_generator','storyteller','community_manager','content_seo','ads_manager','trend_scout','auto_news_editor','auto_law_monitor','fact_checker')
    AND status='queued' AND attempts=0 AND lease_owner IS NULL AND lease_until IS NULL
    AND completed_at IS NULL
    AND parent_task_id IS NOT NULL
    AND public.agent_is_valid_coordinator_parent(agent_tasks.parent_task_id)
  )
);

CREATE POLICY message_read_recipient ON agent_messages FOR SELECT USING (
  session_user='agent_supervisor' OR to_role = COALESCE(public.agent_role_for_session(), '__denied__')
);
CREATE POLICY message_insert_sender ON agent_messages FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    from_role = COALESCE(public.agent_role_for_session(), '__denied__')
    AND (task_id IS NULL OR EXISTS (SELECT 1 FROM agent_tasks t
      WHERE t.id=agent_messages.task_id AND t.assigned_role=from_role))
  )
);

CREATE POLICY run_read_own_role ON agent_runs FOR SELECT USING (
  session_user='agent_supervisor' OR role = COALESCE(public.agent_role_for_session(), '__denied__')
);
-- CI-only definer owner may read aggregate inputs, but no runtime LOGIN is a member of this role.
CREATE POLICY run_budget_aggregate_fn_owner ON agent_runs FOR SELECT TO agent_hq_fn_owner_ci USING (true);
CREATE POLICY run_insert_own_role ON agent_runs FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    role = COALESCE(public.agent_role_for_session(), '__denied__')
    AND status='running'
    AND EXISTS (SELECT 1 FROM agent_tasks t WHERE t.id=agent_runs.task_id AND t.assigned_role=role)
  )
);
CREATE POLICY run_update_own_role ON agent_runs FOR UPDATE USING (
  session_user='agent_supervisor' OR role = COALESCE(public.agent_role_for_session(), '__denied__')
) WITH CHECK (
  session_user='agent_supervisor' OR role = COALESCE(public.agent_role_for_session(), '__denied__')
);

CREATE POLICY task_access_read_own ON agent_task_access FOR SELECT USING (
  session_user='agent_supervisor' OR principal=COALESCE(public.agent_role_for_session(), '__denied__')
);
CREATE POLICY task_access_insert_supervisor ON agent_task_access FOR INSERT
  WITH CHECK (public.agent_can_grant_task_access(principal));

CREATE POLICY artifact_read_explicit_access ON agent_artifacts FOR SELECT USING (
  public.agent_has_task_access(agent_artifacts.task_id)
);
CREATE POLICY artifact_read_own_task ON agent_artifacts FOR SELECT USING (
  session_user='agent_supervisor' OR EXISTS (
    SELECT 1 FROM agent_tasks t WHERE t.id=task_id AND t.assigned_role = COALESCE(public.agent_role_for_session(), '__denied__')
  )
);
CREATE POLICY artifact_insert_own_task ON agent_artifacts FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR public.agent_can_insert_own_artifact(task_id,created_by)
);

CREATE POLICY approval_read_requester ON agent_approvals FOR SELECT USING (
  CASE
    WHEN session_user IN ('agent_supervisor','agent_operator') THEN TRUE
    ELSE requested_by = COALESCE(public.agent_role_for_session(), '__denied__')
  END
);
CREATE POLICY approval_operator_read ON agent_approvals FOR SELECT USING (session_user='agent_operator');
CREATE POLICY approval_operator_decide ON agent_approvals FOR UPDATE
  USING (session_user='agent_operator' AND status='pending')
  WITH CHECK (session_user='agent_operator' AND status IN ('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL);
CREATE POLICY approval_insert_requester ON agent_approvals FOR INSERT WITH CHECK (
  session_user='agent_supervisor' OR (
    status='pending'
    AND requested_by = COALESCE(public.agent_role_for_session(), '__denied__')
    AND EXISTS (SELECT 1 FROM agent_tasks t WHERE t.id=agent_approvals.task_id AND t.assigned_role=requested_by)
  )
);
CREATE POLICY budget_read_only ON agent_budget_config FOR SELECT USING (true);
