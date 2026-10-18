import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opportunity detail keeps partial dependency failures distinct from real empty data", async () => {
  const [workspace, insights, reads] = await Promise.all([
    readFile("apps/web/src/components/OpportunityWorkspace.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityDetailInsights.vue", "utf8"),
    readFile("apps/web/src/components/use-opportunity-workspace-reads.ts", "utf8"),
  ]);

  assert.match(
    reads,
    /downstreamLoadState\.value = \{ \.\.\.downstreamLoadState\.value, \[source\]: "error" \}/,
  );
  assert.match(
    insights,
    /downstreamState\.competitors === 'error'[\s\S]*竞品数据暂不可用[\s\S]*retryDownstream/,
  );
  assert.match(insights, /downstreamState\.sourcing === 'error'[\s\S]*供应链数据暂不可用/);
  assert.match(insights, /retryDownstream/);
});

test("opportunity detail renders persisted status and competitor facts without raw domain codes", async () => {
  const [presentation, insights, profit] = await Promise.all([
    readFile("apps/web/src/components/opportunity-workspace-presentation.ts", "utf8"),
    readFile("apps/web/src/components/OpportunityDetailInsights.vue", "utf8"),
    readFile("apps/web/src/components/OpportunityProfitPanel.vue", "utf8"),
  ]);

  assert.match(presentation, /recommend: "建议采纳"/);
  assert.match(
    insights,
    /downstream\.searches[\s\S]*downstream\.suppliers[\s\S]*候选数量按关联搜索汇总，未去重/,
  );
  assert.doesNotMatch(insights, /三类未齐全时不能自动推荐/);
  assert.match(presentation, /measured: "已测量"/);
  assert.match(insights, /评估覆盖/);
  assert.match(insights, /opportunity-association-grid/);
  assert.match(profit, /opportunityProfitComponentLabel/);
});

test("known scoring gaps use Chinese labels while unknown fields remain auditable", async () => {
  const ts = await import("typescript");
  const source = await readFile(
    "apps/web/src/components/opportunity-workspace-presentation.ts",
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  });
  const { opportunityMissingFieldLabel: label } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
  assert.equal(label("market_demand.input"), "市场需求评分资料");
  assert.equal(label("profit.input"), "利润评分资料");
  assert.equal(label("data_quality.input"), "数据质量评分资料");
  assert.equal(label("automatic_evaluation.market_demand.unsupported"), "市场需求评分资料不足");
  assert.equal(label("automatic_evaluation.competition.unsupported"), "竞争评分资料不足");
  assert.equal(label("automatic_evaluation.quality_blocked"), "原始证据未通过质量检查");
  assert.equal(
    label("automatic_evaluation.profit.automatic_cost_scope_mismatch"),
    "费用规则未覆盖当前商品类别",
  );
  assert.equal(
    label("automatic_evaluation.profit.high_confidence_1688_match_missing"),
    "缺少可信的1688匹配货源",
  );
  assert.equal(
    label("automatic_evaluation.profit.future_reason"),
    "automatic_evaluation.profit.future_reason",
  );
  assert.equal(label("provider.unknown"), "provider.unknown");
  assert.equal(label("评价明细"), "评价明细");
  assert.equal(label("unknown.input"), "unknown.input");
});
