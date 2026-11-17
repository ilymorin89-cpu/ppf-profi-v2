-- Trusted Agent HQ budget reservation and settlement boundary.
-- This migration is intended for an explicitly prepared Agent HQ database only.
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agent_hq_budget_owner') THEN
    CREATE ROLE agent_hq_budget_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  ALTER ROLE agent_hq_budget_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles r ON r.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    WHERE r.rolname='agent_hq_budget_owner' OR member.rolname='agent_hq_budget_owner'
  ) THEN
    RAISE EXCEPTION 'agent_hq_budget_owner must not have or receive role memberships';
  END IF;
END
$role$;

CREATE TABLE IF NOT EXISTS public.agent_budget_reservations (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL UNIQUE REFERENCES public.agent_runs(id) ON DELETE RESTRICT,
  task_id BIGINT NOT NULL REFERENCES public.agent_tasks(id) ON DELETE RESTRICT,
  role VARCHAR(48) NOT NULL,
  worker_id VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  reserved_microusd BIGINT NOT NULL CHECK (reserved_microusd > 0),
  price_snapshot JSONB NOT NULL,
  day_key DATE NOT NULL,
  month_key DATE NOT NULL,
  state VARCHAR(24) NOT NULL DEFAULT 'active'
    CHECK (state IN ('active','settled','released','unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_budget_reservations_day_state_idx
  ON public.agent_budget_reservations(day_key,state);
CREATE INDEX IF NOT EXISTS agent_budget_reservations_month_state_idx
  ON public.agent_budget_reservations(month_key,state);
CREATE UNIQUE INDEX IF NOT EXISTS agent_budget_one_open_reservation_per_task_idx
  ON public.agent_budget_reservations(task_id) WHERE state IN ('active','unknown');

CREATE TABLE IF NOT EXISTS public.agent_budget_ledger (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES public.agent_budget_reservations(id) ON DELETE RESTRICT,
  event_key VARCHAR(200) NOT NULL UNIQUE,
  event_type VARCHAR(24) NOT NULL CHECK (event_type IN ('reserved','settled','released','unknown','reconciled')),
  amount_microusd BIGINT NOT NULL CHECK (amount_microusd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_budget_ledger_reservation_idx
  ON public.agent_budget_ledger(reservation_id,id);

CREATE TABLE IF NOT EXISTS public.agent_budget_settlements (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL UNIQUE REFERENCES public.agent_budget_reservations(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  web_search_calls INTEGER NOT NULL CHECK (web_search_calls >= 0),
  actual_cost_microusd BIGINT NOT NULL CHECK (actual_cost_microusd >= 0),
  provider_reference VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON public.agent_budget_reservations,public.agent_budget_ledger,public.agent_budget_settlements FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.agent_budget_reservations_id_seq,public.agent_budget_ledger_id_seq,public.agent_budget_settlements_id_seq FROM PUBLIC;
GRANT USAGE,SELECT ON SEQUENCE public.agent_runs_id_seq,public.agent_budget_reservations_id_seq,public.agent_budget_ledger_id_seq,public.agent_budget_settlements_id_seq TO agent_hq_budget_owner;

GRANT USAGE ON SCHEMA public TO agent_hq_budget_owner;
REVOKE CREATE ON SCHEMA public FROM agent_hq_budget_owner;
GRANT SELECT ON public.agent_tasks,public.agent_budget_config TO agent_hq_budget_owner;
GRANT UPDATE (status,lease_owner,lease_until,updated_at,completed_at) ON public.agent_tasks TO agent_hq_budget_owner;
GRANT SELECT,INSERT,UPDATE ON public.agent_runs TO agent_hq_budget_owner;
GRANT SELECT,INSERT,UPDATE ON public.agent_budget_reservations TO agent_hq_budget_owner;
GRANT SELECT,INSERT ON public.agent_budget_ledger,public.agent_budget_settlements TO agent_hq_budget_owner;
CREATE OR REPLACE FUNCTION public.agent_budget_role_for_session()
RETURNS TEXT LANGUAGE SQL STABLE SET search_path=pg_catalog
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
REVOKE ALL ON FUNCTION public.agent_budget_role_for_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_budget_role_for_session() TO agent_hq_budget_owner;

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_budget_settlements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_owner_task_read ON public.agent_tasks;
CREATE POLICY budget_owner_task_read ON public.agent_tasks
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_task_lock ON public.agent_tasks;
CREATE POLICY budget_owner_task_lock ON public.agent_tasks
  FOR UPDATE TO agent_hq_budget_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_run_read ON public.agent_runs;
CREATE POLICY budget_owner_run_read ON public.agent_runs
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_run_insert ON public.agent_runs;
CREATE POLICY budget_owner_run_insert ON public.agent_runs
  FOR INSERT TO agent_hq_budget_owner WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_run_update ON public.agent_runs;
CREATE POLICY budget_owner_run_update ON public.agent_runs
  FOR UPDATE TO agent_hq_budget_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_config_read ON public.agent_budget_config;
CREATE POLICY budget_owner_config_read ON public.agent_budget_config
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_reservation_read ON public.agent_budget_reservations;
CREATE POLICY budget_owner_reservation_read ON public.agent_budget_reservations
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_reservation_insert ON public.agent_budget_reservations;
CREATE POLICY budget_owner_reservation_insert ON public.agent_budget_reservations
  FOR INSERT TO agent_hq_budget_owner WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_reservation_update ON public.agent_budget_reservations;
CREATE POLICY budget_owner_reservation_update ON public.agent_budget_reservations
  FOR UPDATE TO agent_hq_budget_owner USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_ledger_read ON public.agent_budget_ledger;
CREATE POLICY budget_owner_ledger_read ON public.agent_budget_ledger
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_ledger_insert ON public.agent_budget_ledger;
CREATE POLICY budget_owner_ledger_insert ON public.agent_budget_ledger
  FOR INSERT TO agent_hq_budget_owner WITH CHECK (true);
DROP POLICY IF EXISTS budget_owner_settlement_read ON public.agent_budget_settlements;
CREATE POLICY budget_owner_settlement_read ON public.agent_budget_settlements
  FOR SELECT TO agent_hq_budget_owner USING (true);
DROP POLICY IF EXISTS budget_owner_settlement_insert ON public.agent_budget_settlements;
CREATE POLICY budget_owner_settlement_insert ON public.agent_budget_settlements
  FOR INSERT TO agent_hq_budget_owner WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.agent_budget_reserve(
  p_task_id BIGINT,p_worker_id TEXT,p_provider TEXT,p_model TEXT,p_estimated_input_tokens INTEGER,
  p_max_output_tokens INTEGER,p_max_turns INTEGER,p_max_search_calls INTEGER,p_idempotency_key TEXT
) RETURNS TABLE(run_id BIGINT,reservation_id BIGINT,reserved_microusd BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $reserve$
DECLARE
  v_role TEXT;
  v_task public.agent_tasks%ROWTYPE;
  v_budget public.agent_budget_config%ROWTYPE;
  v_existing public.agent_budget_reservations%ROWTYPE;
  v_estimate BIGINT;
  v_daily BIGINT;
  v_monthly BIGINT;
  v_day DATE;
  v_month DATE;
  v_run BIGINT;
  v_reservation BIGINT;
BEGIN
  v_role := public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id='' OR p_provider IS NULL OR p_provider NOT IN ('openai','test_stub') OR p_model IS NULL OR p_model=''
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160
     OR p_estimated_input_tokens NOT BETWEEN 1 AND 10000000
     OR p_max_output_tokens NOT BETWEEN 64 AND 8192 OR p_max_turns NOT BETWEEN 1 AND 8
     OR p_max_search_calls NOT BETWEEN 0 AND 128 THEN
    RAISE EXCEPTION 'invalid budget reservation request' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_task FROM public.agent_tasks
    WHERE id=p_task_id AND assigned_role=v_role AND status IN ('claimed','running')
      AND lease_owner=p_worker_id AND lease_until>clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task lease not owned by caller' USING ERRCODE='42501'; END IF;

  PERFORM pg_advisory_xact_lock(781234,1);
  SELECT * INTO v_existing FROM public.agent_budget_reservations
    WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.task_id<>p_task_id OR v_existing.role<>v_role OR v_existing.worker_id<>p_worker_id
       OR v_existing.price_snapshot->>'model'<>p_model
       OR v_existing.price_snapshot->>'provider'<>p_provider
       OR (v_existing.price_snapshot->>'estimated_input_tokens')::INTEGER<>p_estimated_input_tokens
       OR (v_existing.price_snapshot->>'max_output_tokens')::INTEGER<>p_max_output_tokens
       OR (v_existing.price_snapshot->>'max_turns')::INTEGER<>p_max_turns
       OR (v_existing.price_snapshot->>'max_search_calls')::INTEGER<>p_max_search_calls THEN
      RAISE EXCEPTION 'idempotency key reused with different parameters' USING ERRCODE='23505';
    END IF;
    RETURN QUERY SELECT v_existing.run_id,v_existing.id,v_existing.reserved_microusd;
    RETURN;
  END IF;

  -- One locked budget row serializes every reservation transaction.
  SELECT * INTO v_budget FROM public.agent_budget_config WHERE id=1;
  IF NOT FOUND OR NOT v_budget.enabled OR v_budget.daily_cap_microusd<=0
     OR v_budget.monthly_cap_microusd<=0 OR v_budget.per_run_cap_microusd<=0
     OR v_budget.input_price_per_million_microusd<=0
     OR v_budget.output_price_per_million_microusd<=0
     OR (p_max_search_calls>0 AND v_budget.web_search_price_microusd_per_call<=0) THEN
    RAISE EXCEPTION 'budget disabled or price configuration incomplete' USING ERRCODE='P0001';
  END IF;

  v_estimate := CEIL((
    p_estimated_input_tokens::NUMERIC*p_max_turns*v_budget.input_price_per_million_microusd
    + p_max_output_tokens::NUMERIC*p_max_turns*v_budget.output_price_per_million_microusd
  )/1000000)::BIGINT + p_max_search_calls::BIGINT*v_budget.web_search_price_microusd_per_call;
  IF v_estimate<=0 OR v_estimate>v_budget.per_run_cap_microusd
     OR (v_task.budget_limit_microusd>0 AND v_estimate + COALESCE((SELECT SUM(CASE WHEN r.state='settled' THEN st.actual_cost_microusd ELSE r.reserved_microusd END) FROM public.agent_budget_reservations r LEFT JOIN public.agent_budget_settlements st ON st.reservation_id=r.id WHERE r.task_id=p_task_id AND r.state IN ('active','unknown','settled')),0) > v_task.budget_limit_microusd) THEN
    RAISE EXCEPTION 'per-run or task budget cap exceeded' USING ERRCODE='P0001';
  END IF;

  v_day := (clock_timestamp() AT TIME ZONE 'UTC')::DATE;
  v_month := date_trunc('month',clock_timestamp() AT TIME ZONE 'UTC')::DATE;
  SELECT COALESCE(SUM(CASE WHEN r.state='settled' THEN s.actual_cost_microusd ELSE r.reserved_microusd END),0)
    INTO v_daily
    FROM public.agent_budget_reservations r
    LEFT JOIN public.agent_budget_settlements s ON s.reservation_id=r.id
    WHERE r.day_key=v_day AND r.state IN ('active','unknown','settled');
  SELECT COALESCE(SUM(CASE WHEN r.state='settled' THEN s.actual_cost_microusd ELSE r.reserved_microusd END),0)
    INTO v_monthly
    FROM public.agent_budget_reservations r
    LEFT JOIN public.agent_budget_settlements s ON s.reservation_id=r.id
    WHERE r.month_key=v_month AND r.state IN ('active','unknown','settled');
  IF v_daily+v_estimate>v_budget.daily_cap_microusd
     OR v_monthly+v_estimate>v_budget.monthly_cap_microusd THEN
    RAISE EXCEPTION 'daily or monthly budget cap exceeded' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.agent_runs(task_id,role,worker_id,provider,model,status,cost_microusd)
    VALUES(p_task_id,v_role,p_worker_id,p_provider,p_model,'running',0) RETURNING id INTO v_run;
  INSERT INTO public.agent_budget_reservations(run_id,task_id,role,worker_id,idempotency_key,
    reserved_microusd,price_snapshot,day_key,month_key)
    VALUES(v_run,p_task_id,v_role,p_worker_id,p_idempotency_key,v_estimate,
      jsonb_build_object('pricing_version','agent-budget-v1','model',p_model,'provider',p_provider,
        'estimated_input_tokens',p_estimated_input_tokens,'input_price',v_budget.input_price_per_million_microusd,
        'output_price',v_budget.output_price_per_million_microusd,
        'search_price',v_budget.web_search_price_microusd_per_call,
        'max_turns',p_max_turns,'max_output_tokens',p_max_output_tokens,'max_search_calls',p_max_search_calls),
      v_day,v_month) RETURNING id INTO v_reservation;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_reservation,'reserve:'||p_idempotency_key,'reserved',v_estimate,
      jsonb_build_object('task_id',p_task_id,'role',v_role,'model',p_model));

  RETURN QUERY SELECT v_run,v_reservation,v_estimate;
END
$reserve$;

CREATE OR REPLACE FUNCTION public.agent_budget_settle(
  p_reservation_id BIGINT,p_worker_id TEXT,p_input_tokens INTEGER,p_output_tokens INTEGER,
  p_search_calls INTEGER,p_idempotency_key TEXT,p_provider_reference TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $settle$
DECLARE
  v_role TEXT;
  v_res public.agent_budget_reservations%ROWTYPE;
  v_task public.agent_tasks%ROWTYPE;
  v_existing public.agent_budget_settlements%ROWTYPE;
  v_cost BIGINT;
BEGIN
  v_role:=public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id='' OR p_input_tokens NOT BETWEEN 0 AND 100000000
     OR p_output_tokens NOT BETWEEN 0 AND 100000000 OR p_search_calls NOT BETWEEN 0 AND 512
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid settlement request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations
    WHERE id=p_reservation_id AND role=v_role AND worker_id=p_worker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  IF v_res.state='settled' THEN
    SELECT * INTO v_existing FROM public.agent_budget_settlements WHERE reservation_id=v_res.id;
    IF v_existing.idempotency_key=p_idempotency_key AND v_existing.input_tokens=p_input_tokens
       AND v_existing.output_tokens=p_output_tokens AND v_existing.web_search_calls=p_search_calls
       AND v_existing.provider_reference IS NOT DISTINCT FROM p_provider_reference THEN
      RETURN v_existing.actual_cost_microusd;
    END IF;
    RAISE EXCEPTION 'reservation already settled with different payload' USING ERRCODE='23505';
  END IF;
  SELECT * INTO v_task FROM public.agent_tasks
    WHERE id=v_res.task_id AND assigned_role=v_role AND lease_owner=v_res.worker_id
      AND lease_until>clock_timestamp() AND status IN ('claimed','running')
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'settlement requires the original active task lease' USING ERRCODE='42501'; END IF;
  IF v_res.state NOT IN ('active','unknown') THEN
    RAISE EXCEPTION 'reservation is not settleable' USING ERRCODE='55000';
  END IF;
  v_cost:=CEIL((
    p_input_tokens::NUMERIC*(v_res.price_snapshot->>'input_price')::BIGINT
    + p_output_tokens::NUMERIC*(v_res.price_snapshot->>'output_price')::BIGINT
  )/1000000)::BIGINT + p_search_calls::BIGINT*(v_res.price_snapshot->>'search_price')::BIGINT;
  IF p_input_tokens > (v_res.price_snapshot->>'estimated_input_tokens')::INTEGER * (v_res.price_snapshot->>'max_turns')::INTEGER
     OR p_output_tokens > (v_res.price_snapshot->>'max_output_tokens')::INTEGER * (v_res.price_snapshot->>'max_turns')::INTEGER
     OR p_search_calls > (v_res.price_snapshot->>'max_search_calls')::INTEGER THEN
    RAISE EXCEPTION 'provider usage exceeds reserved token/search envelope' USING ERRCODE='P0001';
  END IF;
  IF v_cost>v_res.reserved_microusd THEN
    RAISE EXCEPTION 'actual usage exceeds reservation; reconciliation required' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.agent_budget_settlements(reservation_id,idempotency_key,input_tokens,
    output_tokens,web_search_calls,actual_cost_microusd,provider_reference)
    VALUES(v_res.id,p_idempotency_key,p_input_tokens,p_output_tokens,p_search_calls,v_cost,p_provider_reference);
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'settle:'||p_idempotency_key,'settled',v_cost,
      jsonb_build_object('input_tokens',p_input_tokens,'output_tokens',p_output_tokens,'web_search_calls',p_search_calls));
  UPDATE public.agent_budget_reservations SET state='settled',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='succeeded',input_tokens=p_input_tokens,output_tokens=p_output_tokens,
    cost_microusd=v_cost,finished_at=now() WHERE id=v_res.run_id;
  RETURN v_cost;
END
$settle$;

CREATE OR REPLACE FUNCTION public.agent_budget_release(
  p_reservation_id BIGINT,p_worker_id TEXT,p_reason TEXT,p_idempotency_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $release$
DECLARE v_role TEXT; v_res public.agent_budget_reservations%ROWTYPE;
BEGIN
  v_role:=public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id='' OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid release request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations WHERE id=p_reservation_id AND role=v_role AND worker_id=p_worker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  IF v_res.state='released' THEN
    IF EXISTS (SELECT 1 FROM public.agent_budget_ledger WHERE reservation_id=v_res.id AND event_key='release:'||p_idempotency_key) THEN RETURN true; END IF;
    RAISE EXCEPTION 'reservation was released with a different idempotency key' USING ERRCODE='23505';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agent_tasks t WHERE t.id=v_res.task_id
    AND t.assigned_role=v_role AND t.lease_owner=v_res.worker_id
    AND t.lease_until>clock_timestamp() AND t.status IN ('claimed','running')) THEN
    RAISE EXCEPTION 'release requires the original active task lease' USING ERRCODE='42501';
  END IF;
  IF v_res.state<>'active' THEN RAISE EXCEPTION 'only active reservations can be released' USING ERRCODE='55000'; END IF;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'release:'||p_idempotency_key,'released',v_res.reserved_microusd,jsonb_build_object('reason',p_reason));
  UPDATE public.agent_budget_reservations SET state='released',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='failed',error=p_reason,finished_at=now() WHERE id=v_res.run_id;
  RETURN true;
END
$release$;

CREATE OR REPLACE FUNCTION public.agent_budget_mark_unknown(
  p_reservation_id BIGINT,p_worker_id TEXT,p_reason TEXT,p_event_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $unknown$
DECLARE v_role TEXT; v_res public.agent_budget_reservations%ROWTYPE;
BEGIN
  v_role:=public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id='' OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500
     OR p_event_key IS NULL OR length(p_event_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'invalid unknown reservation request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations WHERE id=p_reservation_id AND role=v_role AND worker_id=p_worker_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not owned by caller' USING ERRCODE='42501'; END IF;
  IF v_res.state='unknown' THEN
    IF EXISTS (SELECT 1 FROM public.agent_budget_ledger WHERE reservation_id=v_res.id AND event_key='unknown:'||p_event_key) THEN RETURN true; END IF;
    RAISE EXCEPTION 'reservation is already unknown under a different event key' USING ERRCODE='23505';
  END IF;
  IF v_res.state IN ('settled','released') THEN RETURN true; END IF;
  IF v_res.state<>'active' THEN RAISE EXCEPTION 'reservation is not active' USING ERRCODE='55000'; END IF;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'unknown:'||p_event_key,'unknown',v_res.reserved_microusd,jsonb_build_object('reason',p_reason));
  UPDATE public.agent_budget_reservations SET state='unknown',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='failed',error=p_reason,finished_at=now() WHERE id=v_res.run_id;
  RETURN true;
END
$unknown$;

CREATE OR REPLACE FUNCTION public.agent_budget_reconcile_usage(
  p_reservation_id BIGINT,p_input_tokens INTEGER,p_output_tokens INTEGER,
  p_search_calls INTEGER,p_provider_reference TEXT,p_idempotency_key TEXT
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $reconcile_usage$
DECLARE
  v_res public.agent_budget_reservations%ROWTYPE;
  v_existing public.agent_budget_settlements%ROWTYPE;
  v_cost BIGINT;
BEGIN
  IF session_user<>'agent_operator' OR p_input_tokens NOT BETWEEN 0 AND 100000000
     OR p_output_tokens NOT BETWEEN 0 AND 100000000 OR p_search_calls NOT BETWEEN 0 AND 512
     OR p_provider_reference IS NULL OR length(p_provider_reference) NOT BETWEEN 1 AND 200
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'operator and provider usage evidence required for reconciliation' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found' USING ERRCODE='P0002'; END IF;
  IF v_res.state='settled' THEN
    SELECT * INTO v_existing FROM public.agent_budget_settlements WHERE reservation_id=v_res.id;
    IF v_existing.idempotency_key=p_idempotency_key
       AND v_existing.input_tokens=p_input_tokens AND v_existing.output_tokens=p_output_tokens
       AND v_existing.web_search_calls=p_search_calls THEN
      RETURN v_existing.actual_cost_microusd;
    END IF;
    RAISE EXCEPTION 'reservation already reconciled with different evidence' USING ERRCODE='23505';
  END IF;
  IF v_res.state NOT IN ('active','unknown') THEN
    RAISE EXCEPTION 'only active or unknown reservations can be reconciled with provider usage' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agent_tasks t WHERE t.id=v_res.task_id
    AND t.status IN ('claimed','running') AND t.lease_until>clock_timestamp()) THEN
    RAISE EXCEPTION 'wait for the worker lease to expire before reconciliation' USING ERRCODE='55000';
  END IF;
  v_cost:=CEIL((
    p_input_tokens::NUMERIC*(v_res.price_snapshot->>'input_price')::BIGINT
    + p_output_tokens::NUMERIC*(v_res.price_snapshot->>'output_price')::BIGINT
  )/1000000)::BIGINT + p_search_calls::BIGINT*(v_res.price_snapshot->>'search_price')::BIGINT;
  IF p_input_tokens > (v_res.price_snapshot->>'estimated_input_tokens')::INTEGER * (v_res.price_snapshot->>'max_turns')::INTEGER
     OR p_output_tokens > (v_res.price_snapshot->>'max_output_tokens')::INTEGER * (v_res.price_snapshot->>'max_turns')::INTEGER
     OR p_search_calls > (v_res.price_snapshot->>'max_search_calls')::INTEGER
     OR v_cost>v_res.reserved_microusd THEN
    RAISE EXCEPTION 'reconciled provider usage exceeds the approved reservation envelope' USING ERRCODE='P0001';
  END IF;
  INSERT INTO public.agent_budget_settlements(reservation_id,idempotency_key,input_tokens,
    output_tokens,web_search_calls,actual_cost_microusd,provider_reference)
    VALUES(v_res.id,p_idempotency_key,p_input_tokens,p_output_tokens,p_search_calls,v_cost,p_provider_reference);
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'reconcile-usage:'||p_idempotency_key,'reconciled',v_cost,
      jsonb_build_object('input_tokens',p_input_tokens,'output_tokens',p_output_tokens,
        'web_search_calls',p_search_calls,'provider_reference',p_provider_reference));
  UPDATE public.agent_budget_reservations SET state='settled',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='succeeded',input_tokens=p_input_tokens,output_tokens=p_output_tokens,
    cost_microusd=v_cost,error='Settled by operator reconciliation',finished_at=now() WHERE id=v_res.run_id;
  RETURN v_cost;
END
$reconcile_usage$;

CREATE OR REPLACE FUNCTION public.agent_budget_reconcile_no_charge(
  p_reservation_id BIGINT,p_confirmation_reference TEXT,p_idempotency_key TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $reconcile$
DECLARE v_res public.agent_budget_reservations%ROWTYPE;
BEGIN
  IF session_user<>'agent_operator' OR p_confirmation_reference IS NULL
     OR length(p_confirmation_reference) NOT BETWEEN 1 AND 200
     OR p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 8 AND 160 THEN
    RAISE EXCEPTION 'operator confirmation required for no-charge reconciliation' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_res FROM public.agent_budget_reservations WHERE id=p_reservation_id FOR UPDATE;
  IF FOUND AND v_res.state='released' AND EXISTS (SELECT 1 FROM public.agent_budget_ledger WHERE reservation_id=v_res.id AND event_key='reconcile:'||p_idempotency_key) THEN
    RETURN true;
  END IF;
  IF NOT FOUND OR v_res.state NOT IN ('active','unknown') THEN
    RAISE EXCEPTION 'only active or unknown reservations can be reconciled' USING ERRCODE='55000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agent_tasks t WHERE t.id=v_res.task_id
    AND t.status IN ('claimed','running') AND t.lease_until>clock_timestamp()) THEN
    RAISE EXCEPTION 'wait for the worker lease to expire before reconciliation' USING ERRCODE='55000';
  END IF;
  INSERT INTO public.agent_budget_ledger(reservation_id,event_key,event_type,amount_microusd,metadata)
    VALUES(v_res.id,'reconcile:'||p_idempotency_key,'reconciled',0,
      jsonb_build_object('confirmation_reference',p_confirmation_reference,'confirmed_no_charge',true));
  UPDATE public.agent_budget_reservations SET state='released',updated_at=now() WHERE id=v_res.id;
  UPDATE public.agent_runs SET status='cancelled',cost_microusd=0,error='Operator confirmed no provider charge',
    finished_at=now() WHERE id=v_res.run_id;
  RETURN true;
END
$reconcile$;

CREATE OR REPLACE FUNCTION public.agent_budget_recover_expired_tasks()
RETURNS TABLE(task_id BIGINT,recovery_status TEXT,has_open_reservation BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $recover$
DECLARE
  v_task RECORD;
  v_target_status TEXT;
BEGIN
  IF session_user<>'agent_supervisor' THEN
    RAISE EXCEPTION 'only the authenticated supervisor may recover expired task leases' USING ERRCODE='42501';
  END IF;
  FOR v_task IN
    SELECT t.id,t.attempts,t.max_attempts,
      EXISTS (SELECT 1 FROM public.agent_budget_reservations r
        WHERE r.task_id=t.id AND r.state IN ('active','unknown')) AS has_open_reservation
    FROM public.agent_tasks t
    WHERE t.status IN ('claimed','running') AND t.lease_until<clock_timestamp()
    ORDER BY t.lease_until,t.id
    FOR UPDATE OF t SKIP LOCKED
  LOOP
    v_target_status := CASE
      WHEN v_task.has_open_reservation THEN 'blocked'
      WHEN v_task.attempts>=v_task.max_attempts THEN 'dead_letter'
      ELSE 'queued'
    END;
    UPDATE public.agent_tasks SET status=v_target_status,lease_owner=NULL,lease_until=NULL,updated_at=now()
      WHERE id=v_task.id;
    task_id:=v_task.id;
    recovery_status:=v_target_status;
    has_open_reservation:=v_task.has_open_reservation;
    RETURN NEXT;
  END LOOP;
END
$recover$;

ALTER FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_settle(BIGINT,TEXT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_reconcile_usage(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_reconcile_no_charge(BIGINT,TEXT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_budget_recover_expired_tasks() OWNER TO agent_hq_budget_owner;
REVOKE CREATE ON SCHEMA public FROM agent_hq_budget_owner;

REVOKE ALL ON FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_settle(BIGINT,TEXT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_reconcile_usage(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_reconcile_no_charge(BIGINT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_budget_recover_expired_tasks() FROM PUBLIC;

DO $acl$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker','agent_seo',
    'agent_qa_security','agent_coordinator'
  ] LOOP
    EXECUTE format('REVOKE INSERT,UPDATE ON public.agent_runs FROM %I',role_name);
    EXECUTE format('REVOKE INSERT (task_id,role,worker_id,provider,model,status,cost_microusd) ON public.agent_runs FROM %I',role_name);
    EXECUTE format('REVOKE UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at) ON public.agent_runs FROM %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_reserve(BIGINT,TEXT,TEXT,TEXT,INTEGER,INTEGER,INTEGER,INTEGER,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_settle(BIGINT,TEXT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_release(BIGINT,TEXT,TEXT,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_budget_mark_unknown(BIGINT,TEXT,TEXT,TEXT) TO %I',role_name);
  END LOOP;
END
$acl$;
DO $run_revoke$
BEGIN
  REVOKE INSERT,UPDATE ON public.agent_runs FROM agent_supervisor,agent_operator;
  REVOKE INSERT (task_id,role,worker_id,provider,model,status,cost_microusd) ON public.agent_runs FROM agent_supervisor,agent_operator;
  REVOKE UPDATE (status,input_tokens,output_tokens,cost_microusd,error,finished_at) ON public.agent_runs FROM agent_supervisor,agent_operator;
END
$run_revoke$;
GRANT EXECUTE ON FUNCTION public.agent_budget_reconcile_usage(BIGINT,INTEGER,INTEGER,INTEGER,TEXT,TEXT) TO agent_operator;
GRANT EXECUTE ON FUNCTION public.agent_budget_reconcile_no_charge(BIGINT,TEXT,TEXT) TO agent_operator;
GRANT EXECUTE ON FUNCTION public.agent_budget_recover_expired_tasks() TO agent_supervisor;

-- Runtime workers must not directly change task lifecycle state. The trusted
-- functions below bind transitions to session_user, role assignment and lease.
CREATE OR REPLACE FUNCTION public.agent_task_heartbeat(
  p_task_id BIGINT,p_worker_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $heartbeat$
DECLARE v_role TEXT;
BEGIN
  v_role:=public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id='' THEN
    RAISE EXCEPTION 'invalid task heartbeat identity' USING ERRCODE='42501';
  END IF;
  UPDATE public.agent_tasks SET status='running',
    lease_until=clock_timestamp()+interval '3 minutes',updated_at=now()
  WHERE id=p_task_id AND assigned_role=v_role AND lease_owner=p_worker_id
    AND status IN ('claimed','running') AND lease_until>clock_timestamp();
  RETURN FOUND;
END
$heartbeat$;

DROP FUNCTION IF EXISTS public.agent_task_transition(BIGINT,TEXT,TEXT);
CREATE OR REPLACE FUNCTION public.agent_task_transition(
  p_task_id BIGINT,p_worker_id TEXT,p_transition TEXT,p_reservation_id BIGINT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $transition$
DECLARE
  v_role TEXT;
  v_task public.agent_tasks%ROWTYPE;
  v_target TEXT;
BEGIN
  v_role:=public.agent_budget_role_for_session();
  IF v_role IS NULL OR p_worker_id IS NULL OR p_worker_id=''
     OR p_transition NOT IN ('complete','blocked','retry','dead_letter') THEN
    RAISE EXCEPTION 'invalid task transition request' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_task FROM public.agent_tasks
    WHERE id=p_task_id AND assigned_role=v_role AND lease_owner=p_worker_id
      AND status IN ('claimed','running') AND lease_until>clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'task transition requires the original active lease' USING ERRCODE='42501';
  END IF;

  IF p_transition='complete' THEN
    IF p_reservation_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.agent_budget_reservations
      WHERE id=p_reservation_id AND task_id=p_task_id AND role=v_role AND worker_id=p_worker_id AND state='settled') THEN
      RAISE EXCEPTION 'task completion requires a settled budget reservation' USING ERRCODE='55000';
    END IF;
    v_target:=CASE WHEN v_role='coordinator' THEN 'review' ELSE 'done' END;
  ELSIF p_transition='blocked' THEN
    v_target:='blocked';
  ELSIF p_transition='retry' THEN
    IF EXISTS (SELECT 1 FROM public.agent_budget_reservations
      WHERE task_id=p_task_id AND state IN ('active','unknown')) THEN
      RAISE EXCEPTION 'task with an open provider reservation cannot be retried' USING ERRCODE='55000';
    END IF;
    v_target:='queued';
  ELSE
    IF v_task.attempts<v_task.max_attempts THEN
      RAISE EXCEPTION 'task has remaining attempts and cannot be dead-lettered' USING ERRCODE='55000';
    END IF;
    IF EXISTS (SELECT 1 FROM public.agent_budget_reservations
      WHERE task_id=p_task_id AND state IN ('active','unknown')) THEN
      RAISE EXCEPTION 'task with an open provider reservation cannot be dead-lettered' USING ERRCODE='55000';
    END IF;
    v_target:='dead_letter';
  END IF;

  UPDATE public.agent_tasks SET status=v_target,
    completed_at=CASE WHEN v_target='done' THEN now() ELSE NULL END,
    lease_owner=NULL,lease_until=NULL,updated_at=now()
  WHERE id=p_task_id;
  RETURN v_target;
END
$transition$;

ALTER FUNCTION public.agent_task_heartbeat(BIGINT,TEXT) OWNER TO agent_hq_budget_owner;
ALTER FUNCTION public.agent_task_transition(BIGINT,TEXT,TEXT,BIGINT) OWNER TO agent_hq_budget_owner;
REVOKE ALL ON FUNCTION public.agent_task_heartbeat(BIGINT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_task_transition(BIGINT,TEXT,TEXT,BIGINT) FROM PUBLIC;

DO $task_acl$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker','agent_seo',
    'agent_qa_security','agent_coordinator'
  ] LOOP
    EXECUTE format('REVOKE UPDATE ON public.agent_tasks FROM %I',role_name);
    EXECUTE format('REVOKE UPDATE (status,attempts,lease_owner,lease_until,updated_at,completed_at) ON public.agent_tasks FROM %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_task_heartbeat(BIGINT,TEXT) TO %I',role_name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.agent_task_transition(BIGINT,TEXT,TEXT,BIGINT) TO %I',role_name);
  END LOOP;
END
$task_acl$;
