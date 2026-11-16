import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { splitSqlStatements } from "./apply-deployment-migrations.mjs";
import { assertAccountProductionFence, assertAccountProductionTarget } from "./lib/account-production-fence.mjs";
import {
  accountScopeInheritedSources,
  accountScopeDerivedApprovalSources,
  accountScopeDerivedCollectionEvidenceSources,
  accountScopeDerivedCompetitorSources,
  accountScopeDerivedDecisionSources,
  accountScopeDerivedOpportunitySources,
  accountScopeDerivedJourneySources,
  accountScopeDerivedQuoteSources,
  accountScopeOptionalInheritedSources,
  accountScopeSources,
  assertAccountRehearsalTarget,
  connectLocalAccountRehearsal,
} from "./stage-account-scope-retirement.mjs";

export const accountRehearsalSchemaMigrations = Object.freeze(
  [
    [
      "0077_account_scope_retirement_staging.up.sql",
      "3ec6bb7e9ead876c23a725e7ba723f1f882a4d959d0fdbe6b071b9b95b7249da",
      ["account_retirement_runs", "account_retirement_scopes", "account_retirement_records"],
    ],
    [
      "0078_account_owned_records.up.sql",
      "7714ff18cb9e9652f8efb03bc48759dac6cf6ffadee342fc3641c4ad54aa38f7",
      ["account_ownership_cutover", "account_owned_records"],
    ],
    [
      "0079_account_trend_topic_follows.up.sql",
      "c72cf491f3ca239356cbc1138557b78ac2a8f398f11ec2729abf4e4ef05df80f",
      ["account_trend_topic_follows"],
    ],
  ].map(([name, sha256, tables]) => Object.freeze({ name, sha256, tables: Object.freeze(tables) })),
);

