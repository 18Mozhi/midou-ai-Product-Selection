import type { OpportunityTab } from "./opportunity-workspace-types";

const opportunityLabels: Record<string, string> = {
  pending: "待判断",
  adopt: "采纳",
  adopted: "已采纳",
  observe: "继续观察",
  observing: "观察中",
  reject: "驳回",
  rejected: "已驳回",
  insufficient: "不完整",
  partial: "部分完整",
  complete: "完整",
  insufficient_data: "待补充数据",
  calculated: "已计算",
  unknown: "待识别",
  low: "低",
  medium: "中",
  high: "高",
  manual: "手动创建",
  trend_topic: "热点自动发现",
  evidence_insufficient: "缺少可采纳证据",
  recommendation_insufficient: "尚无可靠推荐结论",
};

export const opportunityStatusLabel = (value: string) => opportunityLabels[value] ?? value;

export const opportunityTabs: [OpportunityTab, string][] = [
  ["overview", "结论"],
  ["lineage", "业务血缘"],
  ["feedback", "经营复盘"],
  ["evidence", "证据"],
  ["profit", "利润与成本"],
  ["risk", "风险"],
  ["market", "市场"],
  ["competition", "竞争"],
  ["ai", "AI 辅助"],
  ["decisions", "决策历史"],
];

export const formatOpportunityTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

export const safeOpportunityReturnPath = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/opportunities";

export const resolveOpportunityTab = (value: unknown): OpportunityTab =>
  typeof value === "string" && opportunityTabs.some(([tab]) => tab === value)
    ? (value as OpportunityTab)
    : "overview";
