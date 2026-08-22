export type NavigationShellKind = "member" | "organization_admin" | "platform_admin";

export const platformOperationsNavigation = [
  { label: "系统状态", path: "/platform-admin/status" },
  { label: "链路日志", path: "/platform-admin/logs" },
  { label: "服务拓扑", path: "/platform-admin/topology" },
  { label: "采集调度", path: "/platform-admin/crawler-scheduler" },
  { label: "Redis", path: "/platform-admin/redis" },
  { label: "MySQL", path: "/platform-admin/mysql" },
  { label: "文件存储", path: "/platform-admin/files" },
  { label: "备份恢复", path: "/platform-admin/operations" },
  { label: "发布管理", path: "/platform-admin/releases" },
  { label: "容量边界", path: "/platform-admin/capacity" },
] as const;

const breadcrumbRoutes: Record<string, string> = {
  工作台: "/home",
  洞察与选品: "/opportunities",
  运营工具: "/automations",
  选品机会: "/opportunities",
  全部任务: "/tasks",
  供应链与利润: "/sourcing",
  组织后台: "/org-admin",
  平台后台: "/platform-admin",
  账号与组织: "/platform-admin/accounts",
  热点与采集: "/platform-admin/providers",
  数据治理: "/platform-admin/data",
  运营中心: "/platform-admin/content",
  安全中心: "/platform-admin/security",
  系统运维: "/platform-admin/status",
};

export function breadcrumbTrail(labels: string[], currentPath: string) {
  return labels.map((label, index) => {
    const path = index === labels.length - 1 ? undefined : breadcrumbRoutes[label];
    return { label, path: path && path !== currentPath ? path : undefined };
  });
}

export function navigationParentPath(path: string) {
  if (
    path === "/platform-admin/accounts" ||
    path === "/platform-admin/organizations" ||
    path.startsWith("/platform-admin/organizations/")
  )
    return "/platform-admin/organizations";
  if (path === "/platform-admin/users") return "/platform-admin/users";
  if (["/platform-admin/permissions", "/platform-admin/admins"].includes(path))
    return "/platform-admin/admins";
  if (path.startsWith("/platform-admin/providers") || path === "/platform-admin/credentials")
    return "/platform-admin/providers/sources";
  if (path.startsWith("/platform-admin/collection")) return "/platform-admin/collection/overview";
  if (platformOperationsNavigation.some((item) => item.path === path))
    return "/platform-admin/status";
  return path;
}

export function routeEntityIds(path: string) {
  return {
    opportunityId: path.match(/^\/opportunities\/([0-9a-f-]{36})$/i)?.[1] ?? "",
    taskId: path.match(/^\/tasks\/([0-9a-f-]{36})$/i)?.[1] ?? "",
    platformOrganizationId:
      path.match(/^\/platform-admin\/organizations\/([0-9a-f-]{36})$/i)?.[1] ?? "",
  };
}

export function surfaceProps(input: {
  surface: string;
  path: string;
  apiBaseUrl: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  capabilities: string[];
  roles: string[];
}) {
  const common = { apiBaseUrl: input.apiBaseUrl },
    ids = routeEntityIds(input.path);
  switch (input.surface) {
    case "task-workspace":
      return {
        ...common,
        mode: input.path === "/work" ? "today" : "all",
        taskId: ids.taskId || undefined,
      };
    case "organization-admin-center":
      return { ...common, routePath: input.path, organizationId: input.organizationId || "" };
    case "platform-account-center":
      return {
        ...common,
        routePath: input.path,
        organizationId: ids.platformOrganizationId || undefined,
        initialTab: ["/platform-admin/admins", "/platform-admin/permissions"].includes(input.path)
          ? "admins"
          : input.path === "/platform-admin/users"
            ? "users"
            : "organizations",
      };
    case "platform-dashboard":
      return { ...common, capabilities: input.capabilities };
    case "platform-management-center":
      return { ...common, domain: input.path.split("/").pop() || "status" };
    case "trend-dashboard":
      return {
        ...common,
        organizationId: input.organizationId || "",
        workspaceId: input.workspaceId || "",
      };
    case "opportunity-workspace":
      return { ...common, opportunityId: ids.opportunityId || undefined };
    case "competitor-monitor":
      return { ...common, mode: input.path.endsWith("/monitoring-rules") ? "rules" : "list" };
    case "cost-rule-console":
      return { ...common, roles: input.roles };
    case "provider-runtime-surface":
      return { ...common, routePath: input.path, capabilities: input.capabilities };
    case "collection-runtime-surface":
      return { ...common, routePath: input.path };
    default:
      return common;
  }
}

export function pageSummary(shell: NavigationShellKind, path: string) {
  if (shell === "organization_admin")
    return "组织资料、成员、角色、工作区、团队、审批、Token 与审计均受当前组织权限和审计边界保护。";
  if (path === "/platform-admin")
    return "先看今天有没有新热点、采集是否正常，再处理需要人工确认的事项。";
  if (
    [
      "/platform-admin/accounts",
      "/platform-admin/permissions",
      "/platform-admin/organizations",
      "/platform-admin/users",
      "/platform-admin/admins",
    ].includes(path)
  )
    return "管理组织、普通用户和平台管理员；不用理解内部权限代码。";
  if (path === "/platform-admin/operations")
    return "备份副本、RPO/RTO 与隔离恢复结论均来自可审计记录；未验证条件明确阻断。";
  if (path === "/platform-admin/releases")
    return "版本、迁移、渐进观察门、自动停止与回滚均来自宝塔发布任务的审计事实。";
  if (path === "/platform-admin/topology")
    return "当前惠州单机的 API 心跳、宝塔 Nginx 单上游和私有服务只按可审计事实判定；不启用负载均衡或多节点。";
  if (path === "/platform-admin/redis")
    return "当前宝塔单 Redis 的持久化、内存与连接上限、告警和恢复状态只按可审计事实判定；不启用 Sentinel、集群或副本。";
  if (path === "/platform-admin/mysql")
    return "当前宝塔 MySQL 5.7 单主的持久化、I/O、慢查询、容量与隔离恢复只按可审计事实判定；不启用读副本、负载均衡或备用服务器。";
  if (path === "/platform-admin/files")
    return "当前宝塔本机证据与导出目录的组织隔离、容量、校验和与同机恢复只按可审计事实判定；不启用共享存储或备用服务器。";
  if (
    ["/work", "/tasks", "/tasks/approvals", "/notifications"].includes(path) ||
    /^\/tasks\/[0-9a-f-]{36}$/i.test(path)
  )
    return "把选品工作拆成具体任务，查看负责人、期限、运行进度和处理记录。";
  if (path === "/sourcing")
    return "供应链候选、版本化报价、最多五家对比和采购任务均保留来源与缺失项。";
  if (path.startsWith("/competitors"))
    return "持续记录竞品价格、评分、页面变化和告警，点击记录可查看详情。";
  if (path.startsWith("/sourcing/cost-rules"))
    return "维护费用和汇率规则，计算商品利润并明确展示缺失成本。";
  if (path === "/opportunities" || path.startsWith("/opportunities/"))
    return "汇总商品图片、趋势、竞争、利润、风险和原始证据，辅助判断是否值得做。";
  if (path === "/trends") return "用热度、增速、来源和证据判断市场变化，并可转为选品机会。";
  return "";
}
