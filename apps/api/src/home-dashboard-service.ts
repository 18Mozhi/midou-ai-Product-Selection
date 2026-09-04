import type { HomeDashboardItem, HomeDashboardSummary } from "@scoutops/contracts";
export interface HomeDashboardRepository {
  list(input: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    capabilities: string[];
  }): Promise<HomeDashboardItem[]>;
  automaticSelection?(input: {
    organizationId: string;
    workspaceId: string;
  }): Promise<HomeDashboardSummary["automatic_selection"]>;
}
const limits = { action: 5, change: 6, follow: 6, health: 3 } as const;
const priorityRank = { overdue: 5, blocking: 4, high_risk: 3, high_value: 2, normal: 1 },
  riskRank = { critical: 6, high: 5, medium: 4, normal: 3, low: 2, unknown: 1 };
function actionOrder(a: HomeDashboardItem, b: HomeDashboardItem) {
  const priority = priorityRank[b.priority ?? "normal"] - priorityRank[a.priority ?? "normal"];
  if (priority) return priority;
  const risk =
    (riskRank[b.risk_level ?? "unknown"] ?? 0) - (riskRank[a.risk_level ?? "unknown"] ?? 0);
  if (risk) return risk;
  const value =
    (b.value_score ?? Number.NEGATIVE_INFINITY) - (a.value_score ?? Number.NEGATIVE_INFINITY);
  if (value) return value;
  const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY,
    bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  const observed = Date.parse(b.observed_at) - Date.parse(a.observed_at);
  return observed || b.id.localeCompare(a.id);
}
export class HomeDashboardService {
  constructor(
    private readonly repository: HomeDashboardRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async get(input: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    capabilities: string[];
  }): Promise<HomeDashboardSummary> {
    const [rows, automaticSelection] = await Promise.all([
        this.repository.list(input),
        this.repository.automaticSelection?.(input) ??
          Promise.resolve({
            state: "not_configured" as const,
            enabled_rule_count: 0,
            candidate_count: 0,
            rule_candidate_count: 0,
            recommended_count: 0,
            awaiting_evidence_count: 0,
            adopted_count: 0,
            recommended_items: [],
            last_collection_at: null,
            next_collection_at: null,
          }),
      ]),
      ordered = [
        ...rows.filter((item) => item.kind === "action").sort(actionOrder),
        ...rows.filter((item) => item.kind !== "action"),
      ],
      groups = {
        actions: [] as HomeDashboardItem[],
        changes: [] as HomeDashboardItem[],
        follows: [] as HomeDashboardItem[],
        health: [] as HomeDashboardItem[],
      };
    const recommendedItems = rows
      .filter((item) => item.kind === "action" && item.source_module === "opportunity")
      .sort(actionOrder)
      .slice(0, 5);
    const actionRoutes = new Set<string>();
    for (const item of ordered) {
      const key =
        item.kind === "action"
          ? "actions"
          : item.kind === "change"
            ? "changes"
            : item.kind === "follow"
              ? "follows"
              : "health";
      if (item.kind === "action") {
        if (actionRoutes.has(item.route)) continue;
        actionRoutes.add(item.route);
      }
      if (groups[key].length < limits[item.kind]) groups[key].push(item);
    }
    return {
      ...groups,
      automatic_selection: { ...automaticSelection, recommended_items: recommendedItems },
      scope: { organization_id: input.organizationId, workspace_id: input.workspaceId },
      generated_at: this.now().toISOString(),
    };
  }
}
