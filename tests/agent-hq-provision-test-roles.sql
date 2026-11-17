-- CI-only LOGIN provisioning for a disposable PostgreSQL instance.
-- These fixed credentials must never be used outside isolated CI.
DO $roles$
DECLARE
  role_name TEXT;
  role_password TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'agent_web_engineer','agent_geo','agent_growth','agent_analytics','agent_vk_strategist',
    'agent_copywriter','agent_designer','agent_image_generator','agent_storyteller',
    'agent_community_manager','agent_content_seo','agent_ads_manager','agent_trend_scout',
    'agent_auto_news_editor','agent_auto_law_monitor','agent_fact_checker',
    'agent_seo','agent_qa_security','agent_coordinator','agent_supervisor','agent_operator'
  ] LOOP
    IF role_name='agent_qa_security' THEN
      role_password:='ci_agent_qa';
    ELSIF role_name='agent_operator' THEN
      role_password:='ci_agent_operator';
    ELSE
      role_password:='ci_'||role_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',role_name,role_password);
    ELSE
      EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',role_name,role_password);
    END IF;
  END LOOP;
END
$roles$;
