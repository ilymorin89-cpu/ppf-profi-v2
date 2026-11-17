-- Register the 19 staging worker LOGINs after migrations 0003-0011.
-- LOGIN roles and their secret passwords must be provisioned BEFORE migrations
-- 0008 and 0009. This file contains no passwords and never creates credentials.
-- Run as the trusted staging provisioning administrator, never as a worker LOGIN.
--
-- This registry does not start services. Keep agent_budget_config.enabled=false
-- and do not launch worker processes until staging acceptance tests are approved.

BEGIN;

INSERT INTO public.agent_worker_principals (login_role, role, worker_id, enabled) VALUES
  ('agent_coordinator', 'coordinator', 'staging-coordinator-01', true),
  ('agent_web_engineer', 'web_engineer', 'staging-web-engineer-01', true),
  ('agent_seo', 'seo', 'staging-seo-01', true),
  ('agent_geo', 'geo', 'staging-geo-01', true),
  ('agent_growth', 'growth', 'staging-growth-01', true),
  ('agent_analytics', 'analytics', 'staging-analytics-01', true),
  ('agent_qa_security', 'qa_security', 'staging-qa-security-01', true),
  ('agent_vk_strategist', 'vk_strategist', 'staging-vk-strategist-01', true),
  ('agent_copywriter', 'copywriter', 'staging-copywriter-01', true),
  ('agent_designer', 'designer', 'staging-designer-01', true),
  ('agent_image_generator', 'image_generator', 'staging-image-generator-01', true),
  ('agent_storyteller', 'storyteller', 'staging-storyteller-01', true),
  ('agent_community_manager', 'community_manager', 'staging-community-manager-01', true),
  ('agent_content_seo', 'content_seo', 'staging-content-seo-01', true),
  ('agent_ads_manager', 'ads_manager', 'staging-ads-manager-01', true),
  ('agent_trend_scout', 'trend_scout', 'staging-trend-scout-01', true),
  ('agent_auto_news_editor', 'auto_news_editor', 'staging-auto-news-editor-01', true),
  ('agent_auto_law_monitor', 'auto_law_monitor', 'staging-auto-law-monitor-01', true),
  ('agent_fact_checker', 'fact_checker', 'staging-fact-checker-01', true)
ON CONFLICT (login_role) DO NOTHING;

DO $assert_staging_workers$
DECLARE
  expected_count INTEGER;
  registered_count INTEGER;
BEGIN
  SELECT count(*) INTO expected_count
  FROM (VALUES
    ('agent_coordinator', 'coordinator', 'staging-coordinator-01'),
    ('agent_web_engineer', 'web_engineer', 'staging-web-engineer-01'),
    ('agent_seo', 'seo', 'staging-seo-01'),
    ('agent_geo', 'geo', 'staging-geo-01'),
    ('agent_growth', 'growth', 'staging-growth-01'),
    ('agent_analytics', 'analytics', 'staging-analytics-01'),
    ('agent_qa_security', 'qa_security', 'staging-qa-security-01'),
    ('agent_vk_strategist', 'vk_strategist', 'staging-vk-strategist-01'),
    ('agent_copywriter', 'copywriter', 'staging-copywriter-01'),
    ('agent_designer', 'designer', 'staging-designer-01'),
    ('agent_image_generator', 'image_generator', 'staging-image-generator-01'),
    ('agent_storyteller', 'storyteller', 'staging-storyteller-01'),
    ('agent_community_manager', 'community_manager', 'staging-community-manager-01'),
    ('agent_content_seo', 'content_seo', 'staging-content-seo-01'),
    ('agent_ads_manager', 'ads_manager', 'staging-ads-manager-01'),
    ('agent_trend_scout', 'trend_scout', 'staging-trend-scout-01'),
    ('agent_auto_news_editor', 'auto_news_editor', 'staging-auto-news-editor-01'),
    ('agent_auto_law_monitor', 'auto_law_monitor', 'staging-auto-law-monitor-01'),
    ('agent_fact_checker', 'fact_checker', 'staging-fact-checker-01')
  ) AS expected(login_role, role, worker_id);

  SELECT count(*) INTO registered_count
  FROM public.agent_worker_principals;

  IF registered_count <> expected_count THEN
    RAISE EXCEPTION 'Expected exactly % staging worker principals; found %', expected_count, registered_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('agent_coordinator', 'coordinator', 'staging-coordinator-01'),
      ('agent_web_engineer', 'web_engineer', 'staging-web-engineer-01'),
      ('agent_seo', 'seo', 'staging-seo-01'),
      ('agent_geo', 'geo', 'staging-geo-01'),
      ('agent_growth', 'growth', 'staging-growth-01'),
      ('agent_analytics', 'analytics', 'staging-analytics-01'),
      ('agent_qa_security', 'qa_security', 'staging-qa-security-01'),
      ('agent_vk_strategist', 'vk_strategist', 'staging-vk-strategist-01'),
      ('agent_copywriter', 'copywriter', 'staging-copywriter-01'),
      ('agent_designer', 'designer', 'staging-designer-01'),
      ('agent_image_generator', 'image_generator', 'staging-image-generator-01'),
      ('agent_storyteller', 'storyteller', 'staging-storyteller-01'),
      ('agent_community_manager', 'community_manager', 'staging-community-manager-01'),
      ('agent_content_seo', 'content_seo', 'staging-content-seo-01'),
      ('agent_ads_manager', 'ads_manager', 'staging-ads-manager-01'),
      ('agent_trend_scout', 'trend_scout', 'staging-trend-scout-01'),
      ('agent_auto_news_editor', 'auto_news_editor', 'staging-auto-news-editor-01'),
      ('agent_auto_law_monitor', 'auto_law_monitor', 'staging-auto-law-monitor-01'),
      ('agent_fact_checker', 'fact_checker', 'staging-fact-checker-01')
    ) AS expected(login_role, role, worker_id)
    LEFT JOIN public.agent_worker_principals actual USING (login_role)
    WHERE actual.login_role IS NULL
       OR actual.role <> expected.role
       OR actual.worker_id <> expected.worker_id
       OR actual.enabled IS DISTINCT FROM true
  ) THEN
    RAISE EXCEPTION 'A staging worker principal is missing or differs from the approved role/worker_id manifest';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.agent_worker_principals p
    LEFT JOIN pg_roles r ON r.rolname=p.login_role
    WHERE r.rolname IS NULL OR NOT r.rolcanlogin OR r.rolsuper
       OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Every staging worker principal must map to a safe NOINHERIT, non-superuser LOGIN';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members m
    JOIN pg_roles member_role ON member_role.oid=m.member
    WHERE member_role.rolname IN (
      'agent_coordinator','agent_web_engineer','agent_seo','agent_geo','agent_growth',
      'agent_analytics','agent_qa_security','agent_vk_strategist','agent_copywriter',
      'agent_designer','agent_image_generator','agent_storyteller','agent_community_manager',
      'agent_content_seo','agent_ads_manager','agent_trend_scout','agent_auto_news_editor',
      'agent_auto_law_monitor','agent_fact_checker'
    )
  ) THEN
    RAISE EXCEPTION 'Staging worker LOGINs must not belong to any PostgreSQL role';
  END IF;
END
$assert_staging_workers$;

COMMIT;
