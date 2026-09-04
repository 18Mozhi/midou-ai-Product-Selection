import type { createApiClient } from "./api-client";

export interface SelectionSetupStep {
  code: "score" | "market" | "competition" | "cost" | "risk";
  label: string;
  description: string;
  ready: boolean;
  route: string;
}

export interface AutomaticSelectionReadiness {
  available: boolean;
  readyCount: number;
  allReady: boolean;
  steps: SelectionSetupStep[];
}

interface ScoreRuleLike {
  status: string;
  dimensions?: Array<{
    code: string;
    weight: number;
    evidence_group: string;
  }>;
}

interface StatusRuleLike {
  status: string;
}

const scoreRuleRoute = "/opportunities/scoring-rules";

export const unavailableAutomaticSelectionReadiness = (): AutomaticSelectionReadiness => ({
  available: false,
  readyCount: 0,
  allReady: false,
  steps: [],
});

export async function loadAutomaticSelectionReadiness(
  request: ReturnType<typeof createApiClient>,
): Promise<AutomaticSelectionReadiness> {
  const [scoreRules, costRules, competitorRules] = await Promise.allSettled([
    request<ScoreRuleLike[]>("/opportunity-score-rules"),
    request<StatusRuleLike[]>("/cost-rules"),
    request<StatusRuleLike[]>("/competitor-monitor-rules"),
  ]);
  if (
    scoreRules.status !== "fulfilled" ||
    costRules.status !== "fulfilled" ||
    competitorRules.status !== "fulfilled"
  ) {
    return unavailableAutomaticSelectionReadiness();
  }
  return resolveAutomaticSelectionReadiness(
    Array.isArray(scoreRules.value.data) ? scoreRules.value.data : [],
    Array.isArray(costRules.value.data) ? costRules.value.data : [],
    Array.isArray(competitorRules.value.data) ? competitorRules.value.data : [],
  );
}

export function resolveAutomaticSelectionReadiness(
  scoreRules: ScoreRuleLike[],
  costRules: StatusRuleLike[],
  competitorRules: StatusRuleLike[],
): AutomaticSelectionReadiness {
  const activeScoreRule = scoreRules.find((rule) => rule.status === "active"),
    activeDimensions = (activeScoreRule?.dimensions ?? []).filter(
      (dimension) => Number(dimension.weight) > 0,
    ),
    hasEvidenceGroup = (group: string) =>
      activeDimensions.some((dimension) => dimension.evidence_group === group),
    hasRiskDimension = activeDimensions.some((dimension) => dimension.code === "risk"),
    hasActiveCostRule = costRules.some((rule) => rule.status === "active"),
    hasEnabledCompetitorRule = competitorRules.some((rule) => rule.status === "enabled"),
    steps: SelectionSetupStep[] = [
      {
        code: "score",
        label: "评分规则",
        description: activeScoreRule
          ? "已启用显式权重与推荐阈值。"
          : "创建、审批并启用评分权重与推荐阈值。",
        ready: Boolean(activeScoreRule),
        route: scoreRuleRoute,
      },
      {
        code: "market",
        label: "市场质量门",
        description: hasEvidenceGroup("market")
          ? "评分规则已要求真实市场证据。"
          : "在评分规则中启用市场证据维度。",
        ready: Boolean(activeScoreRule) && hasEvidenceGroup("market"),
        route: scoreRuleRoute,
      },
      {
        code: "competition",
        label: "竞争质量门",
        description:
          hasEvidenceGroup("competition") && hasEnabledCompetitorRule
            ? "竞争维度和竞品监控规则均已启用。"
            : "启用竞争证据维度，并创建竞品监控规则。",
        ready:
          Boolean(activeScoreRule) && hasEvidenceGroup("competition") && hasEnabledCompetitorRule,
        route: "/competitors/monitoring-rules",
      },
      {
        code: "cost",
        label: "成本质量门",
        description:
          hasEvidenceGroup("cost") && hasActiveCostRule
            ? "成本维度和费用规则均已生效。"
            : "启用成本证据维度，并发布费用规则。",
        ready: Boolean(activeScoreRule) && hasEvidenceGroup("cost") && hasActiveCostRule,
        route: "/sourcing/cost-rules",
      },
      {
        code: "risk",
        label: "风险质量门",
        description: hasRiskDimension ? "评分规则已启用风险维度。" : "在评分规则中启用风险维度。",
        ready: Boolean(activeScoreRule) && hasRiskDimension,
        route: scoreRuleRoute,
      },
    ],
    readyCount = steps.filter((step) => step.ready).length;
  return {
    available: true,
    readyCount,
    allReady: readyCount === steps.length,
    steps,
  };
}