const lock = "CONCAT('scoutops-acct-schema:',LEFT(SHA2(DATABASE(),256),32))";
const names = accountRehearsalSchemaMigrations.map(({ name }) => name);
const scoped = ["id", "organization_id", "workspace_id"];
const sources = {
  schema_migrations: ["name", "checksum", "applied_at"],
  users: ["id", "email_normalized", "email_verified_at", "status"],
  organizations: ["id", "created_by", "slug"],
  workspaces: ["id", "organization_id"],
  memberships: ["organization_id", "user_id"],
  trend_topic_follows: [...scoped, "topic_id", "user_id", "created_at"],
  ...Object.fromEntries(
    Object.entries(accountScopeSources).map(([table, edges]) => [
      table,
      [
        ...new Set([
          ...scoped,
          ...edges.flatMap(([column, , discriminator]) => [column, discriminator].filter(Boolean)),
          ...(["competitor_snapshots", "competitor_changes"].includes(table)
            ? ["evidence_id"]
            : []),
          ...(["normalized_records", "raw_evidence", "sourcing_candidates"].includes(table)
            ? ["provider_id"]
            : []),
          ...(table === "normalized_records"
            ? ["record_key", "record_version", "schema_version", "payload_json"]
            : []),
          ...(table === "raw_evidence" ? ["content_sha256", "size_bytes"] : []),
          ...(table === "trend_topics" ? ["topic_key"] : []),
          ...(table === "approval_templates" ? ["resource_type"] : []),
          ...(["approval_template_nodes", "approval_node_runs"].includes(table) ? ["ordinal"] : []),
        ]),
      ],
    ]),
  ),
  competitor_outbox: ["id", "aggregate_id", "event_type", "payload_json"],
  outbox_events: [
    ...scoped,
    "event_type",
    "schema_version",
    "payload_json",
    "request_id",
    "trace_id",
  ],
  tasks: [...scoped, "collection_task_id", "source_type", "source_ref_id"],
  browser_evidence_artifacts: [
    "id",
    "collection_task_id",
    "collection_subquery_id",
    "file_asset_id",
    "browser_job_id",
    "provider_id",
    "status",
    "size_bytes",
    "content_sha256",
  ],
  browser_collection_jobs: ["id", "collection_task_id", "collection_subquery_id", "provider_id"],
  evidence_data_events: [
    "id",
    "event_type",
    "resource_type",
    "resource_id",
    "request_id",
    "trace_id",
  ],
  evidence_data_outbox: [
    "id",
    "event_type",
    "resource_type",
    "resource_id",
    "request_id",
    "trace_id",
  ],
  trend_events: ["id", "event_type", "resource_type", "resource_id", "request_id", "trace_id"],
  trend_outbox: ["id", "event_type", "resource_type", "resource_id", "request_id", "trace_id"],
  trend_topic_change_requests: [
    "id",
    "operation",
    "target_topic_id",
    "result_topic_id",
    "source_topic_ids_json",
    "signal_ids_json",
  ],
  opportunity_events: [
    "id",
    "event_type",
    "resource_type",
    "resource_id",
    "request_id",
    "trace_id",
  ],
  opportunity_outbox: [
    "id",
    "event_type",
    "resource_type",
    "resource_id",
    "request_id",
    "trace_id",
  ],
  ...Object.fromEntries(
    Object.entries({
      ...accountScopeInheritedSources,
      ...accountScopeOptionalInheritedSources,
    }).map(([table, [column]]) => [table, ["id", column]]),
  ),
  trend_signals: ["id", "topic_id", "normalized_record_id", "raw_evidence_id", "provider_id"],
  task_events: ["id", "task_id", "event_type", "request_id", "trace_id"],
  approval_template_nodes: ["id", "template_version_id", "ordinal"],
  approval_template_versions: ["id", "template_id"],
  approval_requests: ["id", "template_id", "template_version_id", "resource_type", "resource_id"],
  approval_node_runs: ["id", "approval_request_id", "template_node_id", "ordinal"],
  approval_actions: ["id", "approval_request_id", "node_run_id"],
  approval_escalation_jobs: ["id", "approval_request_id", "node_run_id"],
  collection_task_evidence_links: [
    "id",
    "collection_task_id",
    "collection_subquery_id",
    "raw_evidence_id",
    "normalized_record_id",
    "provider_id",
  ],
  field_provenance: ["id", "normalized_record_id", "raw_evidence_id"],
  supplier_quotes: ["id", "candidate_id", "evidence_id"],
  sourcing_purchase_tasks: ["id", "quote_id"],
  sourcing_candidates: [
    "id",
    "search_id",
    "provider_id",
    "normalized_record_id",
    "raw_evidence_id",
  ],
  sourcing_comparisons: ["id", "quote_ids_json"],
  sourcing_outbox: ["id", "event_type", "resource_id", "payload_json"],
  sourcing_events: ["id", "event_type", "resource_id", "payload_json"],
  automation_executions: [
    "id",
    "rule_id",
    "notification_id",
    "action_resource_id",
    "action_resource_type",
  ],
  competitor_events: ["id", "competitor_id", "event_type"],
  notifications: ["id", "organization_id", "workspace_id"],
  competitor_snapshots: ["id", "competitor_id", "evidence_id"],
  competitor_snapshot_jobs: ["id", "competitor_id", "snapshot_id"],
  competitor_changes: ["id", "competitor_id", "snapshot_id", "evidence_id"],
  competitor_alerts: ["id", "competitor_id", "change_id", "rule_id"],
  opportunity_decisions: ["id", "opportunity_id"],
  opportunity_score_jobs: ["id", "opportunity_id", "score_rule_id", "trigger_task_id"],
  opportunity_profit_jobs: ["id", "opportunity_id", "cost_rule_id"],
  opportunity_score_runs: ["id", "opportunity_id", "score_rule_id"],
  opportunity_profit_runs: ["id", "opportunity_id", "cost_rule_id"],
  opportunity_cost_inputs: ["id", "opportunity_id"],
  opportunity_cost_input_reviews: ["id", "opportunity_id", "cost_input_id"],
  opportunity_evidence_links: [
    "id",
    "opportunity_id",
    "raw_evidence_id",
    "evidence_id",
    "evidence_type",
  ],
  opportunity_rule_matches: ["id", "opportunity_id", "monitoring_rule_id", "topic_id"],
  selection_journey_decisions: ["id", "journey_id", "opportunity_id", "selected_raw_evidence_id"],
  selection_journey_events: ["id", "journey_id"],
  selection_journey_outbox: ["id", "journey_id"],
};

async function pinnedSql({ name, sha256, tables }) {
  const sql = (
    await readFile(new URL(`../database/migrations/${name}`, import.meta.url), "utf8")
  ).replaceAll("\r\n", "\n");
  if (createHash("sha256").update(sql).digest("hex") !== sha256)
    throw new Error("account_rehearsal_migration_file_changed");
  const statements = splitSqlStatements(sql);
  if (
    statements.length !== tables.length ||
    statements.some((sql, i) => !sql.startsWith(`CREATE TABLE ${tables[i]} (`))
  )
    throw new Error("account_rehearsal_migration_statement_mismatch");
  return statements;
}

