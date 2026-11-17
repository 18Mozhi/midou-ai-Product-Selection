import { pathToFileURL } from "node:url";
import { readAccountCostApprovalAudit } from "./lib/account-cost-approval-audit.mjs";
import { evidenceAccountScopeRelations } from "./lib/evidence-event-scope.mjs";
import { trendTopicHistoricalScopeRelation } from "./lib/trend-event-scope.mjs";
import { accountRehearsalTaskScope } from "./lib/account-rehearsal-task-scope.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import {
  assertAccountRehearsalTarget,
  accountScopeSourceNames,
  connectLocalAccountRehearsal,
} from "./stage-account-scope-retirement.mjs";

// These are complete-table backfills, unlike polymorphic shared delivery tables.
const domains = {
  selection: ["opportunities"],
  intelligence: ["trend_topics", "trend_signals"],
  competitors: ["competitors", "competitor_snapshots", "competitor_changes", "competitor_alerts"],
  quotes: ["supplier_quotes", "sourcing_comparisons", "exchange_rate_quotes"],
  evidence: ["raw_evidence", "browser_evidence_artifacts"],
  tasks: ["tasks", "collection_tasks"],
  rules: [
    "score_rules",
    "cost_rules",
    "trend_monitoring_rules",
    "competitor_monitor_rules",
    "automation_rules",
  ],
};
const coreTables = new Set(Object.values(domains).flat());
// The generic outbox is intentionally staged by event type, not as a whole table.
const supplementalTables = accountScopeSourceNames.filter(
  (table) => !coreTables.has(table) && table !== "outbox_events",
);
const primaryEmail = "2313645627@qq.com";
const textCount = (value) => BigInt(value).toString();

export async function verifyRetiredTenancySchema(connection) {
  const [[receipt]] = await connection.query(
    "SELECT COUNT(*) applied FROM schema_migrations WHERE name='0197_retire_tenancy_roots.up.sql'",
  );
  const [roots] = await connection.query(
    "SELECT TABLE_NAME table_name,TABLE_TYPE table_type FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() " +
      "AND TABLE_NAME IN ('organizations','workspaces','historical_organizations','historical_workspaces')",
  );
  const runtime = roots.filter((row) => ["organizations", "workspaces"].includes(row.table_name));
  const archive = roots.filter((row) =>
    ["historical_organizations", "historical_workspaces"].includes(row.table_name),
  );
  const applied = Number(receipt.applied) === 1;
  const basePair = (rows) =>
    rows.length === 2 && rows.every((row) => row.table_type === "BASE TABLE");
  const result = { runtime_roots: runtime.length, archived_roots: archive.length };
  if (!applied)
    return {
      ...result,
      status: basePair(runtime) && archive.length === 0 ? "not_applied" : "mismatch",
    };
  const [columns] = await connection.query(
    "SELECT TABLE_NAME table_name,COLUMN_NAME column_name FROM information_schema.COLUMNS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND COLUMN_NAME IN ('organization_id','workspace_id')",
  );
  const [references] = await connection.query(
    "SELECT TABLE_SCHEMA=DATABASE() local_schema,TABLE_NAME table_name,CONSTRAINT_NAME constraint_name," +
      "COLUMN_NAME column_name,REFERENCED_TABLE_NAME target_table,REFERENCED_COLUMN_NAME target_column " +
      "FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() " +
      "AND REFERENCED_TABLE_NAME IN ('organizations','workspaces','historical_organizations','historical_workspaces')",
  );
  const expected = new Set([
    "historical_organizations:fk_organizations_default_workspace:default_workspace_id:historical_workspaces:id",
    "historical_workspaces:fk_workspaces_org:organization_id:historical_organizations:id",
  ]);
  const unexpectedReferences = references.filter(
    (row) =>
      Number(row.local_schema) !== 1 ||
      !expected.delete(
        [
          row.table_name,
          row.constraint_name,
          row.column_name,
          row.target_table,
          row.target_column,
        ].join(":"),
      ),
  ).length;
  const archivedColumnOnly =
    columns.length === 1 &&
    columns[0].table_name === "historical_workspaces" &&
    columns[0].column_name === "organization_id";
  const retired =
    !runtime.length &&
    basePair(archive) &&
    archivedColumnOnly &&
    !unexpectedReferences &&
    !expected.size;
  return {
    ...result,
    status: retired ? "retired" : "mismatch",
    legacy_columns: columns.length,
    unexpected_references: unexpectedReferences,
    missing_archive_references: expected.size,
  };
}

