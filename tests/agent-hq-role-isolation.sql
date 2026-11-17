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
    EXECUTE format('GRANT UPDATE (status,error,finished_at) ON agent_runs TO %I', role_name);
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
-- In CI, model the production ownership boundary: helper functions are owned
-- by a dedicated NOLOGIN role, never by the disposable database/schema owner.
GRANT USAGE,CREATE ON SCHEMA public TO agent_hq_fn_owner_ci;
GRANT SELECT ON public.agent_tasks,public.agent_task_access TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_has_task_access(BIGINT) OWNER TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_can_grant_task_access(TEXT) OWNER TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_is_valid_coordinator_parent(BIGINT) OWNER TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_role_for_session() OWNER TO agent_hq_fn_owner_ci;
ALTER FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) OWNER TO agent_hq_fn_owner_ci;
REVOKE CREATE ON SCHEMA public FROM agent_hq_fn_owner_ci;

REVOKE ALL ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_can_insert_own_artifact(BIGINT,TEXT)
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT EXECUTE ON FUNCTION public.agent_role_for_session()
  TO agent_seo,agent_qa_security,agent_coordinator,agent_supervisor;
GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO agent_operator;
DO $roles$ DECLARE role_name TEXT; BEGIN
  FOREACH role_name IN ARRAY ARRAY['agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_role_for_session() TO %I', role_name);
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
CREATE POLICY run_budget_owner_insert ON agent_runs FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK (true);
CREATE POLICY run_budget_owner_update ON agent_runs FOR UPDATE TO agent_hq_budget_owner_ci USING (true) WITH CHECK (true);

ALTER TABLE agent_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_config FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_access FORCE ROW LEVEL SECURITY;

-- Trusted budget reservation/settlement service. CI-only schema; never apply to production.
DO $budget_owner$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_budget_owner_ci') THEN
    CREATE ROLE agent_hq_budget_owner_ci NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$budget_owner$;

