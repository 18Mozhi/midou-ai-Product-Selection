import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opportunity detail keeps partial dependency failures distinct from real empty data", async () => {
  const [workspace, insights, ai] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityDetailInsights.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityAiPanel.vue", "utf8"),
  ]);

  assert.match(
    workspace,
    /downstreamLoadState\.value = \{ \.\.\.downstreamLoadState\.value, \[source\]: "error" \}/,
  );
  assert.match(workspace, /aiLoadState\.value = "error"/);
  assert.doesNotMatch(workspace, /catch\s*\{\s*aiAnalyses\.value = \[\]/);
  assert.match(insights, /暂不能判定为零/);
  assert.match(ai, /不能据此判定记录为空/);
  assert.match(insights, /retryDownstream/);
  assert.match(ai, /\$emit\('retry'\)/);
});

test("opportunity detail renders persisted status and competitor facts without raw domain codes", async () => {
  const [presentation, insights, ai, profit] = await Promise.all([
    readFile("apps/web/src/components/opportunity-workspace-presentation.ts", "utf8"),
    readFile("apps/web/src/components/OpportunityDetailInsights.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityAiPanel.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityProfitPanel.vue", "utf8"),
  ]);

  assert.match(presentation, /recommend: "建议采纳"/);
  assert.match(insights, /候选数为已关联搜索的 candidate_count/);
  assert.doesNotMatch(insights, /三类未齐全时不能自动推荐/);
  assert.match(presentation, /measured: "已测量"/);
  assert.match(presentation, /ai_provider_timeout: "模型服务超时"/);
  assert.match(insights, /评估覆盖/);
  assert.match(insights, /opportunity-association-grid/);
  assert.match(ai, /opportunityAiErrorLabel/);
  assert.match(profit, /opportunityProfitComponentLabel/);
});