// The comparison API expands saved IDs through the account ledger. Counting comparison
// rows alone cannot detect a missing quote or a quote hidden by the ownership filters.
export async function verifyAccountQuoteReferences(connection, runId) {
  const [comparisonColumns] = await connection.query(
    "SHOW COLUMNS FROM sourcing_comparisons WHERE Field IN ('anchor_quote_id','organization_id','workspace_id')",
  );
  const shape = comparisonColumns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape !== "anchor_quote_id" && shape !== "organization_id,workspace_id")
    throw new Error("sourcing_comparison_scope_shape_invalid");
  const anchored = shape === "anchor_quote_id";
  const task = await accountRehearsalTaskScope(connection);
  const evidence = await evidenceAccountScopeRelations(connection);
  const nativeEvidence = evidence.raw !== "raw_evidence";
  const [[quotes]] = await connection.execute(
    `SELECT COUNT(*) checked,COUNT(CASE WHEN c.id IS NULL OR s.id IS NULL
      OR e.id IS NULL OR ce.id IS NULL OR n.id IS NULL OR qo.account_id IS NULL
      OR co.account_id IS NULL OR so.account_id IS NULL OR eo.account_id IS NULL
      OR ceo.account_id IS NULL OR no.account_id IS NULL OR st.id IS NULL
      OR sto.account_id IS NULL THEN 1 END) invalid
    FROM account_retirement_records r
    JOIN supplier_quotes q ON q.id=r.source_id
    LEFT JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id
    LEFT JOIN sourcing_candidates c ON c.id=q.candidate_id
    LEFT JOIN sourcing_searches s ON s.id=c.search_id
    LEFT JOIN collection_tasks st ON st.id=s.collection_task_id${task.native ? " AND st.account_id=qo.account_id" : ""}
    LEFT JOIN account_owned_records sto ON sto.source_table='collection_tasks' AND sto.source_id=st.id AND sto.account_id=qo.account_id
    LEFT JOIN raw_evidence e ON e.id=q.evidence_id${nativeEvidence ? " AND e.account_id=qo.account_id" : ""}
    LEFT JOIN raw_evidence ce ON ce.id=c.raw_evidence_id AND ce.provider_id=c.provider_id${nativeEvidence ? " AND ce.account_id=qo.account_id" : ""}
    LEFT JOIN normalized_records n ON n.id=c.normalized_record_id AND n.raw_evidence_id=ce.id
      AND n.provider_id=ce.provider_id${nativeEvidence ? " AND n.account_id=qo.account_id" : ""}
    LEFT JOIN account_owned_records co ON co.source_table='sourcing_candidates' AND co.source_id=c.id AND co.account_id=qo.account_id
    LEFT JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=s.id AND so.account_id=qo.account_id
    LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id AND eo.account_id=qo.account_id
    LEFT JOIN account_owned_records ceo ON ceo.source_table='raw_evidence' AND ceo.source_id=ce.id AND ceo.account_id=qo.account_id
    LEFT JOIN account_owned_records no ON no.source_table='normalized_records' AND no.source_id=n.id AND no.account_id=qo.account_id
    WHERE r.run_id=? AND r.source_table='supplier_quotes'`,
    [runId],
  );
  const [[comparisons]] = await connection.execute(
    `SELECT COUNT(*) checked, COUNT(CASE WHEN checks.invalid<>0 THEN 1 END) invalid
     FROM (
       SELECT c.id, CASE WHEN co.account_id IS NULL OR JSON_TYPE(c.quote_ids_json)<>'ARRAY'
         OR JSON_LENGTH(c.quote_ids_json) NOT BETWEEN 2 AND 5
         ${anchored ? "OR NOT (c.anchor_quote_id <=> LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(c.quote_ids_json,'$[0]')) USING ascii)))" : ""}
         OR COUNT(DISTINCT CASE WHEN JSON_TYPE(JSON_EXTRACT(c.quote_ids_json,CONCAT('$[',pos.n,']')))='STRING'
           AND qo.account_id IS NOT NULL THEN q.id END)<>JSON_LENGTH(c.quote_ids_json)
         THEN 1 ELSE 0 END invalid
       FROM account_retirement_records r
       JOIN sourcing_comparisons c ON c.id=r.source_id
       LEFT JOIN account_owned_records co ON co.source_table='sourcing_comparisons' AND co.source_id=c.id
       LEFT JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) pos
         ON pos.n<JSON_LENGTH(c.quote_ids_json)
       LEFT JOIN supplier_quotes q ON q.id=LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(c.quote_ids_json,CONCAT('$[',pos.n,']'))) USING ascii))
       LEFT JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id AND qo.account_id=co.account_id
       WHERE r.run_id=? AND r.source_table='sourcing_comparisons'
       GROUP BY c.id,c.quote_ids_json,co.account_id${anchored ? ",c.anchor_quote_id" : ""}
     ) checks`,
    [runId],
  );
  return {
    supplier_quotes: { checked: textCount(quotes.checked), invalid: textCount(quotes.invalid) },
    sourcing_comparisons: {
      checked: textCount(comparisons.checked),
      invalid: textCount(comparisons.invalid),
    },
  };
}

