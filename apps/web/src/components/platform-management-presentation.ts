export type PlatformManagementDomain =
  "content" | "notifications" | "email" | "status" | "api-coverage";

export const platformManagementTitles: Record<PlatformManagementDomain, [string, string]> = {
  content: ["内容管理", "审核跨组织热点内容，处理无关和过期主题。"],
  notifications: ["通知管理", "查看站内通知、接收人、已读状态和各渠道投递结果。"],
  email: ["邮件管理", "统一查看账号邮件与业务通知邮件的队列、失败和死信状态。"],
  status: [
    "系统状态",
    "查看 API、MySQL、Redis、文件、Worker、Crawler、来源和采集任务的真实运行状态。",
  ],
  "api-coverage": ["接口覆盖证据", "仅供平台超级管理员核对接口、权限、消费方与采集副作用。"],
};

const summaryNames: Record<string, string> = {
  total: "总记录",
  active: "展示中",
  irrelevant: "无关",
  stale: "已过期",
  archived: "已归档",
  unread: "未读",
  critical: "严重",
  succeeded: "已送达",
  blocked: "受阻",
  api: "后端接口",
  database: "数据库",
  dashboard_reads: "15 分钟访问",
  active_organizations: "活动组织",
  active_users: "活动用户",
};

const stateNames: Record<string, string> = {
  active: "展示中",
  irrelevant: "无关",
  stale: "已过期",
  archived: "已归档",
  measured: "已测量",
  insufficient_data: "数据不足",
  delivered: "已送达",
  succeeded: "成功",
  pending: "等待",
  pending_placeholder: "待配置",
  blocked_provider: "服务商受阻",
  dead_letter: "死信",
  failed: "失败",
  queued: "排队中",
  scheduled: "已计划",
  leased: "已领取",
  running: "运行中",
  parsing: "解析中",
  validating: "校验中",
  persisted: "已入库",
  retry_scheduled: "等待重试",
  blocked_login: "登录受阻",
  blocked_captcha: "验证码受阻",
  blocked_robots: "规则受阻",
  rate_limited: "触发限流",
  succeeded_empty: "成功但无结果",
  completed_with_warnings: "完成但有警告",
  failed_terminal: "最终失败",
  manually_replayed: "人工重放",
  automatically_replayed: "自动重放",
  suppressed: "已停止投递",
  healthy: "正常",
  ready: "正常",
  warning: "警告",
  blocked: "阻断",
  degraded: "降级",
  unknown: "待检查",
  stopped: "已停止",
  enabled: "启用",
  disabled: "停用",
  read: "已读",
  unread: "未读",
  draft: "草稿",
  published: "已发布",
  cancelled: "已取消",
  system_fixed: "系统内置",
  pending_provider_selection: "邮件服务待配置",
  in_app: "站内通知",
  notification: "通知",
  email: "邮件",
  task: "任务",
  approval: "审批",
  competitor: "竞品",
  system: "系统",
  info: "普通",
  critical: "严重",
};

export const platformManagementSummaryName = (key: string) => summaryNames[key] ?? key;

export const platformManagementStateName = (value: unknown) =>
  stateNames[String(value)] ?? String(value ?? "—");

export const formatPlatformManagementTime = (value: unknown) =>
  value ? new Date(String(value)).toLocaleString("zh-CN") : "—";