async function inspect(connection) {
  const [rows] =
    await connection.query(`SELECT t.TABLE_NAME table_name,t.ENGINE engine,c.COLUMN_NAME column_name
    FROM information_schema.TABLES t JOIN information_schema.COLUMNS c
      ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME
    WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE'`);
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.table_name))
      tables.set(row.table_name, { engine: row.engine, columns: new Set() });
    tables.get(row.table_name).columns.add(row.column_name);
  }
  const missing = [];
  for (const [name, columns] of Object.entries(sources)) {
    const table = tables.get(name);
    if (table?.engine !== "InnoDB")
      missing.push({ table: name, reason: table ? "not_innodb" : "missing_table" });
    else
      for (const column of columns)
        if (!table.columns.has(column))
          missing.push({ table: name, column, reason: "missing_column" });
  }
  for (const table of [
    ...Object.keys(accountScopeOptionalInheritedSources),
    ...Object.keys(accountScopeDerivedApprovalSources),
    ...accountScopeDerivedQuoteSources,
    ...accountScopeDerivedCompetitorSources,
    ...accountScopeDerivedDecisionSources,
    ...accountScopeDerivedOpportunitySources,
    ...accountScopeDerivedJourneySources,
    ...Object.keys(accountScopeDerivedCollectionEvidenceSources),
    "browser_collection_jobs",
    "trend_signals",
    "automation_executions",
    "competitor_events",
    "competitor_outbox",
    "trend_events",
    "trend_outbox",
    "trend_topic_change_requests",
    "sourcing_outbox",
    "sourcing_events",
    "evidence_data_events",
    "evidence_data_outbox",
    "opportunity_events",
  ]) {
    const columns = tables.get(table)?.columns;
    if (columns && columns.has("organization_id") !== columns.has("workspace_id"))
      missing.push({ table, reason: "partial_scope_schema" });
  }
  const opportunityOutbox = tables.get("opportunity_outbox")?.columns;
  if (opportunityOutbox) {
    const shape = ["event_id", "organization_id", "workspace_id"]
      .filter((column) => opportunityOutbox.has(column))
      .join(",");
    if (!["event_id", "organization_id,workspace_id"].includes(shape))
      missing.push({ table: "opportunity_outbox", reason: "partial_scope_schema" });
  }
  const comparisons = tables.get("sourcing_comparisons")?.columns;
  if (comparisons) {
    const shape = ["anchor_quote_id", "organization_id", "workspace_id"]
      .filter((column) => comparisons.has(column))
      .join(",");
    if (!["anchor_quote_id", "organization_id,workspace_id"].includes(shape))
      missing.push({ table: "sourcing_comparisons", reason: "partial_scope_schema" });
  }
  return { tables, missing };
}

// Production legacy preflight only. Never dispatches through the rehearsal writer.
export async function inspectAccountProductionLegacySchema(connection) {
  await assertAccountProductionTarget(connection);
  const { tables, missing } = await inspect(connection);
  const destinationTables = accountRehearsalSchemaMigrations.flatMap((entry) => entry.tables);
  const existing = destinationTables.filter((name) => tables.has(name));
  if (missing.length)
    return {
      status: "source_schema_incompatible",
      missing,
      existing_targets: existing,
      executable: false,
    };
  const [rows] = await connection.query(
    "SELECT name FROM schema_migrations WHERE name IN (?) ORDER BY BINARY name",
    [names],
  );
  return {
    status:
      existing.length || rows.length
        ? "account_schema_present_needs_exact_prefix_check"
        : "legacy_schema_confirmed",
    required_tables: Object.keys(sources).length,
    existing_targets: existing,
    recorded_prerequisites: rows.map(({ name }) => name),
    executable: false,
  };
}

export async function prepareAccountRetirementSchema(connection, { apply = false } = {}) {
  if (typeof apply !== "boolean") throw new Error("invalid_schema_prepare_mode");
  await assertAccountRehearsalTarget(connection);
  return prepareAccountSchemaOnBoundTarget(connection, apply);
}

