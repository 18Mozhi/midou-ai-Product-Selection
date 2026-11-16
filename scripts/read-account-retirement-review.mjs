import { createHash } from "node:crypto";

// Fixed identifiers only. MySQL hashes the selected facts; business keys and
// payloads never leave the database in this review.
const reviewedSourceFacts = [
  ["trend_topics", "s.topic_key"],
  ["raw_evidence", "s.provider_id,s.file_asset_id,s.content_sha256,s.size_bytes"],
  ["sourcing_searches", "s.input_type,s.input_ref,s.collection_task_id,s.request_id,s.trace_id"],
  [
    "normalized_records",
    `s.provider_id,s.record_key,s.schema_version,s.record_version,
    s.raw_evidence_id,s.supersedes_record_id,CAST(s.payload_json AS CHAR CHARACTER SET utf8mb4)`,
  ],
  [
    "opportunities",
    "s.name,s.market,s.source_type,s.source_ref_id,s.owner_id,s.lifecycle_status,s.version",
  ],
  [
    "trend_signals",
    "s.topic_id,s.normalized_record_id,s.raw_evidence_id,s.provider_id,s.title,s.canonical_url",
  ],
  [
    "competitors",
    "s.opportunity_id,s.provider_id,s.source_site,s.external_id,s.product_url,s.title,s.latest_snapshot_id",
  ],
  [
    "competitor_snapshots",
    "s.competitor_id,s.provider_id,s.current_price,s.currency,s.source_ref_id,s.evidence_id",
  ],
  [
    "supplier_quotes",
    "s.candidate_id,s.quote_version,s.is_current,s.supplier_name,s.product_title,s.moq,s.quoted_price,s.currency,s.evidence_id,s.confirmed_by",
  ],
  ["sourcing_comparisons", "s.name,s.quote_ids_json,s.created_by,s.request_id,s.trace_id"],
  [
    "tasks",
    "s.title,s.description,s.status,s.assignee_id,s.source_type,s.source_ref_id,s.created_by",
  ],
  ["task_comments", "s.task_id,s.body,s.created_by,s.created_at"],
  ["task_events", "s.task_id,s.event_type,s.actor_id,s.payload_json,s.request_id,s.trace_id"],
  [
    "score_rules",
    "s.version_code,s.name,s.status,s.dimensions_json,s.thresholds_json,s.approved_by,s.rollback_target_id",
  ],
  [
    "cost_rules",
    "s.market,s.platform,s.version_code,s.name,s.status,s.fee_lines_json,s.effective_from,s.rollback_target_id",
  ],
  [
    "cost_rule_approvals",
    "s.cost_rule_id,s.approval_role,s.decision,s.reason,s.actor_id,s.request_id,s.trace_id",
  ],
  [
    "competitor_monitor_rules",
    "s.competitor_id,s.metric,s.direction,s.threshold_value,s.status,s.created_by",
  ],
];

