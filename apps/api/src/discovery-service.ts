import type { GlobalSearchPage, GlobalSearchResult, QuickActionSummary } from "@scoutops/contracts";
export class DiscoveryError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "DiscoveryError";
  }
}
export interface DiscoveryRepository {
  search(input: {
    organizationId: string;
    workspaceId: string;
    query: string;
    capabilities: string[];
    limit: number;
    cursor?: string;
    resourceType?: "task" | "opportunity" | "evidence" | "collection_task";
    status?: string;
    assignee?: string;
  }): Promise<{ items: GlobalSearchResult[]; nextCursor: string | null }>;
}
const ACTIONS: QuickActionSummary[] = [
  {
    id: "task",
    label: "创建任务",
    description: "进入任务创建页",
    route: "/tasks?create=1",
    required_capability: "task:create",
  },
  {
    id: "sourcing",
    label: "发起找货",
    description: "进入供应链搜索",
    route: "/sourcing?create=1",
    required_capability: "sourcing:read",
  },
  {
    id: "member",
    label: "邀请成员",
    description: "进入当前组织成员管理",
    route: "/org-admin/members?create=1",
    required_capability: "membership:manage",
  },
  {
    id: "workspace",
    label: "创建工作区",
    description: "进入当前组织工作区管理",
    route: "/org-admin/workspaces?create=1",
    required_capability: "workspace:manage",
  },
  {
    id: "provider",
    label: "配置来源",
    description: "进入平台来源注册中心",
    route: "/platform-admin/providers?create=1",
    required_capability: "provider:configure",
  },
];
const SHELL_ACTION_PRIORITY = {
  member: ["task", "sourcing", "member", "workspace", "provider"],
  organization_admin: ["member", "workspace", "task", "sourcing", "provider"],
  platform_admin: ["provider", "workspace", "member", "task", "sourcing"],
} as const;
export class DiscoveryService {
  constructor(private readonly repository: DiscoveryRepository) {}
  async search(input: {
    organizationId: string;
    workspaceId: string;
    query: string;
    capabilities: string[];
    limit?: number;
    cursor?: string;
    resourceType?: "task" | "opportunity" | "evidence" | "collection_task";
    status?: string;
    assignee?: string;
  }): Promise<GlobalSearchPage> {
    const query = input.query.trim();
    if (query.length < 2 || query.length > 100)
      throw new DiscoveryError("search_query_invalid", 400, "输入 2–100 个字符。");
    const limit = input.limit ?? 10;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20)
      throw new DiscoveryError("search_limit_invalid", 400, "limit 应为 1–20。");
    const status = input.status?.trim(),
      assignee = input.assignee?.trim();
    if (status && !/^[a-z][a-z0-9_]{0,39}$/.test(status))
      throw new DiscoveryError("search_status_invalid", 400, "选择有效的业务状态。");
    if (assignee && assignee.length > 120)
      throw new DiscoveryError("search_assignee_invalid", 400, "负责人筛选不能超过 120 个字符。");
    const result = await this.repository.search({
      ...input,
      query,
      limit,
      ...(status ? { status } : {}),
      ...(assignee ? { assignee } : {}),
    });
    return {
      items: result.items,
      next_cursor: result.nextCursor,
      scope: { organization_id: input.organizationId, workspace_id: input.workspaceId },
    };
  }
  quickActions(
    capabilities: string[],
    shell: "member" | "organization_admin" | "platform_admin" = "member",
  ) {
    const priority = SHELL_ACTION_PRIORITY[shell];
    return ACTIONS.filter((item) => capabilities.includes(item.required_capability)).sort(
      (left, right) => priority.indexOf(left.id as never) - priority.indexOf(right.id as never),
    );
  }
}
