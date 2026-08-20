// @ts-nocheck -- aggregate result rows are normalized below.
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  CollectionConsoleError,
  type CollectionConsoleRepository,
} from "./collection-console-service.js";

const numberValue = (value: unknown) => Number(value ?? 0);
const iso = (value: unknown) => (value ? new Date(value as string | Date).toISOString() : null);
const windowMilliseconds: Record<string, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: null,
};

export class MySqlCollectionConsoleRepository implements CollectionConsoleRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}

  async read(input: any) {
    await this.validateScope(input);
    const observedAt = this.now();
    const windowMs = windowMilliseconds[input.window];
    const since = windowMs == null ? null : new Date(observedAt.getTime() - windowMs);
    const taskFilter = this.taskFilter(input, since);
    const deadFilter = this.deadFilter(input, since);
    const qualityFilter = this.qualityFilter(input, since);
    const attemptFilter = this.attemptFilter(input, since);
    const deadRootFilter = this.deadFilter({ ...input, errorCode: null }, since);

    const [[sourceRows], [taskRows], [deadRows], [qualityRows], [attemptRows], [rootRows]] =
      await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT p.id, p.code, p.name, p.status, p.owner_label,\n                  p.schedule_minutes," +
            " p.concurrency_limit, p.parser_version,\n                  h.health_status," +
            " h.last_checked_at, h.last_latency_ms,\n                  h.last_error_code," +
            " h.consecutive_failures\n             FROM providers p\n        LEFT JOIN provider_adapter_health " +
            "h ON h.provider_id = p.id\n         ORDER BY p.status = 'enabled' DESC, p.name",
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT t.status, COUNT(*) total
             FROM collection_tasks t
             ${taskFilter.sql}
         GROUP BY t.status
         ORDER BY t.status`,
          taskFilter.values,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT d.id, d.task_id, d.organization_id, d.workspace_id,
                  d.error_code, d.status, d.created_at
             FROM collection_dead_letters d
             ${deadFilter.sql}
         ORDER BY d.created_at DESC
            LIMIT ?`,
          [...deadFilter.values, input.recentLimit],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT q.severity, q.status, COUNT(*) total
             FROM data_quality_issues q
             ${qualityFilter.sql}
         GROUP BY q.severity, q.status
         ORDER BY q.status, q.severity`,
          qualityFilter.values,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT a.id, a.task_id, t.organization_id, t.workspace_id,
                  a.attempt_number, a.worker_id, a.status, a.error_code,
                  a.started_at, a.finished_at, a.trace_id
             FROM collection_task_attempts a
             JOIN collection_tasks t ON t.id = a.task_id
             ${attemptFilter.sql}
         ORDER BY a.created_at DESC
            LIMIT ?`,
          [...attemptFilter.values, input.recentLimit],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT d.error_code, COUNT(*) total, MAX(d.created_at) latest_at
             FROM collection_dead_letters d
             ${deadRootFilter.sql}
         GROUP BY d.error_code
         ORDER BY total DESC, latest_at DESC, d.error_code`,
          deadRootFilter.values,
        ),
      ]);

    const sources = sourceRows.map((row: any) => ({
      ...row,
      schedule_minutes: numberValue(row.schedule_minutes),
      concurrency_limit: numberValue(row.concurrency_limit),
      last_latency_ms: row.last_latency_ms == null ? null : numberValue(row.last_latency_ms),
      consecutive_failures: numberValue(row.consecutive_failures),
      last_checked_at: iso(row.last_checked_at),
      health_status: row.health_status ?? "unknown",
    }));
    const result = {
      filters: {
        organization_id: input.organizationId,
        workspace_id: input.workspaceId,
        provider_id: input.providerId,
        window: input.window,
        error_code: input.errorCode,
      },
      source_options: sources.map(({ id, code, name }: any) => ({ id, code, name })),
      sources: input.providerId
        ? sources.filter((row: any) => row.id === input.providerId)
        : sources,
      task_states: taskRows.map((row: any) => ({
        status: row.status,
        total: numberValue(row.total),
      })),
      dead_letters: deadRows.map((row: any) => ({
        ...row,
        created_at: iso(row.created_at),
      })),
      quality: qualityRows.map((row: any) => ({
        ...row,
        total: numberValue(row.total),
      })),
      attempts: attemptRows.map((row: any) => ({
        ...row,
        attempt_number: numberValue(row.attempt_number),
        started_at: iso(row.started_at),
        finished_at: iso(row.finished_at),
      })),
      root_causes: rootRows.map((row: any) => ({
        error_code: row.error_code,
        total: numberValue(row.total),
        latest_at: iso(row.latest_at),
      })),
      links: {
        provider_registry: "/platform-admin/providers",
        adapter_health: "/platform-admin/providers/adapters",
        source_catalog: "/platform-admin/providers/sources",
        task_monitor: "/platform-admin/collection",
        browser_runtime: "/platform-admin/collection/browser-runtime",
        data_quality: "/platform-admin/data",
      },
      observed_at: observedAt.toISOString(),
    };
    await this.audit(input, observedAt);
    return result;
  }

  private async validateScope(input: any) {
    if (input.organizationId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id FROM organizations WHERE id = ?",
        [input.organizationId],
      );
      if (!rows[0])
        throw new CollectionConsoleError(
          "collection_console_organization_not_found",
          404,
          "选择存在的组织。",
        );
    }
    if (input.workspaceId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT organization_id FROM workspaces WHERE id = ?",
        [input.workspaceId],
      );
      if (!rows[0])
        throw new CollectionConsoleError(
          "collection_console_workspace_not_found",
          404,
          "选择存在的工作区。",
        );
      if (input.organizationId && String(rows[0].organization_id) !== input.organizationId)
        throw new CollectionConsoleError(
          "collection_console_scope_mismatch",
          409,
          "选择属于该组织的工作区。",
        );
    }
    if (input.providerId) {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE id = ?",
        [input.providerId],
      );
      if (!rows[0])
        throw new CollectionConsoleError(
          "collection_console_provider_not_found",
          404,
          "选择存在的采集来源。",
        );
    }
  }

  private taskFilter(input: any, since: Date | null) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    this.scopeConditions(conditions, values, "t", input);
    if (since) {
      conditions.push("t.updated_at >= ?");
      values.push(since);
    }
    if (input.providerId) {
      conditions.push(
        "EXISTS (SELECT 1 FROM collection_subqueries source_scope WHERE source_scope.task_id = t.id AND source_scope.provider_id = ?)",
      );
      values.push(input.providerId);
    }
    return this.where(conditions, values);
  }

  private deadFilter(input: any, since: Date | null) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    this.scopeConditions(conditions, values, "d", input);
    if (since) {
      conditions.push("d.created_at >= ?");
      values.push(since);
    }
    if (input.providerId) {
      conditions.push(
        "EXISTS (SELECT 1 FROM collection_subqueries source_scope WHERE source_scope.task_id = d.task_id AND source_scope.provider_id = ?)",
      );
      values.push(input.providerId);
    }
    if (input.errorCode) {
      conditions.push("d.error_code = ?");
      values.push(input.errorCode);
    }
    return this.where(conditions, values);
  }

  private qualityFilter(input: any, since: Date | null) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    this.scopeConditions(conditions, values, "q", input);
    if (since) {
      conditions.push("q.updated_at >= ?");
      values.push(since);
    }
    if (input.providerId) {
      conditions.push("q.provider_id = ?");
      values.push(input.providerId);
    }
    return this.where(conditions, values);
  }

  private attemptFilter(input: any, since: Date | null, requireError = false) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    this.scopeConditions(conditions, values, "t", input);
    if (since) {
      conditions.push("a.created_at >= ?");
      values.push(since);
    }
    if (input.providerId) {
      conditions.push(
        "EXISTS (SELECT 1 FROM collection_subqueries source_scope WHERE source_scope.task_id = t.id AND source_scope.provider_id = ?)",
      );
      values.push(input.providerId);
    }
    if (input.errorCode) {
      conditions.push("a.error_code = ?");
      values.push(input.errorCode);
    } else if (requireError) {
      conditions.push("a.error_code IS NOT NULL");
    }
    return this.where(conditions, values);
  }

  private scopeConditions(conditions: string[], values: unknown[], alias: string, input: any) {
    if (input.organizationId) {
      conditions.push(`${alias}.organization_id = ?`);
      values.push(input.organizationId);
    }
    if (input.workspaceId) {
      conditions.push(`${alias}.workspace_id = ?`);
      values.push(input.workspaceId);
    }
  }

  private where(conditions: string[], values: unknown[]) {
    return {
      sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      values,
    };
  }

  private async audit(input: any, observedAt: Date) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO collection_console_views\n          (id, actor_id, organization_filter_id," +
          " workspace_filter_id,\n           request_id, trace_id, observed_at)\n         VALUES " +
          "(?, ?, ?, ?, ?, ?, ?)",
        [
          randomUUID(),
          input.actorId,
          input.organizationId,
          input.workspaceId,
          input.requestId,
          input.traceId,
          observedAt,
        ],
      );
      await connection.query(
        "INSERT INTO platform_audit_events\n          (id, organization_id, workspace_id," +
          " actor_id, action, resource_type,\n           resource_id, outcome, request_id," +
          " trace_id, metadata, occurred_at,\n           schema_version)\n         VALUES (?," +
          " ?, ?, ?, ?, 'collection_console', NULL, 'succeeded',\n                 ?," +
          " ?, ?, ?, 1)",
        [
          randomUUID(),
          input.organizationId,
          input.workspaceId,
          input.actorId,
          "platform.collection.console.read",
          input.requestId,
          input.traceId,
          JSON.stringify({
            organization_filter_id: input.organizationId,
            workspace_filter_id: input.workspaceId,
            provider_filter_id: input.providerId,
            window: input.window,
            error_code: input.errorCode,
          }),
          observedAt,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
