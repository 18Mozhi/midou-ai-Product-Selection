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
  covered: "已覆盖",
  measured: "已测量",
  recommend: "建议采纳",
  recommended: "建议采纳",
  rule_candidate: "选品候选",
  not_eligible: "采集中",
  not_recommend: "不建议采纳",
  succeeded: "已完成",
  failed_terminal: "终止失败",
  pending_review: "待复核",
  approved: "已通过",
  unknown: "待识别",
  low: "低",
  medium: "中",
  high: "高",
  manual: "手动创建",
  trend_topic: "热点自动发现",
  evidence_insufficient: "缺少可采纳证据",
  recommendation_insufficient: "尚无可靠推荐结论",
};

export const opportunityStatusLabel = (value: string | null | undefined) =>
  value ? (opportunityLabels[value] ?? value) : "未提供";

const scoreDimensionLabels: Record<string, string> = {
  market_demand: "市场需求",
  data_quality: "数据质量",
  trend: "趋势",
  competition: "竞争",
  profit: "利润",
  risk: "风险",
  evidence: "证据",
  supply: "供应链",
};

export const opportunityScoreDimensionLabel = (value: string) =>
  scoreDimensionLabels[value] ?? value;

const profitComponentLabels: Record<string, string> = {
  sale_price: "含税售价",
  purchase_price: "采购成本",
  logistics: "物流成本",
  platform_fee: "平台费",
  payment_fee: "支付手续费",
  tax: "税费",
  fulfillment: "履约成本",
};

export const opportunityProfitComponentLabel = (value: string) =>
  profitComponentLabels[value] ?? value;

export const opportunityTabs: [OpportunityTab, string][] = [
  ["overview", "商品与评分"],
  ["competition", "竞品对比"],
  ["profit", "货源与利润"],
  ["evidence", "情报证据"],
  ["risk", "风险"],
  ["decisions", "决策记录"],
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
    : value === "market"
      ? "evidence"
      : "overview";
