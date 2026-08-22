const labels: Record<string, string> = {
  accepted: "已受理",
  active: "正常",
  adopted: "已采纳",
  blocked: "已受阻",
  blocked_captcha: "验证码受阻",
  blocked_login: "登录已失效",
  blocked_robots: "站点规则受阻",
  cancelled: "已取消",
  closed: "已关闭",
  completed: "已完成",
  completed_with_warnings: "完成但有缺失",
  dead_letter: "失败待处理",
  enabled: "已启用",
  failed: "失败",
  failed_terminal: "终止失败",
  in_progress: "处理中",
  insufficient: "证据不足",
  insufficient_data: "数据不足",
  leased: "已领取",
  observing: "持续观察",
  open: "未处理",
  paused: "已暂停",
  parsing: "解析中",
  pending: "待处理",
  persisted: "已持久化",
  queued: "排队中",
  rate_limited: "限速等待",
  rejected: "已驳回",
  retry_scheduled: "等待重试",
  running: "执行中",
  scheduled: "已排队",
  stale: "数据已过期",
  succeeded: "成功",
  succeeded_empty: "成功但无结果",
  todo: "待处理",
  validating: "校验中",
};

export const statusLabel = (value: string | null | undefined) =>
  value ? (labels[value] ?? "待确认") : "未提供";

export const technicalStatus = (value: string | null | undefined) => value ?? "unknown";

export const durationLabel = (seconds: number) => {
  const safe = Math.max(0, Number(seconds) || 0),
    days = Math.floor(safe / 86400),
    hours = Math.floor((safe % 86400) / 3600),
    minutes = Math.floor((safe % 3600) / 60);
  if (days) return `${days} 天 ${hours} 小时`;
  if (hours) return `${hours} 小时 ${minutes} 分钟`;
  return `${minutes} 分钟`;
};