// This phase creates only the six retirement-ledger tables. The caller must
// hold the coordinated release lock on this exact connection, after stopping
// the BaoTa writers. This is not an independent production CLI.
export async function prepareAccountProductionPrerequisites(connection, compiled) {
  await assertAccountProductionTarget(connection);
  const prerequisites = compiled?.prerequisites;
  if (
    compiled?.plan?.target_database !== "product_scout" ||
    compiled.plan.source_contract_version !== 25 ||
    !Array.isArray(prerequisites) ||
    prerequisites.length !== accountRehearsalSchemaMigrations.length
  )
    throw new Error("account_release_prerequisites_plan_invalid");
  for (const [i, expected] of accountRehearsalSchemaMigrations.entries()) {
    const candidate = prerequisites[i];
    const pinned = await pinnedSql(expected);
    if (
      candidate?.metadata?.name !== expected.name ||
      candidate.metadata.candidate_sha256 !== expected.sha256 ||
      candidate.metadata.retargeted !== false ||
      !Array.isArray(candidate.statements) ||
      candidate.statements.length !== pinned.length ||
      candidate.statements.some((sql, index) => sql !== pinned[index])
    )
      throw new Error("account_release_prerequisites_plan_invalid");
  }
  const assertFenced = () =>
    assertAccountProductionFence(connection, "account_release_prerequisites_not_fenced");
  await assertFenced();
  return prepareAccountSchemaOnBoundTarget(connection, true, assertFenced);
}

async function prepareAccountSchemaOnBoundTarget(connection, apply, assertFenced) {
  const ddl = await Promise.all(accountRehearsalSchemaMigrations.map(pinnedSql));
  const targetShape = new Map(
    accountRehearsalSchemaMigrations.flatMap(({ tables }, i) =>
      tables.map((table, j) => [
        table,
        Array.from(ddl[i][j].matchAll(/^\s+([a-z][a-z_]+) [A-Z]/gm), (m) => m[1]),
      ]),
    ),
  );
  const matches = (tables, name) => {
    const table = tables.get(name),
      columns = targetShape.get(name);
    return (
      table?.engine === "InnoDB" &&
      columns.length > 0 &&
      table.columns.size === columns.length &&
      columns.every((column) => table.columns.has(column))
    );
  };
  const [[acquired]] = await connection.query(`SELECT GET_LOCK(${lock},0) acquired`);
  if (String(acquired?.acquired) !== "1") throw new Error("account_rehearsal_schema_lock_busy");
  try {
    const { tables, missing } = await inspect(connection);
    if (missing.length) return { status: "source_schema_incompatible", missing, migrations: [] };
    const [rows] = await connection.query(
      "SELECT name,checksum FROM schema_migrations WHERE name IN (?)",
      [names],
    );
    const ledger = new Map(rows.map(({ name, checksum }) => [name, checksum]));
    let pending = false;
    const migrations = accountRehearsalSchemaMigrations.map(({ name, sha256, tables: targets }) => {
      const present = targets.filter((table) => tables.has(table));
      const recorded = ledger.has(name);
      if (
        recorded &&
        (pending ||
          ledger.get(name) !== sha256 ||
          present.length !== targets.length ||
          present.some((table) => !matches(tables, table)))
      )
        throw new Error("account_rehearsal_schema_ledger_mismatch");
      if (!recorded && present.length)
        throw new Error("account_rehearsal_schema_partial_migration");
      if (!recorded) pending = true;
      return { name, status: recorded ? "already_applied" : "pending" };
    });
    if (!apply) return { status: pending ? "ready_to_apply" : "ready", migrations };
    for (const [i, migration] of migrations.entries()) {
      if (migration.status !== "pending") continue;
      const { name, sha256 } = accountRehearsalSchemaMigrations[i];
      // MySQL 5.7 DDL auto-commits. A partial failure is never auto-dropped or recorded as applied.
      for (const sql of ddl[i]) {
        if (assertFenced) await assertFenced();
        await connection.query(sql);
      }
      if (assertFenced) await assertFenced();
      await connection.execute(
        "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))",
        [name, sha256],
      );
      migration.status = "applied";
    }
    if (pending) {
      const current = await inspect(connection);
      if (
        current.missing.length ||
        [...targetShape.keys()].some((table) => !matches(current.tables, table))
      )
        throw new Error("account_rehearsal_schema_readback_mismatch");
    }
    return { status: "ready", migrations };
  } finally {
    await connection.query(`SELECT RELEASE_LOCK(${lock}) released`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--apply"))
    throw new Error("invalid_schema_prepare_arguments");
  const connection = await connectLocalAccountRehearsal();
  try {
    const result = await prepareAccountRetirementSchema(connection, {
      apply: args[0] === "--apply",
    });
    console.log(JSON.stringify(result));
    if (result.status === "source_schema_incompatible") process.exitCode = 2;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error.code ??
        (/^[a-z_]+$/.test(error.message)
          ? error.message
          : "account_rehearsal_schema_prepare_failed"),
    );
    process.exitCode = 1;
  });
}
