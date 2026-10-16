import assert from "node:assert/strict";
import test from "node:test";

import { recommendationGuidance } from "../../apps/api/dist/opportunity-recommendation-guidance.js";

const base = {
  qualityRegressionBlocked: false,
  scoreInProgress: false,
  scoreRuleVersion: null,
  latestScoreStatus: null,
  primaryIdentified: false,
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

test("recommendation guidance follows product identity without requiring monitoring subscriptions", () => {
  assert.equal(
    recommendationGuidance({
      ...base,
      primaryIdentified: true,
    }),
    "已识别 Amazon 主品，系统正在补齐评分、市场、竞品、成本与风险证据。",
  );
  assert.equal(
    recommendationGuidance({
      ...base,
      primaryIdentified: false,
    }),
    "尚未取得可确认身份的 Amazon 主品证据，系统会继续采集；新闻或关键词本身不能代替商品。",
  );
});
