import { randomUUID } from "node:crypto";

export type Availability = "in_stock" | "out_of_stock" | "unknown";
export type CompetitorWriteContext = {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  requestId: string;
  traceId: string;
  idempotencyKey: string;
};
export class CompetitorServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "CompetitorServiceError";
  }
}
const text = (v: unknown, name: string, max: number, pattern?: RegExp) => {
  if (typeof v !== "string")
    throw new CompetitorServiceError("competitor_input_invalid", 400, `修正 ${name}。`);
  const value = v.trim();
  if (!value || value.length > max || (pattern && !pattern.test(value)))
    throw new CompetitorServiceError("competitor_input_invalid", 400, `修正 ${name}。`);
  return value;
};
const uuid = (v: unknown, name: string) =>
  text(v, name, 36, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const number = (v: unknown, name: string, max: number, integer = false) => {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    v > max ||
    (integer && !Number.isSafeInteger(v))
  )
    throw new CompetitorServiceError(
      "competitor_metric_invalid",
      400,
      `${name} 必须是有效非负数。`,
    );
  return v;
};
export function validateSnapshot(v: any) {
  const captured = new Date(v?.captured_at);
  if (Number.isNaN(captured.valueOf()) || captured.valueOf() > Date.now() + 300000)
    throw new CompetitorServiceError(
      "competitor_captured_at_invalid",
      400,
      "提交有效的历史 captured_at。",
    );
  if (
    !["in_stock", "out_of_stock", "unknown"].includes(v.availability) ||
    !["fresh", "stale"].includes(v.freshness) ||
    !["healthy", "degraded", "unavailable"].includes(v.source_status)
  )
    throw new CompetitorServiceError(
      "competitor_source_state_invalid",
      400,
      "提交有效库存、新鲜度和来源状态。",
    );
  return {
    current_price: number(v.current_price, "current_price", 999999999999),
    currency: text(v.currency, "currency", 3, /^[A-Za-z]{3}$/).toUpperCase(),
    rank_value: number(v.rank_value, "rank_value", 4294967295, true),
    review_count: number(v.review_count, "review_count", 4294967295, true),
    rating_value: number(v.rating_value, "rating_value", 5),
    availability: v.availability as Availability,
    captured_at: captured,
    freshness: v.freshness as "fresh" | "stale",
    source_status: v.source_status as "healthy" | "degraded" | "unavailable",
    source_ref_id: text(v.source_ref_id, "source_ref_id", 255),
    evidence_id: uuid(v.evidence_id, "evidence_id"),
  };
}
export function validateCompetitor(v: any) {
  let url: string;
  try {
    url = new URL(text(v?.product_url, "product_url", 2048)).toString();
  } catch {
    throw new CompetitorServiceError("competitor_url_invalid", 400, "提交绝对 http(s) 商品网址。");
  }
  if (!/^https?:/.test(url))
    throw new CompetitorServiceError("competitor_url_invalid", 400, "提交绝对 http(s) 商品网址。");
  const asin = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]?.toUpperCase();
  return {
    provider_id: v.provider_id ? uuid(v.provider_id, "provider_id") : null,
    opportunity_id: v.opportunity_id ? uuid(v.opportunity_id, "opportunity_id") : null,
    market: v.market ? text(v.market, "market", 40, /^[A-Za-z0-9._-]+$/).toUpperCase() : "US",
    source_site: v.source_site
      ? text(v.source_site, "source_site", 120)
      : new URL(url).hostname.replace(/^www\./, ""),
    external_id: v.external_id ? text(v.external_id, "external_id", 255) : (asin ?? url),
    product_url: url,
    title: text(v.title, "title", 500),
    snapshot: v.snapshot ? validateSnapshot(v.snapshot) : null,
  };
}
export function validateRule(v: any) {
  if (
    !["price", "rank", "review_count", "availability"].includes(v?.metric) ||
    !["increase", "decrease", "change", "became_unavailable"].includes(v?.direction)
  )
    throw new CompetitorServiceError("competitor_rule_invalid", 400, "选择有效指标和方向。");
  const availability = v.metric === "availability";
  if (availability && v.direction !== "became_unavailable" && v.direction !== "change")
    throw new CompetitorServiceError(
      "competitor_rule_invalid",
      400,
      "库存规则只支持变化或变为不可售。",
    );
  if (!availability && !["increase", "decrease", "change"].includes(v.direction))
    throw new CompetitorServiceError("competitor_rule_invalid", 400, "数值规则方向无效。");
  return {
    competitor_id: v.competitor_id ? uuid(v.competitor_id, "competitor_id") : null,
    metric: v.metric as "price" | "rank" | "review_count" | "availability",
    direction: v.direction as "increase" | "decrease" | "change" | "became_unavailable",
    threshold_value: availability
      ? null
      : number(v.threshold_value, "threshold_value", 999999999999),
  };
}
export interface CompetitorRepository {
  list(i: { organizationId: string; workspaceId: string }): Promise<unknown>;
  get(i: { organizationId: string; workspaceId: string; competitorId: string }): Promise<unknown>;
  listRules(i: { organizationId: string; workspaceId: string }): Promise<unknown>;
  create(
    i: CompetitorWriteContext & {
      id: string;
      taskId: string;
      subqueryId: string;
      value: ReturnType<typeof validateCompetitor>;
      route: string;
    },
  ): Promise<unknown>;
  addSnapshot(
    i: CompetitorWriteContext & {
      id: string;
      competitorId: string;
      value: ReturnType<typeof validateSnapshot>;
      route: string;
    },
  ): Promise<unknown>;
  createRule(
    i: CompetitorWriteContext & {
      id: string;
      value: ReturnType<typeof validateRule>;
      route: string;
    },
  ): Promise<unknown>;
  setStatus(
    i: CompetitorWriteContext & {
      competitorId: string;
      status: "active" | "paused";
      expectedRevision: number;
      route: string;
    },
  ): Promise<unknown>;
  collect(i: any): Promise<unknown>;
  discover(i: any): Promise<unknown>;
  remove(i: any): Promise<unknown>;
}
export class CompetitorService {
  constructor(private readonly repo: CompetitorRepository) {}
  list(i: { organizationId: string; workspaceId: string }) {
    return this.repo.list(i);
  }
  get(i: { organizationId: string; workspaceId: string; competitorId: string }) {
    return this.repo.get({ ...i, competitorId: uuid(i.competitorId, "competitor_id") });
  }
  listRules(i: { organizationId: string; workspaceId: string }) {
    return this.repo.listRules(i);
  }
  create(i: CompetitorWriteContext & { value: any }) {
    return this.repo.create({
      ...i,
      id: randomUUID(),
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      value: validateCompetitor(i.value),
      route: "POST:/api/v1/competitors",
    });
  }
  addSnapshot(i: CompetitorWriteContext & { competitorId: string; value: any }) {
    const id = uuid(i.competitorId, "competitor_id");
    return this.repo.addSnapshot({
      ...i,
      id: randomUUID(),
      competitorId: id,
      value: validateSnapshot(i.value),
      route: `POST:/api/v1/competitors/${id}/snapshots`,
    });
  }
  createRule(i: CompetitorWriteContext & { value: any }) {
    return this.repo.createRule({
      ...i,
      id: randomUUID(),
      value: validateRule(i.value),
      route: "POST:/api/v1/competitor-monitor-rules",
    });
  }
  setStatus(i: CompetitorWriteContext & { competitorId: string; value: any }) {
    const id = uuid(i.competitorId, "competitor_id");
    if (
      !["active", "paused"].includes(i.value?.status) ||
      !Number.isSafeInteger(i.value?.expected_revision) ||
      i.value.expected_revision < 1
    )
      throw new CompetitorServiceError(
        "competitor_action_invalid",
        400,
        "提交 active/paused 和当前 revision。",
      );
    return this.repo.setStatus({
      ...i,
      competitorId: id,
      status: i.value.status,
      expectedRevision: i.value.expected_revision,
      route: `POST:/api/v1/competitors/${id}/actions`,
    });
  }
  collect(i: CompetitorWriteContext & { competitorId: string }) {
    const id = uuid(i.competitorId, "competitor_id");
    return this.repo.collect({
      ...i,
      competitorId: id,
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      route: `POST:/api/v1/competitors/${id}/collect`,
    });
  }
  discover(i: CompetitorWriteContext & { opportunityId: string }) {
    const id = uuid(i.opportunityId, "opportunity_id");
    return this.repo.discover({
      ...i,
      opportunityId: id,
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      route: `POST:/api/v1/opportunities/${id}/competitor-discovery`,
    });
  }
  remove(i: CompetitorWriteContext & { competitorId: string; value: any }) {
    const id = uuid(i.competitorId, "competitor_id"),
      reason = text(i.value?.reason, "reason", 500),
      expected = Number(i.value?.expected_revision);
    if (!Number.isSafeInteger(expected) || expected < 1)
      throw new CompetitorServiceError("competitor_revision_invalid", 400, "提交当前竞品版本。");
    return this.repo.remove({
      ...i,
      competitorId: id,
      reason,
      expectedRevision: expected,
      route: `DELETE:/api/v1/competitors/${id}`,
    });
  }
}
