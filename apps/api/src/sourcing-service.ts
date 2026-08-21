import { randomUUID } from "node:crypto";
export type SourcingContext = {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  requestId: string;
  traceId: string;
  idempotencyKey: string;
};
export class SourcingServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "SourcingServiceError";
  }
}
const text = (v: unknown, n: string, max: number, p?: RegExp) => {
    if (typeof v !== "string")
      throw new SourcingServiceError("sourcing_input_invalid", 400, `修正 ${n}。`);
    const x = v.trim();
    if (!x || x.length > max || (p && !p.test(x)))
      throw new SourcingServiceError("sourcing_input_invalid", 400, `修正 ${n}。`);
    return x;
  },
  uuid = (v: unknown, n: string) =>
    text(v, n, 36, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  num = (v: unknown, n: string, max: number, int = false) => {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < 0 ||
      v > max ||
      (int && !Number.isSafeInteger(v))
    )
      throw new SourcingServiceError("sourcing_number_invalid", 400, `${n} 必须为有效非负数。`);
    return v;
  };
export function validateSearch(v: any) {
  if (!["keyword", "image", "opportunity", "product_url"].includes(v?.input_type))
    throw new SourcingServiceError(
      "sourcing_input_type_invalid",
      400,
      "选择关键词、图片、机会或商品链接。",
    );
  return {
    collection_task_id: v?.collection_task_id
      ? uuid(v.collection_task_id, "collection_task_id")
      : null,
    input_type: v.input_type as string,
    input_ref: text(v.input_ref, "input_ref", 2048),
  };
}
export function validateQuote(v: any) {
  const observed = new Date(v?.observed_at);
  if (Number.isNaN(observed.valueOf()) || observed.valueOf() > Date.now() + 300000)
    throw new SourcingServiceError("supplier_quote_time_invalid", 400, "提交有效历史观测时间。");
  if (
    !["stable", "variable", "unknown"].includes(v?.stability_status) ||
    !["low", "medium", "high", "unknown"].includes(v?.risk_level)
  )
    throw new SourcingServiceError("supplier_quote_risk_invalid", 400, "显式提交稳定性和风险。");
  const moq = num(v.moq, "moq", 4294967295, true);
  if (moq < 1)
    throw new SourcingServiceError("supplier_quote_moq_invalid", 400, "最小起订量至少为 1。");
  return {
    candidate_id: uuid(v.candidate_id, "candidate_id"),
    moq,
    specification: text(v.specification, "specification", 1000),
    lead_time_days: num(v.lead_time_days, "lead_time_days", 3650, true),
    location: text(v.location, "location", 255),
    confidence_value: num(v.confidence_value, "confidence_value", 100),
    stability_status: v.stability_status as string,
    risk_level: v.risk_level as string,
    observed_at: observed,
    evidence_id: uuid(v.evidence_id, "evidence_id"),
  };
}
export function validateComparison(v: any) {
  if (
    !Array.isArray(v?.quote_ids) ||
    v.quote_ids.length < 2 ||
    v.quote_ids.length > 5 ||
    new Set(v.quote_ids).size !== v.quote_ids.length
  )
    throw new SourcingServiceError(
      "sourcing_comparison_size_invalid",
      400,
      "选择 2–5 家不重复报价。",
    );
  return {
    name: text(v.name, "name", 200),
    quote_ids: v.quote_ids.map((x: unknown) => uuid(x, "quote_id")),
  };
}
export interface SourcingRepository {
  list(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  listComparisons(i: any): Promise<any>;
  createSearch(i: any): Promise<any>;
  confirmQuote(i: any): Promise<any>;
  createComparison(i: any): Promise<any>;
  createPurchaseTask(i: any): Promise<any>;
  refresh(i: any): Promise<any>;
  remove(i: any): Promise<any>;
}
export class SourcingService {
  constructor(private readonly repo: SourcingRepository) {}
  list(i: any) {
    return this.repo.list(i);
  }
  detail(i: any) {
    return this.repo.detail({ ...i, searchId: uuid(i.searchId, "search_id") });
  }
  listComparisons(i: any) {
    return this.repo.listComparisons(i);
  }
  createSearch(i: SourcingContext & { value: any }) {
    return this.repo.createSearch({
      ...i,
      id: randomUUID(),
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      value: validateSearch(i.value),
      route: "POST:/api/v1/sourcing/searches",
    });
  }
  confirmQuote(i: SourcingContext & { value: any }) {
    return this.repo.confirmQuote({
      ...i,
      id: randomUUID(),
      value: validateQuote(i.value),
      route: "POST:/api/v1/sourcing/quotes",
    });
  }
  createComparison(i: SourcingContext & { value: any }) {
    return this.repo.createComparison({
      ...i,
      id: randomUUID(),
      value: validateComparison(i.value),
      route: "POST:/api/v1/sourcing/comparisons",
    });
  }
  createPurchaseTask(i: SourcingContext & { value: any }) {
    const quoteId = uuid(i.value?.quote_id, "quote_id"),
      quantity = num(i.value?.quantity, "quantity", 4294967295, true),
      reason = text(i.value?.reason, "reason", 1000);
    if (quantity < 1)
      throw new SourcingServiceError("purchase_quantity_invalid", 400, "采购数量至少为 1。");
    return this.repo.createPurchaseTask({
      ...i,
      id: randomUUID(),
      quoteId,
      quantity,
      reason,
      route: "POST:/api/v1/sourcing/purchase-tasks",
    });
  }
  refresh(i: SourcingContext & { searchId: string }) {
    const id = uuid(i.searchId, "search_id");
    return this.repo.refresh({
      ...i,
      searchId: id,
      taskId: randomUUID(),
      subqueryId: randomUUID(),
      route: `POST:/api/v1/sourcing/searches/${id}/refresh`,
    });
  }
  remove(i: SourcingContext & { searchId: string; value: any }) {
    const id = uuid(i.searchId, "search_id"),
      reason = text(i.value?.reason, "reason", 500);
    return this.repo.remove({
      ...i,
      searchId: id,
      reason,
      route: `DELETE:/api/v1/sourcing/searches/${id}`,
    });
  }
}
