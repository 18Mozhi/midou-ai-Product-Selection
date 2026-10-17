export const onboardingSteps = [
  {
    number: 1,
    eyebrow: "情报发现",
    title: "从最新情报发现相关商品",
    copy: "系统持续采集情报，识别与商品或需求变化的关系，再查找亚马逊商品。先查看来源、采集时间和关联依据。",
    relations: ["最新情报", "商品关联", "亚马逊主品"],
    points: ["情报保留原始来源与时间", "商品关联需要真实依据", "采集失败和缺失数据明确展示"],
  },
  {
    number: 2,
    eyebrow: "竞品与评分",
    title: "围绕一个主品比较5–10个竞品",
    copy: "对比主品与相关竞品的商品、公开销售线索、评价和广告数据，按评分规则给出分析结果。低分和不推荐结果也会保留。",
    relations: ["一个主品", "5–10个竞品", "分析评分"],
    points: [
      "竞品需与主品具有真实替代关系",
      "私有销量和广告数据无法获取时标为未知",
      "评分保留证据、规则和缺失项",
    ],
  },
  {
    number: 3,
    eyebrow: "货源与选品库",
    title: "核对1688货源与选品结果",
    copy: "系统通过商品图片查找1688货源，匹配具体规格和报价，并把分析结果收进选品库。利润缺少真实输入时明确显示未知。",
    relations: ["1688图片找货", "规格与进货价", "选品库"],
    points: [
      "相似图片不代表规格已经匹配",
      "进货价以具体货源报价为准",
      "区分完整链路、推荐结果和利润未知",
    ],
  },
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];
export type OnboardingStepNumber = OnboardingStep["number"];

export function resolveOnboardingStep(search: string): OnboardingStepNumber {
  const value = Number(new URLSearchParams(search).get("step"));
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 1;
  return Math.min(onboardingSteps.length, Math.max(1, value)) as OnboardingStepNumber;
}