// A retained FX quote is not necessarily usable for a new calculation: its source
// evidence can belong to a different account. Report that separately from preservation.
export async function inspectAccountFxEvidence(connection, runId) {
  const [[rows]] = await connection.execute(
    `SELECT COUNT(*) checked,
       COUNT(CASE WHEN e.id IS NULL THEN 1 END) missing_evidence,
       COUNT(CASE WHEN e.id IS NOT NULL AND e.provider_id<>q.provider_id THEN 1 END) provider_mismatch,
       COUNT(CASE WHEN e.id IS NOT NULL AND e.provider_id=q.provider_id AND eo.account_id IS NULL THEN 1 END) inaccessible_evidence
     FROM account_retirement_records r
     JOIN exchange_rate_quotes q ON q.id=r.source_id
     LEFT JOIN account_owned_records qo ON qo.source_table='exchange_rate_quotes' AND qo.source_id=q.id
     LEFT JOIN raw_evidence e ON e.id=q.evidence_id
     LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id AND eo.account_id=qo.account_id
     WHERE r.run_id=? AND r.source_table='exchange_rate_quotes'`,
    [runId],
  );
  return Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, textCount(value)]));
}

export async function verifyNativeEvidenceOwnership(connection, runId, task) {
  const scope = await evidenceAccountScopeRelations(connection);
  if (scope.raw === "raw_evidence") return { layout: "legacy" };
  task ??= await accountRehearsalTaskScope(connection);
  const sourceTaskAccount = (alias) => (task.native ? ` AND ${alias}.account_id=x.account_id` : "");
  const result = { layout: "account" };
  for (const [table, parentChecks] of [
    [
      "raw_evidence",
      `LEFT JOIN ${task.relation} p ON p.id=x.collection_task_id${sourceTaskAccount("p")}
      LEFT JOIN collection_subqueries q ON q.id=x.collection_subquery_id AND q.task_id=p.id AND q.provider_id=x.provider_id
      LEFT JOIN account_owned_records po ON po.source_table='collection_tasks' AND po.source_id=p.id AND po.account_id=x.account_id
      LEFT JOIN account_owned_records fo ON fo.source_table='file_assets' AND fo.source_id=x.file_asset_id AND fo.account_id=x.account_id`,
    ],
    [
      "normalized_records",
      `LEFT JOIN raw_evidence p ON p.id=x.raw_evidence_id AND p.provider_id=x.provider_id AND p.account_id=x.account_id AND p.history_chain=x.history_chain
      LEFT JOIN ${task.relation} t ON t.id=p.collection_task_id${sourceTaskAccount("t")}
      LEFT JOIN account_owned_records po ON po.source_table='raw_evidence' AND po.source_id=p.id AND po.account_id=x.account_id`,
    ],
  ]) {
    const raw = table === "raw_evidence";
    const coordinate = raw ? "p" : "t";
    const invalidParent = raw ? "q.id IS NULL OR fo.source_id IS NULL" : "t.id IS NULL";
    const [[rows]] = await connection.execute(
      `SELECT COUNT(*) checked,
      COUNT(CASE WHEN o.source_id IS NULL OR r.source_id IS NULL OR po.source_id IS NULL OR ${invalidParent}
        OR NOT (${coordinate}.organization_id <=> r.legacy_org_id AND ${coordinate}.workspace_id <=> r.legacy_workspace_id)
        OR NOT (x.history_chain <=> UNHEX(SHA2(CONCAT('scoutops:evidence-history:v1:',r.legacy_org_id,':',r.legacy_workspace_id),256)))
        THEN 1 END) invalid
      FROM ${table} x
      LEFT JOIN account_owned_records o ON o.source_table='${table}' AND o.source_id=x.id AND o.account_id=x.account_id
      LEFT JOIN account_retirement_records r ON r.run_id=? AND r.source_table='${table}' AND r.source_id=x.id
      ${parentChecks}`,
      [runId],
    );
    result[table] = { checked: textCount(rows.checked), invalid: textCount(rows.invalid) };
  }
  return result;
}

