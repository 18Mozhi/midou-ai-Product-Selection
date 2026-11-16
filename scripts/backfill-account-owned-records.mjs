import { pathToFileURL } from "node:url";
import { assertAccountProductionFence, assertAccountProductionPrerequisitePrefix, assertAccountProductionTarget } from "./lib/account-production-fence.mjs";
import { readAccountRetirementReview } from "./read-account-retirement-review.mjs";
import { readLegacyAccountScopeDefaults } from "./preview-account-scope-retirement.mjs";
import {
  baotaEvidenceBoundary,
  verifyAccountEvidenceBeforeBackfillCommit,
} from "./verify-account-evidence-files.mjs";
import {
  assertAccountRehearsalTarget,
  checkAccountScopeRecords,
  connectLocalAccountRehearsal,
  findAccountUniqueKeyCollisions,
} from "./stage-account-scope-retirement.mjs";

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const scopeKey = (row) => `${row.legacy_org_id}/${row.legacy_workspace_id}`;

const scopeJoin = `FROM account_retirement_records r JOIN account_retirement_scopes m
  ON m.run_id=r.run_id AND m.legacy_org_id=r.legacy_org_id
    AND m.legacy_workspace_id=r.legacy_workspace_id`;

export async function backfillAccountOwnedRecords(
  connection,
  runId,
  options = {},
) {
  return backfillOnBoundTarget(connection, runId, options, assertAccountRehearsalTarget);
}

// Internal production step. The exact reviewed run and in-place evidence
// verification are mandatory. There is no operator-supplied audit exception.
export async function backfillAccountProductionOwnedRecords(connection, runId, expectedReviewSha256, plan) {
  if (typeof expectedReviewSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedReviewSha256))
    throw new Error("account_release_review_digest_required");
  const assertFenced = () =>
    assertAccountProductionFence(connection, "account_release_backfill_not_fenced");
  return backfillOnBoundTarget(connection, runId, {
    commit: true,
    expectedReviewSha256,
    evidenceRoot: "/www/wwwroot/ai选品/runtime/evidence",
    preserveHistoricalKeys: true,
  }, async (db) => {
    await assertAccountProductionTarget(db);
    await assertFenced();
    await assertAccountProductionPrerequisitePrefix(db, plan, "account_release_backfill_requires_exact_prerequisites");
  }, assertFenced);
}

