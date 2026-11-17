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

// Original business fields only. The ownership/references verifier separately checks
// the ledger and parent links; migration-added scope/anchor columns are not original data.
const projections = Object.freeze({
  supplier_quotes:
    "id,candidate_id,quote_version,is_current,supplier_name,product_title,specification," +
    "moq,CAST(quoted_price AS CHAR),currency,lead_time_days,location,original_url,observed_at,evidence_id," +
    "CAST(confidence_value AS CHAR),stability_status,risk_level,confirmed_by,request_id,trace_id,created_at",
  sourcing_comparisons: "id,name,quote_ids_json,created_by,request_id,trace_id,created_at",
  exchange_rate_quotes:
    "id,provider_id,base_currency,quote_currency,CAST(rate_value AS CHAR),quote_date," +
    "observed_at,source_ref_id,evidence_id,created_by,request_id,trace_id,created_at",
});
const schema = "account_quote_snapshot_v1";
const digestPattern = /^[a-f0-9]{64}$/;

export async function readAccountQuoteSnapshot(connection) {
  await assertAccountRehearsalTarget(connection);
  return readQuoteSnapshot(connection);
}

export async function readAccountProductionQuoteSnapshot(connection) {
  await assertAccountProductionTarget(connection);
  const fence = () =>
    assertAccountProductionFence(connection, "account_quote_snapshot_requires_fence");
  await fence();
  const snapshot = await readQuoteSnapshot(connection);
  await fence();
  return snapshot;
}

async function readQuoteSnapshot(connection) {
  await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    const [[receipt]] = await connection.query(
      "SELECT DATABASE() db,source_run_id FROM account_ownership_cutover WHERE slot='current' AND contract_version=25",
    );
    if (!receipt?.source_run_id) throw new Error("quote_snapshot_receipt_required");
    const [anchor] = await connection.query(
      "SHOW COLUMNS FROM sourcing_comparisons WHERE Field='anchor_quote_id'",
    );
    const tables = {};
    for (const [table, columns] of Object.entries(projections)) {
      const checkAnchor = table === "sourcing_comparisons" && anchor.length === 1;
      const [rows] = await connection.query(
        `SELECT SHA2(CAST(JSON_ARRAY(${columns}) AS CHAR CHARACTER SET utf8mb4),256) row_sha256` +
          (checkAnchor
            ? ", NOT (LOWER(anchor_quote_id) <=> LOWER(CONVERT(JSON_UNQUOTE(JSON_EXTRACT(quote_ids_json,'$[0]')) USING ascii))) invalid_anchor"
            : "") +
          ` FROM ${table} ORDER BY BINARY id`,
      );
      if (checkAnchor && rows.some((row) => Number(row.invalid_anchor) !== 0))
        throw new Error("quote_snapshot_invalid_anchor");
      const digest = createHash("sha256");
      for (const row of rows) {
        if (!digestPattern.test(row.row_sha256 ?? ""))
          throw new Error("quote_snapshot_row_invalid");
        digest.update(row.row_sha256); // Fixed-width SHA-256 hex gives unambiguous framing.
      }
      tables[table] = { rows: rows.length, sha256: digest.digest("hex") };
    }
    return { schema, database: receipt.db, source_run_id: receipt.source_run_id, tables };
  } finally {
    await connection.rollback();
  }
}

export function compareAccountQuoteSnapshots(baseline, current) {
  const names = Object.keys(projections);
  for (const snapshot of [baseline, current]) {
    if (
      snapshot?.schema !== schema ||
      !snapshot.database ||
      !snapshot.source_run_id ||
      Object.keys(snapshot.tables ?? {}).length !== names.length ||
      names.some((name) => {
        const row = snapshot.tables[name];
        return (
          !Number.isSafeInteger(row?.rows) || row.rows < 0 || !digestPattern.test(row.sha256 ?? "")
        );
      })
    )
      throw new Error("quote_snapshot_invalid");
  }
  if (baseline.database !== current.database || baseline.source_run_id !== current.source_run_id)
    throw new Error("quote_snapshot_batch_mismatch");
  const mismatches = [];
  const tables = Object.fromEntries(
    names.map((name) => {
      const before = baseline.tables[name],
        after = current.tables[name];
      const matches = before.rows === after.rows && before.sha256 === after.sha256;
      if (!matches) mismatches.push(name);
      return [
        name,
        { ...after, status: !matches ? "mismatch" : after.rows ? "matched" : "no_historical_rows" },
      ];
    }),
  );
  return { status: mismatches.length ? "mismatch" : "matched", mismatches, tables };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== "--compare"))
      throw new Error("quote_snapshot_arguments_invalid");
    let baseline;
    if (args.length) {
      let input = "";
      process.stdin.setEncoding("utf8");
      for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 8192) throw new Error("quote_snapshot_input_too_large");
      }
      baseline = JSON.parse(input);
    }
    const connection = await connectLocalAccountRehearsal();
    try {
      const current = await readAccountQuoteSnapshot(connection);
      const result = args.length ? compareAccountQuoteSnapshots(baseline, current) : current;
      console.log(JSON.stringify(result));
      if (result.status === "mismatch") process.exitCode = 2;
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error(
      error.code ?? (/^[a-z0-9_]+$/.test(error.message) ? error.message : "quote_snapshot_failed"),
    );
    process.exitCode = 1;
  }
}