export async function verifyNativeCollectionTaskOwnership(connection, runId, task) {
  if (!task.native) return { layout: "legacy" };
  return verifyNativeTaskTable(connection, runId, "collection_tasks");
}

export async function verifyNativeBusinessTaskOwnership(connection, runId) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM tasks WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return { layout: "legacy" };
  if (shape !== "account_id") throw new Error("invalid_business_task_scope_schema");
  return verifyNativeTaskTable(connection, runId, "tasks");
}

export async function verifyNativeCompetitorOwnership(connection, runId) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM competitors WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return { layout: "legacy" };
  if (shape !== "account_id") throw new Error("invalid_competitor_scope_schema");
  const { checked, invalid } = await verifyNativeTaskTable(connection, runId, "competitors");
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) invalid_references
    FROM competitors c
    LEFT JOIN account_owned_records p ON p.source_table='opportunities' AND p.source_id=c.opportunity_id
    LEFT JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id AND s.competitor_id=c.id
    LEFT JOIN account_owned_records o ON o.source_table='competitor_snapshots' AND o.source_id=s.id
    WHERE (c.opportunity_id IS NOT NULL AND NOT(c.account_id<=>p.account_id))
       OR (c.latest_snapshot_id IS NOT NULL AND (s.id IS NULL OR NOT(c.account_id<=>o.account_id)))`,
    [],
  );
  return {
    layout: "account",
    checked,
    invalid,
    invalid_references: textCount(row.invalid_references),
  };
}

export async function verifyNativeOpportunityOwnership(connection, runId) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM opportunities WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id") return { layout: "legacy" };
  if (shape !== "account_id") throw new Error("invalid_opportunity_scope_schema");
  if ((await trendTopicHistoricalScopeRelation(connection)) === "trend_topics")
    throw new Error("opportunity_topic_scope_schema_invalid");
  const { checked, invalid } = await verifyNativeTaskTable(connection, runId, "opportunities");
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) invalid_references
    FROM opportunities p
    LEFT JOIN trend_topics t ON t.id=p.source_ref_id
    LEFT JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id
    WHERE p.source_type='trend_topic' AND (t.id IS NULL OR
      NOT(p.account_id<=>t.account_id AND p.account_id<=>o.account_id))`,
    [],
  );
  return {
    layout: "account",
    checked,
    invalid,
    invalid_references: textCount(row.invalid_references),
  };
}

