interface RecommendationGuidanceInput {
  qualityRegressionBlocked: boolean;
  scoreInProgress: boolean;
  scoreRuleVersion: string | null;
  latestScoreStatus: string | null;
  matchedRuleCount: number;
  enabledRuleCount: number;
  minimumSourceCount: number | null;
  sourceCount: number;
}

export function recommendationGuidance(input: RecommendationGuidanceInput) {
  if (input.qualityRegressionBlocked)
    return "关联证据的最新质量核对未通过；先解决数据质量问题，再重新评分。";
  if (input.scoreInProgress) return "评分任务处理中，完成后会提醒重新决策。";
  if (input.scoreRuleVersion || input.latestScoreStatus)
    return "当前评分结果仍为数据不足；按评分缺失项补充真实证据后重新评分。";
  if (input.enabledRuleCount > 0 && input.minimumSourceCount !== null) {
    const missing = Math.max(0, input.minimumSourceCount - input.sourceCount);
    if (missing > 0)
      return `已命中 ${input.enabledRuleCount} 条运行规则；当前 ${input.sourceCount} 个独立来源，达到 ${input.minimumSourceCount} 个后进入推荐。系统会继续自动补证。`;
    return "运行规则的独立来源门槛已满足，系统正在刷新推荐结论。";
  }
  if (input.matchedRuleCount > 0) return "候选关联的自动选品规则已暂停；恢复规则后系统会重新评估。";
  return "当前候选尚未命中运行中的自动选品规则；在首页设置匹配关键词后，系统会继续采集并重新判断。";
}
