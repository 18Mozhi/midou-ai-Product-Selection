// @ts-nocheck -- aggregate row shapes are normalized before leaving the repository.
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  PlatformDashboardError,
  type PlatformDashboardRepository,
} from "./platform-dashboard-service.js";
const n = (v: any) => Number(v ?? 0),
  iso = (v: any) => (v ? new Date(v).toISOString() : null);
export class MySqlPlatformDashboardRepository implements PlatformDashboardRepository {
  constructor(
    private readonly pool: Pool,
    private readonly queueWarning = 1000,
    private readonly errorLimit = 20,
    private readonly now = () => new Date(),
  ) {}
  async read(i: any) {
    const since = new Date(this.now().getTime() - i.windowMinutes * 60000),
      now = this.now();
    const [
      [orgs],
      [users],
      [providers],
      [tasks],
      [quality],
      [storage],
      [queues],
      [providerRows],
      [trend],
      [alerts],
      [activity],
    ] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM organizations WHERE status='active'",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM users WHERE status='active'",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM providers WHERE status='enabled'",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT SUM(status IN ('succeeded','succeeded_empty','completed_with_warnings')) success_count,SUM(status IN ('failed_terminal','dead_letter')) failed_count,SUM(status IN ('queued','leased','running','parsing','validating','retry_scheduled')) queue_backlog,SUM(lease_expires_at IS NOT NULL AND lease_expires_at<? AND status IN ('leased','running')) expired_leases FROM collection_tasks WHERE updated_at>=?",
        [now, since],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT SUM(status='open') open_count,SUM(status='open' AND severity='critical') critical_count FROM data_quality_issues",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(CASE WHEN status='active' THEN size_bytes ELSE 0 END),0) total_bytes,COALESCE(SUM(CASE WHEN status='active' AND created_at>=? THEN size_bytes ELSE 0 END),0) growth_bytes FROM file_assets",
        [since],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT status,COUNT(*) total FROM collection_tasks WHERE status IN ('queued','leased','running','parsing','validating','retry_scheduled','failed_terminal','dead_letter') GROUP BY status ORDER BY status",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT p.id,p.code,p.name,COUNT(s.id) observed_count,SUM(s.status IN ('succeeded','succeeded_empty')) success_count,SUM(s.status IN ('failed','blocked')) failed_count,MAX(s.updated_at) last_observed_at FROM providers p LEFT JOIN collection_subqueries s ON s.provider_id=p.id AND s.updated_at>=? WHERE p.status='enabled' GROUP BY p.id,p.code,p.name ORDER BY p.name",
        [since],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT DATE_FORMAT(updated_at,IF(?<=1440,'%Y-%m-%d %H:00:00','%Y-%m-%d 00:00:00')) bucket,SUM(status IN ('succeeded','succeeded_empty','completed_with_warnings')) succeeded,SUM(status IN ('failed_terminal','dead_letter')) failed FROM collection_tasks WHERE updated_at>=? GROUP BY bucket ORDER BY bucket",
        [i.windowMinutes, since],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,organization_id,workspace_id,'quality' kind,severity,metric_code code,updated_at observed_at FROM data_quality_issues WHERE status='open' UNION ALL SELECT id,organization_id,workspace_id,'task' kind,IF(status='dead_letter','critical','warning') severity,COALESCE(last_error_code,status) code,updated_at observed_at FROM collection_tasks WHERE status IN ('failed_terminal','dead_letter') ORDER BY observed_at DESC LIMIT ?",
        [this.errorLimit],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT action,outcome,resource_type,request_id,occurred_at FROM platform_audit_events ORDER BY occurred_at DESC LIMIT 10",
      ),
    ]);
    const terminal = n(tasks[0]?.success_count) + n(tasks[0]?.failed_count),
      provider_health = providerRows.map((r: any) => {
        const observed = n(r.observed_count),
          fail = n(r.failed_count),
          success = n(r.success_count);
        return {
          id: r.id,
          code: r.code,
          name: r.name,
          status: !observed ? "unknown" : fail > 0 ? "degraded" : "healthy",
          observed_count: observed,
          success_count: success,
          failed_count: fail,
          last_observed_at: iso(r.last_observed_at),
        };
      });
    const openAlerts =
      n(quality[0]?.open_count) +
      n(tasks[0]?.failed_count) +
      n(tasks[0]?.expired_leases);
    const result = {
      window: i.window,
      summary: {
        active_organizations: n(orgs[0]?.total),
        active_users: n(users[0]?.total),
        enabled_providers: n(providers[0]?.total),
        task_success_rate: terminal
          ? Math.round((n(tasks[0]?.success_count) * 10000) / terminal) / 100
          : null,
        queue_backlog: n(tasks[0]?.queue_backlog),
        open_alerts: openAlerts,
        storage_bytes: n(storage[0]?.total_bytes),
        file_growth_bytes: n(storage[0]?.growth_bytes),
      },
      queues: queues.map((r: any) => ({ status: r.status, total: n(r.total) })),
      provider_health,
      task_trend: trend.map((r: any) => ({
        bucket: String(r.bucket).replace(" ", "T") + "Z",
        succeeded: n(r.succeeded),
        failed: n(r.failed),
      })),
      health_signals: [
        { code: "mysql", status: "healthy", value: "query_succeeded" },
        {
          code: "queue",
          status:
            n(tasks[0]?.queue_backlog) >= this.queueWarning
              ? "warning"
              : "healthy",
          value: n(tasks[0]?.queue_backlog),
        },
        {
          code: "expired_leases",
          status: n(tasks[0]?.expired_leases) > 0 ? "critical" : "healthy",
          value: n(tasks[0]?.expired_leases),
        },
        {
          code: "data_quality",
          status:
            n(quality[0]?.critical_count) > 0
              ? "critical"
              : n(quality[0]?.open_count) > 0
                ? "warning"
                : "healthy",
          value: n(quality[0]?.open_count),
        },
      ],
      alerts: alerts.map((r: any) => ({
        ...r,
        observed_at: iso(r.observed_at),
      })),
      activity: activity.map((r: any) => ({
        ...r,
        occurred_at: iso(r.occurred_at),
      })),
      observed_at: now.toISOString(),
    };
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO platform_dashboard_views(id,actor_id,window_code,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?)",
        [randomUUID(), i.actorId, i.window, i.requestId, i.traceId, now],
      );
      await c.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.dashboard.read','platform_dashboard',NULL,'succeeded',?,?,?, ?,1)",
        [
          randomUUID(),
          i.actorId,
          i.requestId,
          i.traceId,
          JSON.stringify({
            window: i.window,
            open_alerts: openAlerts,
            queue_backlog: n(tasks[0]?.queue_backlog),
          }),
          now,
        ],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    return result;
  }
  async readManagement(i: any) {
    const like = `%${i.query.replace(/[\\%_]/g, "\\$&")}%`,
      filter = i.query ? like : "%",
      status = i.status || "%";
    if (i.domain === "data") {
      let rows: RowDataPacket[] = [];
      if (i.entity === "trends") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT t.id,t.title,t.category,t.market,t.status,t.signal_count metric_primary,t.source_count metric_secondary,t.last_seen_at updated_at,o.name organization_name,w.name workspace_name FROM trend_topics t JOIN organizations o ON o.id=t.organization_id JOIN workspaces w ON w.id=t.workspace_id WHERE (t.title LIKE ? OR o.name LIKE ? OR w.name LIKE ?) AND t.status LIKE ? ORDER BY t.last_seen_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else if (i.entity === "opportunities") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT p.id,p.name title,p.category,p.market,p.decision_status status,p.evidence_count metric_primary,p.source_count metric_secondary,p.updated_at,o.name organization_name,w.name workspace_name FROM opportunities p JOIN organizations o ON o.id=p.organization_id JOIN workspaces w ON w.id=p.workspace_id WHERE (p.name LIKE ? OR o.name LIKE ? OR w.name LIKE ?) AND p.decision_status LIKE ? ORDER BY p.updated_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else if (i.entity === "competitors") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT c.id,c.title,c.source_site category,c.market,c.status,c.revision metric_primary,COUNT(ch.id) metric_secondary,c.updated_at,o.name organization_name,w.name workspace_name FROM competitors c JOIN organizations o ON o.id=c.organization_id JOIN workspaces w ON w.id=c.workspace_id LEFT JOIN competitor_changes ch ON ch.competitor_id=c.id WHERE (c.title LIKE ? OR o.name LIKE ? OR w.name LIKE ?) AND c.status LIKE ? GROUP BY c.id,c.title,c.source_site,c.market,c.status,c.revision,c.updated_at,o.name,w.name ORDER BY c.updated_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT s.id,s.product_title title,s.supplier_name category,s.location market,s.status,s.moq metric_primary,s.quoted_price metric_secondary,s.observed_at updated_at,o.name organization_name,w.name workspace_name FROM sourcing_candidates s JOIN organizations o ON o.id=s.organization_id JOIN workspaces w ON w.id=s.workspace_id WHERE (s.product_title LIKE ? OR s.supplier_name LIKE ? OR o.name LIKE ?) AND s.status LIKE ? ORDER BY s.observed_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      }
      const counts = rows.reduce<Record<string, number>>((acc, row: any) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {});
      return {
        domain: i.domain,
        entity: i.entity,
        summary: { total: rows.length, ...counts },
        items: rows.map((row: any) => ({
          ...row,
          metric_primary: n(row.metric_primary),
          metric_secondary: n(row.metric_secondary),
          updated_at: iso(row.updated_at),
        })),
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "governance") {
      const [
        [scoreRules],
        [costRules],
        [approvals],
        [automations],
        [releases],
        [versions],
      ] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT r.id,r.name,r.version_code,r.status,r.revision,r.updated_at,o.name organization_name,w.name workspace_name FROM score_rules r JOIN organizations o ON o.id=r.organization_id JOIN workspaces w ON w.id=r.workspace_id WHERE (r.name LIKE ? OR r.version_code LIKE ? OR o.name LIKE ?) AND r.status LIKE ? ORDER BY r.updated_at DESC LIMIT 40",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT r.id,r.name,r.version_code,r.market,r.platform,r.status,r.revision,r.updated_at,o.name organization_name,w.name workspace_name FROM cost_rules r JOIN organizations o ON o.id=r.organization_id JOIN workspaces w ON w.id=r.workspace_id WHERE (r.name LIKE ? OR r.version_code LIKE ? OR o.name LIKE ?) AND r.status LIKE ? ORDER BY r.updated_at DESC LIMIT 40",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT t.id,t.name,t.resource_type,t.status,t.current_version,t.revision,t.updated_at,o.name organization_name,w.name workspace_name FROM approval_templates t JOIN organizations o ON o.id=t.organization_id JOIN workspaces w ON w.id=t.workspace_id WHERE (t.name LIKE ? OR o.name LIKE ? OR w.name LIKE ?) AND t.status LIKE ? ORDER BY t.updated_at DESC LIMIT 40",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT a.id,a.name,a.trigger_event_type,a.action_type,a.status,a.version,a.updated_at,o.name organization_name,w.name workspace_name FROM automation_rules a JOIN organizations o ON o.id=a.organization_id JOIN workspaces w ON w.id=a.workspace_id WHERE (a.name LIKE ? OR a.trigger_event_type LIKE ? OR o.name LIKE ?) AND a.status LIKE ? ORDER BY a.updated_at DESC LIMIT 40",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,app_version name,build_sha version_code,stage,status,updated_at FROM deployment_releases WHERE (app_version LIKE ? OR build_sha LIKE ?) AND status LIKE ? ORDER BY updated_at DESC LIMIT 30",
          [filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,MAX(created_at) latest_at FROM provider_versions",
        ),
      ]);
      const normalize = (rows: RowDataPacket[]) =>
        rows.map((row: any) => ({ ...row, updated_at: iso(row.updated_at) }));
      return {
        domain: i.domain,
        summary: {
          score_rules: scoreRules.length,
          cost_rules: costRules.length,
          approval_templates: approvals.length,
          automation_rules: automations.length,
          releases: releases.length,
          provider_versions: n(versions[0]?.total),
        },
        score_rules: normalize(scoreRules),
        cost_rules: normalize(costRules),
        approval_templates: normalize(approvals),
        automation_rules: normalize(automations),
        releases: normalize(releases),
        provider_versions_latest_at: iso(versions[0]?.latest_at),
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "content") {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT t.id,t.title,t.category,t.market,t.language,t.status,t.signal_count,t.source_count,t.heat_value,t.confidence_status,t.version,t.last_seen_at,o.name organization_name,w.name workspace_name FROM trend_topics t JOIN organizations o ON o.id=t.organization_id JOIN workspaces w ON w.id=t.workspace_id WHERE (t.title LIKE ? OR t.category LIKE ? OR t.market LIKE ?) AND t.status LIKE ? ORDER BY t.last_seen_at DESC LIMIT 100",
        [filter, filter, filter, status],
      );
      return {
        domain: i.domain,
        summary: {
          total: rows.length,
          active: rows.filter((r: any) => r.status === "active").length,
          review: rows.filter((r: any) => r.status !== "active").length,
        },
        items: rows.map((r: any) => ({
          ...r,
          last_seen_at: iso(r.last_seen_at),
        })),
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "notifications") {
      const [
        [rows],
        [subscriptions],
        [deliveries],
        [automationRoutes],
        [competitorRoutes],
      ] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT n.id,n.title,n.category,n.severity,n.read_at,n.created_at,u.email recipient_email,o.name organization_name,GROUP_CONCAT(CONCAT(d.channel,':',d.status) ORDER BY d.channel SEPARATOR ',') delivery_status FROM notifications n JOIN users u ON u.id=n.recipient_id JOIN organizations o ON o.id=n.organization_id LEFT JOIN notification_deliveries d ON d.notification_id=n.id WHERE (n.title LIKE ? OR u.email LIKE ? OR o.name LIKE ?) AND n.category LIKE ? GROUP BY n.id,n.title,n.category,n.severity,n.read_at,n.created_at,u.email,o.name ORDER BY n.created_at DESC LIMIT 100",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,SUM(in_app_enabled=1) in_app_enabled,SUM(email_enabled=1) email_enabled,SUM(task_enabled=1) task_enabled,SUM(approval_enabled=1) approval_enabled,SUM(competitor_enabled=1) competitor_enabled FROM notification_preferences",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT channel,status,COUNT(*) total FROM notification_deliveries GROUP BY channel,status ORDER BY channel,status",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT a.id,a.name,a.trigger_event_type event_type,a.action_type action_type,a.status,a.version,o.name organization_name,w.name workspace_name,a.updated_at FROM automation_rules a JOIN organizations o ON o.id=a.organization_id JOIN workspaces w ON w.id=a.workspace_id ORDER BY a.updated_at DESC LIMIT 30",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT r.id,CONCAT('竞品 ',r.metric,' ',r.direction) name,CONCAT('competitor.',r.metric,'.',r.direction) event_type,'notify_owner' action_type,r.status,r.revision version,o.name organization_name,w.name workspace_name,r.updated_at FROM competitor_monitor_rules r JOIN organizations o ON o.id=r.organization_id JOIN workspaces w ON w.id=r.workspace_id ORDER BY r.updated_at DESC LIMIT 30",
        ),
      ]);
      return {
        domain: i.domain,
        summary: {
          total: rows.length,
          unread: rows.filter((r: any) => !r.read_at).length,
          critical: rows.filter((r: any) => r.severity === "critical").length,
        },
        items: rows.map((r: any) => ({
          ...r,
          created_at: iso(r.created_at),
          read_at: iso(r.read_at),
        })),
        templates: [
          {
            category: "task",
            title: "任务状态更新",
            event_pattern: "task.*",
            status: "system_fixed",
          },
          {
            category: "approval",
            title: "审批状态更新",
            event_pattern: "approval.*",
            status: "system_fixed",
          },
          {
            category: "competitor",
            title: "竞品监控更新",
            event_pattern: "competitor.*",
            status: "system_fixed",
          },
          {
            category: "system",
            title: "系统与自动化通知",
            event_pattern: "automation.*",
            status: "system_fixed",
          },
        ],
        channels: [
          {
            code: "in_app",
            name: "站内通知",
            status: "enabled",
            deliveries: deliveries
              .filter((row: any) => row.channel === "in_app")
              .map((row: any) => ({ status: row.status, total: n(row.total) })),
          },
          {
            code: "email",
            name: "邮件",
            status: "pending_provider_selection",
            deliveries: deliveries
              .filter((row: any) => row.channel === "email")
              .map((row: any) => ({ status: row.status, total: n(row.total) })),
          },
        ],
        subscriptions: {
          total: n(subscriptions[0]?.total),
          in_app_enabled: n(subscriptions[0]?.in_app_enabled),
          email_enabled: n(subscriptions[0]?.email_enabled),
          task_enabled: n(subscriptions[0]?.task_enabled),
          approval_enabled: n(subscriptions[0]?.approval_enabled),
          competitor_enabled: n(subscriptions[0]?.competitor_enabled),
        },
        alert_routes: [...automationRoutes, ...competitorRoutes]
          .sort(
            (a: any, b: any) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime(),
          )
          .slice(0, 50)
          .map((row: any) => ({ ...row, updated_at: iso(row.updated_at) })),
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "email") {
      const [auth, delivery] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT a.id,a.kind,a.status,a.attempt_count,a.last_error_code,a.created_at,a.updated_at,u.email FROM auth_delivery_outbox a JOIN users u ON u.id=a.user_id WHERE (u.email LIKE ? OR a.kind LIKE ?) AND a.status LIKE ? ORDER BY a.updated_at DESC LIMIT 70",
          [filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT d.id,d.status,d.attempt_count,d.last_error_code,d.updated_at,u.email,n.title FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN users u ON u.id=d.recipient_id WHERE d.channel='email' AND (u.email LIKE ? OR n.title LIKE ?) AND d.status LIKE ? ORDER BY d.updated_at DESC LIMIT 30",
          [filter, filter, status],
        ),
      ]);
      const rows = [
        ...auth[0].map((r: any) => ({
          ...r,
          source: "账号邮件",
          source_type: "account",
        })),
        ...delivery[0].map((r: any) => ({
          ...r,
          source: "业务通知",
          source_type: "notification",
        })),
      ]
        .sort(
          (a: any, b: any) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 100);
      return {
        domain: i.domain,
        summary: {
          total: rows.length,
          succeeded: rows.filter((r: any) =>
            ["succeeded", "delivered"].includes(r.status),
          ).length,
          blocked: rows.filter((r: any) =>
            ["blocked_provider", "dead_letter", "failed"].includes(r.status),
          ).length,
        },
        items: rows.map((r: any) => ({
          ...r,
          created_at: iso(r.created_at),
          updated_at: iso(r.updated_at),
        })),
        observed_at: this.now().toISOString(),
      };
    }
    const [[services], [collection], [sources], [accounts]] = await Promise.all(
      [
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) recent_views FROM platform_dashboard_views WHERE observed_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE)",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT status,COUNT(*) total FROM collection_tasks GROUP BY status ORDER BY total DESC",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT status,COUNT(*) total FROM providers GROUP BY status",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM organizations WHERE status='active') active_organizations,(SELECT COUNT(*) FROM users WHERE status='active') active_users",
        ),
      ],
    );
    return {
      domain: i.domain,
      summary: {
        api: "healthy",
        database: "healthy",
        dashboard_reads: n(services[0]?.recent_views),
        active_organizations: n(accounts[0]?.active_organizations),
        active_users: n(accounts[0]?.active_users),
      },
      collections: collection.map((r: any) => ({
        status: r.status,
        total: n(r.total),
      })),
      sources: sources.map((r: any) => ({
        status: r.status,
        total: n(r.total),
      })),
      observed_at: this.now().toISOString(),
    };
  }
  async moderateTrend(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM platform_management_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [i.actorId, i.route, i.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        const value = operations[0].result_json;
        return typeof value === "string" ? JSON.parse(value) : value;
      }
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,organization_id,workspace_id,status,version FROM trend_topics WHERE id=? FOR UPDATE",
          [i.topicId],
        ),
        row = rows[0];
      if (!row)
        throw new PlatformDashboardError(
          "trend_topic_not_found",
          404,
          "刷新内容列表后重试。",
        );
      if (Number(row.version) !== i.expectedVersion)
        throw new PlatformDashboardError(
          "trend_topic_version_conflict",
          409,
          "内容已被其他管理员修改，刷新后重试。",
        );
      const version = Number(row.version) + 1;
      await c.query(
        "UPDATE trend_topics SET status=?,version=?,updated_at=? WHERE id=?",
        [i.status, version, i.now, i.topicId],
      );
      await c.query(
        "INSERT INTO trend_events(id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES(?,?,?,?,? ,?,'user',?,?,?,?,?)",
        [
          randomUUID(),
          row.organization_id,
          row.workspace_id,
          "trend.topic.moderated",
          "trend_topic",
          i.topicId,
          i.actorId,
          i.requestId,
          i.traceId,
          JSON.stringify({
            from_status: row.status,
            to_status: i.status,
            reason: i.reason,
            version,
          }),
          i.now,
        ],
      );
      const result = { id: i.topicId, status: i.status, version };
      await c.query(
        "INSERT INTO platform_management_operations(id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
        [
          randomUUID(),
          i.actorId,
          i.route,
          i.idempotencyKey,
          i.topicId,
          JSON.stringify(result),
          i.now,
        ],
      );
      await c.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,?,?,?,?,'trend_topic',?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          row.organization_id,
          row.workspace_id,
          i.actorId,
          "trend.topic.moderated",
          i.topicId,
          i.requestId,
          i.traceId,
          JSON.stringify({
            from_status: row.status,
            to_status: i.status,
            reason: i.reason,
          }),
          i.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async manageEmailDelivery(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM platform_management_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [i.actorId, i.route, i.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        const value = operations[0].result_json;
        return typeof value === "string" ? JSON.parse(value) : value;
      }

      let row: any;
      let nextStatus: string;
      let resourceType: string;
      let organizationId: string | null = null;
      let workspaceId: string | null = null;
      if (i.source === "account") {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,status FROM auth_delivery_outbox WHERE id=? FOR UPDATE",
          [i.deliveryId],
        );
        row = rows[0];
        if (!row)
          throw new PlatformDashboardError(
            "email_delivery_not_found",
            404,
            "刷新邮件列表后重试。",
          );
        if (
          !["blocked_provider", "dead_letter", "retry_scheduled"].includes(
            row.status,
          )
        )
          throw new PlatformDashboardError(
            "email_delivery_state_conflict",
            409,
            "只有受阻、死信或待重试的账号邮件可以重新投递。",
          );
        nextStatus = "queued";
        resourceType = "auth_delivery";
        await c.query(
          "UPDATE auth_delivery_outbox SET status='queued',attempt_count=0,available_at=?,lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,request_id=?,trace_id=?,updated_at=? WHERE id=?",
          [i.now, i.requestId, i.traceId, i.now, i.deliveryId],
        );
      } else {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,organization_id,workspace_id,status FROM notification_deliveries WHERE id=? AND channel='email' FOR UPDATE",
          [i.deliveryId],
        );
        row = rows[0];
        if (!row)
          throw new PlatformDashboardError(
            "email_delivery_not_found",
            404,
            "刷新邮件列表后重试。",
          );
        organizationId = row.organization_id;
        workspaceId = row.workspace_id;
        resourceType = "notification_delivery";
        if (i.action === "retry") {
          if (!["failed", "dead_letter", "suppressed"].includes(row.status))
            throw new PlatformDashboardError(
              "email_delivery_state_conflict",
              409,
              "只有失败、死信或已抑制的业务邮件可以重新进入待投递队列。",
            );
          nextStatus = "pending_placeholder";
          await c.query(
            "UPDATE notification_deliveries SET status='pending_placeholder',attempt_count=0,provider_ref=NULL,last_error_code=NULL,updated_at=? WHERE id=?",
            [i.now, i.deliveryId],
          );
        } else {
          if (["delivered", "suppressed"].includes(row.status))
            throw new PlatformDashboardError(
              "email_delivery_state_conflict",
              409,
              "已送达或已抑制的业务邮件不能重复抑制。",
            );
          nextStatus = "suppressed";
          await c.query(
            "UPDATE notification_deliveries SET status='suppressed',last_error_code='suppressed_by_admin',updated_at=? WHERE id=?",
            [i.now, i.deliveryId],
          );
        }
      }

      const result = {
        id: i.deliveryId,
        source: i.source,
        action: i.action,
        previous_status: row.status,
        status: nextStatus,
      };
      await c.query(
        "INSERT INTO platform_management_operations(id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
        [
          randomUUID(),
          i.actorId,
          i.route,
          i.idempotencyKey,
          i.deliveryId,
          JSON.stringify(result),
          i.now,
        ],
      );
      await c.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,?,?,?,?,?,?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          organizationId,
          workspaceId,
          i.actorId,
          `email.delivery.${i.action}`,
          resourceType,
          i.deliveryId,
          i.requestId,
          i.traceId,
          JSON.stringify({
            source: i.source,
            from_status: row.status,
            to_status: nextStatus,
            reason: i.reason,
          }),
          i.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async exportData(i: any) {
    const data: any = await this.readManagement({ ...i, domain: "data" });
    await this.pool.query(
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.data.export','platform_data',NULL,'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify({
          entity: i.entity,
          query: i.query,
          status: i.status,
          reason: i.reason,
          row_count: data.items.length,
        }),
        i.now,
      ],
    );
    return data;
  }
}
