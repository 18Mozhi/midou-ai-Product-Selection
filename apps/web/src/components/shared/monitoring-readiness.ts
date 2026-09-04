export type MonitoringReadinessTone = "ready" | "attention" | "blocked" | "neutral";

export interface MonitoringReadinessFact {
  label: string;
  value: string;
  detail: string;
  state: MonitoringReadinessTone;
}

export interface MonitoringReadiness {
  summary: {
    tone: MonitoringReadinessTone;
    title: string;
    status: string;
  };
  facts: MonitoringReadinessFact[];
}

export function buildTrendMonitoringReadiness(input: {
  loading: boolean;
  enabledRules: number;
  evaluatedRules: number;
  totalTopics: number;
  failedSources: number;
}): MonitoringReadiness {
  const summary = input.loading
    ? { tone: "neutral" as const, title: "正在核对市场监控状态", status: "读取中" }
    : !input.enabledRules
      ? { tone: "blocked" as const, title: "市场证据链尚未启动", status: "需要启用规则" }
      : !input.totalTopics
        ? { tone: "attention" as const, title: "监控已启动，正在等待真实信号", status: "等待数据" }
        : input.failedSources
          ? {
              tone: "attention" as const,
              title: "市场监控运行中，但有来源需要处理",
              status: `${input.failedSources} 个来源异常`,
            }
          : { tone: "ready" as const, title: "市场信号正在持续进入选品链", status: "持续监控中" };
  return {
    summary,
    facts: [
      {
        label: "自动监控",
        value: input.loading ? "读取中" : `${input.enabledRules} 条启用`,
        detail: input.enabledRules
          ? `${input.evaluatedRules} 条已有评估记录`
          : "需要先配置关键词、市场和周期",
        state: input.loading ? "neutral" : input.enabledRules ? "ready" : "blocked",
      },
      {
        label: "真实市场主题",
        value: input.loading ? "读取中" : `${input.totalTopics} 个`,
        detail: input.totalTopics ? "列表按当前组织与工作区隔离" : "尚未形成可核对主题",
        state: input.loading ? "neutral" : input.totalTopics ? "ready" : "attention",
      },
      {
        label: "来源运行",
        value: input.loading
          ? "读取中"
          : input.failedSources
            ? `${input.failedSources} 个异常`
            : "未报告异常",
        detail: "仅统计启用规则最近一次记录的失败来源",
        state: input.loading ? "neutral" : input.failedSources ? "attention" : "ready",
      },
    ],
  };
}

export function buildCompetitionMonitoringReadiness(input: {
  loading: boolean;
  total: number;
  active: number;
  pending: number;
  snapshots: number;
  enabledRules: number;
  unhealthySources: number;
}): MonitoringReadiness {
  const summary = input.loading
    ? { tone: "neutral" as const, title: "正在核对竞争监控状态", status: "读取中" }
    : !input.total
      ? { tone: "blocked" as const, title: "竞争证据链尚未建立", status: "需要添加竞品" }
      : !input.enabledRules
        ? {
            tone: "blocked" as const,
            title: "竞品已有数据，但变化阈值尚未配置",
            status: "需要配置阈值",
          }
        : input.pending || input.unhealthySources
          ? {
              tone: "attention" as const,
              title: "竞争监控运行中，仍有数据需要补齐",
              status: input.pending
                ? `${input.pending} 个等待快照`
                : `${input.unhealthySources} 个来源异常`,
            }
          : {
              tone: "ready" as const,
              title: "竞品变化正在持续进入竞争证据链",
              status: "持续监控中",
            };
  return {
    summary,
    facts: [
      {
        label: "监控对象",
        value: input.loading ? "读取中" : `${input.active} / ${input.total}`,
        detail: "当前监控中 / 工作区竞品总数",
        state: input.loading ? "neutral" : input.active ? "ready" : "blocked",
      },
      {
        label: "真实快照",
        value: input.loading ? "读取中" : `${input.snapshots} 份`,
        detail: input.pending ? `${input.pending} 个竞品等待首次采集` : "所有竞品均已有基线快照",
        state: input.loading
          ? "neutral"
          : input.pending
            ? "attention"
            : input.snapshots
              ? "ready"
              : "blocked",
      },
      {
        label: "变化阈值",
        value: input.loading ? "读取中" : `${input.enabledRules} 条启用`,
        detail: input.enabledRules
          ? "达到显式阈值才生成告警与任务"
          : "尚无启用的价格、排名、评论或库存规则",
        state: input.loading ? "neutral" : input.enabledRules ? "ready" : "blocked",
      },
    ],
  };
}