async function verifyNativeTaskTable(connection, runId, table) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) task_checked,
    COUNT(CASE WHEN r.source_id IS NULL OR s.account_id IS NULL OR o.source_id IS NULL
      OR NOT(t.account_id<=>s.account_id AND o.reason<=>s.reason) THEN 1 END) invalid
    FROM ${table} t
    LEFT JOIN account_owned_records o ON o.source_table='${table}' AND o.source_id=t.id AND o.account_id=t.account_id
    LEFT JOIN account_retirement_records r ON r.run_id=? AND r.source_table='${table}' AND r.source_id=t.id
    LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id`,
    [runId],
  );
  return {
    layout: "account",
    checked: textCount(row.task_checked),
    invalid: textCount(row.invalid),
  };
}

export async function verifyNativeTrendTopicOwnership(connection, runId) {
  if ((await trendTopicHistoricalScopeRelation(connection)) === "trend_topics")
    return { layout: "legacy" };
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) topic_checked,
    COUNT(CASE WHEN o.source_id IS NULL OR r.source_id IS NULL OR s.account_id IS NULL
      OR NOT(t.account_id<=>s.account_id AND o.reason<=>s.reason) THEN 1 END) invalid
    FROM trend_topics t
    LEFT JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id AND o.account_id=t.account_id
    LEFT JOIN account_retirement_records r ON r.run_id=? AND r.source_table='trend_topics' AND r.source_id=t.id
    LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id`,
    [runId],
  );
  return {
    layout: "account",
    checked: textCount(row.topic_checked),
    invalid: textCount(row.invalid),
  };
}

// A complete ledger cannot by itself prove that a historical signature still
// points to an original rule in the correct account. Do not compare the actor
// to the new primary: a migrated signature retains its original signer.
export async function verifyCostApprovalOwnership(connection, runId, nativeRule) {
  const [[row]] = await connection.execute(
    `SELECT COUNT(*) approval_checked,
    COUNT(CASE WHEN p.id IS NULL OR ar.source_id IS NULL OR pr.source_id IS NULL
      OR asrc.source_id IS NULL OR psrc.source_id IS NULL
      OR NOT (ar.account_id<=>pr.account_id AND ar.reason<=>pr.reason)
      OR NOT (asrc.legacy_org_id<=>psrc.legacy_org_id AND asrc.legacy_workspace_id<=>psrc.legacy_workspace_id)
      ${nativeRule ? "OR NOT (p.account_id<=>pr.account_id)" : ""} THEN 1 END) invalid
    FROM cost_rule_approvals a
    LEFT JOIN cost_rules p ON p.id=a.cost_rule_id
    LEFT JOIN account_retirement_records asrc ON asrc.run_id=? AND asrc.source_table='cost_rule_approvals' AND asrc.source_id=a.id
    LEFT JOIN account_retirement_records psrc ON psrc.run_id=asrc.run_id AND psrc.source_table='cost_rules' AND psrc.source_id=p.id
    LEFT JOIN account_owned_records ar ON ar.source_table='cost_rule_approvals' AND ar.source_id=a.id
    LEFT JOIN account_owned_records pr ON pr.source_table='cost_rules' AND pr.source_id=p.id`,
    [runId],
  );
  return { checked: textCount(row.approval_checked), invalid: textCount(row.invalid) };
}

