import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  assertAccountProductionFence,
  assertAccountProductionTarget,
} from "./lib/account-production-fence.mjs";
import {
  assertAccountRehearsalTarget,
  connectLocalAccountRehearsal,
} from "./stage-account-scope-retirement.mjs";

const sha = (rows) => {
  const hash = createHash("sha256");
  for (const row of rows) hash.update(JSON.stringify(row) + "\n");
  return hash.digest("hex");
};

export async function snapshotAccountTrendPreservation(db) {
  await assertAccountRehearsalTarget(db);
  return readTrendSnapshot(db);
}

export async function snapshotAccountProductionTrendPreservation(db) {
  await assertAccountProductionTarget(db);
  const fence = () => assertAccountProductionFence(db, "account_trend_snapshot_requires_fence");
  await fence();
  const snapshot = await readTrendSnapshot(db);
  await fence();
  return snapshot;
}

async function readTrendSnapshot(db) {
  await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await db.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    const [columns] = await db.query(
      "SHOW COLUMNS FROM trend_signals WHERE Field IN ('organization_id','workspace_id')",
    );
    if (![0, 2].includes(columns.length)) throw new Error("trend_signal_scope_partial");
    const [topicColumns] = await db.query(
      "SHOW COLUMNS FROM trend_topics WHERE Field IN ('account_id','organization_id','workspace_id')",
    );
    const shape = topicColumns
      .map((row) => row.Field)
      .sort()
      .join(",");
    const native = shape === "account_id";
    if ((!native && shape !== "organization_id,workspace_id") || (native && columns.length !== 0))
      throw new Error("trend_topic_scope_invalid");
    if (native) {
      const [[receipt]] = await db.query(
        "SELECT slot FROM account_ownership_cutover WHERE slot='current' AND contract_version=25",
      );
      if (!receipt) throw new Error("trend_topic_ownership_receipt_required");
    }
    const scope = columns.length ? "s" : "t";
    const originalScope = `LEFT JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
      LEFT JOIN account_retirement_records r ON r.run_id=cut.source_run_id AND r.source_table='trend_topics' AND r.source_id=t.id`;
    const [topicRows] = await db.query(
      native
        ? `SELECT t.*,r.legacy_org_id AS organization_id,r.legacy_workspace_id AS workspace_id,
      CASE WHEN r.source_id IS NULL OR r.legacy_org_id IS NULL OR r.legacy_workspace_id IS NULL OR ss.account_id IS NULL
        OR NOT (t.account_id<=>o.account_id AND t.account_id<=>ss.account_id AND o.reason<=>ss.reason)
        OR NOT (o.reason='exclusive_owner' OR (o.reason IN ('shared','unassigned') AND o.account_id=cut.primary_account_id))
        THEN 1 ELSE 0 END invalid_owner
      FROM trend_topics t ${originalScope}
      LEFT JOIN account_retirement_scopes ss ON ss.run_id=r.run_id AND ss.legacy_org_id=r.legacy_org_id AND ss.legacy_workspace_id=r.legacy_workspace_id
      LEFT JOIN account_owned_records o ON o.source_table='trend_topics' AND o.source_id=t.id ORDER BY BINARY t.id`
        : "SELECT * FROM trend_topics ORDER BY BINARY id",
    );
    if (native && topicRows.some((row) => Number(row.invalid_owner) !== 0))
      throw new Error("trend_topic_original_owner_mismatch");
    const topics = native
      ? topicRows.map(
          ({ id, account_id, organization_id, workspace_id, invalid_owner, ...original }) => ({
            id,
            organization_id,
            workspace_id,
            ...original,
          }),
        )
      : topicRows;
    const [signals] = await db.query(
      "SELECT s.id,s.topic_id,s.normalized_record_id,s.raw_evidence_id,s.provider_id,s.title,s.publisher," +
        "s.canonical_url,s.published_at,s.observed_at,s.request_id,s.trace_id,s.created_at," +
        (native
          ? "r.legacy_org_id AS organization_id,r.legacy_workspace_id AS workspace_id"
          : `${scope}.organization_id,${scope}.workspace_id`) +
        ` FROM trend_signals s LEFT JOIN trend_topics t ON t.id=s.topic_id ${native ? originalScope : ""} ORDER BY BINARY s.id`,
    );
    const [[integrity]] = await db.query(
      "SELECT COUNT(*) AS total FROM trend_signals s " +
        "LEFT JOIN trend_topics t ON t.id=s.topic_id LEFT JOIN normalized_records n ON n.id=s.normalized_record_id " +
        "LEFT JOIN raw_evidence e ON e.id=s.raw_evidence_id LEFT JOIN providers p ON p.id=s.provider_id " +
        (native
          ? `LEFT JOIN account_owned_records sl ON sl.source_table='trend_signals' AND sl.source_id=s.id
        LEFT JOIN account_owned_records nl ON nl.source_table='normalized_records' AND nl.source_id=n.id
        LEFT JOIN account_owned_records el ON el.source_table='raw_evidence' AND el.source_id=e.id `
          : "") +
        "WHERE t.id IS NULL OR n.id IS NULL OR e.id IS NULL OR p.id IS NULL OR " +
        "NOT (n.raw_evidence_id <=> s.raw_evidence_id AND n.provider_id <=> s.provider_id AND e.provider_id <=> s.provider_id)" +
        (native
          ? ` OR NOT (n.account_id<=>t.account_id AND e.account_id<=>t.account_id AND
        sl.account_id<=>t.account_id AND nl.account_id<=>t.account_id AND el.account_id<=>t.account_id)`
          : ""),
    );
    if (String(integrity?.total) !== "0") throw new Error("trend_signal_reference_mismatch");
    return {
      topics: topics.length,
      topics_sha256: sha(topics),
      signals: signals.length,
      signals_sha256: sha(signals),
    };
  } finally {
    await db.rollback();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const db = await connectLocalAccountRehearsal();
    try {
      console.log(JSON.stringify(await snapshotAccountTrendPreservation(db)));
    } finally {
      await db.end();
    }
  } catch (error) {
    console.error(
      error.code ??
        (/^[a-z0-9_]+$/.test(error.message) ? error.message : "trend_preservation_readback_failed"),
    );
    process.exitCode = 1;
  }
}
