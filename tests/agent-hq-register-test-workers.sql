-- CI-only mapping of disposable LOGINs to one unique worker instance each.
-- The credentials are defined in agent-hq-provision-test-roles.sql and never leave CI.
INSERT INTO public.agent_worker_principals(login_role,role,worker_id,enabled) VALUES
  ('agent_coordinator','coordinator','test-coordinator',true),
  ('agent_web_engineer','web_engineer','test-web_engineer',true),
  ('agent_seo','seo','test-seo',true),
  ('agent_geo','geo','test-geo',true),
  ('agent_growth','growth','test-growth',true),
  ('agent_analytics','analytics','test-analytics',true),
  ('agent_qa_security','qa_security','test-qa_security',true),
  ('agent_vk_strategist','vk_strategist','test-vk_strategist',true),
  ('agent_copywriter','copywriter','test-copywriter',true),
  ('agent_designer','designer','test-designer',true),
  ('agent_image_generator','image_generator','test-image_generator',true),
  ('agent_storyteller','storyteller','test-storyteller',true),
  ('agent_community_manager','community_manager','test-community_manager',true),
  ('agent_content_seo','content_seo','test-content_seo',true),
  ('agent_ads_manager','ads_manager','test-ads_manager',true),
  ('agent_trend_scout','trend_scout','test-trend_scout',true),
  ('agent_auto_news_editor','auto_news_editor','test-auto_news_editor',true),
  ('agent_auto_law_monitor','auto_law_monitor','test-auto_law_monitor',true),
  ('agent_fact_checker','fact_checker','test-fact_checker',true)
ON CONFLICT (login_role) DO UPDATE
SET role=EXCLUDED.role,worker_id=EXCLUDED.worker_id,enabled=EXCLUDED.enabled;
