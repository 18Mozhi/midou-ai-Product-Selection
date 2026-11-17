import {
  compareAccountQuoteSnapshots,
  readAccountProductionQuoteSnapshot,
  readAccountQuoteSnapshot,
} from "../verify-account-quote-preservation.mjs";
import {
  snapshotAccountProductionTrendPreservation,
  snapshotAccountTrendPreservation,
} from "../verify-account-trend-preservation.mjs";
import {
  assertAccountProductionFence,
  assertAccountProductionTarget,
} from "./account-production-fence.mjs";
import {
  captureOriginalBusinessRows,
  compareOriginalBusinessRows,
} from "./account-original-business-rows.mjs";

// The caller holds the isolated migration lock and has stopped all writers.
export async function captureAccountMigrationPreservation(db) {
  return {
    quotes: await readAccountQuoteSnapshot(db),
    trends: await snapshotAccountTrendPreservation(db),
    business: await captureOriginalBusinessRows(db),
  };
}

export async function captureAccountProductionMigrationPreservation(db) {
  await assertAccountProductionTarget(db);
  const fence = () => assertAccountProductionFence(db, "account_preservation_requires_fence");
  await fence();
  const quotes = await readAccountProductionQuoteSnapshot(db);
  const trends = await snapshotAccountProductionTrendPreservation(db);
  const business = await captureOriginalBusinessRows(db);
  await fence();
  return { quotes, trends, business };
}

export function compareAccountMigrationPreservation(before, after) {
  const quotes = compareAccountQuoteSnapshots(before.quotes, after.quotes);
  const domains = ["topics", "signals"];
  const trends = Object.fromEntries(
    domains.map((name) => {
      const digest = `${name}_sha256`;
      const valid = [before.trends, after.trends].every(
        (snapshot) =>
          Number.isSafeInteger(snapshot?.[name]) &&
          snapshot[name] >= 0 &&
          /^[a-f0-9]{64}$/.test(snapshot[digest] ?? ""),
      );
      if (!valid) throw new Error("account_migration_trend_snapshot_invalid");
      const matches =
        before.trends[name] === after.trends[name] &&
        before.trends[digest] === after.trends[digest];
      return [
        name,
        {
          rows: after.trends[name],
          sha256: after.trends[digest],
          status: !matches ? "mismatch" : after.trends[name] ? "matched" : "no_historical_rows",
        },
      ];
    }),
  );
  const business = compareOriginalBusinessRows(before.business, after.business);
  const mismatches = [
    ...quotes.mismatches,
    ...domains.filter((name) => trends[name].status === "mismatch"),
    ...Object.keys(business).filter((name) => business[name].status === "mismatch"),
  ];
  if (mismatches.length)
    throw new Error(`account_migration_preservation_mismatch:${mismatches.join(",")}`);
  return { status: "matched", scope: "this_invocation", quotes: quotes.tables, trends, business };
}