async function verifyRetiredRuleOwnership(connection, runId) {
  const result = {};
  for (const table of domains.rules) {
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','historical_context','organization_id','workspace_id')`,
    );
    const shape = columns
      .map(({ Field }) => Field)
      .sort()
      .join(",");
    if (
      shape === "organization_id,workspace_id" ||
      (table === "trend_monitoring_rules" && shape === "account_id,organization_id,workspace_id")
    ) {
      result[table] = { layout: "legacy" };
      continue;
    }
    // Competitor rules read ownership from the ledger; the other rule tables carry
    // a native account once their original coordinates have been retired.
    const native = table !== "competitor_monitor_rules";
    if (shape !== (native ? "account_id,historical_context" : "historical_context"))
      throw new Error("invalid_rule_scope_schema");
    const [[row]] = await connection.execute(
      `SELECT COUNT(*) rule_checked,COUNT(CASE WHEN r.source_id IS NULL OR o.source_id IS NULL
        OR NOT (BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.organization_id')) <=> BINARY r.legacy_org_id
            AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.historical_context,'$.workspace_id')) <=> BINARY r.legacy_workspace_id)
        ${native ? " OR NOT(q.account_id<=>o.account_id)" : ""} THEN 1 END) invalid
      FROM ${table} q
      LEFT JOIN account_retirement_records r ON r.run_id=? AND r.source_table=? AND r.source_id=q.id
      LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id
        AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
      LEFT JOIN account_owned_records o ON o.source_table=r.source_table AND o.source_id=r.source_id
        AND o.account_id=s.account_id AND o.reason=s.reason`,
      [runId, table],
    );
    result[table] = {
      layout: native ? "account" : "ledger",
      checked: textCount(row.rule_checked),
      invalid: textCount(row.invalid),
    };
  }
  return result;
}

export async function verifyAccountRetirementOwnership(connection, expectedRunId) {
  await assertAccountRehearsalTarget(connection);
  return readOwnershipOnBoundTarget(connection, expectedRunId);
}

export async function verifyAccountProductionOwnership(connection, expectedRunId) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(expectedRunId ?? ""))
    throw new Error("account_release_expected_run_required");
  await assertAccountProductionTarget(connection);
  await assertAccountProductionFence(
    connection,
    "account_release_ownership_requires_stopped_writers",
  );
  const result = await readOwnershipOnBoundTarget(connection, expectedRunId);
  await assertAccountProductionFence(
    connection,
    "account_release_ownership_requires_stopped_writers",
  );
  return result;
}

