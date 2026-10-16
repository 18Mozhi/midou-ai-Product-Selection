interface RecommendationGuidanceInput {
  qualityRegressionBlocked: boolean;
  scoreInProgress: boolean;
  scoreRuleVersion: string | null;
  latestScoreStatus: string | null;
  primaryIdentified: boolean;
}

export function recommendationGuidance(input: RecommendationGuidanceInput) {
  if (input.qualityRegressionBlocked)
    return "关联证据的最新质量核对未通过；先解决数据质量问题，再重新评分。";
  if (input.scoreInProgress) return "评分任务处理中，完成后会提醒重新决策。";
  if (input.scoreRuleVersion || input.latestScoreStatus)
    return "当前评分结果仍为数据不足；按评分缺失项补充真实证据后重新评分。";
  return input.primaryIdentified
    ? "已识别 Amazon 主品，系统正在补齐评分、市场、竞品、成本与风险证据。"
    : "尚未取得可确认身份的 Amazon 主品证据，系统会继续采集；新闻或关键词本身不能代替商品。";
}
