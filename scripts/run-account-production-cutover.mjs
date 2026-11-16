import { applyAccountProductionForward } from "./apply-account-production-forward.mjs";
import { backfillAccountProductionOwnedRecords } from "./backfill-account-owned-records.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionPrerequisitePrefix,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import { compileAccountRetirementProduction } from "./plan-account-retirement-production.mjs";
import { prepareAccountProductionPrerequisites } from "./prepare-account-retirement-schema.mjs";
import { readAccountRetirementReview } from "./read-account-retirement-review.mjs";
import { stageAccountProductionRetirement } from "./stage-account-scope-retirement.mjs";
import { inspectAccountReleaseReceiptPrefix } from "./verify-account-release-receipt-prefix.mjs";

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const digest = /^[a-f0-9]{64}$/;

async function existingStage(connection) {
  const [rows] = await connection.query("SELECT id FROM account_retirement_runs LIMIT 2");
  if (rows.length > 1 || (rows.length && !uuid.test(rows[0].id)))
    throw new Error("account_cutover_ambiguous_staged_run");
  return rows[0]?.id;
}

async function reviewStage(connection, runId) {
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    return await readAccountRetirementReview(connection, runId);
  } finally {
    await connection.rollback();
  }
}

// This is the DB step of a coordinated BaoTa release, not a standalone CLI.
// The parent must own the lock on this session and keep the old writers down
// until the new package has started and the release has been verified.
export async function runAccountProductionCutover(
  connection,
  { phase, expectedPlanSha256, runId, expectedReviewSha256 } = {},
) {
  if (
    !["prepare", "apply"].includes(phase) ||
    (phase === "prepare" && (runId !== undefined || expectedReviewSha256 !== undefined)) ||
    (phase === "apply" && (!uuid.test(runId ?? "") || !digest.test(expectedReviewSha256 ?? "")))
  )
    throw new Error("account_cutover_invalid_phase_or_review");
  const compiled = await compileAccountRetirementProduction(expectedPlanSha256);
  await assertAccountProductionTarget(connection);
  const fence = () =>
    assertAccountProductionFence(connection, "account_cutover_requires_stopped_writers");
  const prefix = () =>
    assertAccountProductionPrerequisitePrefix(
      connection,
      compiled.plan,
      "account_cutover_requires_exact_prerequisites",
    );
  await fence();

  if (phase === "prepare") {
    const [rows] = await connection.query(
      "SELECT name,checksum FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0077' AND '0197'",
    );
    const starting = inspectAccountReleaseReceiptPrefix(compiled.plan, rows);
    if (starting.status !== "verified_receipt_prefix" || starting.applied > 3)
      throw new Error("account_cutover_prepare_receipt_boundary_invalid");
    const schema = await prepareAccountProductionPrerequisites(connection, compiled);
    if (schema.status !== "ready") return { status: "blocked", phase: "schema", schema };
    await prefix();
    const staged = await existingStage(connection);
    const staging = staged
      ? null
      : await stageAccountProductionRetirement(connection, compiled.plan);
    const stagedRunId = staged ?? staging.run_id;
    await fence();
    const review = await reviewStage(connection, stagedRunId);
    await fence();
    return { status: "review_required", run_id: stagedRunId, review, staging };
  }

  await prefix();
  if ((await existingStage(connection)) !== runId)
    throw new Error("account_cutover_expected_staged_run");
  const backfill = await backfillAccountProductionOwnedRecords(
    connection,
    runId,
    expectedReviewSha256,
    compiled.plan,
  );
  if (
    !["backfilled", "already_backfilled"].includes(backfill.status) ||
    backfill.evidence_preflight?.status !== "verified"
  )
    return { status: "blocked", phase: "backfill", backfill };
  await fence();
  const forward = await applyAccountProductionForward(connection, expectedPlanSha256, runId);
  return { status: "database_verified", run_id: runId, backfill, forward };
}