// Caller owns a repeatable-read snapshot. Only the digest and aggregates leave this function.
export async function readAccountRetirementReview(
  connection,
  runId,
  { lockForBackfill = false } = {},
) {
  const lock = lockForBackfill ? " LOCK IN SHARE MODE" : "";
  const [[run]] = await connection.execute(
    "SELECT primary_account_id FROM account_retirement_runs WHERE id=?",
    [runId],
  );
  if (!run) throw new Error("committed_staging_run_required");
  const hash = createHash("sha256");
  const add = (values) => hash.update(`${JSON.stringify(values)}\n`, "utf8");
  add(["account_retirement_review_v3", runId, run.primary_account_id]);
  const [scopes] = await connection.execute(
    `SELECT legacy_org_id,legacy_workspace_id,account_id,reason
    FROM account_retirement_scopes WHERE run_id=? ORDER BY legacy_org_id,legacy_workspace_id${lock}`,
    [runId],
  );
  const reasons = new Map();
  const scopeReasons = new Map();
  const scopeKey = (row) => JSON.stringify([row.legacy_org_id, row.legacy_workspace_id]);
  for (const row of scopes) {
    add(["scope", row.legacy_org_id, row.legacy_workspace_id, row.account_id, row.reason]);
    reasons.set(row.reason, (reasons.get(row.reason) ?? 0n) + 1n);
    scopeReasons.set(scopeKey(row), row.reason);
  }
  const byTable = new Map();
  let sourceTable = "";
  for (;;) {
    const [[next]] = await connection.execute(
      `SELECT source_table FROM account_retirement_records FORCE INDEX (PRIMARY)
       WHERE run_id=? AND source_table>? ORDER BY source_table LIMIT 1${lock}`,
      [runId, sourceTable],
    );
    if (!next) break;
    sourceTable = next.source_table;
    let sourceId = "";
    const counts = new Map();
    for (;;) {
      const [rows] = await connection.execute(
        `SELECT source_id,legacy_org_id,legacy_workspace_id
         FROM account_retirement_records FORCE INDEX (PRIMARY)
         WHERE run_id=? AND source_table=? AND source_id>? ORDER BY source_id LIMIT 2000${lock}`,
        [runId, sourceTable, sourceId],
      );
      if (!rows.length) break;
      for (const row of rows) {
        sourceId = row.source_id;
        const reason = scopeReasons.get(scopeKey(row));
        if (!reason) throw new Error("account_retirement_review_scope_missing");
        add(["record", sourceTable, sourceId, row.legacy_org_id, row.legacy_workspace_id]);
        counts.set(reason, (counts.get(reason) ?? 0n) + 1n);
      }
    }
    if (counts.size) byTable.set(sourceTable, counts);
  }
  const sourceFactRows = {};
  for (const [table, facts] of reviewedSourceFacts) {
    let after = "";
    let seen = 0n;
    for (;;) {
      const [rows] = await connection.execute(
        `SELECT r.source_id,SHA2(JSON_ARRAY(${facts}),256) facts_sha256
         FROM account_retirement_records r FORCE INDEX (PRIMARY)
         STRAIGHT_JOIN \`${table}\` s ON s.id=r.source_id
         WHERE r.run_id=? AND r.source_table=? AND r.source_id>?
           AND s.organization_id=r.legacy_org_id AND s.workspace_id=r.legacy_workspace_id
         ORDER BY r.source_id LIMIT 500${lock}`,
        [runId, table, after],
      );
      if (!rows.length) break;
      for (const row of rows) {
        if (
          typeof row.source_id !== "string" ||
          row.source_id.toLowerCase() <= after.toLowerCase() ||
          !/^[a-f0-9]{64}$/.test(row.facts_sha256 ?? "")
        )
          throw new Error("invalid_account_retirement_source_fingerprint");
        after = row.source_id;
        seen++;
        add(["source_facts", table, after, row.facts_sha256]);
      }
    }
    const staged = [...(byTable.get(table)?.values() ?? [])].reduce(
      (sum, count) => sum + count,
      0n,
    );
    if (seen !== staged)
      throw new Error(`account_retirement_review_source_coverage_mismatch:${table}`);
    sourceFactRows[table] = String(seen);
  }
  let followId = "",
    followCount = 0n;
  for (;;) {
    const [rows] = await connection.execute(
      `SELECT id,organization_id,workspace_id,topic_id,user_id,
      DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%f') created_at FROM trend_topic_follows
      WHERE id>? ORDER BY id LIMIT 500${lock}`,
      [followId],
    );
    if (!rows.length) break;
    for (const row of rows) {
      followId = row.id;
      add([
        "personal_follow",
        row.id,
        row.organization_id,
        row.workspace_id,
        row.topic_id,
        row.user_id,
        row.created_at,
      ]);
      followCount++;
    }
  }
  const summarize = (counts) =>
    Object.fromEntries(
      [...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)]),
    );
  return {
    review_sha256: hash.digest("hex"),
    scope_counts: summarize(reasons),
    record_counts_by_table_and_reason: Object.fromEntries(
      [...byTable].map(([table, counts]) => [table, summarize(counts)]),
    ),
    personal_trend_follows: String(followCount),
    source_fact_rows: sourceFactRows,
  };
}
