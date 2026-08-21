import { assertOrganizationScope, type RequestContext } from "@scoutops/contracts";

export interface AuditRecord {
  action: "foundation.delivery.recorded";
  organization_id: string;
  workspace_id?: string;
  actor_id: string;
  request_id: string;
  trace_id: string;
  occurred_at: string;
}

export interface FoundationDelivery {
  id: string;
  idempotency_key: string;
  status: "accepted";
  version: 1;
}

export class FoundationDeliveryService {
  readonly #deliveries = new Map<string, FoundationDelivery>();
  readonly #audit: AuditRecord[] = [];

  record(
    context: RequestContext,
    input: { id: string; idempotency_key: string },
  ): FoundationDelivery {
    assertOrganizationScope(context, { workspaceRequired: true });
    const scopedKey = `${context.organization_id}:${input.idempotency_key}`;
    const existing = this.#deliveries.get(scopedKey);
    if (existing) return existing;

    const delivery: FoundationDelivery = {
      id: input.id,
      idempotency_key: input.idempotency_key,
      status: "accepted",
      version: 1,
    };
    this.#deliveries.set(scopedKey, delivery);
    this.#audit.push({
      action: "foundation.delivery.recorded",
      organization_id: context.organization_id,
      ...(context.workspace_id ? { workspace_id: context.workspace_id } : {}),
      actor_id: context.actor_id,
      request_id: context.request_id,
      trace_id: context.trace_id,
      occurred_at: new Date().toISOString(),
    });
    return delivery;
  }

  auditRecords(): readonly AuditRecord[] {
    return this.#audit;
  }
}
