import { executeMigrationStatement, preflightAccountRehearsalForward } from "./apply-deployment-migrations.mjs";
import { compileAccountRetirementProduction } from "./plan-account-retirement-production.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionPrerequisitePrefix,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import {
  captureAccountMigrationPreservation,
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
  const fence = () => assertAccountProductionFence(connection, "account_release_forward_requires_stopped_writers");
  await fence();
  await assertAccountProductionPrerequisitePrefix(connection, compiled.plan, "account_release_forward_requires_fresh_prefix");
  const [[firstStep]] = await connection.query(
    "SELECT COLUMN_TYPE column_type FROM information_schema.COLUMNS " +
    "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cost_rule_approvals' AND COLUMN_NAME='approval_role'",
  );
  if (firstStep?.column_type !== "enum('selection_manager','organization_admin')")
    throw new Error("account_release_forward_first_migration_not_pristine");
  if ((await verifyAccountProductionOwnership(connection, runId)).status !== "ownership_verified")
    throw new Error("account_release_forward_ownership_not_verified");

  const bundle = compiled.forward.map(({ metadata, statements }) => ({
    name: metadata.name,
    checksum: metadata.candidate_sha256,
    statements,
  }));
  await connection.query("SET SESSION lock_wait_timeout=5");
  await preflightAccountRehearsalForward(connection, bundle);
  const before = await captureAccountMigrationPreservation(connection);
  await fence();
  await assertAccountProductionPrerequisitePrefix(connection, compiled.plan, "account_release_forward_requires_fresh_prefix");

  for (const { name, checksum, statements } of bundle) {
    for (const statement of statements) {
      await executeMigrationStatement(async (sql) => {
        await fence();
        return connection.query(sql);
      }, statement);
    }
    await fence();
    await connection.query("INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))", [name, checksum]);
  }
  const [rows] = await connection.query("SELECT name,checksum FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0077' AND '0197'");
  const receipt = inspectAccountReleaseReceiptPrefix(compiled.plan, rows);
  if (receipt.status !== "verified_receipt_prefix" || receipt.applied !== receipt.total)
    throw new Error("account_release_forward_receipt_readback_failed");
  const preservation = compareAccountMigrationPreservation(before, await captureAccountMigrationPreservation(connection));
  const ownership = await verifyAccountProductionOwnership(connection, runId);
  if (ownership.status !== "ownership_verified" || ownership.tenancy_schema?.status !== "retired")
    throw new Error("account_release_forward_ownership_readback_failed");
  return { status: "forward_verified", receipt, preservation, ownership };
}
