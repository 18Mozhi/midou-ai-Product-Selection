export const UI_STATE_KINDS = [
  "loading",
  "empty",
  "error",
  "forbidden",
  "expired",
  "blocked",
  "recovery",
  "not_found",
] as const;
export type UiStateKind = (typeof UI_STATE_KINDS)[number];
export interface ConfirmationInput {
  destructive: boolean;
  acknowledged: boolean;
  confirmationText?: string;
  typedText?: string;
}
export const stateFromHttp = (status: number): UiStateKind =>
  status === 401
    ? "expired"
    : status === 403
      ? "forbidden"
      : status === 404
        ? "not_found"
        : [408, 425, 429, 502, 503, 504].includes(status)
          ? "blocked"
          : "error";
export function sanitizeCorrelationId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : "";
}
export function canConfirm(input: ConfirmationInput) {
  if (input.destructive && !input.acknowledged) return false;
  const required = input.confirmationText?.trim();
  return !required || input.typedText?.trim() === required;
}
export const DEFAULT_STATE_COPY: Record<
  UiStateKind,
  { title: string; description: string; primary: string; secondary?: string }
> = {
  loading: {
    title: "正在加载",
    description: "请稍候。",
    primary: "请稍候",
  },
  empty: {
    title: "这里还没有内容",
    description: "当前范围内暂无结果。",
    primary: "开始创建",
    secondary: "调整筛选",
  },
  error: {
    title: "操作未完成",
    description: "请重试；结果不明确时，请先核对记录。",
    primary: "重新尝试",
    secondary: "返回上一页",
  },
  forbidden: {
    title: "你没有此项权限",
    description: "请联系管理员申请访问权限。",
    primary: "返回工作台",
    secondary: "申请权限",
  },
  expired: {
    title: "登录已失效",
    description: "请重新登录后继续。",
    primary: "重新登录",
  },
  blocked: {
    title: "依赖暂时受阻",
    description: "服务暂不可用，请稍后重试。",
    primary: "稍后重试",
    secondary: "查看影响",
  },
  recovery: {
    title: "服务已恢复",
    description: "可以继续操作。",
    primary: "继续",
  },
  not_found: {
    title: "没有找到这个页面",
    description: "地址可能有误，或页面已变更。",
    primary: "返回选品工作台",
    secondary: "返回上一页",
  },
};
