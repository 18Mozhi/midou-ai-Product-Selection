import type { RouteRecordRaw } from "vue-router";

export type AppShell = "member" | "organization_admin" | "platform_admin" | "account";

export interface AppRouteMeta {
  title: string;
  breadcrumb: string[];
  shell?: AppShell;
  view?: string;
  capabilities?: string[];
  notFound?: boolean;
}

const ApplicationSurface = () => import("./App.vue");

const route = (path: string, name: string, meta: AppRouteMeta): RouteRecordRaw => ({
  path,
  name,
  component: ApplicationSurface,
  meta: { ...meta },
});

const member = (
  path: string,
  name: string,
  title: string,
  breadcrumb: string[],
  capabilities: string[] = [],
) => route(path, name, { title, breadcrumb, shell: "member", capabilities });

const organization = (
  path: string,
  name: string,
  title: string,
  breadcrumb: string[],
  capabilities: string[] = [],
) => route(path, name, { title, breadcrumb, shell: "organization_admin", capabilities });

const platform = (
  path: string,
  name: string,
  title: string,
  breadcrumb: string[],
  capabilities: string[] = [],
) => route(path, name, { title, breadcrumb, shell: "platform_admin", capabilities });

export const appRoutes: RouteRecordRaw[] = [
  route("/", "landing", { title: "正在进入", breadcrumb: [], view: "landing" }),
  route("/login", "login", { title: "登录", breadcrumb: ["登录"], view: "local-identity" }),
  route("/register", "register", {
    title: "注册",
    breadcrumb: ["注册"],
    view: "local-identity",
  }),
  route("/forgot-password", "forgot-password", {
    title: "找回密码",
    breadcrumb: ["找回密码"],
    view: "local-identity",
  }),
  route("/verify-email", "verify-email", {
    title: "验证邮箱",
    breadcrumb: ["验证邮箱"],
    view: "local-identity",
  }),
  route("/reset-password", "reset-password", {
    title: "重置密码",
    breadcrumb: ["重置密码"],
    view: "local-identity",
  }),
  route("/security/mfa", "security-mfa", {
    title: "安全设置",
    breadcrumb: ["账号", "安全设置"],
    view: "local-identity",
  }),
  route("/select-context", "select-context", {
    title: "选择组织与工作区",
    breadcrumb: ["选择组织与工作区"],
    view: "tenancy",
  }),
  route("/onboarding", "onboarding", {
    title: "快速引导",
    breadcrumb: ["快速引导"],
    view: "onboarding",
  }),
  route("/settings/theme", "theme-settings", {
    title: "外观偏好",
    breadcrumb: ["账号", "外观偏好"],
    view: "theme",
  }),
  route("/me", "personal-center", {
    title: "个人中心",
    breadcrumb: ["账号", "个人中心"],
    shell: "account",
    view: "account",
  }),

  member("/home", "home", "今日行动", ["工作台", "今日行动"], ["task:read"]),
  member("/work", "today-work", "今日工作", ["工作台", "今日工作"], ["task:read"]),
  member("/trends", "trends", "热点趋势", ["洞察与选品", "热点趋势"], ["trend:read"]),
  member(
    "/opportunities",
    "opportunities",
    "选品机会",
    ["洞察与选品", "选品机会"],
    ["opportunity:read"],
  ),
  member(
    "/opportunities/start",
    "opportunity-start",
    "创建选品",
    ["洞察与选品", "创建选品"],
    ["opportunity:decide"],
  ),
  member("/opportunities/scoring-rules", "opportunity-scoring", "评分规则", [
    "洞察与选品",
    "选品机会",
    "评分规则",
  ]),
  member(
    "/opportunities/:opportunityId",
    "opportunity-detail",
    "机会详情",
    ["洞察与选品", "选品机会", "机会详情"],
    ["opportunity:read"],
  ),
  member(
    "/competitors",
    "competitors",
    "竞品监控",
    ["洞察与选品", "竞品监控"],
    ["competitor:read"],
  ),
  member(
    "/sourcing",
    "sourcing",
    "供应链与利润",
    ["洞察与选品", "供应链与利润"],
    ["sourcing:read"],
  ),
  member("/sourcing/cost-rules", "sourcing-cost-rules", "费用与利润规则", [
    "洞察与选品",
    "供应链与利润",
    "费用规则",
  ]),
  member("/tasks", "tasks", "全部任务", ["工作台", "全部任务"], ["task:read"]),
  member(
    "/tasks/:taskId",
    "task-detail",
    "任务详情",
    ["工作台", "全部任务", "任务详情"],
    ["task:read"],
  ),
  member("/tasks/approvals", "approvals", "审批中心", ["工作台", "审批中心"], ["task:read"]),
  member(
    "/notifications",
    "notifications",
    "通知中心",
    ["工作台", "通知中心"],
    ["notification:read"],
  ),
  member("/automations", "automations", "自动化规则", ["运营工具", "自动化规则"], ["team:manage"]),
  member("/reports", "reports", "报表与导出", ["运营工具", "报表与导出"], ["report:read"]),

  organization("/org-admin", "organization-overview", "治理概览", ["组织后台", "治理概览"]),
  organization("/org-admin/members", "organization-members", "成员与邀请", [
    "组织后台",
    "成员与邀请",
  ]),
  organization("/org-admin/roles", "organization-roles", "角色与权限", ["组织后台", "角色与权限"]),
  organization("/org-admin/workspaces", "organization-workspaces", "工作区与团队", [
    "组织后台",
    "工作区与团队",
  ]),
  organization("/org-admin/approvals", "organization-approvals", "审批模板", [
    "组织后台",
    "审批模板",
  ]),
  organization("/org-admin/data", "organization-data", "组织数据", ["组织后台", "组织数据"]),
  organization("/org-admin/tokens", "organization-tokens", "组织令牌", ["组织后台", "组织令牌"]),
  organization("/org-admin/audit", "organization-audit", "组织审计", ["组织后台", "组织审计"]),

  platform("/platform-admin", "platform-overview", "平台概览", ["平台后台", "平台概览"]),
  platform(
    "/platform-admin/accounts",
    "platform-accounts",
    "账号与组织",
    ["平台后台", "账号与组织"],
    ["platform:superadmin"],
  ),
  platform(
    "/platform-admin/permissions",
    "platform-permissions",
    "平台管理员",
    ["平台后台", "账号与组织", "平台管理员"],
    ["platform:superadmin"],
  ),
  platform(
    "/platform-admin/providers",
    "platform-providers",
    "来源设置",
    ["平台后台", "热点与采集", "来源设置"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/providers/adapters",
    "platform-provider-adapters",
    "采集程序",
    ["平台后台", "热点与采集", "采集程序"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/providers/sources",
    "platform-provider-sources",
    "热点来源",
    ["平台后台", "热点与采集", "热点来源"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/credentials",
    "platform-credentials",
    "凭证与档案",
    ["平台后台", "热点与采集", "凭证与档案"],
    ["platform:superadmin"],
  ),
  platform(
    "/platform-admin/collection",
    "platform-collection-tasks",
    "采集任务",
    ["平台后台", "热点与采集", "采集任务"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/collection/overview",
    "platform-collection-overview",
    "采集总览",
    ["平台后台", "热点与采集", "采集总览"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/collection/browser-runtime",
    "platform-browser-runtime",
    "网页登录采集",
    ["平台后台", "热点与采集", "网页登录采集"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/data",
    "platform-data",
    "数据中心",
    ["平台后台", "数据治理", "数据中心"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/governance",
    "platform-governance",
    "质量与规则",
    ["平台后台", "数据治理", "质量与规则"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/content",
    "platform-content",
    "内容管理",
    ["平台后台", "运营中心", "内容管理"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/notifications",
    "platform-notifications",
    "通知管理",
    ["平台后台", "运营中心", "通知管理"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/commercial",
    "platform-commercial",
    "配额管理",
    ["平台后台", "运营中心", "配额管理"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/security",
    "platform-security",
    "安全中心",
    ["平台后台", "安全中心"],
    ["platform:secure", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/open-platform",
    "platform-open",
    "开放平台",
    ["平台后台", "安全中心", "开放平台"],
    ["platform:superadmin"],
  ),
  platform(
    "/platform-admin/status",
    "platform-status",
    "系统状态",
    ["平台后台", "系统运维", "系统状态"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/operations",
    "platform-operations",
    "备份与恢复",
    ["平台后台", "系统运维", "备份与恢复"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/releases",
    "platform-releases",
    "发布管理",
    ["平台后台", "系统运维", "发布管理"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/topology",
    "platform-topology",
    "服务拓扑",
    ["平台后台", "系统运维", "服务拓扑"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/redis",
    "platform-redis",
    "Redis 运行",
    ["平台后台", "系统运维", "Redis 运行"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/mysql",
    "platform-mysql",
    "MySQL 运行",
    ["平台后台", "系统运维", "MySQL 运行"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/files",
    "platform-files",
    "文件存储",
    ["平台后台", "系统运维", "文件存储"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/crawler-scheduler",
    "platform-crawler-scheduler",
    "采集调度",
    ["平台后台", "系统运维", "采集调度"],
    ["platform:operate", "platform:superadmin"],
  ),
  platform(
    "/platform-admin/capacity",
    "platform-capacity",
    "容量边界",
    ["平台后台", "系统运维", "容量边界"],
    ["platform:operate", "platform:superadmin"],
  ),

  route("/ui-states", "ui-states", {
    title: "界面状态",
    breadcrumb: ["开发工具", "界面状态"],
    view: "ui-states",
  }),
  route("/:pathMatch(.*)*", "not-found", {
    title: "页面不存在",
    breadcrumb: ["页面不存在"],
    view: "not-found",
    notFound: true,
  }),
];
