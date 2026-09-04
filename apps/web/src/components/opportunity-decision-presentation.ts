import type { OpportunitySummary } from "./opportunity-workspace-types";

export const opportunityQualityGateLabels = {
  score: "评分",
  market: "市场",
  competition: "竞争",
  cost: "成本",
  risk: "风险",
} as const;

const opportunityQualityGateKeys = Object.keys(opportunityQualityGateLabels) as Array<
  keyof typeof opportunityQualityGateLabels
>;

export const countPassedOpportunityQualityGates = (gates: OpportunitySummary["quality_gates"]) =>
  opportunityQualityGateKeys.filter((key) => Boolean(gates[key])).length;

export const nextOpportunityQualityGateLabel = (gates: OpportunitySummary["quality_gates"]) => {
  const key = opportunityQualityGateKeys.find((candidate) => !gates[candidate]);
  return key ? opportunityQualityGateLabels[key] : "全部通过";
};

export const opportunityBlockerStatusLabel = (value: "blocked" | "in_progress" | "cleared") =>
  ({ blocked: "仍在阻断", in_progress: "解除中", cleared: "已解除" })[value];

export const opportunityDecisionCopy = (
  canAdopt: boolean,
  selectionStage: OpportunitySummary["selection_stage"],
) =>
  canAdopt
    ? "五项质量门全部通过，最终采纳仍由你决定。"
    : selectionStage === "rule_candidate"
      ? "已进入规则命中候选，系统会继续补齐未通过的质量门。"
      : "尚未达到规则来源门槛，或当前机会不属于自动选品规则，暂不能采纳。";
