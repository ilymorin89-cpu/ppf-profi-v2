import test from "node:test";
import assert from "node:assert/strict";
import { AGENT_ROLES, AGENT_ROLE_NAMES } from "../scripts/agent-hq-roles.mjs";

test("Agent HQ exposes exactly 19 unique specialist and coordinator roles", () => {
  assert.equal(AGENT_ROLE_NAMES.length, 19);
  assert.equal(new Set(AGENT_ROLE_NAMES).size, 19);
  for (const [name, instruction] of Object.entries(AGENT_ROLES)) {
    assert.ok(name.length > 0);
    assert.ok(instruction.length > 40);
  }
});

test("Agent HQ role registry includes the full agreed role set", () => {
  const expected = [
    "coordinator", "web_engineer", "seo", "geo", "growth", "analytics",
    "qa_security", "vk_strategist", "copywriter", "designer", "image_generator",
    "storyteller", "community_manager", "content_seo", "ads_manager",
    "trend_scout", "auto_news_editor", "auto_law_monitor", "fact_checker"
  ];
  assert.deepEqual(AGENT_ROLE_NAMES, expected);
});
