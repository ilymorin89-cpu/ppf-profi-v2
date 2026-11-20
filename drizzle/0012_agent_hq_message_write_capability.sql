-- Route worker message writes through a narrowly-scoped SECURITY DEFINER capability.
-- Worker LOGINs keep read access but cannot insert rows directly. The NOLOGIN,
-- NOINHERIT, NOBYPASSRLS function owner receives one INSERT policy and validates
-- the authenticated session, task ownership, recipient, kind and payload.

GRANT INSERT (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
  ON public.agent_messages TO agent_hq_runtime_fn_owner;
GRANT SELECT (id,idempotency_key) ON public.agent_messages TO agent_hq_runtime_fn_owner;
GRANT USAGE,SELECT ON SEQUENCE public.agent_messages_id_seq TO agent_hq_runtime_fn_owner;

DROP POLICY IF EXISTS message_insert_runtime_function ON public.agent_messages;
CREATE POLICY message_insert_runtime_function ON public.agent_messages
  FOR INSERT TO agent_hq_runtime_fn_owner
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.agent_insert_own_message(
  p_task_id BIGINT,
  p_conversation_id UUID,
  p_from_role TEXT,
  p_to_role TEXT,
  p_kind TEXT,
  p_body TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE(id BIGINT,to_role TEXT,kind TEXT,duplicate BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $insert_message$
DECLARE
  inserted_id BIGINT;
BEGIN
  IF p_task_id IS NULL
     OR p_from_role IS DISTINCT FROM COALESCE(public.agent_role_for_session(),'__denied__')
     OR NOT public.agent_can_insert_own_message(p_task_id,p_from_role) THEN
    RAISE EXCEPTION 'worker may only send messages from its authenticated role on its assigned task'
      USING ERRCODE='42501';
  END IF;

  IF p_to_role IS NULL OR NOT (p_to_role = ANY(ARRAY[
    'coordinator','web_engineer','seo','geo','growth','analytics','qa_security',
    'vk_strategist','copywriter','designer','image_generator','storyteller',
    'community_manager','content_seo','ads_manager','trend_scout',
    'auto_news_editor','auto_law_monitor','fact_checker'
  ]::TEXT[])) THEN
    RAISE EXCEPTION 'invalid Agent HQ message recipient' USING ERRCODE='22023';
  END IF;

  IF p_kind IS NULL OR NOT (p_kind = ANY(ARRAY[
    'request','result','question','objection','handoff','approval_request','status'
  ]::TEXT[])) THEN
    RAISE EXCEPTION 'invalid Agent HQ message kind' USING ERRCODE='22023';
  END IF;

  IF p_conversation_id IS NULL
     OR p_body IS NULL OR length(btrim(p_body))=0 OR length(p_body)>8000
     OR p_idempotency_key IS NULL OR length(p_idempotency_key)<1 OR length(p_idempotency_key)>160 THEN
    RAISE EXCEPTION 'invalid Agent HQ message payload' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.agent_messages AS inserted_message
    (task_id,conversation_id,from_role,to_role,kind,body,idempotency_key)
  VALUES
    (p_task_id,p_conversation_id,p_from_role,p_to_role,p_kind,p_body,p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING inserted_message.id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN QUERY SELECT NULL::BIGINT,p_to_role,p_kind,true;
  ELSE
    RETURN QUERY SELECT inserted_id,p_to_role,p_kind,false;
  END IF;
END
$insert_message$;

ALTER FUNCTION public.agent_insert_own_message(BIGINT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT)
  OWNER TO agent_hq_runtime_fn_owner;
REVOKE ALL ON FUNCTION public.agent_insert_own_message(BIGINT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;

DO $worker_message_capability$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator'
  ] LOOP
    EXECUTE format('REVOKE INSERT ON public.agent_messages FROM %I',role_name);
    EXECUTE format(
      'REVOKE INSERT (task_id,conversation_id,from_role,to_role,kind,body,evidence,in_reply_to,idempotency_key) ON public.agent_messages FROM %I',
      role_name
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.agent_insert_own_message(BIGINT,UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO %I',
      role_name
    );
  END LOOP;
END
$worker_message_capability$;
