import {
  executeMigrationStatement,
  preflightAccountRehearsalForward,
} from "./apply-deployment-migrations.mjs";
import { compileAccountRetirementProduction } from "./plan-account-retirement-production.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionPrerequisitePrefix,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import {
  captureAccountProductionMigrationPreservation,
  compareAccountMigrationPreservation,
} from "./lib/account-migration-preservation.mjs";
import { verifyAccountProductionOwnership } from "./verify-account-retirement-ownership.mjs";
import { inspectAccountReleaseReceiptPrefix } from "./verify-account-release-receipt-prefix.mjs";

// Internal component only. The BaoTa caller must stop all writers first and
// hold the same connection's production lock through the eventual cutover.
// Do not infer that interrupted DDL can safely be replayed from a receipt gap.
export async function applyAccountProductionForward(connection, expectedPlanSha256, runId) {
  const compiled = await compileAccountRetirementProduction(expectedPlanSha256);
  await assertAccountProductionTarget(connection);
  const fence = () =>
    assertAccountProductionFence(connection, "account_release_forward_requires_stopped_writers");
  await fence();
  await assertAccountProductionPrerequisitePrefix(
    connection,
    compiled.plan,
    "account_release_forward_requires_fresh_prefix",
  );
  const [[firstStep]] = await connection.query(
    "SELECT COLUMN_TYPE column_type FROM information_schema.COLUMNS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cost_rule_approvals' AND COLUMN_NAME='approval_role'",
  );
  if (firstStep?.column_type !== "enum('selection_manager','organization_admin')")
    throw new Error("account_release_forward_first_migration_not_pristine");
  return runVerifiedForward(connection, compiled, runId, 0, fence, () =>
    assertAccountProductionPrerequisitePrefix(
      connection,
      compiled.plan,
      "account_release_forward_requires_fresh_prefix",
    ),
  );
}

const evidenceMigration = "0190_evidence_account_scope.up.sql";
const suffixStart = 110;
const receiptSql =
  "SELECT name,checksum FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0077' AND '0197'";

export async function assertAccountEvidenceSuffixPrefix(connection, plan) {
  const [rows] = await connection.query(receiptSql);
  const prefix = inspectAccountReleaseReceiptPrefix(plan, rows);
  if (
    prefix.status !== "verified_receipt_prefix" ||
    prefix.applied !== 113 ||
    prefix.total !== 121 ||
    prefix.next_receipt !== evidenceMigration
  )
    throw new Error("account_release_evidence_suffix_prefix_changed");
}

export async function verifyAccountEvidenceHistoryGuards(connection, item) {
  const lead = "INSERT INTO scoutops_evidence_scope_guard\n";
  const reads = item.statements.filter((sql) => sql.startsWith(lead + "SELECT 1 "));
  if (item.metadata.name !== evidenceMigration || reads.length !== 6)
    throw new Error("account_release_evidence_history_guard_shape_changed");
  const labels = [
    "target",
    "raw_parent",
    "normalized_parent",
    "raw_key",
    "normalized_key",
    "scope_digest",
  ];
  for (const [i, sql] of reads.entries()) {
    const [violations] = await connection.query(
      sql.slice(lead.length).replace(/^SELECT 1 WHERE /, "SELECT 1 FROM DUAL WHERE "),
    );
    if (violations.length) throw new Error("account_release_evidence_history_guard_" + labels[i]);
  }
}

