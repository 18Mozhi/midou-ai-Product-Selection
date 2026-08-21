import { createHash, randomUUID } from "node:crypto";
export type AuditOutcome = "succeeded" | "failed" | "blocked";
export interface AuditEvent {
  id: string;
  organization_id: string | null;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditOutcome;
  request_id: string;
  trace_id: string;
  metadata: Record<string, unknown>;
  occurred_at: Date;
  schema_version: 1;
}
export interface AuditFilter {
  organizationId?: string;
  action?: string;
  outcome?: AuditOutcome;
  resourceType?: string;
  requestId?: string;
  traceId?: string;
  occurredFrom?: Date;
  occurredTo?: Date;
  cursor?: string;
  limit?: number;
}
export interface SeedAdminInput {
  id: string;
  email: string;
  emailHash: string;
  passwordHash: string;
  requestId: string;
  traceId: string;
  now: Date;
}
export interface AuditRepository {
  seedPlatformAdmin(
    input: SeedAdminInput,
  ): Promise<{ status: "created" | "already_seeded"; userId: string }>;
  list(filter: AuditFilter): Promise<{ items: AuditEvent[]; nextCursor: string | null }>;
  append(event: AuditEvent): Promise<void>;
}
export interface SeedPasswordHasher {
  hash(value: string): Promise<string>;
}
export class AuditError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "AuditError";
  }
}
export class SeedAdminService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly hasher: SeedPasswordHasher,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async seed(input: { email: string; password: string; requestId: string; traceId: string }) {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new AuditError("seed_email_invalid", 400, "在宝塔受限变量中配置有效邮箱。");
    if (input.password.length < 12 || input.password.length > 1024)
      throw new AuditError("seed_password_invalid", 400, "配置 12–1024 位一次性强密码。");
    return this.repository.seedPlatformAdmin({
      id: randomUUID(),
      email,
      emailHash: createHash("sha256").update(email).digest("hex"),
      passwordHash: await this.hasher.hash(input.password),
      requestId: input.requestId,
      traceId: input.traceId,
      now: this.now(),
    });
  }
}
export class AuditQueryService {
  constructor(private readonly repository: AuditRepository) {}
  list(filter: AuditFilter) {
    const limit = filter.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new AuditError("audit_limit_invalid", 400, "limit 必须为 1–100。");
    if (filter.occurredFrom && filter.occurredTo && filter.occurredFrom > filter.occurredTo)
      throw new AuditError("audit_range_invalid", 400, "调整审计时间范围后重试。");
    return this.repository.list({ ...filter, limit });
  }
}
export class InMemoryAuditRepository implements AuditRepository {
  events: AuditEvent[] = [];
  seededUserId: string | null = null;
  async seedPlatformAdmin(input: SeedAdminInput) {
    if (this.seededUserId) return { status: "already_seeded" as const, userId: this.seededUserId };
    this.seededUserId = input.id;
    this.events.push({
      id: randomUUID(),
      organization_id: null,
      workspace_id: null,
      actor_id: input.id,
      action: "platform_admin.seeded",
      resource_type: "user",
      resource_id: input.id,
      outcome: "succeeded",
      request_id: input.requestId,
      trace_id: input.traceId,
      metadata: {
        email_hash: input.emailHash,
        role_code: "platform_super_admin",
        forced_security_setup: true,
      },
      occurred_at: input.now,
      schema_version: 1,
    });
    return { status: "created" as const, userId: input.id };
  }
  async append(event: AuditEvent) {
    this.events.push(event);
  }
  async list(filter: AuditFilter) {
    const items = this.events
      .filter(
        (e) =>
          (filter.organizationId === undefined
            ? e.organization_id === null
            : e.organization_id === filter.organizationId) &&
          (!filter.action || e.action === filter.action) &&
          (!filter.outcome || e.outcome === filter.outcome) &&
          (!filter.resourceType || e.resource_type === filter.resourceType) &&
          (!filter.requestId || e.request_id === filter.requestId) &&
          (!filter.traceId || e.trace_id === filter.traceId) &&
          (!filter.occurredFrom || e.occurred_at >= filter.occurredFrom) &&
          (!filter.occurredTo || e.occurred_at <= filter.occurredTo),
      )
      .sort(
        (a, b) => b.occurred_at.getTime() - a.occurred_at.getTime() || b.id.localeCompare(a.id),
      );
    const start = filter.cursor
        ? Math.max(0, items.findIndex((e) => e.id === filter.cursor) + 1)
        : 0,
      limit = filter.limit ?? 50,
      page = items.slice(start, start + limit);
    return { items: page, nextCursor: items[start + limit]?.id ?? null };
  }
}