async function readOwnershipOnBoundTarget(connection, expectedRunId) {
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    const [[receipt]] = await connection.execute(
      `SELECT c.source_run_id,c.primary_account_id,c.source_record_count
       FROM account_ownership_cutover c
       JOIN account_retirement_runs r ON r.id=c.source_run_id AND r.primary_account_id=c.primary_account_id
       JOIN users u ON u.id=c.primary_account_id
       WHERE c.slot='current' AND c.contract_version=25 AND u.status='active'
       AND u.email_verified_at IS NOT NULL AND BINARY u.email_normalized=BINARY ?`,
      [primaryEmail],
    );
    if (!receipt || (expectedRunId !== undefined && receipt.source_run_id !== expectedRunId))
      return { status: "blocked", reason: "account_ownership_receipt_not_verified" };
    const runId = receipt.source_run_id;
    const tenancySchema = await verifyRetiredTenancySchema(connection);
    const [[coverage]] = await connection.execute(
      `SELECT COUNT(*) staged,
         (SELECT COUNT(*) FROM account_owned_records) ledger_total,
         COUNT(CASE WHEN s.reason='shared' THEN 1 END) shared,
         COUNT(CASE WHEN s.reason='unassigned' THEN 1 END) unassigned,
         COUNT(CASE WHEN s.reason='exclusive_owner' THEN 1 END) exclusive,
         COUNT(CASE WHEN s.account_id IS NULL OR o.source_id IS NULL THEN 1 END) invalid,
         COUNT(CASE WHEN s.reason IN ('shared','unassigned') AND s.account_id<>? THEN 1 END) wrong_primary
       FROM account_retirement_records r
       LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id
         AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
       LEFT JOIN account_owned_records o ON o.source_table=r.source_table AND o.source_id=r.source_id
         AND o.account_id=s.account_id AND o.reason=s.reason
       WHERE r.run_id=?`,
      [receipt.primary_account_id, runId],
    );
    const extraLedger =
      BigInt(coverage.ledger_total) - (BigInt(coverage.staged) - BigInt(coverage.invalid));
    let ok =
      tenancySchema.status !== "mismatch" &&
      BigInt(coverage.staged) === BigInt(receipt.source_record_count) &&
      extraLedger === 0n &&
      BigInt(coverage.invalid) === 0n &&
      BigInt(coverage.wrong_primary) === 0n;
    const result = {};
    for (const [domain, tables] of [
      ...Object.entries(domains),
      ["supplemental", supplementalTables],
    ]) {
      const verified = {};
      for (const table of tables) {
        // Table identifiers are exclusively literals in the complete-table manifest above.
        const [[row]] = await connection.execute(
          `SELECT
             (SELECT COUNT(*) FROM \`${table}\`) source_rows,
             COUNT(*) staged_rows,
             COUNT(CASE WHEN live.id IS NULL THEN 1 END) missing_original,
             COUNT(CASE WHEN s.reason='shared' THEN 1 END) shared,
             COUNT(CASE WHEN s.reason='unassigned' THEN 1 END) unassigned,
             COUNT(CASE WHEN s.reason='exclusive_owner' THEN 1 END) exclusive
           FROM account_retirement_records r
           LEFT JOIN \`${table}\` live ON live.id=r.source_id
           LEFT JOIN account_retirement_scopes s ON s.run_id=r.run_id
             AND s.legacy_org_id=r.legacy_org_id AND s.legacy_workspace_id=r.legacy_workspace_id
           WHERE r.run_id=? AND r.source_table=?`,
          [runId, table],
        );
        if (
          BigInt(row.source_rows) !== BigInt(row.staged_rows) ||
          BigInt(row.missing_original) !== 0n
        )
          ok = false;
        verified[table] = Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, textCount(value)]),
        );
      }
      result[domain] = verified;
    }
    const { supplemental, ...verifiedDomains } = result;
    const taskScope = await accountRehearsalTaskScope(connection);
    const nativeTasks = await verifyNativeCollectionTaskOwnership(connection, runId, taskScope);
    if (
      nativeTasks.layout === "account" &&
      (nativeTasks.invalid !== "0" ||
        nativeTasks.checked !== verifiedDomains.tasks.collection_tasks.source_rows)
    )
      ok = false;
    const nativeBusinessTasks = await verifyNativeBusinessTaskOwnership(connection, runId);
    if (
      nativeBusinessTasks.layout === "account" &&
      (nativeBusinessTasks.invalid !== "0" ||
        nativeBusinessTasks.checked !== verifiedDomains.tasks.tasks.source_rows)
    )
      ok = false;
    const nativeCompetitors = await verifyNativeCompetitorOwnership(connection, runId);
    if (
      nativeCompetitors.layout === "account" &&
      (nativeCompetitors.invalid !== "0" ||
        nativeCompetitors.invalid_references !== "0" ||
        nativeCompetitors.checked !== verifiedDomains.competitors.competitors.source_rows)
    )
      ok = false;
    const nativeOpportunities = await verifyNativeOpportunityOwnership(connection, runId);
    if (
      nativeOpportunities.layout === "account" &&
      (nativeOpportunities.invalid !== "0" ||
        nativeOpportunities.invalid_references !== "0" ||
        nativeOpportunities.checked !== verifiedDomains.selection.opportunities.source_rows)
    )
      ok = false;
    const nativeEvidence = await verifyNativeEvidenceOwnership(connection, runId, taskScope);
    const nativeTopics = await verifyNativeTrendTopicOwnership(connection, runId);
    const ruleOwnership = await verifyRetiredRuleOwnership(connection, runId);
    const approvalOwnership = await verifyCostApprovalOwnership(
      connection,
      runId,
      ruleOwnership.cost_rules.layout === "account",
    );
    if (
      approvalOwnership.invalid !== "0" ||
      approvalOwnership.checked !== supplemental.cost_rule_approvals.source_rows
    )
      ok = false;
    for (const [table, rule] of Object.entries(ruleOwnership))
      if (
        rule.layout !== "legacy" &&
        (rule.invalid !== "0" || rule.checked !== verifiedDomains.rules[table].source_rows)
      )
        ok = false;
    if (
      nativeTopics.layout === "account" &&
      (nativeTopics.invalid !== "0" ||
        nativeTopics.checked !== verifiedDomains.intelligence.trend_topics.source_rows)
    )
      ok = false;
    if (nativeEvidence.layout === "account") {
      for (const [table, source] of Object.entries({
        raw_evidence: verifiedDomains.evidence.raw_evidence,
        normalized_records: supplemental.normalized_records,
      })) {
        if (
          nativeEvidence[table].invalid !== "0" ||
          nativeEvidence[table].checked !== source.source_rows
        )
          ok = false;
      }
    }
    const quoteReferences = await verifyAccountQuoteReferences(connection, runId);
    const fxEvidence = await inspectAccountFxEvidence(connection, runId);
    if (fxEvidence.checked !== verifiedDomains.quotes.exchange_rate_quotes.source_rows) ok = false;
    for (const [table, check] of Object.entries(quoteReferences))
      if (check.invalid !== "0" || check.checked !== verifiedDomains.quotes[table].source_rows)
        ok = false;
    // An empty source is valid preservation, not proof that a record survived migration.
    // Keep this separate from the ownership gate and from FX evidence usability.
    const quoteCoverage = Object.fromEntries(
      Object.entries(verifiedDomains.quotes).map(([table, source]) => {
        const check = table === "exchange_rate_quotes" ? fxEvidence : quoteReferences[table];
        const matches =
          source.source_rows === source.staged_rows &&
          source.missing_original === "0" &&
          source.source_rows === check.checked &&
          (check.invalid ?? "0") === "0";
        return [
          table,
          {
            source_rows: source.source_rows,
            checked_rows: check.checked,
            status: !matches
              ? "mismatch"
              : source.source_rows === "0"
                ? "no_historical_rows"
                : "historical_rows_checked",
          },
        ];
      }),
    );
    const [[selectiveOutbox]] = await connection.execute(
      `SELECT COUNT(*) staged_rows,COUNT(CASE WHEN live.id IS NULL THEN 1 END) missing_original
       FROM account_retirement_records r LEFT JOIN outbox_events live ON live.id=r.source_id
       WHERE r.run_id=? AND r.source_table='outbox_events'`,
      [runId],
    );
    if (BigInt(selectiveOutbox.missing_original) !== 0n) ok = false;
    return {
      status: ok ? "ownership_verified" : "blocked",
      receipt_count: textCount(receipt.source_record_count),
      sealed_count: textCount(coverage.staged),
      ledger_count: textCount(coverage.ledger_total),
      unmatched_ledger_rows: textCount(extraLedger),
      ownership_reasons: {
        shared: textCount(coverage.shared),
        unassigned: textCount(coverage.unassigned),
        exclusive: textCount(coverage.exclusive),
      },
      invalid_ledger_rows: textCount(coverage.invalid),
      wrong_primary_rows: textCount(coverage.wrong_primary),
      tenancy_schema: tenancySchema,
      domains: verifiedDomains,
      quote_references: quoteReferences,
      quote_coverage: quoteCoverage,
      fx_evidence: fxEvidence,
      evidence_ownership: nativeEvidence,
      collection_task_ownership: nativeTasks,
      business_task_ownership: nativeBusinessTasks,
      competitor_ownership: nativeCompetitors,
      opportunity_ownership: nativeOpportunities,
      trend_topic_ownership: nativeTopics,
      rule_ownership: ruleOwnership,
      cost_approval_ownership: approvalOwnership,
      cost_approval_audit: await readAccountCostApprovalAudit(connection),
      supplemental_tables: supplemental,
      selective_outbox: Object.fromEntries(
        Object.entries(selectiveOutbox).map(([key, value]) => [key, textCount(value)]),
      ),
    };
  } finally {
    await connection.rollback();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  (async () => {
    if (process.argv.length !== 2) throw new Error("unexpected_arguments");
    const connection = await connectLocalAccountRehearsal();
    try {
      const result = await verifyAccountRetirementOwnership(connection);
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "ownership_verified") process.exitCode = 2;
    } finally {
      await connection.end();
    }
  })().catch((error) => {
    console.error(
      error.code ?? (/^[a-z0-9_]+$/.test(error.message) ? error.message : "ownership_audit_failed"),
    );
    process.exitCode = 1;
  });
}