CREATE TABLE IF NOT EXISTS agent_budget_reservations (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL UNIQUE REFERENCES agent_runs(id) ON DELETE RESTRICT,
  task_id BIGINT NOT NULL REFERENCES agent_tasks(id) ON DELETE RESTRICT,
  role VARCHAR(48) NOT NULL,
  worker_id VARCHAR(120) NOT NULL,
  reserve_key VARCHAR(160) NOT NULL UNIQUE,
  reserved_microusd BIGINT NOT NULL CHECK (reserved_microusd > 0),
  price_snapshot JSONB NOT NULL,
  day_key DATE NOT NULL,
  month_key DATE NOT NULL,
  state VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (state IN ('active','settled','released','unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_budget_reservations_period_idx
  ON agent_budget_reservations(day_key,month_key,state);

CREATE TABLE IF NOT EXISTS agent_budget_ledger (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES agent_budget_reservations(id) ON DELETE RESTRICT,
  event_key VARCHAR(160) NOT NULL UNIQUE,
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('reserved','settled','released','unknown','reconciled')),
  amount_microusd BIGINT NOT NULL CHECK (amount_microusd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_budget_settlements (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL UNIQUE REFERENCES agent_budget_reservations(id) ON DELETE RESTRICT,
  settlement_key VARCHAR(160) NOT NULL UNIQUE,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  web_search_calls INTEGER NOT NULL CHECK (web_search_calls >= 0),
  actual_cost_microusd BIGINT NOT NULL CHECK (actual_cost_microusd >= 0),
  provider_reference VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON agent_budget_reservations,agent_budget_ledger,agent_budget_settlements FROM PUBLIC;
DO $budget_grants$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['agent_seo','agent_qa_security','agent_coordinator','agent_supervisor','agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker'] LOOP
    EXECUTE format('REVOKE ALL ON agent_budget_reservations,agent_budget_ledger,agent_budget_settlements FROM %I',role_name);
  END LOOP;
END
$budget_grants$;
REVOKE ALL ON SEQUENCE agent_budget_reservations_id_seq,agent_budget_ledger_id_seq,agent_budget_settlements_id_seq FROM PUBLIC;
GRANT USAGE,SELECT ON SEQUENCE agent_budget_reservations_id_seq,agent_budget_ledger_id_seq,agent_budget_settlements_id_seq TO agent_hq_budget_owner_ci;

GRANT USAGE ON SCHEMA public TO agent_hq_budget_owner_ci;
GRANT SELECT ON agent_tasks,agent_runs,agent_budget_config,agent_budget_reservations TO agent_hq_budget_owner_ci;
GRANT INSERT,UPDATE ON agent_runs TO agent_hq_budget_owner_ci;
GRANT INSERT,UPDATE ON agent_budget_reservations TO agent_hq_budget_owner_ci;
GRANT INSERT ON agent_budget_ledger,agent_budget_settlements TO agent_hq_budget_owner_ci;
GRANT SELECT ON agent_budget_ledger,agent_budget_settlements TO agent_hq_budget_owner_ci;

CREATE OR REPLACE FUNCTION public.agent_budget_reserve(
  p_task_id BIGINT, p_worker_id TEXT, p_model TEXT,
  p_estimated_input_tokens INTEGER, p_max_output_tokens INTEGER,
  p_max_turns INTEGER, p_max_search_calls INTEGER, p_idempotency_key TEXT
) RETURNS TABLE(run_id BIGINT,reservation_id BIGINT,reserved_microusd BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $reserve$
DECLARE
  v_role TEXT; v_task public.agent_tasks%ROWTYPE; v_budget public.agent_budget_config%ROWTYPE;
  v_run BIGINT; v_reservation BIGINT; v_estimate BIGINT; v_day DATE; v_month DATE;
  v_daily BIGINT; v_monthly BIGINT;
BEGIN
  v_role := public.agent_role_for_session();
  IF v_role IS NULL OR p_task_id IS NULL OR p_worker_id IS NULL OR p_worker_id = ''
     OR p_model IS NULL OR p_model = '' OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160
     OR p_estimated_input_tokens NOT BETWEEN 1 AND 10000000
     OR p_max_output_tokens NOT BETWEEN 64 AND 8192 OR p_max_turns NOT BETWEEN 1 AND 8
     OR p_max_search_calls NOT BETWEEN 0 AND 64 THEN
    RAISE EXCEPTION 'invalid budget reservation request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_task FROM public.agent_tasks
    WHERE id=p_task_id AND assigned_role=v_role AND status IN ('claimed','running')
      AND lease_owner=p_worker_id AND lease_until > clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task lease not owned by caller' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_budget FROM public.agent_budget_config WHERE id=1 FOR UPDATE;
  IF NOT FOUND OR NOT v_budget.enabled OR v_budget.daily_cap_microusd<=0
      OR v_budget.monthly_cap_microusd<=0 OR v_budget.per_run_cap_microusd<=0
      OR v_budget.input_price_per_million_microusd<=0 OR v_budget.output_price_per_million_microusd<=0
      OR (p_max_search_calls>0 AND v_budget.web_search_price_microusd_per_call<=0) THEN
    RAISE EXCEPTION 'budget disabled or price configuration incomplete' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agent_budget_reservations r WHERE r.reserve_key=p_idempotency_key) THEN
    IF EXISTS (SELECT 1 FROM public.agent_budget_reservations r
      WHERE r.reserve_key=p_idempotency_key AND
      (r.task_id<>p_task_id OR r.role<>v_role OR r.worker_id<>p_worker_id OR r.price_snapshot->>'model'<>p_model)) THEN
      RAISE EXCEPTION 'idempotency key reused with different immutable parameters' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT r.run_id,r.id,r.reserved_microusd
      FROM public.agent_budget_reservations r WHERE r.reserve_key=p_idempotency_key;
    RETURN;
  END IF;
  v_estimate := CEIL((p_estimated_input_tokens::NUMERIC*p_max_turns*v_budget.input_price_per_million_microusd
    + p_max_output_tokens::NUMERIC*p_max_turns*v_budget.output_price_per_million_microusd)/1000000)::BIGINT
    + p_max_search_calls::BIGINT*v_budget.web_search_price_microusd_per_call;
  IF v_estimate<=0 OR v_estimate>v_budget.per_run_cap_microusd
     OR (v_task.budget_limit_microusd>0 AND v_estimate>v_task.budget_limit_microusd) THEN
    RAISE EXCEPTION 'per-run or task budget cap exceeded' USING ERRCODE='P0001';
  END IF;
  v_day := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;
  v_month := date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')::DATE;
  SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual_cost_microusd ELSE reserved_microusd END),0)
    INTO v_daily FROM (
      SELECT r.state,r.reserved_microusd,COALESCE(s.actual_cost_microusd,0) actual_cost_microusd
      FROM public.agent_budget_reservations r LEFT JOIN public.agent_budget_settlements s ON s.reservation_id=r.id
      WHERE r.day_key=v_day AND r.state IN ('active','unknown','settled')
    ) q;
  SELECT COALESCE(SUM(CASE WHEN state='settled' THEN actual_cost_microusd ELSE reserved_microusd END),0)
    INTO v_monthly FROM (
      SELECT r.state,r.reserved_microusd,COALESCE(s.actual_cost_microusd,0) actual_cost_microusd
      FROM public.agent_budget_reservations r LEFT JOIN public.agent_budget_settlements s ON s.reservation_id=r.id
      WHERE r.month_key=v_month AND r.state IN ('active','unknown','settled')
    ) q;
  IF v_daily+v_estimate>v_budget.daily_cap_microusd OR v_monthly+v_estimate>v_budget.monthly_cap_microusd THEN
    RAISE EXCEPTION 'daily or monthly budget cap exceeded' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.agent_runs(task_id,role,worker_id,provider,model,status,cost_microusd)
    VALUES(p_task_id,v_role,p_worker_id,'openai',p_model,'running',v_estimate) RETURNING id INTO v_run;
  INSERT INTO public.agent_budget_reservations(run_id,task_id,role,worker_id,reserve_key,reserved_microusd,price_snapshot,day_key,month_key)
    VALUES(v_run,p_task_id,v_role,p_worker_id,p_idempotency_key,v_estimate,
      jsonb_build_object('model',p_model,'input_price',v_budget.input_price_per_million_microusd,
       'output_price',v_budget.output_price_per_million_microusd,'search_price',v_budget.web_search_price_microusd_per_call,
       'max_turns',p_max_turns,'max_output_tokens',p_max_output_tokens),
      v_day,v_month) RETURNING id INTO v_reservation;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_reservation,'reserve:'||p_idempotency_key,'reserved',v_estimate,'{}'::jsonb);
  RETURN QUERY SELECT v_run,v_reservation,v_estimate;
END
$reserve$;

CREATE OR REPLACE FUNCTION public.agent_budget_settle(
  p_reservation_id BIGINT,p_input_tokens INTEGER,p_output_tokens INTEGER,
  p_search_calls INTEGER,p_settlement_key TEXT,p_provider_reference TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $settle$
DECLARE
  v_role TEXT; v_res public.agent_budget_reservations%ROWTYPE; v_task public.agent_tasks%ROWTYPE;
  v_run_count INTEGER; v_cost BIGINT; v_existing public.agent_budget_settlements%ROWTYPE;
BEGIN
  v_role:=public.agent_role_for_session();
  IF v_role IS NULL OR p_input_tokens NOT BETWEEN 0 AND 100000000
     OR p_output_tokens NOT BETWEEN 0 AND 100000000 OR p_search_calls NOT BETWEEN 0 AND 512
     OR p_settlement_key IS NULL OR length(p_settlement_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid settlement request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations
    WHERE id=p_reservation_id AND role=v_role
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_task FROM public.agent_tasks WHERE id=v_res.task_id AND assigned_role=v_role
    AND lease_owner=v_res.worker_id AND status IN ('claimed','running') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement requires the same active task lease' USING ERRCODE='42501'; END IF;
  IF v_res.state='settled' THEN
    SELECT * INTO v_existing FROM public.agent_budget_settlements WHERE reservation_id=v_res.id;
    IF v_existing.settlement_key=p_settlement_key AND v_existing.input_tokens=p_input_tokens
      AND v_existing.output_tokens=p_output_tokens AND v_existing.web_search_calls=p_search_calls THEN
      RETURN v_existing.actual_cost_microusd;
    END IF;
    RAISE EXCEPTION 'reservation already settled with different payload' USING ERRCODE='23505';
  END IF;
  IF v_res.state NOT IN ('active','unknown') THEN RAISE EXCEPTION 'reservation is not settleable' USING ERRCODE='55000'; END IF;
  v_cost:=CEIL((p_input_tokens::NUMERIC*(v_res.price_snapshot->>'input_price')::BIGINT
      + p_output_tokens::NUMERIC*(v_res.price_snapshot->>'output_price')::BIGINT)/1000000)::BIGINT
      + p_search_calls::BIGINT*(v_res.price_snapshot->>'search_price')::BIGINT;
  IF v_cost>v_res.reserved_microusd THEN RAISE EXCEPTION 'provider usage exceeds reserved maximum; reconciliation required' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.agent_budget_settlements(reservation_id,settlement_key,input_tokens,output_tokens,web_search_calls,actual_cost_microusd,provider_reference)
    VALUES(v_res.id,p_settlement_key,p_input_tokens,p_output_tokens,p_search_calls,v_cost,p_provider_reference);
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'settle:'||p_settlement_key,'settled',v_cost,jsonb_build_object('input_tokens',p_input_tokens,'output_tokens',p_output_tokens,'search_calls',p_search_calls));
  UPDATE public.agent_budget_reservations SET state='settled',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='succeeded',input_tokens=p_input_tokens,output_tokens=p_output_tokens,cost_microusd=v_cost,finished_at=now()
    WHERE id=v_res.run_id AND role=v_role AND worker_id=v_res.worker_id;
  GET DIAGNOSTICS v_run_count=ROW_COUNT;
  IF v_run_count<>1 THEN RAISE EXCEPTION 'run settlement target missing' USING ERRCODE='P0001'; END IF;
  RETURN v_cost;
END
$settle$;

CREATE OR REPLACE FUNCTION public.agent_budget_release(p_reservation_id BIGINT,p_reason TEXT,p_release_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $release$
DECLARE v_res public.agent_budget_reservations%ROWTYPE; v_role TEXT;
BEGIN
  v_role:=public.agent_role_for_session();
  IF v_role IS NULL OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
    OR p_release_key IS NULL OR length(p_release_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid release request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations
    WHERE id=p_reservation_id AND role=v_role FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agent_tasks t WHERE t.id=v_res.task_id AND t.assigned_role=v_role AND t.lease_owner=v_res.worker_id AND t.status IN ('claimed','running')) THEN
    RAISE EXCEPTION 'release requires the same active task lease' USING ERRCODE='42501';
  END IF;
  IF v_res.state='released' THEN RETURN TRUE; END IF;
  IF v_res.state<>'active' THEN RAISE EXCEPTION 'only active reservations may be released; unknown outcomes need reconciliation' USING ERRCODE='55000'; END IF;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'release:'||p_release_key,'released',v_res.reserved_microusd,jsonb_build_object('reason',p_reason));
  UPDATE public.agent_budget_reservations SET state='released',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='failed',error=p_reason,finished_at=now() WHERE id=v_res.run_id;
  RETURN TRUE;
END
$release$;

CREATE OR REPLACE FUNCTION public.agent_budget_mark_unknown(p_reservation_id BIGINT,p_reason TEXT,p_event_key TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $unknown$
DECLARE v_res public.agent_budget_reservations%ROWTYPE; v_role TEXT;
BEGIN
  v_role:=public.agent_role_for_session();
  IF v_role IS NULL OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
    OR p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid unknown reservation request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations
    WHERE id=p_reservation_id AND role=v_role FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  IF v_res.state='unknown' THEN RETURN TRUE; END IF;
  IF v_res.state<>'active' THEN RAISE EXCEPTION 'reservation is not active' USING ERRCODE='55000'; END IF;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'unknown:'||p_event_key,'unknown',v_res.reserved_microusd,jsonb_build_object('reason',p_reason));
  UPDATE public.agent_budget_reservations SET state='unknown',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='failed',error=p_reason,finished_at=now() WHERE id=v_res.run_id;
  RETURN TRUE;
END
$unknown$;

ALTER TABLE agent_budget_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budget_settlements FORCE ROW LEVEL SECURITY;
CREATE POLICY budget_owner_reservation_delete ON agent_budget_reservations FOR DELETE TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_ledger_delete ON agent_budget_ledger FOR DELETE TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_settlement_delete ON agent_budget_settlements FOR DELETE TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_reservation_select ON agent_budget_reservations FOR SELECT TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_reservation_insert ON agent_budget_reservations FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK(true);
CREATE POLICY budget_owner_reservation_update ON agent_budget_reservations FOR UPDATE TO agent_hq_budget_owner_ci USING(true) WITH CHECK(true);
CREATE POLICY budget_owner_ledger_select ON agent_budget_ledger FOR SELECT TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_ledger_insert ON agent_budget_ledger FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK(true);
CREATE POLICY budget_owner_settlement_select ON agent_budget_settlements FOR SELECT TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_owner_settlement_insert ON agent_budget_settlements FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK(true);
CREATE POLICY budget_fn_run_select ON agent_runs FOR SELECT TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_fn_run_insert ON agent_runs FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK(true);
CREATE POLICY budget_fn_run_update ON agent_runs FOR UPDATE TO agent_hq_budget_owner_ci USING(true) WITH CHECK(true);
CREATE POLICY budget_fn_task_read ON agent_tasks FOR SELECT TO agent_hq_budget_owner_ci USING(true);
CREATE POLICY budget_fn_config_read ON agent_budget_config FOR SELECT TO agent_hq_budget_owner_ci USING(true);

ALTER FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) OWNER TO agent_hq_budget_owner_ci;
ALTER FUNCTION public.agent_budget_settle(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) OWNER TO agent_hq_budget_owner_ci;
ALTER FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT) OWNER TO agent_hq_budget_owner_ci;
ALTER FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT) OWNER TO agent_hq_budget_owner_ci;
REVOKE ALL ON FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_settle(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT) FROM PUBLIC;
DO $budget_exec$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist','agent_copywriter','agent_designer','agent_image_generator','agent_storyteller','agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker','agent_seo','agent_qa_security','agent_coordinator'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_settle(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT) TO %I',role_name);
  END LOOP;