export async function assertAccountEvidencePristine(connection) {
  const [shapes] = await connection.query(
    "SELECT TABLE_NAME name,GROUP_CONCAT(COLUMN_NAME ORDER BY COLUMN_NAME) columns_found " +
      "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() " +
      "AND TABLE_NAME IN ('normalized_records','raw_evidence') " +
      "AND COLUMN_NAME IN ('account_id','organization_id','workspace_id','history_chain') GROUP BY TABLE_NAME ORDER BY TABLE_NAME",
  );
  if (
    shapes.length !== 2 ||
    shapes[0].name !== "normalized_records" ||
    shapes[1].name !== "raw_evidence" ||
    shapes.some((x) => x.columns_found !== "organization_id,workspace_id")
  )
    throw new Error("account_release_evidence_suffix_not_pristine");
  const [keys] = await connection.query(
    "SELECT TABLE_NAME name,INDEX_NAME index_name,NON_UNIQUE is_nonunique,COUNT(*) columns_count, " +
      "SUM(SUB_PART IS NOT NULL) prefixes,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) columns_found " +
      "FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() " +
      "AND ((TABLE_NAME='raw_evidence' AND INDEX_NAME IN ('uq_raw_evidence_scope_dedupe','uq_raw_evidence_account_dedupe')) " +
      "OR (TABLE_NAME='normalized_records' AND INDEX_NAME IN ('uq_normalized_scope_record_version','uq_normalized_account_record_version'))) " +
      "GROUP BY TABLE_NAME,INDEX_NAME,NON_UNIQUE ORDER BY TABLE_NAME,INDEX_NAME",
  );
  const expected = [
    [
      "normalized_records",
      "uq_normalized_scope_record_version",
      "organization_id,workspace_id,provider_id,record_key,record_version",
    ],
    [
      "raw_evidence",
      "uq_raw_evidence_scope_dedupe",
      "organization_id,workspace_id,provider_id,dedupe_key",
    ],
  ];
  if (
    keys.length !== 2 ||
    keys.some((x, i) => {
      const [name, index, columns] = expected[i];
      return (
        x.name !== name ||
        x.index_name !== index ||
        x.columns_found !== columns ||
        Number(x.is_nonunique) !== 0 ||
        Number(x.prefixes) !== 0 ||
        Number(x.columns_count) !== columns.split(",").length
      );
    })
  )
    throw new Error("account_release_evidence_suffix_index_changed");
}

// Only the staged, fixed-host coordinator may call this entry with the original
// sealed run. A prefix gap cannot authorize it and no prior SQL is replayed.
export async function applyAccountProductionEvidenceSuffix(connection, expectedPlanSha256, runId) {
  const compiled = await compileAccountRetirementProduction(expectedPlanSha256);
  await assertAccountProductionTarget(connection);
  const fence = () =>
    assertAccountProductionFence(connection, "account_release_evidence_suffix_fence_lost");
  const prefix = () => assertAccountEvidenceSuffixPrefix(connection, compiled.plan);
  await fence();
  await prefix();
  await assertAccountEvidencePristine(connection);
  return runVerifiedForward(connection, compiled, runId, suffixStart, fence, prefix);
}

async function runVerifiedForward(connection, compiled, runId, start, fence, prefix) {
  if ((await verifyAccountProductionOwnership(connection, runId)).status !== "ownership_verified")
    throw new Error("account_release_forward_ownership_not_verified");

  const bundle = compiled.forward.map(({ metadata, statements }) => ({
    name: metadata.name,
    checksum: metadata.candidate_sha256,
    statements,
  }));
  await connection.query("SET SESSION lock_wait_timeout=5");
  await preflightAccountRehearsalForward(connection, bundle);
  await verifyAccountEvidenceHistoryGuards(connection, compiled.forward[suffixStart]);
  const before = await captureAccountProductionMigrationPreservation(connection);
  await fence();
  await prefix();

  for (const { name, checksum, statements } of bundle.slice(start)) {
    for (const statement of statements) {
      await executeMigrationStatement(async (sql) => {
        await fence();
        return connection.query(sql);
      }, statement);
    }
    await fence();
    await connection.query(
      "INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))",
      [name, checksum],
    );
  }
  const [rows] = await connection.query(
    "SELECT name,checksum FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0077' AND '0197'",
  );
  const receipt = inspectAccountReleaseReceiptPrefix(compiled.plan, rows);
  if (receipt.status !== "verified_receipt_prefix" || receipt.applied !== receipt.total)
    throw new Error("account_release_forward_receipt_readback_failed");
  const preservation = compareAccountMigrationPreservation(
    before,
    await captureAccountProductionMigrationPreservation(connection),
  );
  const ownership = await verifyAccountProductionOwnership(connection, runId);
  if (ownership.status !== "ownership_verified" || ownership.tenancy_schema?.status !== "retired")
    throw new Error("account_release_forward_ownership_readback_failed");
  return { status: "forward_verified", receipt, preservation, ownership };
}
