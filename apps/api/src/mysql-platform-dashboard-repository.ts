import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  PlatformDashboardError,
  type PlatformDashboardRepository,
} from "./platform-dashboard-service.js";
import { readPlatformCollectionMetrics } from "./mysql-platform-dashboard-collection-metrics.js";
import { readPlatformRiskMetrics } from "./mysql-platform-dashboard-risk-metrics.js";
import { readPlatformScaleMetrics } from "./mysql-platform-dashboard-scale-metrics.js";
import { readPlatformStorageMetrics } from "./mysql-platform-dashboard-storage-metrics.js";
import { readApiCoverageDashboard } from "./api-coverage-dashboard.js";
const n = (v: any) => Number(v ?? 0),
  iso = (v: any) => (v ? new Date(v).toISOString() : null);
export class MySqlPlatformDashboardRepository implements PlatformDashboardRepository {
  constructor(
    private readonly pool: Pool,
    private readonly queueWarning = 1000,
    private readonly errorLimit = 20,
    private readonly now = () => new Date(),
    private readonly apiCoverageReportFile = resolve(
      process.cwd(),
      ".artifacts/verification/production-api-coverage.json",
    ),
  ) {}
  async read(i: any) {
    const since = new Date(this.now().getTime() - i.windowMinutes * 60000),
      now = this.now();
    const [scale, collection, risk, storage] = await Promise.all([
        readPlatformScaleMetrics(this.pool),
        readPlatformCollectionMetrics(this.pool, { since, now, windowMinutes: i.windowMinutes }),
        readPlatformRiskMetrics(this.pool, this.errorLimit),
        readPlatformStorageMetrics(this.pool, since),
      ]),
      orgs = scale.organizations,
      users = scale.users,
      providers = scale.providers,
      tasks = collection.tasks,
      queues = collection.queues,
      providerRows = collection.providers,
      trend = collection.trend,
      quality = risk.quality,
      alerts = risk.alerts,
      activity = risk.activity;
    const terminal = n(tasks?.success_count) + n(tasks?.failed_count),
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
    const openAlerts = n(quality?.open_count) + n(tasks?.failed_count) + n(tasks?.expired_leases);
    const result = {
      window: i.window,
      summary: {
        active_organizations: n(orgs?.total),
        active_users: n(users?.total),
        enabled_providers: n(providers?.total),
        task_success_rate: terminal
          ? Math.round((n(tasks?.success_count) * 10000) / terminal) / 100
          : null,
        queue_backlog: n(tasks?.queue_backlog),
        open_alerts: openAlerts,
        storage_bytes: n(storage?.total_bytes),
        file_growth_bytes: n(storage?.growth_bytes),
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
          status: n(tasks?.queue_backlog) >= this.queueWarning ? "warning" : "healthy",
          value: n(tasks?.queue_backlog),
        },
        {
          code: "expired_leases",
          status: n(tasks?.expired_leases) > 0 ? "critical" : "healthy",
          value: n(tasks?.expired_leases),
        },
        {
          code: "data_quality",
          status:
            n(quality?.critical_count) > 0
              ? "critical"
              : n(quality?.open_count) > 0
                ? "warning"
                : "healthy",
          value: n(quality?.open_count),
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
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.dashboard.read','platform_dashboard'," +
          "NULL,'succeeded',?,?,?, ?,1)",
        [
          randomUUID(),
          i.actorId,
          i.requestId,
          i.traceId,
          JSON.stringify({
            window: i.window,
            open_alerts: openAlerts,
            queue_backlog: n(tasks?.queue_backlog),
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
    if (i.domain === "api_coverage")
      return readApiCoverageDashboard({
        openapiFile: resolve(process.cwd(), "docs/openapi.yaml"),
        routeCatalogFile: resolve(process.cwd(), "config/route-catalog.json"),
        metadataFile: resolve(process.cwd(), "config/api-coverage-metadata.json"),
        reportFile: this.apiCoverageReportFile,
        query: i.query,
        status: i.status,
        now: this.now(),
      });
    const like = `%${i.query.replace(/[\\%_]/g, "\\$&")}%`,
      filter = i.query ? like : "%",
      status = i.status || "%";
    if (i.domain === "logs") {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT * FROM (
          SELECT 'api' source,id,action event_type,resource_type,resource_id,outcome status,
            NULL error_code,request_id,trace_id,occurred_at,NULL task_id,NULL provider_id,
            NULL provider_name
          FROM platform_audit_events
          WHERE (?='%' OR ?='api') AND (action LIKE ? OR resource_type LIKE ? OR
            COALESCE(resource_id,'') LIKE ? OR request_id LIKE ? OR trace_id LIKE ?)
          UNION ALL
          SELECT 'worker' source,id,event_type,'collection_task' resource_type,task_id resource_id,
            to_status status,JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.error_code')) error_code,
            request_id,trace_id,occurred_at,task_id task_id,NULL provider_id,NULL provider_name
          FROM collection_task_events
          WHERE (?='%' OR ?='worker') AND (event_type LIKE ? OR task_id LIKE ? OR
            request_id LIKE ? OR trace_id LIKE ? OR
            COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata_json,'$.error_code')),'') LIKE ?)
          UNION ALL
          SELECT 'crawler' source,r.id,CONCAT('crawler.run.',r.status) event_type,
            'crawler_run' resource_type,r.id resource_id,r.status,r.error_code,r.request_id,r.trace_id,
            r.started_at occurred_at,j.collection_task_id task_id,r.provider_id,p.name provider_name
          FROM crawler_browser_runs r JOIN providers p ON p.id=r.provider_id
          LEFT JOIN browser_collection_jobs j ON j.crawler_run_id=r.id
          WHERE (?='%' OR ?='crawler') AND (r.id LIKE ? OR r.status LIKE ? OR
            COALESCE(r.error_code,'') LIKE ? OR r.request_id LIKE ? OR r.trace_id LIKE ?)
        ) operational_logs ORDER BY occurred_at DESC,id DESC LIMIT 200`,
        [
          status,
          status,
          filter,
          filter,
          filter,
          filter,
          filter,
          status,
          status,
          filter,
          filter,
          filter,
          filter,
          filter,
          status,
          status,
          filter,
          filter,
          filter,
          filter,
          filter,
        ],
      );
      const sources = { api: 0, worker: 0, crawler: 0 };
      const items = rows.map((row: any) => {
        const source = row.source as keyof typeof sources;
        if (source in sources) sources[source] += 1;
        return { ...row, occurred_at: iso(row.occurred_at) };
      });
      return {
        domain: i.domain,
        summary: { total: items.length, ...sources },
        items,
        limit: 200,
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "data") {
      let rows: RowDataPacket[] = [];
      if (i.entity === "trends") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT t.id,t.title,t.category,t.market,t.status,t.signal_count metric_primary," +
            "t.source_count metric_secondary,t.last_seen_at updated_at,o.name organization_name," +
            "w.name workspace_name FROM trend_topics t JOIN organizations o ON o.id=t.organization_id " +
            "JOIN workspaces w ON w.id=t.workspace_id WHERE (t.title LIKE ? OR o.name LIKE ? OR w.name " +
            "LIKE ?) AND t.status LIKE ? ORDER BY t.last_seen_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else if (i.entity === "opportunities") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT p.id,p.name title,p.category,p.market,p.decision_status status,p.evidence_count " +
            "metric_primary,p.source_count metric_secondary,p.updated_at,o.name organization_name," +
            "w.name workspace_name FROM opportunities p JOIN organizations o ON o.id=p.organization_id " +
            "JOIN workspaces w ON w.id=p.workspace_id WHERE (p.name LIKE ? OR o.name LIKE ? OR w.name " +
            "LIKE ?) AND p.decision_status LIKE ? ORDER BY p.updated_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else if (i.entity === "competitors") {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT c.id,c.title,c.source_site category,c.market,c.status,c.revision metric_primary," +
            "COUNT(ch.id) metric_secondary,c.updated_at,o.name organization_name,w.name workspace_name " +
            "FROM competitors c JOIN organizations o ON o.id=c.organization_id JOIN workspaces w " +
            "ON w.id=c.workspace_id LEFT JOIN competitor_changes ch ON ch.competitor_id=c.id WHERE " +
            "(c.title LIKE ? OR o.name LIKE ? OR w.name LIKE ?) AND c.status LIKE ? GROUP BY c.id," +
            "c.title,c.source_site,c.market,c.status,c.revision,c.updated_at,o.name,w.name ORDER " +
            "BY c.updated_at DESC LIMIT 100",
          [filter, filter, filter, status],
        );
      } else {
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT s.id,s.product_title title,s.supplier_name category,s.location market," +
            "s.status,s.moq metric_primary,s.quoted_price metric_secondary,s.observed_at updated_at," +
            "o.name organization_name,w.name workspace_name FROM sourcing_candidates s JOIN organizations " +
            "o ON o.id=s.organization_id JOIN workspaces w ON w.id=s.workspace_id WHERE (s.product_title " +
            "LIKE ? OR s.supplier_name LIKE ? OR o.name LIKE ?) AND s.status LIKE ? ORDER BY s.observed_at " +
            "DESC LIMIT 100",
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
      const textLike = (column: string) =>
        `CONVERT(${column} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?`;
      const sectionQueries: Record<
        string,
        { count: string; select: string; parameters: unknown[] }
      > = {
        score_rules: {
          count:
            "SELECT COUNT(*) total FROM score_rules r JOIN organizations o ON o.id=r.organization_id " +
            `JOIN workspaces w ON w.id=r.workspace_id WHERE (${textLike("r.name")} OR ` +
            `${textLike("r.version_code")} OR ${textLike("o.name")} OR ${textLike("w.name")}) ` +
            "AND r.status LIKE ?",
          select:
            "SELECT r.id,r.name,r.version_code,r.status,r.revision,r.updated_at,o.name organization_name," +
            "w.name workspace_name FROM score_rules r JOIN organizations o ON o.id=r.organization_id " +
            `JOIN workspaces w ON w.id=r.workspace_id WHERE (${textLike("r.name")} OR ` +
            `${textLike("r.version_code")} OR ${textLike("o.name")} OR ${textLike("w.name")}) ` +
            "AND r.status LIKE ? ORDER BY r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?",
          parameters: [filter, filter, filter, filter, status],
        },
        cost_rules: {
          count:
            "SELECT COUNT(*) total FROM cost_rules r JOIN organizations o ON o.id=r.organization_id " +
            `JOIN workspaces w ON w.id=r.workspace_id WHERE (${textLike("r.name")} OR ` +
            `${textLike("r.version_code")} OR ${textLike("r.market")} OR ${textLike("r.platform")} OR ` +
            `${textLike("o.name")} OR ${textLike("w.name")}) AND r.status LIKE ?`,
          select:
            "SELECT r.id,r.name,r.version_code,r.market,r.platform,r.status,r.revision,r.updated_at," +
            "o.name organization_name,w.name workspace_name FROM cost_rules r JOIN organizations o ON " +
            `o.id=r.organization_id JOIN workspaces w ON w.id=r.workspace_id WHERE (${textLike("r.name")} OR ` +
            `${textLike("r.version_code")} OR ${textLike("r.market")} OR ${textLike("r.platform")} OR ` +
            `${textLike("o.name")} OR ${textLike("w.name")}) AND r.status LIKE ? ORDER BY ` +
            "r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?",
          parameters: [filter, filter, filter, filter, filter, filter, status],
        },
        approval_templates: {
          count:
            "SELECT COUNT(*) total FROM approval_templates t JOIN organizations o ON o.id=t.organization_id " +
            `JOIN workspaces w ON w.id=t.workspace_id WHERE (${textLike("t.name")} OR ` +
            `${textLike("t.resource_type")} OR ${textLike("o.name")} OR ${textLike("w.name")}) ` +
            "AND t.status LIKE ?",
          select:
            "SELECT t.id,t.name,t.resource_type,t.status,t.current_version,t.revision,t.updated_at," +
            "o.name organization_name,w.name workspace_name FROM approval_templates t JOIN organizations o " +
            `ON o.id=t.organization_id JOIN workspaces w ON w.id=t.workspace_id WHERE (${textLike("t.name")} OR ` +
            `${textLike("t.resource_type")} OR ${textLike("o.name")} OR ${textLike("w.name")}) ` +
            "AND t.status LIKE ? ORDER BY t.updated_at DESC,t.id DESC LIMIT ? OFFSET ?",
          parameters: [filter, filter, filter, filter, status],
        },
        automation_rules: {
          count:
            "SELECT COUNT(*) total FROM automation_rules a JOIN organizations o ON o.id=a.organization_id " +
            `JOIN workspaces w ON w.id=a.workspace_id WHERE (${textLike("a.name")} OR ` +
            `${textLike("a.trigger_event_type")} OR ${textLike("a.action_title")} OR ${textLike("o.name")} ` +
            `OR ${textLike("w.name")}) AND a.status LIKE ?`,
          select:
            "SELECT a.id,a.name,a.trigger_event_type,a.condition_severity,a.action_type,a.owner_id," +
            "a.action_assignee_id,a.action_title,a.rate_limit_count,a.rate_limit_window_minutes,a.status," +
            "a.version,a.updated_at,o.name organization_name,w.name workspace_name FROM automation_rules a " +
            "JOIN organizations o ON o.id=a.organization_id JOIN workspaces w ON w.id=a.workspace_id WHERE " +
            `(${textLike("a.name")} OR ${textLike("a.trigger_event_type")} OR ${textLike("a.action_title")} ` +
            `OR ${textLike("o.name")} OR ${textLike("w.name")}) AND a.status LIKE ? ORDER BY ` +
            "a.updated_at DESC,a.id DESC LIMIT ? OFFSET ?",
          parameters: [filter, filter, filter, filter, filter, status],
        },
        releases: {
          count:
            `SELECT COUNT(*) total FROM deployment_releases WHERE (${textLike("app_version")} OR ` +
            `${textLike("build_sha")} OR ${textLike("stage")}) AND status LIKE ?`,
          select:
            "SELECT id,app_version name,build_sha version_code,stage,status,updated_at FROM deployment_releases " +
            `WHERE (${textLike("app_version")} OR ${textLike("build_sha")} OR ${textLike("stage")}) ` +
            "AND status LIKE ? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
          parameters: [filter, filter, filter, status],
        },
      };
      const sectionQuery = sectionQueries[i.section]!;
      const [[summaryRows], [countRows]] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM score_rules) score_rules," +
            "(SELECT COUNT(*) FROM cost_rules) cost_rules," +
            "(SELECT COUNT(*) FROM approval_templates) approval_templates," +
            "(SELECT COUNT(*) FROM automation_rules) automation_rules," +
            "(SELECT COUNT(*) FROM deployment_releases) releases," +
            "(SELECT COUNT(*) FROM provider_versions) provider_versions," +
            "(SELECT MAX(created_at) FROM provider_versions) provider_versions_latest_at",
        ),
        this.pool.query<RowDataPacket[]>(sectionQuery.count, sectionQuery.parameters),
      ]);
      const total = n(countRows[0]?.total),
        totalPages = total ? Math.ceil(total / i.pageSize) : 0,
        page = totalPages ? Math.min(i.page, totalPages) : 1,
        offset = (page - 1) * i.pageSize,
        [rows] = await this.pool.query<RowDataPacket[]>(sectionQuery.select, [
          ...sectionQuery.parameters,
          i.pageSize,
          offset,
        ]),
        summaryRow: any = summaryRows[0] ?? {};
      return {
        domain: i.domain,
        section: i.section,
        summary: {
          score_rules: n(summaryRow.score_rules),
          cost_rules: n(summaryRow.cost_rules),
          approval_templates: n(summaryRow.approval_templates),
          automation_rules: n(summaryRow.automation_rules),
          releases: n(summaryRow.releases),
          provider_versions: n(summaryRow.provider_versions),
        },
        items: rows.map((row: any) => ({ ...row, updated_at: iso(row.updated_at) })),
        pagination: {
          page,
          page_size: i.pageSize,
          total,
          total_pages: totalPages,
        },
        provider_versions_latest_at: iso(summaryRow.provider_versions_latest_at),
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "content") {
      const searchPredicate =
          "(t.title LIKE ? OR COALESCE(t.category,'') LIKE ? OR " +
          "CONVERT(t.market USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?)",
        searchParameters = [filter, filter, filter],
        [[summaryRows], [filteredRows]] = await Promise.all([
          this.pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) total," +
              "SUM(t.status='active') active,SUM(t.status='irrelevant') irrelevant," +
              "SUM(t.status='stale') stale,SUM(t.status='archived') archived " +
              `FROM trend_topics t WHERE ${searchPredicate}`,
            searchParameters,
          ),
          this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) total FROM trend_topics t WHERE ${searchPredicate} AND t.status LIKE ?`,
            [...searchParameters, status],
          ),
        ]),
        summaryRow = summaryRows[0] as any,
        filteredRow = filteredRows[0] as any,
        total = n((filteredRow as any).total),
        totalPages = Math.max(1, Math.ceil(total / i.pageSize)),
        page = Math.min(i.page, totalPages),
        offset = (page - 1) * i.pageSize,
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT t.id,t.title,t.category,t.market,t.language,t.status,t.signal_count," +
            "t.source_count,t.heat_value,t.confidence_status,t.version,t.last_seen_at," +
            "o.name organization_name,w.name workspace_name FROM trend_topics t JOIN organizations " +
            "o ON o.id=t.organization_id JOIN workspaces w ON w.id=t.workspace_id WHERE " +
            `${searchPredicate} AND t.status LIKE ? ORDER BY t.last_seen_at DESC,t.id LIMIT ? OFFSET ?`,
          [...searchParameters, status, i.pageSize, offset],
        );
      return {
        domain: i.domain,
        summary: {
          total: n((summaryRow as any).total),
          active: n((summaryRow as any).active),
          irrelevant: n((summaryRow as any).irrelevant),
          stale: n((summaryRow as any).stale),
          archived: n((summaryRow as any).archived),
        },
        items: rows.map((r: any) => ({
          ...r,
          last_seen_at: iso(r.last_seen_at),
        })),
        pagination: {
          page,
          page_size: i.pageSize,
          total,
          total_pages: totalPages,
        },
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "notifications") {
      const [
        [summaryRows],
        [subscriptions],
        [deliveries],
        [automationRoutes],
        [competitorRoutes],
        messageManagement,
      ] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,SUM(n.read_at IS NULL) unread," +
            "SUM(n.severity='critical') critical FROM notifications n JOIN users u ON " +
            "u.id=n.recipient_id JOIN organizations o ON o.id=n.organization_id WHERE " +
            "(n.title LIKE ? OR u.email LIKE ? OR o.name LIKE ?) AND n.category LIKE ?",
          [filter, filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT COUNT(*) total,SUM(in_app_enabled=1) in_app_enabled,SUM(email_enabled=1) email_enabled," +
            "SUM(task_enabled=1) task_enabled,SUM(approval_enabled=1) approval_enabled," +
            "SUM(competitor_enabled=1) competitor_enabled FROM notification_preferences",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT channel,status,COUNT(*) total FROM notification_deliveries GROUP BY channel,status ORDER BY channel,status",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT a.id,a.name,a.trigger_event_type event_type,a.action_type action_type," +
            "a.status,a.version,o.name organization_name,w.name workspace_name,a.updated_at FROM " +
            "automation_rules a JOIN organizations o ON o.id=a.organization_id JOIN workspaces w " +
            "ON w.id=a.workspace_id ORDER BY a.updated_at DESC LIMIT 30",
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT r.id,CONCAT('竞品 ',r.metric,' ',r.direction) name,CONCAT('competitor.'," +
            "r.metric,'.',r.direction) event_type,'notify_owner' action_type,r.status," +
            "r.revision version,o.name organization_name,w.name workspace_name,r.updated_at FROM " +
            "competitor_monitor_rules r JOIN organizations o ON o.id=r.organization_id JOIN workspaces " +
            "w ON w.id=r.workspace_id ORDER BY r.updated_at DESC LIMIT 30",
        ),
        this.messageManagement("notification", i.messagePage, i.messagePageSize),
      ]);
      const summary = summaryRows[0] as any,
        total = n(summary?.total),
        totalPages = Math.max(1, Math.ceil(total / i.pageSize)),
        page = Math.min(i.page, totalPages),
        offset = (page - 1) * i.pageSize,
        [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT n.id,n.title,n.category,n.severity,n.read_at,n.created_at,u.email recipient_email," +
            "o.name organization_name,GROUP_CONCAT(CONCAT(d.channel,':',d.status) ORDER BY d.channel " +
            "SEPARATOR ',') delivery_status FROM notifications n JOIN users u ON u.id=n.recipient_id " +
            "JOIN organizations o ON o.id=n.organization_id LEFT JOIN notification_deliveries d ON " +
            "d.notification_id=n.id WHERE (n.title LIKE ? OR u.email LIKE ? OR o.name LIKE ?) AND " +
            "n.category LIKE ? GROUP BY n.id,n.title,n.category,n.severity,n.read_at," +
            "n.created_at,u.email,o.name ORDER BY n.created_at DESC,n.id DESC LIMIT ? OFFSET ?",
          [filter, filter, filter, status, i.pageSize, offset],
        );
      return {
        domain: i.domain,
        summary: {
          total,
          unread: n(summary?.unread),
          critical: n(summary?.critical),
        },
        items: rows.map((r: any) => ({
          ...r,
          created_at: iso(r.created_at),
          read_at: iso(r.read_at),
        })),
        pagination: {
          page,
          page_size: i.pageSize,
          total,
          total_pages: totalPages,
        },
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
            (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          )
          .slice(0, 50)
          .map((row: any) => ({ ...row, updated_at: iso(row.updated_at) })),
        ...messageManagement,
        observed_at: this.now().toISOString(),
      };
    }
    if (i.domain === "email") {
      const [auth, delivery] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT a.id,a.kind,a.status,a.attempt_count,a.last_error_code,a.created_at," +
            "a.updated_at,u.email FROM auth_delivery_outbox a JOIN users u ON u.id=a.user_id WHERE " +
            "(u.email LIKE ? OR a.kind LIKE ?) AND a.status LIKE ? ORDER BY a.updated_at DESC LIMIT " +
            "70",
          [filter, filter, status],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT d.id,d.status,d.attempt_count,d.last_error_code,d.updated_at,u.email," +
            "n.title FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id " +
            "JOIN users u ON u.id=d.recipient_id WHERE d.channel='email' AND (u.email LIKE ? OR n.title " +
            "LIKE ?) AND d.status LIKE ? ORDER BY d.updated_at DESC LIMIT 30",
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
          (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 100);
      const messageManagement = await this.messageManagement("email");
      return {
        domain: i.domain,
        summary: {
          total: rows.length,
          succeeded: rows.filter((r: any) => ["succeeded", "delivered"].includes(r.status)).length,
          blocked: rows.filter((r: any) =>
            ["blocked_provider", "dead_letter", "failed"].includes(r.status),
          ).length,
        },
        items: rows.map((r: any) => ({
          ...r,
          created_at: iso(r.created_at),
          updated_at: iso(r.updated_at),
        })),
        ...messageManagement,
        observed_at: this.now().toISOString(),
      };
    }
    const [
      [views],
      [collection],
      [sources],
      [accounts],
      [runtimeNodes],
      [redisObservations],
      [mysqlObservations],
      [fileObservations],
      [schedulerObservations],
    ] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) recent_views FROM platform_dashboard_views WHERE observed_at>=DATE_SUB(UTC_TIMESTAMP(3)," +
          "INTERVAL 15 MINUTE)",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT status,COUNT(*) total FROM collection_tasks GROUP BY status ORDER BY total DESC",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT status,COUNT(*) total FROM providers GROUP BY status",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT (SELECT COUNT(*) FROM organizations WHERE status='active') active_organizations," +
          "(SELECT COUNT(*) FROM users WHERE status='active') active_users",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT node_id,role,status,build_sha,app_version,last_heartbeat_at FROM runtime_nodes " +
          "WHERE role='api' ORDER BY last_heartbeat_at DESC LIMIT 1",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT state,observed_at FROM redis_resilience_observations ORDER BY observed_at DESC LIMIT 1",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT state,observed_at FROM mysql_resilience_observations ORDER BY observed_at DESC LIMIT 1",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT state,observed_at FROM file_resilience_observations ORDER BY observed_at DESC LIMIT 1",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT state,worker_instances,crawler_instances,active_worker_leases,active_crawler_leases," +
          "observed_at FROM crawler_scheduler_observations ORDER BY observed_at DESC LIMIT 1",
      ),
    ]);
    const staleAfterMs = 5 * 60 * 1000,
      serviceState = (row: any, fallback = "unknown") =>
        !row
          ? fallback
          : this.now().getTime() - new Date(row.observed_at ?? row.last_heartbeat_at).getTime() >
              staleAfterMs
            ? "stale"
            : String(row.state ?? row.status ?? fallback),
      runtime = runtimeNodes[0],
      redis = redisObservations[0],
      mysql = mysqlObservations[0],
      files = fileObservations[0],
      scheduler = schedulerObservations[0];
    return {
      domain: i.domain,
      summary: {
        api: serviceState(runtime),
        database: "healthy",
        dashboard_reads: n(views[0]?.recent_views),
        active_organizations: n(accounts[0]?.active_organizations),
        active_users: n(accounts[0]?.active_users),
      },
      services: [
        {
          code: "api",
          name: "后端接口",
          status: serviceState(runtime),
          detail: runtime
            ? `${runtime.app_version} · ${String(runtime.build_sha).slice(0, 12)}`
            : "尚无运行节点心跳",
          observed_at: iso(runtime?.last_heartbeat_at),
          href: "/platform-admin/topology",
        },
        {
          code: "mysql",
          name: "数据库",
          status: serviceState(mysql, "healthy"),
          detail: mysql ? "最近一次韧性检查" : "本次管理查询成功",
          observed_at: iso(mysql?.observed_at) ?? this.now().toISOString(),
          href: "/platform-admin/mysql",
        },
        {
          code: "redis",
          name: "缓存与任务队列",
          status: serviceState(redis),
          detail: redis ? "最近一次韧性检查" : "尚未执行韧性检查",
          observed_at: iso(redis?.observed_at),
          href: "/platform-admin/redis",
        },
        {
          code: "files",
          name: "文件存储",
          status: serviceState(files),
          detail: files ? "最近一次存储检查" : "尚未执行存储检查",
          observed_at: iso(files?.observed_at),
          href: "/platform-admin/files",
        },
        {
          code: "worker",
          name: "任务处理服务",
          status: serviceState(scheduler),
          detail: scheduler
            ? `${n(scheduler.worker_instances)} 个实例 · ${n(scheduler.active_worker_leases)} 个活动任务`
            : "尚无调度器观测",
          observed_at: iso(scheduler?.observed_at),
          href: "/platform-admin/crawler-scheduler",
        },
        {
          code: "crawler",
          name: "网页采集服务",
          status: serviceState(scheduler),
          detail: scheduler
            ? `${n(scheduler.crawler_instances)} 个实例 · ${n(scheduler.active_crawler_leases)} 个活动运行`
            : "尚无调度器观测",
          observed_at: iso(scheduler?.observed_at),
          href: "/platform-admin/crawler-scheduler",
        },
      ],
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
  private async messageManagement(
    kind: "notification" | "email",
    requestedPage = 1,
    pageSize = 100,
  ) {
    const [[[count]], [organizations], [users]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total FROM platform_messages WHERE kind=?",
        [kind],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,name FROM organizations WHERE status='active' ORDER BY name LIMIT 200",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,email FROM users WHERE status='active' ORDER BY email LIMIT 500",
      ),
    ]);
    const total = n(count?.total),
      totalPages = Math.max(1, Math.ceil(total / pageSize)),
      page = Math.min(requestedPage, totalPages),
      offset = (page - 1) * pageSize,
      [messages] = await this.pool.query<RowDataPacket[]>(
        "SELECT m.*,o.name organization_name,u.email user_email,creator.email created_by_email " +
          "FROM platform_messages m LEFT JOIN organizations o ON o.id=m.organization_id LEFT JOIN " +
          "users u ON u.id=m.user_id JOIN users creator ON creator.id=m.created_by WHERE m.kind=? " +
          "ORDER BY m.updated_at DESC,m.id DESC LIMIT ? OFFSET ?",
        [kind, pageSize, offset],
      );
    return {
      messages: messages.map((row: any) => ({
        ...row,
        in_app_enabled: Boolean(row.in_app_enabled),
        email_enabled: Boolean(row.email_enabled),
        version: n(row.version),
        published_at: iso(row.published_at),
        created_at: iso(row.created_at),
        updated_at: iso(row.updated_at),
      })),
      message_pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      },
      audience_options: {
        organizations: organizations.map((row: any) => ({
          id: row.id,
          name: row.name,
        })),
        users: users.map((row: any) => ({ id: row.id, email: row.email })),
      },
    };
  }
  private async replayOperation(c: PoolConnection, i: any) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT result_json FROM platform_management_operations WHERE actor_id=? AND route=? AND idempotency_key=? FOR UPDATE",
      [i.actorId, i.route, i.idempotencyKey],
    );
    const value = rows[0]?.result_json;
    return value ? (typeof value === "string" ? JSON.parse(value) : value) : null;
  }
  private async saveOperation(c: PoolConnection, i: any, resourceId: string, result: any) {
    await c.query(
      "INSERT INTO platform_management_operations(id,actor_id,route,idempotency_key," +
        "resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
      [
        randomUUID(),
        i.actorId,
        i.route,
        i.idempotencyKey,
        resourceId,
        JSON.stringify(result),
        i.now,
      ],
    );
  }
  private async auditMessage(c: any, i: any, action: string, resourceId: string, metadata: any) {
    await c.query(
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES(?,NULL,NULL,? ,?,'platform_message',?,'succeeded'," +
        "?,?,?,?,1)",
      [
        randomUUID(),
        i.actorId,
        action,
        resourceId,
        i.requestId,
        i.traceId,
        JSON.stringify(metadata),
        i.now,
      ],
    );
  }
  async createMessage(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replay = await this.replayOperation(c, i);
      if (replay) {
        await c.commit();
        return replay;
      }
      const id = randomUUID(),
        v = i.value;
      await c.query(
        "INSERT INTO platform_messages(id,kind,title,body,category,severity,audience_type," +
          "organization_id,user_id,in_app_enabled,email_enabled,status,version,created_by," +
          "updated_by,published_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?," +
          "?,?,'draft',1,?,?,NULL,?,?)",
        [
          id,
          v.kind,
          v.title,
          v.body,
          v.category,
          v.severity,
          v.audience_type,
          v.organization_id,
          v.user_id,
          v.in_app_enabled,
          v.email_enabled,
          i.actorId,
          i.actorId,
          i.now,
          i.now,
        ],
      );
      const result = { id, status: "draft", version: 1 };
      await this.auditMessage(c, i, "platform.message.created", id, {
        kind: v.kind,
        audience_type: v.audience_type,
      });
      await this.saveOperation(c, i, id, result);
      await c.commit();
      return result;
    } catch (error: any) {
      await c.rollback();
      if (error?.code === "ER_NO_REFERENCED_ROW_2")
        throw new PlatformDashboardError(
          "platform_message_target_not_found",
          404,
          "选择仍然有效的组织或用户。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  async updateMessage(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replay = await this.replayOperation(c, i);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT status,version FROM platform_messages WHERE id=? FOR UPDATE",
        [i.messageId],
      );
      if (!rows[0])
        throw new PlatformDashboardError("platform_message_not_found", 404, "刷新草稿列表。");
      if (rows[0].status !== "draft")
        throw new PlatformDashboardError(
          "platform_message_not_editable",
          409,
          "已发布或已取消的内容不能修改，可新建草稿。",
        );
      if (n(rows[0].version) !== i.expectedVersion)
        throw new PlatformDashboardError(
          "platform_message_version_conflict",
          409,
          "草稿已被其他管理员修改，刷新后重试。",
        );
      const v = i.value,
        version = i.expectedVersion + 1;
      await c.query(
        "UPDATE platform_messages SET kind=?,title=?,body=?,category=?,severity=?," +
          "audience_type=?,organization_id=?,user_id=?,in_app_enabled=?,email_enabled=?," +
          "version=?,updated_by=?,updated_at=? WHERE id=?",
        [
          v.kind,
          v.title,
          v.body,
          v.category,
          v.severity,
          v.audience_type,
          v.organization_id,
          v.user_id,
          v.in_app_enabled,
          v.email_enabled,
          version,
          i.actorId,
          i.now,
          i.messageId,
        ],
      );
      const result = { id: i.messageId, status: "draft", version };
      await this.auditMessage(c, i, "platform.message.updated", i.messageId, {
        reason: i.reason,
        version,
      });
      await this.saveOperation(c, i, i.messageId, result);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async messageAction(i: any) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const replay = await this.replayOperation(c, i);
      if (replay) {
        await c.commit();
        return replay;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM platform_messages WHERE id=? FOR UPDATE",
        [i.messageId],
      );
      const message = rows[0];
      if (!message)
        throw new PlatformDashboardError("platform_message_not_found", 404, "刷新草稿列表。");
      if (message.status !== "draft")
        throw new PlatformDashboardError(
          "platform_message_action_conflict",
          409,
          "该草稿已经发布或取消。",
        );
      if (n(message.version) !== i.expectedVersion)
        throw new PlatformDashboardError(
          "platform_message_version_conflict",
          409,
          "草稿已被其他管理员修改，刷新后重试。",
        );
      if (i.action === "publish" && message.email_enabled)
        throw new PlatformDashboardError(
          "mail_provider_pending",
          503,
          "邮件服务尚未接入；可取消历史邮件草稿，不能发布或重试。",
        );
      const next = i.expectedVersion + 1;
      if (i.action === "cancel") {
        await c.query(
          "UPDATE platform_messages SET status='cancelled',version=?,updated_by=?,updated_at=? WHERE id=?",
          [next, i.actorId, i.now, i.messageId],
        );
        const result = {
          id: i.messageId,
          status: "cancelled",
          version: next,
          recipient_count: 0,
        };
        await this.auditMessage(c, i, "platform.message.cancelled", i.messageId, {
          reason: i.reason,
        });
        await this.saveOperation(c, i, i.messageId, result);
        await c.commit();
        return result;
      }
      const args: any[] = [];
      let target = "";
      let earlierScope = "";
      if (message.audience_type === "organization") {
        target = "AND m.organization_id=?";
        earlierScope = "AND earlier.organization_id=m.organization_id";
        args.push(message.organization_id);
      }
      if (message.audience_type === "user") {
        target = "AND u.id=?";
        args.push(message.user_id);
      }
      const [recipients] = await c.query<RowDataPacket[]>(
        `SELECT u.id user_id,m.organization_id,o.default_workspace_id workspace_id
         FROM users u
         JOIN memberships m ON m.user_id=u.id AND m.status='active'
         JOIN organizations o ON o.id=m.organization_id AND o.status='active'
          AND o.default_workspace_id IS NOT NULL
         WHERE u.status='active' ${target}
          AND NOT EXISTS(
            SELECT 1 FROM memberships earlier
            JOIN organizations earlier_o ON earlier_o.id=earlier.organization_id
             AND earlier_o.status='active' AND earlier_o.default_workspace_id IS NOT NULL
            WHERE earlier.user_id=u.id AND earlier.status='active' ${earlierScope}
             AND (earlier.created_at<m.created_at
              OR (earlier.created_at=m.created_at AND earlier.id<m.id))
          )
         ORDER BY u.email`,
        args,
      );
      if (!recipients.length)
        throw new PlatformDashboardError(
          "platform_message_audience_empty",
          409,
          "目标范围没有可接收消息的活动用户。",
        );
      let inAppCount = 0,
        emailCount = 0;
      for (const recipient of recipients) {
        const eventId = randomUUID(),
          notificationId = randomUUID();
        const payload = {
          resource_type: "platform_message",
          resource_id: i.messageId,
          title: message.title,
        };
        await c.query(
          "INSERT INTO outbox_events(id,organization_id,workspace_id,event_type,schema_version," +
            "payload_json,status,attempt_count,available_at,published_at,request_id,trace_id," +
            "created_at,updated_at,version) VALUES(?,?,?,'platform.message.published'," +
            "1,?,'published',0,?,?,?,?,?,?,1)",
          [
            eventId,
            recipient.organization_id,
            recipient.workspace_id,
            JSON.stringify(payload),
            i.now,
            i.now,
            i.requestId,
            i.traceId,
            i.now,
            i.now,
          ],
        );
        await c.query(
          "INSERT INTO notifications(id,organization_id,workspace_id,recipient_id,source_event_id," +
            "category,severity,title,body,resource_type,resource_id,read_at,version,created_at," +
            "updated_at) VALUES(?,?,?,?,?,?,?,?,?,'platform_message',?,NULL,1,?,?)",
          [
            notificationId,
            recipient.organization_id,
            recipient.workspace_id,
            recipient.user_id,
            eventId,
            message.category,
            message.severity,
            message.title,
            message.body,
            i.messageId,
            i.now,
            i.now,
          ],
        );
        if (message.in_app_enabled) {
          await c.query(
            "INSERT INTO notification_deliveries(id,organization_id,workspace_id,notification_id," +
              "recipient_id,channel,status,attempt_count,created_at,updated_at) VALUES(?," +
              "?,?,?,?,'in_app','delivered',1,?,?)",
            [
              randomUUID(),
              recipient.organization_id,
              recipient.workspace_id,
              notificationId,
              recipient.user_id,
              i.now,
              i.now,
            ],
          );
          await c.query(
            "INSERT INTO realtime_events(organization_id,workspace_id,recipient_id,notification_id," +
              "event_type,payload_json,created_at) VALUES(?,?,?,?, 'notification.created'," +
              "?,?)",
            [
              recipient.organization_id,
              recipient.workspace_id,
              recipient.user_id,
              notificationId,
              JSON.stringify({
                id: notificationId,
                category: message.category,
                severity: message.severity,
                title: message.title,
                created_at: i.now.toISOString(),
              }),
              i.now,
            ],
          );
          inAppCount += 1;
        }
        if (message.email_enabled) {
          await c.query(
            "INSERT INTO notification_deliveries(id,organization_id,workspace_id,notification_id," +
              "recipient_id,channel,status,attempt_count,created_at,updated_at) VALUES(?," +
              "?,?,?,?,'email','pending_placeholder',0,?,?)",
            [
              randomUUID(),
              recipient.organization_id,
              recipient.workspace_id,
              notificationId,
              recipient.user_id,
              i.now,
              i.now,
            ],
          );
          emailCount += 1;
        }
      }
      await c.query(
        "UPDATE platform_messages SET status='published',published_at=?,version=?,updated_by=?,updated_at=? WHERE id=?",
        [i.now, next, i.actorId, i.now, i.messageId],
      );
      const result = {
        id: i.messageId,
        status: "published",
        version: next,
        recipient_count: recipients.length,
        in_app_count: inAppCount,
        email_count: emailCount,
      };
      await this.auditMessage(c, i, "platform.message.published", i.messageId, {
        ...result,
        reason: i.reason,
      });
      await this.saveOperation(c, i, i.messageId, result);
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
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
        throw new PlatformDashboardError("trend_topic_not_found", 404, "刷新内容列表后重试。");
      if (Number(row.version) !== i.expectedVersion)
        throw new PlatformDashboardError(
          "trend_topic_version_conflict",
          409,
          "内容已被其他管理员修改，刷新后重试。",
        );
      const version = Number(row.version) + 1;
      await c.query("UPDATE trend_topics SET status=?,version=?,updated_at=? WHERE id=?", [
        i.status,
        version,
        i.now,
        i.topicId,
      ]);
      await c.query(
        "INSERT INTO trend_events(id,organization_id,workspace_id,event_type,resource_type," +
          "resource_id,actor_type,actor_id,request_id,trace_id,payload_json,occurred_at) VALUES(?," +
          "?,?,?,? ,?,'user',?,?,?,?,?)",
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
        "INSERT INTO platform_management_operations(id,actor_id,route,idempotency_key," +
          "resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
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
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,?,?,?,?,'trend_topic',?,'succeeded',?,?,?,?,1)",
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
          throw new PlatformDashboardError("email_delivery_not_found", 404, "刷新邮件列表后重试。");
        if (!["blocked_provider", "dead_letter", "retry_scheduled"].includes(row.status))
          throw new PlatformDashboardError(
            "email_delivery_state_conflict",
            409,
            "只有受阻、死信或待重试的账号邮件可以重新投递。",
          );
        nextStatus = "queued";
        resourceType = "auth_delivery";
        await c.query(
          "UPDATE auth_delivery_outbox SET status='queued',attempt_count=0,available_at=?," +
            "lease_owner=NULL,lease_expires_at=NULL,last_error_code=NULL,request_id=?," +
            "trace_id=?,updated_at=? WHERE id=?",
          [i.now, i.requestId, i.traceId, i.now, i.deliveryId],
        );
      } else {
        const [rows] = await c.query<RowDataPacket[]>(
          "SELECT id,organization_id,workspace_id,status FROM notification_deliveries WHERE id=? AND channel='email' FOR UPDATE",
          [i.deliveryId],
        );
        row = rows[0];
        if (!row)
          throw new PlatformDashboardError("email_delivery_not_found", 404, "刷新邮件列表后重试。");
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
            "UPDATE notification_deliveries SET status='pending_placeholder',attempt_count=0," +
              "provider_ref=NULL,last_error_code=NULL,updated_at=? WHERE id=?",
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
        "INSERT INTO platform_management_operations(id,actor_id,route,idempotency_key," +
          "resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
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
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,?,?,?,?,?,?,'succeeded',?,?,?,?,1)",
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
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES(?,NULL,NULL,?,'platform.data.export','platform_data'," +
        "NULL,'succeeded',?,?,?,?,1)",
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
  async exportLogs(i: any) {
    const data: any = await this.readManagement({
      ...i,
      domain: "logs",
      entity: "trends",
      status: i.source,
    });
    await this.pool.query(
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES(?,NULL,NULL,?,'platform.logs.export','operational_logs'," +
        "NULL,'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify({
          query: i.query,
          source: i.source,
          reason: i.reason,
          row_count: data.items.length,
        }),
        i.now,
      ],
    );
    return data;
  }
}
