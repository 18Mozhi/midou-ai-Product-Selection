import {
  appendCollectionSubquery,
  collectionTaskScope,
  insertScheduledHighCollectionTask,
  trendRuleScopeRelation,
} from "@scoutops/database";
import { automaticIntakeBacklogLimit } from "./automatic-intake-capacity-policy.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { nativeCollectionBacklogCountSql } from "./collection-account-backlog.js";
import {
  activeCollectionScopeSql,
  accountCollectionBacklogCountSql,
  activeCollectionTaskStatusesSql,
  automaticIntelligenceTaskSql,
} from "./collection-source-scheduling-policy.js";

export interface AutomaticSourceScheduleResult {
  status: "idle" | "scheduled" | "backpressure";
  taskId?: string;
  organizationId?: string;
  workspaceId?: string;
  sourceCount?: number;
  ruleId?: string;
  reason?: "queue_backlog_limit" | "tenant_active_task_budget";
}

interface AutomaticSourceSchedulerPolicy {
  systemActorId: string;
  tenantActiveTaskBudget: number;
  queueBacklogLimit: number;
}

const activeTaskStatuses = activeCollectionTaskStatusesSql;
const accountScheduleFrom =
  "FROM automatic_source_schedules s JOIN users u ON u.id=s.account_id AND u.status='active' ";
const accountScheduleDue = "WHERE s.is_enabled=1 AND s.next_scheduled_at<=? ";
const accountFullSourceBudget = (native: boolean) =>
  "(SELECT COUNT(*) FROM collection_tasks ct " +
  "JOIN account_owned_records a ON a.source_table='collection_tasks' AND a.source_id=ct.id AND a.account_id=s.account_id " +
  `WHERE ${automaticIntelligenceTaskSql("ct")}` +
  (native ? " AND ct.account_id=a.account_id" : "") +
  ` AND ct.status IN ${activeTaskStatuses})`;
type SourceOwner = { account_id: string; reason: "shared" | "unassigned" | "exclusive_owner" };

type AutomaticSourceMode = "all" | "rules" | "full";
const statement = (...parts: string[]) => parts.join("");

