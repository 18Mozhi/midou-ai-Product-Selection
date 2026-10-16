import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("P17 existing Vue keeps five-gate setup and governed rule lifecycle", async () => {
  const source = await readFile("apps/web/src/components/ScoreRuleConsole.vue", "utf8");
  assert.match(source, /QualityGateSetupSummary/);
  assert.match(source, /评分配置未就绪/);
  assert.match(source, /request<RulePreview>\([\s\S]*?\/preview\?page=/);
  assert.match(source, /expected_revision/);
  assert.match(source, /规则不会自动生效/);
});