END
$budget_exec$;

-- The NOLOGIN function owner gets only the row reads required by reviewed helpers.
CREATE POLICY task_fn_owner_read ON agent_tasks FOR SELECT TO agent_hq_fn_owner_ci USING (true);
CREATE POLICY task_access_fn_owner_read ON agent_task_access FOR SELECT TO agent_hq_fn_owner_ci USING (true);

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

CREATE POLICY run_budget_owner_insert ON agent_runs FOR INSERT TO agent_hq_budget_owner_ci WITH CHECK(true);
CREATE POLICY run_budget_owner_update ON agent_runs FOR UPDATE TO agent_hq_budget_owner_ci USING(true) WITH CHECK(true);
CREATE POLICY run_read_own_role ON agent_runs FOR SELECT USING (
  session_user='agent_supervisor' OR role = COALESCE(public.agent_role_for_session(), '__denied__')
);
-- CI-only definer owner may read aggregate inputs, but no runtime LOGIN is a member of this role.
CREATE POLICY run_budget_aggregate_fn_owner ON agent_runs FOR SELECT TO agent_hq_fn_owner_ci USING (true);
CREATE POLICY run_insert_own_role ON agent_runs FOR INSERT WITH CHECK (
  session_user='agent_hq_budget_owner_ci' OR (
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
CREATE POLICY run_budget_owner_update ON agent_runs FOR UPDATE TO agent_hq_budget_owner_ci USING(true) WITH CHECK(true);

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