export class MySqlAutomaticSourceScheduler {
  constructor(
    private readonly pool: Pool,
    private readonly batchSize = 16,
    private readonly now: () => Date = () => new Date(),
    private readonly policy: AutomaticSourceSchedulerPolicy = {
      systemActorId: "",
      tenantActiveTaskBudget: 2,
      queueBacklogLimit: 1000,
    },
  ) {}
  async processOnce(): Promise<AutomaticSourceScheduleResult> {
    return this.process("all");
  }
  async processRuleOnce(): Promise<AutomaticSourceScheduleResult> {
    return this.process("rules");
  }
  async processFullOnce(): Promise<AutomaticSourceScheduleResult> {
    return this.process("full");
  }
  private async process(mode: AutomaticSourceMode): Promise<AutomaticSourceScheduleResult> {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const now = this.now();
      const accountSchedules = await this.hasAccountSchedules(c);
      let primaryAccountId: string | undefined;
      if (accountSchedules) {
        // Serialize account-wide budget checks across the multiple preserved cursors.
        // Lock before the first consistent read so concurrent producers see committed tasks.
        const [cutover] = await c.query<RowDataPacket[]>(
          "SELECT primary_account_id FROM account_ownership_cutover WHERE slot='current' AND contract_version=25 FOR UPDATE",
        );
        if (!cutover[0]?.primary_account_id)
          throw new Error("automatic_source_account_cutover_missing");
        primaryAccountId = String(cutover[0].primary_account_id);
      }
      const nativeTasks = (await collectionTaskScope(c)) === "account";
      if (nativeTasks && !accountSchedules)
        throw new Error("automatic_source_schedule_account_scope_required");
      const backlog = await this.backlog(c, accountSchedules, nativeTasks);
      if (backlog >= automaticIntakeBacklogLimit(this.policy.queueBacklogLimit)) {
        await c.commit();
        return { status: "backpressure", reason: "queue_backlog_limit" };
      }
      if (mode !== "full") {
        const ruleResult = await this.scheduleDueRule(c, now, accountSchedules, nativeTasks);
        if (ruleResult) {
          await c.commit();
          return ruleResult;
        }
      }
      if (mode === "rules") {
        await c.commit();
        return { status: "idle" };
      }
      if (!accountSchedules)
        await c.query(
          statement(
            "INSERT IGNORE INTO automatic_source_schedules ",
            "(id,organization_id,workspace_id,last_task_id,provider_offset,last_scheduled_at,",
            "next_scheduled_at,updated_at) SELECT UUID(),o.id,w.id,NULL,0,NULL,?,? ",
            "FROM organizations o JOIN workspaces w ON w.id=o.default_workspace_id ",
            "WHERE o.status='active' AND w.status='active'",
          ),
          [now, now],
        );
      const [schedules] = await c.query<RowDataPacket[]>(
        accountSchedules
          ? "SELECT s.id,s.account_id,s.ownership_reason,s.provider_offset,s.historical_context " +
              accountScheduleFrom +
              accountScheduleDue +
              `AND ${accountFullSourceBudget(nativeTasks)}<? ORDER BY s.next_scheduled_at,` +
              "COALESCE(s.last_scheduled_at,'1000-01-01'),s.account_id,s.id LIMIT 1 FOR UPDATE"
          : statement(
              "SELECT s.* FROM automatic_source_schedules s WHERE s.next_scheduled_at<=? ",
              "AND ",
              activeCollectionScopeSql("s"),
              " ",
              "AND (SELECT COUNT(*) FROM collection_tasks ct ",
              "WHERE ct.organization_id=s.organization_id AND ",
              activeCollectionScopeSql("ct"),
              " AND ",
              automaticIntelligenceTaskSql("ct"),
              " AND ct.status IN ",
              "('scheduled','queued','leased','running','parsing','validating',",
              "'retry_scheduled','rate_limited'))<? ",
              "ORDER BY s.next_scheduled_at,COALESCE(s.last_scheduled_at,'1000-01-01'),",
              "s.organization_id LIMIT 1 FOR UPDATE",
            ),
        [now, this.policy.tenantActiveTaskBudget],
      );
      const schedule = schedules[0];
      if (!schedule) {
        const [dueSchedules] = await c.query<RowDataPacket[]>(
          accountSchedules
            ? "SELECT COUNT(*) count " + accountScheduleFrom + accountScheduleDue
            : "SELECT COUNT(*) count FROM automatic_source_schedules s WHERE s.next_scheduled_at<=? AND " +
                activeCollectionScopeSql("s"),
          [now],
        );
        await c.commit();
        return Number(dueSchedules[0]?.count ?? 0) > 0
          ? { status: "backpressure", reason: "tenant_active_task_budget" }
          : { status: "idle" };
      }
      const owner: SourceOwner | null = accountSchedules
        ? { account_id: String(schedule.account_id ?? ""), reason: schedule.ownership_reason }
        : null;
      if (
        owner &&
        (!owner.account_id ||
          (owner.reason !== "exclusive_owner" &&
            ((owner.reason !== "shared" && owner.reason !== "unassigned") ||
              owner.account_id !== primaryAccountId)))
      )
        throw new Error("automatic_source_owner_mismatch");
      const [allProviders] = await c.query<RowDataPacket[]>(
        statement(
          "SELECT id,code FROM providers WHERE status='enabled' ",
          "AND terms_review_status='approved' ",
          "AND terms_version IS NOT NULL AND (terms_permanent=1 OR terms_expires_at>NOW(3)) AND parser_version IN ",
          "('google-news-fixed-rss-v1','syndication-feed-v1','google-trends-rss-v1',",
          "'structured-public-page-v1') ORDER BY code",
        ),
      );
      if (!allProviders.length) {
        await c.query(
          "UPDATE automatic_source_schedules SET next_scheduled_at=DATE_ADD(?,INTERVAL 5 MINUTE),updated_at=? WHERE id=?",
          [now, now, schedule.id],
        );
        await c.commit();
        return { status: "idle" };
      }
      const accountOnly = Boolean(owner && nativeTasks);
      const taskContext = accountOnly
        ? undefined
        : accountSchedules
          ? typeof schedule.historical_context === "string"
            ? JSON.parse(schedule.historical_context)
            : schedule.historical_context
          : schedule;
      if (
        owner &&
        !accountOnly &&
        (typeof taskContext?.organization_id !== "string" ||
          typeof taskContext.workspace_id !== "string")
      )
        throw new Error("automatic_source_task_context_invalid");
      const taskEventId = randomUUID(),
        taskOutboxId = randomUUID();
      const offset = Math.min(
          Number(schedule.provider_offset) || 0,
          Math.max(0, allProviders.length - 1),
        ),
        providers = allProviders.slice(offset, offset + this.batchSize),
        taskId = randomUUID(),
        requestId = `auto-hotspot-${taskId}`,
        actorId = await this.actor(c);
      const owned = owner
        ? [
            ["collection_tasks", taskId],
            ["collection_task_events", taskEventId],
            ["collection_task_outbox", taskOutboxId],
          ]
        : [];
      await insertScheduledHighCollectionTask(c, {
        id: taskId,
        now,
        actorId,
        requestId,
        traceId: requestId,
        scope:
          accountOnly && owner
            ? { kind: "account", accountId: owner.account_id }
            : {
                kind: "legacy",
                organizationId: taskContext?.organization_id,
                workspaceId: taskContext?.workspace_id,
              },
      });
      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i]!;
        const subqueryId = randomUUID();
        await appendCollectionSubquery(
          c,
          {
            id: subqueryId,
            taskId,
            providerId: String(provider.id),
            ordinal: i + 1,
            targetJson: "{}",
            required: false,
            status: "pending",
            now,
          },
          accountOnly,
        );
        if (owner) owned.push(["collection_subqueries", subqueryId]);
      }
      await c.query(
        statement(
          "INSERT INTO collection_task_events ",
          "(id,task_id,event_type,from_status,to_status,",
          "actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) ",
          "VALUES (?,?,?,NULL,'scheduled','system',?,?,?,?,?)",
        ),
        [
          taskEventId,
          taskId,
          "hotspot.automatic.scheduled",
          actorId,
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
        statement(
          "INSERT INTO collection_task_outbox ",
          "(id,task_id,event_type,payload_json,status,",
          "attempt_count,available_at,request_id,trace_id,created_at,updated_at) ",
          "VALUES (?,?,?,?,'queued',0,?,?,?,?,?)",
        ),
        [
          taskOutboxId,
          taskId,
          "hotspot.automatic.scheduled",
          JSON.stringify({ task_id: taskId, source_count: providers.length }),
          now,
          requestId,
          requestId,
          now,
          now,
        ],
      );
      if (owner)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
          [owned.map(([table, id]) => [table, id, owner.account_id, owner.reason])],
        );
      const nextOffset =
          offset + providers.length >= allProviders.length ? 0 : offset + providers.length,
        nextAt = new Date(now.getTime() + (nextOffset === 0 ? 15 : 1) * 60_000);
      const [advanced] = await c.query<ResultSetHeader>(
        "UPDATE automatic_source_schedules SET last_task_id=?,provider_offset=?,last_scheduled_at=?,next_scheduled_at=?,updated_at=? WHERE id=?" +
          (accountOnly ? " AND account_id=? AND ownership_reason=? AND is_enabled=1" : ""),
        [
          taskId,
          nextOffset,
          now,
          nextAt,
          now,
          schedule.id,
          ...(accountOnly ? [owner!.account_id, owner!.reason] : []),
        ],
      );
      if (accountOnly && advanced.affectedRows !== 1)
        throw new Error("automatic_source_cursor_changed");
      await c.commit();
      return {
        status: "scheduled",
        taskId,
        ...(!accountOnly
          ? {
              organizationId: String(taskContext.organization_id),
              workspaceId: String(taskContext.workspace_id),
            }
          : {}),
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
    accountSchedules: boolean,
    nativeTasks: boolean,
  ): Promise<AutomaticSourceScheduleResult | null> {
    const relation = accountSchedules ? await trendRuleScopeRelation(c) : "trend_monitoring_rules";
    const accountRules = relation !== "trend_monitoring_rules";
    if (nativeTasks && !accountRules) throw new Error("trend_rule_schedule_account_scope_required");
    const due =
      " WHERE r.status='enabled' AND (r.next_collection_at IS NULL OR r.next_collection_at<=?)";
    const accountFrom =
      " FROM trend_monitoring_rules r JOIN users u ON u.id=r.account_id AND u.status='active'";
    const [rules] = await c.query<RowDataPacket[]>(
      accountRules
        ? "SELECT r.*" +
            accountFrom +
            due +
            " AND (SELECT COUNT(*) FROM collection_tasks ct JOIN account_owned_records ow ON ow.source_table='collection_tasks' AND ow.source_id=ct.id " +
            "WHERE ow.account_id=r.account_id" +
            (nativeTasks ? " AND ct.account_id=ow.account_id" : "") +
            " AND ct.status IN ('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited'))<? " +
            "ORDER BY COALESCE(r.next_collection_at,'1000-01-01'),COALESCE(r.last_collection_at,'1000-01-01'),r.account_id,r.id LIMIT 1 FOR UPDATE"
        : statement(
            "SELECT r.* FROM trend_monitoring_rules r WHERE r.status='enabled' ",
            "AND ",
            activeCollectionScopeSql("r"),
            " ",
            "AND (r.next_collection_at IS NULL OR r.next_collection_at<=?) ",
            "AND (SELECT COUNT(*) FROM collection_tasks ct ",
            "WHERE ct.organization_id=r.organization_id AND ",
            activeCollectionScopeSql("ct"),
            " AND ct.status IN ",
            "('scheduled','queued','leased','running','parsing','validating',",
            "'retry_scheduled','rate_limited'))<? ",
            "ORDER BY COALESCE(r.next_collection_at,'1000-01-01'),",
            "COALESCE(r.last_collection_at,'1000-01-01'),r.organization_id,r.id ",
            "LIMIT 1 FOR UPDATE",
          ),
      [now, this.policy.tenantActiveTaskBudget],
    );
    const rule = rules[0];
    if (!rule) {
      const [dueRules] = await c.query<RowDataPacket[]>(
        accountRules
          ? "SELECT COUNT(*) count" + accountFrom + due
          : "SELECT COUNT(*) count FROM trend_monitoring_rules r WHERE r.status='enabled' AND (r.next_collection_at IS NULL OR r.next_collection_at<=?) AND " +
              activeCollectionScopeSql("r"),
        [now],
      );
      return Number(dueRules[0]?.count ?? 0) > 0
        ? { status: "backpressure", reason: "tenant_active_task_budget" }
        : null;
    }
    const owned: [string, string][] = [];
    let owner: RowDataPacket | undefined;
    // SELECT r.* distinguishes a pre-0127 rule from a broken native ownership row.
    if (Object.hasOwn(rule, "account_id")) {
      const [owners] = await c.query<RowDataPacket[]>(
        "SELECT o.account_id,o.reason FROM account_owned_records o JOIN account_ownership_cutover cut " +
          "ON cut.slot='current' AND cut.contract_version=25 " +
          "WHERE o.source_table='trend_monitoring_rules' AND o.source_id=? AND o.account_id=? " +
          "AND (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=cut.primary_account_id)) " +
          "LOCK IN SHARE MODE",
        [rule.id, rule.account_id],
      );
      owner = owners[0];
      if (!owner) throw new Error("trend_rule_schedule_owner_mismatch");
    }
    const accountOnly = Boolean(owner && nativeTasks);
    const taskContext = accountOnly
      ? undefined
      : accountRules
        ? typeof rule.historical_context === "string"
          ? JSON.parse(rule.historical_context)
          : rule.historical_context
        : rule;
    if (
      accountRules &&
      (!owner ||
        (!accountOnly &&
          (typeof taskContext?.organization_id !== "string" ||
            typeof taskContext.workspace_id !== "string")))
    )
      throw new Error("trend_rule_task_context_invalid");
    if (accountRules && !accountOnly) {
      const [scopes] = await c.query<RowDataPacket[]>(
        "SELECT s.account_id FROM account_retirement_scopes s JOIN account_ownership_cutover cut " +
          "ON cut.slot='current' AND cut.contract_version=25 AND cut.source_run_id=s.run_id " +
          "JOIN workspaces w ON w.id=s.legacy_workspace_id AND w.organization_id=s.legacy_org_id " +
          "WHERE s.legacy_org_id=? AND s.legacy_workspace_id=? AND s.account_id=? AND s.reason=? LOCK IN SHARE MODE",
        [taskContext.organization_id, taskContext.workspace_id, owner!.account_id, owner!.reason],
      );
      if (scopes.length !== 1) throw new Error("trend_rule_task_context_owner_mismatch");
    }
    const [providerRows] = await c.query<RowDataPacket[]>(
      statement(
        "SELECT id,code,markets_json FROM providers WHERE status='enabled' AND code<>'1688_search' ",
        "AND terms_review_status='approved' ",
        "AND terms_version IS NOT NULL AND (terms_permanent=1 OR terms_expires_at>NOW(3)) ",
        "AND parser_version IN ('google-news-rss-v1','google-news-fixed-rss-v1',",
        "'syndication-feed-v1','google-trends-rss-v1','structured-public-page-v1','amazon-public-product-v5') ORDER BY code",
      ),
    );
    const market = String(rule.market).toUpperCase();
    const allProviders = providerRows.filter((provider) => {
      if (provider.code === "1688_search") return false;
      if (market === "GLOBAL") return true;
      const markets = Array.isArray(provider.markets_json)
        ? provider.markets_json
        : JSON.parse(String(provider.markets_json ?? "[]"));
      return markets.some(
        (value: unknown) =>
          String(value).toUpperCase() === market || String(value).toUpperCase() === "GLOBAL",
      );
    });
    if (!allProviders.length) {
      await c.query(
        "UPDATE trend_monitoring_rules SET next_collection_at=DATE_ADD(?,INTERVAL 5 MINUTE) WHERE id=?",
        [now, rule.id],
      );
      return { status: "idle" };
    }
    const offset = Math.min(Number(rule.source_cursor) || 0, Math.max(0, allProviders.length - 1)),
      providers = allProviders.slice(offset, offset + this.batchSize),
      taskId = randomUUID(),
      requestId = `trend-rule-${String(rule.id)}-${taskId}`,
      actorId = await this.actor(c),
      baseTarget = {
        monitoring_rule_id: String(rule.id),
        query: (typeof rule.include_keywords_json === "string"
          ? JSON.parse(rule.include_keywords_json)
          : rule.include_keywords_json
        ).join(" OR "),
        market,
        language: String(rule.language),
      };
    await insertScheduledHighCollectionTask(c, {
      id: taskId,
      now,
      actorId,
      requestId,
      traceId: requestId,
      scope:
        accountOnly && owner
          ? { kind: "account", accountId: String(owner.account_id) }
          : {
              kind: "legacy",
              organizationId: taskContext?.organization_id,
              workspaceId: taskContext?.workspace_id,
            },
    });
    if (owner) owned.push(["collection_tasks", taskId]);
    for (let index = 0; index < providers.length; index += 1) {
      const subqueryId = randomUUID();
      await appendCollectionSubquery(
        c,
        {
          id: subqueryId,
          taskId,
          providerId: String(providers[index]!.id),
          ordinal: index + 1,
          targetJson: JSON.stringify(
            String(providers[index]!.code) === "amazon_product"
              ? { ...baseTarget, projection_type: "rule_product_discovery" }
              : baseTarget,
          ),
          required: false,
          status: "pending",
          now,
        },
        accountOnly,
      );
      if (owner) owned.push(["collection_subqueries", subqueryId]);
    }
    const payload = {
      task_id: taskId,
      monitoring_rule_id: String(rule.id),
      source_count: providers.length,
      source_offset: offset,
    };
    const eventId = randomUUID();
    await c.query(
      statement(
        "INSERT INTO collection_task_events ",
        "(id,task_id,event_type,from_status,to_status,",
        "actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) ",
        "VALUES (?,?,?,NULL,'scheduled','system',?,?,?,?,?)",
      ),
      [
        eventId,
        taskId,
        "trend.rule.collection.scheduled",
        actorId,
        requestId,
        requestId,
        JSON.stringify(payload),
        now,
      ],
    );
    const outboxId = randomUUID();
    await c.query(
      statement(
        "INSERT INTO collection_task_outbox ",
        "(id,task_id,event_type,payload_json,status,",
        "attempt_count,available_at,request_id,trace_id,created_at,updated_at) ",
        "VALUES (?,?,?,?,'queued',0,?,?,?,?,?)",
      ),
      [
        outboxId,
        taskId,
        "trend.rule.collection.scheduled",
        JSON.stringify(payload),
        now,
        requestId,
        requestId,
        now,
        now,
      ],
    );
    if (owner) {
      owned.push(["collection_task_events", eventId], ["collection_task_outbox", outboxId]);
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
        [owned.map(([table, id]) => [table, id, owner.account_id, owner.reason])],
      );
    }
    const nextOffset =
        offset + providers.length >= allProviders.length ? 0 : offset + providers.length,
      nextAt = new Date(
        now.getTime() + (nextOffset === 0 ? Number(rule.collection_interval_minutes) : 1) * 60_000,
      );
    const [advanced] = await c.query<ResultSetHeader>(
      "UPDATE trend_monitoring_rules SET source_cursor=?,last_collection_at=?,next_collection_at=?,last_collection_task_id=? WHERE id=?" +
        (accountOnly ? " AND account_id=? AND status='enabled'" : ""),
      [nextOffset, now, nextAt, taskId, rule.id, ...(accountOnly ? [owner!.account_id] : [])],
    );
    if (accountOnly && advanced.affectedRows !== 1)
      throw new Error("trend_rule_schedule_cursor_changed");
    return {
      status: "scheduled",
      taskId,
      ...(!accountOnly
        ? {
            organizationId: String(taskContext.organization_id),
            workspaceId: String(taskContext.workspace_id),
          }
        : {}),
      sourceCount: providers.length,
      ruleId: String(rule.id),
    };
  }
  private async hasAccountSchedules(c: PoolConnection) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM automatic_source_schedules WHERE Field IN ('account_id','historical_context','is_enabled','organization_id','ownership_reason','workspace_id')",
    );
    const shape = rows
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (shape === "account_id,historical_context,is_enabled,ownership_reason") return true;
    if (shape === "organization_id,workspace_id") return false;
    throw new Error("automatic_source_schedule_schema_incomplete");
  }
  private async backlog(c: PoolConnection, accountMode: boolean, nativeTasks: boolean) {
    const [rows] = await c.query<RowDataPacket[]>(
      accountMode
        ? "SELECT " +
            (nativeTasks ? nativeCollectionBacklogCountSql : accountCollectionBacklogCountSql) +
            " count"
        : statement(
            "SELECT COUNT(*) count FROM collection_tasks WHERE ",
            activeCollectionScopeSql("collection_tasks"),
            " AND status IN ",
            "('scheduled','queued','leased','running','parsing','validating',",
            "'retry_scheduled','rate_limited')",
          ),
    );
    return Number(rows[0]?.count ?? 0);
  }
  private async actor(c: PoolConnection) {
    if (!this.policy.systemActorId) throw new Error("automatic_source_system_actor_not_configured");
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id=? AND status='active' LIMIT 1",
      [this.policy.systemActorId],
    );
    if (!rows[0]) throw new Error("automatic_source_system_actor_invalid");
    return String(rows[0].id);
  }
}
