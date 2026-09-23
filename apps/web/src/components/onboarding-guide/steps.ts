export const onboardingSteps = [
  {
    number: 1,
    eyebrow: "从信号到行动",
    title: "把市场变化，变成今天的行动",
    copy: "智能选品将来源证据、机会判断与团队任务串在同一个工作范围里。",
    relations: ["市场变化", "来源证据", "团队行动"],
    points: ["变化附带来源与新鲜度", "机会保留评分依据", "行动进入可追踪任务"],
  },
  {
    number: 2,
    eyebrow: "共享工作范围",
    title: "让协作围绕同一份证据展开",
    copy: "组织、工作区与角色决定可见范围。评论、审批和结论不会脱离原始上下文。",
    relations: ["组织", "工作区", "角色范围"],
    points: ["组织与工作区隔离", "角色决定最小权限", "审批保留版本与审计"],
  },
  {
    number: 3,
    eyebrow: "事实先于结论",
    title: "先看事实，再做可解释的决定",
    copy: "AI 只负责摘要、解释和缺失提示；价格、利润、资质与最终决策始终由事实和人员负责。",
    relations: ["来源事实", "辅助解释", "人工决定"],
    points: ["缺失证据明确受阻", "风险不用颜色代替文字", "所有结论可以回到来源"],
  },
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];
export type OnboardingStepNumber = OnboardingStep["number"];

export function resolveOnboardingStep(search: string): OnboardingStepNumber {
  const value = Number(new URLSearchParams(search).get("step"));
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 1;
  return Math.min(onboardingSteps.length, Math.max(1, value)) as OnboardingStepNumber;
}
