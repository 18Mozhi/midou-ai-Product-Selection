const readyAge = (table, ready, extra = "", leased = "status='leased'") => ({
  table,
  sql: `SELECT COALESCE(MAX(GREATEST(0,TIMESTAMPDIFF(SECOND,CASE WHEN ${leased} THEN lease_expires_at ELSE available_at END,UTC_TIMESTAMP(3)))),0) lag_seconds FROM \`${table}\` WHERE (${ready})${extra}`,
});

// This list mirrors queues that the BaoTa-managed Node Worker actually leases.
// Domain outbox tables without a runtime consumer are immutable audit/delivery
// contracts and must not be mistaken for stalled executable work.
export const RELEASE_ASYNC_QUEUE_PROBES = Object.freeze([
  readyAge(
    "auth_delivery_outbox",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "collection_tasks",
    "(status IN ('scheduled','queued','retry_scheduled','rate_limited') AND available_at<=UTC_TIMESTAMP(3)) OR (status IN ('leased','running') AND lease_expires_at<=UTC_TIMESTAMP(3))",
    "",
    "status IN ('leased','running')",
  ),
  readyAge(
    "trend_projection_jobs",
    "(status='scheduled' AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "opportunity_refresh_jobs",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "opportunity_score_jobs",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "opportunity_profit_jobs",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "competitor_snapshot_jobs",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "sourcing_projection_jobs",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "ai_analysis_requests",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "sourcing_outbox",
    "(status='queued' AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
    " AND event_type='sourcing.purchase_task.queued'",
  ),
  readyAge(
    "approval_escalation_jobs",
    "(status='queued' AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "outbox_events",
    "(status='pending' AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
    " AND (event_type LIKE 'task.%' OR event_type LIKE 'approval.%' OR event_type LIKE 'competitor.%' OR event_type='automation.notification.queued')",
  ),
  readyAge(
    "automation_executions",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
  ),
  readyAge(
    "report_exports",
    "(status IN ('queued','retry_scheduled') AND available_at<=UTC_TIMESTAMP(3)) OR (status='leased' AND lease_expires_at<=UTC_TIMESTAMP(3))",
    " AND expires_at>UTC_TIMESTAMP(3)",
  ),
  {
    table: "webhook_deliveries",
    sql: "SELECT COALESCE(MAX(GREATEST(0,TIMESTAMPDIFF(SECOND,CASE WHEN d.status='leased' THEN d.lease_expires_at ELSE d.available_at END,UTC_TIMESTAMP(3)))),0) lag_seconds FROM `webhook_deliveries` d JOIN `webhook_endpoints` e ON e.id=d.endpoint_id WHERE e.status='active' AND ((d.status IN ('queued','retry_scheduled') AND d.available_at<=UTC_TIMESTAMP(3)) OR (d.status='leased' AND d.lease_expires_at<=UTC_TIMESTAMP(3)))",
  },
]);

export async function asyncLagSeconds(pool) {
  let maximum = 0;
  for (const probe of RELEASE_ASYNC_QUEUE_PROBES) {
    const [values] = await pool.query(probe.sql);
    const lag = Number(values[0]?.lag_seconds ?? 0);
    if (!Number.isFinite(lag) || lag < 0)
      throw new Error(`release_async_lag_invalid:${probe.table}`);
    maximum = Math.max(maximum, lag);
  }
  return maximum;
}
