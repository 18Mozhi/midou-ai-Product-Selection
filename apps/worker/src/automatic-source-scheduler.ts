import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export interface AutomaticSourceScheduleResult {
  status: "idle" | "scheduled";
  taskId?: string;
  organizationId?: string;
  workspaceId?: string;
  sourceCount?: number;
  ruleId?: string;
}

export class MySqlAutomaticSourceScheduler {
  constructor(
    private readonly pool: Pool,
    private readonly batchSize = 16,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async processOnce(): Promise<AutomaticSourceScheduleResult> {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const now = this.now();
      const ruleResult = await this.scheduleDueRule(c, now);
      if (ruleResult) {
        await c.commit();
        return ruleResult;
      }
      await c.query(
        "INSERT IGNORE INTO automatic_source_schedules (id,organization_id,workspace_id,last_task_id,provider_offset,last_scheduled_at,next_scheduled_at,updated_at) SELECT UUID(),o.id,w.id,NULL,0,NULL,?,? FROM organizations o JOIN workspaces w ON w.id=o.default_workspace_id WHERE o.status='active' AND w.status='active'",
        [now, now],
      );
      const [schedules] = await c.query<RowDataPacket[]>(
        "SELECT * FROM automatic_source_schedules WHERE next_scheduled_at<=? ORDER BY next_scheduled_at LIMIT 1 FOR UPDATE",
        [now],
      );
      const schedule = schedules[0];
      if (!schedule) {
        await c.commit();
        return { status: "idle" };
      }
      const [allProviders] = await c.query<RowDataPacket[]>(
        "SELECT id,code FROM providers WHERE status='enabled' AND parser_version IN ('google-news-fixed-rss-v1','syndication-feed-v1','structured-public-page-v1') ORDER BY code",
      );
      if (!allProviders.length) {
        await c.query(
          "UPDATE automatic_source_schedules SET next_scheduled_at=DATE_ADD(?,INTERVAL 5 MINUTE),updated_at=? WHERE id=?",
          [now, now, schedule.id],
        );
        await c.commit();
        return { status: "idle" };
      }
      const offset = Math.min(
          Number(schedule.provider_offset) || 0,
          Math.max(0, allProviders.length - 1),
        ),
        providers = allProviders.slice(offset, offset + this.batchSize),
        taskId = randomUUID(),
        requestId = `auto-hotspot-${taskId}`,
        actorId = await this.actor(c);
      await c.query(
        "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES (?,?,?,'scheduled',NULL,'normal',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
        [
          taskId,
          schedule.organization_id,
          schedule.workspace_id,
          now,
          now,
          requestId,
          requestId,
          actorId,
          now,
          now,
        ],
      );
      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i]!;
        await c.query(
          "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,'pending',0,'[]',NULL,0,1,?,?)",
          [
            randomUUID(),
            taskId,
            schedule.organization_id,
            schedule.workspace_id,
            provider.id,
            i + 1,
            "{}",
            now,
            now,
          ],
        );
      }
      await c.query(
        "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,?,?,NULL,'scheduled','system',?,?,?,?,?)",
        [
          randomUUID(),
          taskId,
          schedule.organization_id,
          schedule.workspace_id,
          "hotspot.automatic.scheduled",
          "ai-selection-worker",
          requestId,
          requestId,
          JSON.stringify({
            source_count: providers.length,
            provider_offset: offset,
          }),
          now,
        ],
      );
      await c.query(
        "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id,event_type,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          randomUUID(),
          taskId,
          schedule.organization_id,
          schedule.workspace_id,
          "hotspot.automatic.scheduled",
          JSON.stringify({ task_id: taskId, source_count: providers.length }),
          now,
          requestId,
          requestId,
          now,
          now,
        ],
      );
      const nextOffset =
          offset + providers.length >= allProviders.length
            ? 0
            : offset + providers.length,
        nextAt = new Date(now.getTime() + (nextOffset === 0 ? 15 : 1) * 60_000);
      await c.query(
        "UPDATE automatic_source_schedules SET last_task_id=?,provider_offset=?,last_scheduled_at=?,next_scheduled_at=?,updated_at=? WHERE id=?",
        [taskId, nextOffset, now, nextAt, now, schedule.id],
      );
      await c.commit();
      return {
        status: "scheduled",
        taskId,
        organizationId: String(schedule.organization_id),
        workspaceId: String(schedule.workspace_id),
        sourceCount: providers.length,
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async scheduleDueRule(
    c: PoolConnection,
    now: Date,
  ): Promise<AutomaticSourceScheduleResult | null> {
    const [rules] = await c.query<RowDataPacket[]>(
      "SELECT * FROM trend_monitoring_rules WHERE status='enabled' AND (next_collection_at IS NULL OR next_collection_at<=?) ORDER BY COALESCE(next_collection_at,'1000-01-01'),id LIMIT 1 FOR UPDATE",
      [now],
    );
    const rule = rules[0];
    if (!rule) return null;
    const [providerRows] = await c.query<RowDataPacket[]>(
      "SELECT id,code,markets_json FROM providers WHERE status='enabled' AND parser_version IN ('google-news-rss-v1','google-news-fixed-rss-v1','syndication-feed-v1','structured-public-page-v1') ORDER BY code",
    );
    const market = String(rule.market).toUpperCase();
    const allProviders = providerRows.filter((provider) => {
      if (market === "GLOBAL") return true;
      const markets = Array.isArray(provider.markets_json)
        ? provider.markets_json
        : JSON.parse(String(provider.markets_json ?? "[]"));
      return markets.some(
        (value: unknown) =>
          String(value).toUpperCase() === market ||
          String(value).toUpperCase() === "GLOBAL",
      );
    });
    if (!allProviders.length) {
      await c.query(
        "UPDATE trend_monitoring_rules SET next_collection_at=DATE_ADD(?,INTERVAL 5 MINUTE) WHERE id=?",
        [now, rule.id],
      );
      return { status: "idle" };
    }
    const offset = Math.min(
        Number(rule.source_cursor) || 0,
        Math.max(0, allProviders.length - 1),
      ),
      providers = allProviders.slice(offset, offset + this.batchSize),
      taskId = randomUUID(),
      requestId = `trend-rule-${String(rule.id)}-${taskId}`,
      target = JSON.stringify({
        monitoring_rule_id: String(rule.id),
        query: (typeof rule.include_keywords_json === "string"
          ? JSON.parse(rule.include_keywords_json)
          : rule.include_keywords_json
        ).join(" OR "),
        market,
        language: String(rule.language),
      });
    await c.query(
      "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES (?,?,?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        taskId,
        rule.organization_id,
        rule.workspace_id,
        now,
        now,
        requestId,
        requestId,
        rule.created_by,
        now,
        now,
      ],
    );
    for (let index = 0; index < providers.length; index += 1) {
      await c.query(
        "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,'pending',0,'[]',NULL,0,1,?,?)",
        [
          randomUUID(),
          taskId,
          rule.organization_id,
          rule.workspace_id,
          providers[index]!.id,
          index + 1,
          target,
          now,
          now,
        ],
      );
    }
    const payload = {
      task_id: taskId,
      monitoring_rule_id: String(rule.id),
      source_count: providers.length,
      source_offset: offset,
    };
    await c.query(
      "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES (?,?,?,?,?,NULL,'scheduled','system',?,?,?,?,?)",
      [
        randomUUID(),
        taskId,
        rule.organization_id,
        rule.workspace_id,
        "trend.rule.collection.scheduled",
        "ai-selection-worker",
        requestId,
        requestId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id,event_type,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        taskId,
        rule.organization_id,
        rule.workspace_id,
        "trend.rule.collection.scheduled",
        JSON.stringify(payload),
        now,
        requestId,
        requestId,
        now,
        now,
      ],
    );
    const nextOffset =
        offset + providers.length >= allProviders.length
          ? 0
          : offset + providers.length,
      nextAt = new Date(
        now.getTime() +
          (nextOffset === 0
            ? Number(rule.collection_interval_minutes)
            : 1) *
            60_000,
      );
    await c.query(
      "UPDATE trend_monitoring_rules SET source_cursor=?,last_collection_at=?,next_collection_at=?,last_collection_task_id=? WHERE id=?",
      [nextOffset, now, nextAt, taskId, rule.id],
    );
    return {
      status: "scheduled",
      taskId,
      organizationId: String(rule.organization_id),
      workspaceId: String(rule.workspace_id),
      sourceCount: providers.length,
      ruleId: String(rule.id),
    };
  }
  private async actor(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT pra.user_id FROM platform_role_assignments pra JOIN users u ON u.id=pra.user_id WHERE pra.role_code='platform_super_admin' AND u.status='active' ORDER BY pra.created_at LIMIT 1",
    );
    if (!rows[0]) throw new Error("automatic_source_platform_admin_missing");
    return String(rows[0].user_id);
  }
}
