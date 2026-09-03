import assert from "node:assert/strict";
import test from "node:test";

import { recommendationGuidance } from "../../apps/api/dist/opportunity-recommendation-guidance.js";

const base = {
  qualityRegressionBlocked: false,
  scoreInProgress: false,
  scoreRuleVersion: null,
  latestScoreStatus: null,
  matchedRuleCount: 0,
  enabledRuleCount: 0,
  minimumSourceCount: null,
  sourceCount: 0,
};

test("recommendation guidance prioritizes persisted quality and score states", () => {
  assert.equal(
    recommendationGuidance({ ...base, qualityRegressionBlocked: true, scoreInProgress: true }),
    "关联证据的最新质量核对未通过；先解决数据质量问题，再重新评分。",
  );
  assert.equal(
    recommendationGuidance({ ...base, scoreInProgress: true }),
    "评分任务处理中，完成后会提醒重新决策。",
  );
  assert.equal(
    recommendationGuidance({ ...base, scoreRuleVersion: "score-rule-v2" }),
    "当前评分结果仍为数据不足；按评分缺失项补充真实证据后重新评分。",
  );
  assert.equal(
    recommendationGuidance({ ...base, latestScoreStatus: "insufficient_data" }),
    "当前评分结果仍为数据不足；按评分缺失项补充真实证据后重新评分。",
  );
});

test("recommendation guidance reports the exact automatic-rule source threshold", () => {
  assert.equal(
    recommendationGuidance({
      ...base,
      matchedRuleCount: 2,
      enabledRuleCount: 2,
      minimumSourceCount: 3,
      sourceCount: 1,
    }),
    "已命中 2 条运行规则；当前 1 个独立来源，达到 3 个后进入推荐。系统会继续自动补证。",
  );
  assert.equal(
    recommendationGuidance({
      ...base,
      matchedRuleCount: 1,
      enabledRuleCount: 1,
      minimumSourceCount: 2,
      sourceCount: 2,
    }),
    "运行规则的独立来源门槛已满足，系统正在刷新推荐结论。",
  );
});

test("recommendation guidance distinguishes paused and unmatched rules", () => {
  assert.equal(
    recommendationGuidance({ ...base, matchedRuleCount: 1 }),
    "候选关联的自动选品规则已暂停；恢复规则后系统会重新评估。",
  );
  assert.equal(
    recommendationGuidance(base),
    "当前候选尚未命中运行中的自动选品规则；在首页设置匹配关键词后，系统会继续采集并重新判断。",
  );
});