async function backfillOnBoundTarget(
  connection,
  runId,
  {
    commit = false,
    expectedReviewSha256,
    evidenceRoot,
    drillRoot,
    preserveHistoricalKeys = false,
    auditOnly,
  } = {},
  assertTarget,
  assertFenced,
) {
  if (
    typeof runId !== "string" ||
    !uuid.test(runId) ||
    typeof commit !== "boolean" ||
    typeof preserveHistoricalKeys !== "boolean" ||
    (preserveHistoricalKeys && (expectedReviewSha256 === undefined || !evidenceRoot)) ||
    (expectedReviewSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedReviewSha256))
  )
    throw new Error("invalid_account_ownership_backfill_input");
  await assertTarget(connection);
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
  try {
    if (assertFenced) await assertFenced();
    const [[current]] = await connection.query(
      "SELECT source_run_id,primary_account_id,source_record_count,contract_version FROM account_ownership_cutover WHERE slot='current' FOR UPDATE",
    );
    if (current && current.source_run_id !== runId)
      throw new Error("another_account_backfill_exists");
    const [[staged]] = await connection.execute(
      "SELECT primary_account_id FROM account_retirement_runs WHERE id=? FOR UPDATE",
      [runId],
    );
    if (!staged) throw new Error("committed_staging_run_required");
    if (
      expectedReviewSha256 !== undefined &&
      (await readAccountRetirementReview(connection, runId, { lockForBackfill: true }))
        .review_sha256 !== expectedReviewSha256
    )
      throw new Error("account_retirement_review_changed");
    const { primaryId, scopeDefaults } = await readLegacyAccountScopeDefaults(connection);
    if (staged.primary_account_id !== primaryId) throw new Error("staged_primary_account_changed");

    const [savedScopes] = await connection.execute(
      "SELECT legacy_org_id,legacy_workspace_id,account_id,reason FROM account_retirement_scopes WHERE run_id=?",
      [runId],
    );
    const scopeMap = new Map(savedScopes.map((row) => [scopeKey(row), row]));
    if (
      savedScopes.length !== scopeDefaults.length ||
      scopeDefaults.some((scope) => {
        const saved = scopeMap.get(`${scope.organization_id}/${scope.workspace_id}`);
        return saved?.account_id !== scope.account_id || saved?.reason !== scope.reason;
      })
    )
      throw new Error("staged_scope_ownership_changed");

    const sourceTables = await checkAccountScopeRecords(connection, runId);
    const expected = Object.values(sourceTables).reduce(
      (total, count) => total + BigInt(count),
      0n,
    );
    if (
      current &&
      (current.primary_account_id !== primaryId ||
        BigInt(current.source_record_count) !== expected ||
        Number(current.contract_version) !== 25)
    )
      throw new Error("account_ownership_cutover_receipt_mismatch");
    const [[stagedTotal]] = await connection.execute(
      "SELECT COUNT(*) total FROM account_retirement_records WHERE run_id=?",
      [runId],
    );
    if (BigInt(stagedTotal.total) !== expected) throw new Error("unexpected_staged_records");
    const collisions = await findAccountUniqueKeyCollisions(connection, runId, {
      preserveHistoricalKeys,
    });
    if (collisions.some((entry) => entry.preserved_by_original_id !== true))
      throw new Error("unresolved_account_unique_key_collisions");

    if (!current) {
      await connection.execute(
        `INSERT INTO account_ownership_cutover
          (slot,source_run_id,primary_account_id,source_record_count,contract_version,created_at)
          VALUES ('current',?,?,?,25,UTC_TIMESTAMP(3))`,
        [runId, primaryId, String(expected)],
      );
      await connection.execute(
        `INSERT INTO account_owned_records (source_table,source_id,account_id,reason)
          SELECT r.source_table,r.source_id,m.account_id,m.reason ${scopeJoin} WHERE r.run_id=?`,
        [runId],
      );
      await connection.query(`INSERT INTO account_trend_topic_follows (id,account_id,topic_id,created_at)
        SELECT id,user_id,topic_id,created_at FROM trend_topic_follows`);
    }
    const [[recorded]] = await connection.query("SELECT COUNT(*) total FROM account_owned_records");
    const [mismatched] = await connection.execute(
      `SELECT 1 ${scopeJoin} LEFT JOIN account_owned_records o
        ON o.source_table=r.source_table AND o.source_id=r.source_id
          AND o.account_id=m.account_id AND o.reason=m.reason
        WHERE r.run_id=? AND o.source_id IS NULL LIMIT 1`,
      [runId],
    );
    if (BigInt(recorded.total) !== expected || mismatched.length)
      throw new Error("account_owned_record_readback_mismatch");
    const [[follows]] = await connection.query(`SELECT
      (SELECT COUNT(*) FROM trend_topic_follows) source_count,
      (SELECT COUNT(*) FROM account_trend_topic_follows) target_count,
      (SELECT COUNT(*) FROM trend_topic_follows f LEFT JOIN account_trend_topic_follows a
        ON a.id=f.id AND a.account_id=f.user_id AND a.topic_id=f.topic_id AND a.created_at=f.created_at
        WHERE a.id IS NULL) mismatch_count`);
    if (
      BigInt(follows.source_count) !== BigInt(follows.target_count) ||
      BigInt(follows.mismatch_count) !== 0n
    )
      throw new Error("account_trend_follows_readback_mismatch");
    let evidence;
    if (commit && (!current || assertFenced) && evidenceRoot !== undefined) {
      evidence = await verifyAccountEvidenceBeforeBackfillCommit(
        connection,
        runId,
        evidenceRoot,
        drillRoot,
        auditOnly,
      );
      if (evidence.status !== "verified") {
        await connection.rollback();
        return { run_id: runId, status: "evidence_preflight_rolled_back", evidence };
      }
    }
    if (assertFenced) await assertFenced();
    if (commit && !current) await connection.commit();
    else await connection.rollback();
    return {
      run_id: runId,
      status: current ? "already_backfilled" : commit ? "backfilled" : "rolled_back",
      account_owned_record_count: String(expected),
      account_trend_follow_count: String(follows.target_count),
      tables: sourceTables,
      ...(preserveHistoricalKeys ? { preserved_historical_collisions: collisions } : {}),
      ...(evidence ? { evidence_preflight: evidence } : {}),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const [runId, flag, reviewSha256, ...extra] = process.argv.slice(2);
  if (
    !runId ||
    !uuid.test(runId) ||
    extra.length ||
    (flag !== undefined && (flag !== "--commit" || !/^[a-f0-9]{64}$/.test(reviewSha256 ?? "")))
  )
    throw new Error("expected_staging_run_uuid_and_commit_review_sha256");
  if (flag === "--commit" && (await baotaEvidenceBoundary()))
    throw new Error("use_historical_rehearsal_verify_on_baota");
  const connection = await connectLocalAccountRehearsal();
  try {
    const result = await backfillAccountOwnedRecords(connection, runId, {
      commit: flag === "--commit",
      expectedReviewSha256: reviewSha256,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      error.code ?? (/^[a-z0-9_:.]+$/.test(error.message) ? error.message : "backfill_failed"),
    );
    process.exitCode = 1;
  });
}
