const roleNames: Record<string, string> = {
  member: "成员",
  selection_manager: "选品负责人",
  procurement_member: "采购成员",
  organization_admin: "组织管理员",
};

const scopeNames: Record<string, string> = {
  organization: "整个组织",
  workspace: "当前工作区",
  team: "指定团队",
  self: "仅本人",
};

const capabilityNames: Record<string, string> = {
  "task:read": "查看任务",
  "task:create": "创建任务",
  "task:update": "更新任务",
  "task:assign": "分配任务",
  "trend:read": "查看热点",
  "trend:follow": "关注热点",
  "opportunity:read": "查看机会",
  "opportunity:decide": "处理机会",
  "competitor:read": "查看竞品",
  "sourcing:read": "查看供应链",
  "report:read": "查看报表",
  "team:manage": "管理团队与规则",
};

const stateNames: Record<string, string> = {
  active: "使用中",
  revoked: "已撤销",
  expired: "已过期",
  todo: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
  low: "低",
  normal: "普通",
  high: "高",
  critical: "紧急",
  adopt: "采纳",
  observe: "继续观察",
  reject: "驳回",
};

export const roleName = (value: string) => roleNames[value] ?? "自定义角色";
export const scopeName = (value: string) => scopeNames[value] ?? "指定范围";
export const capabilityName = (value: string) => capabilityNames[value] ?? "其他已授权操作";
export const statusName = (value: string) => stateNames[value] ?? value;
export const decisionName = (value: string) => stateNames[value] ?? "已处理";

export function formatPersonalDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "时间信息不可用"
    : date.toLocaleString("zh-CN", { hour12: false });
}
