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
