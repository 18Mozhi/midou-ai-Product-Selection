import { createHash } from "node:crypto";

export const originalBusinessTables = Object.freeze([
  "opportunities",
  "competitors",
  "competitor_snapshots",
  "competitor_changes",
  "competitor_alerts",
  "raw_evidence",
  "browser_evidence_artifacts",
  "collection_tasks",
  "tasks",
  "task_comments",
  "task_events",
  "score_rules",
  "cost_rules",
  "cost_rule_approvals",
  "trend_monitoring_rules",
  "competitor_monitor_rules",
  "automation_rules",
]);

const identifier = /^[a-z][a-z0-9_]*$/;
const sha256 = /^[a-f0-9]{64}$/;
const scopeColumns = new Set(["organization_id", "workspace_id", "account_id"]);
const historicalScopeTables = new Set([
  "score_rules",
  "cost_rules",
  "trend_monitoring_rules",
  "competitor_monitor_rules",
  "automation_rules",
]);
const quote = (name) => "`" + name + "`";

function originalColumnExpression(table, field) {
  if (table === "cost_rule_approvals" && field === "approval_role")
    return "CASE WHEN approval_role='organization_admin' THEN 'primary_account' ELSE approval_role END";
  return quote(field);
}

// Called only by the stop-writes, isolated migration executor under its advisory lock.
// Hash in MySQL so neither original payloads nor row IDs appear in the acceptance report.
export async function captureOriginalBusinessRows(db) {
  await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  await db.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
  try {
    const snapshots = {};
    for (const table of originalBusinessTables) {
      const [metadata] = await db.query(`SHOW COLUMNS FROM ${quote(table)}`);
      const fields = metadata.map(({ Field }) => Field);
      if (
        !fields.includes("id") ||
        new Set(fields).size !== fields.length ||
        fields.some((name) => typeof name !== "string" || !identifier.test(name))
      )
        throw new Error(`account_original_business_schema_invalid:${table}`);
      const columns = fields
        .filter(
          (field) =>
            !scopeColumns.has(field) &&
            !(field === "historical_context" && historicalScopeTables.has(table)),
        )
        .sort();
      const projected = columns.map(
        (field) => `HEX(CAST(${originalColumnExpression(table, field)} AS BINARY))`,
      );
      const hash = createHash("sha256").update(JSON.stringify(columns) + "\n");
      let last = "";
      let rows = 0;
      for (;;) {
        const [page] = await db.query(
          `SELECT id,SHA2(JSON_ARRAY(${projected.join(",")}),256) digest ` +
            `FROM ${quote(table)} WHERE id>? ORDER BY id LIMIT 500`,
          [last],
        );
        if (page.length === 0) break;
        for (const row of page) {
          if (
            typeof row.id !== "string" ||
            !row.id ||
            row.id === last ||
            !sha256.test(row.digest ?? "")
          )
            throw new Error(`account_original_business_row_invalid:${table}`);
          hash.update(row.digest);
          last = row.id;
          rows++;
        }
      }
      snapshots[table] = { rows, sha256: hash.digest("hex") };
    }
    return snapshots;
  } finally {
    await db.rollback();
  }
}

export function compareOriginalBusinessRows(before, after) {
  return Object.fromEntries(
    originalBusinessTables.map((table) => {
      const a = before?.[table];
      const b = after?.[table];
      if (
        [a, b].some(
          (snapshot) =>
            !Number.isSafeInteger(snapshot?.rows) ||
            snapshot.rows < 0 ||
            !sha256.test(snapshot.sha256 ?? ""),
        )
      )
        throw new Error(`account_original_business_snapshot_invalid:${table}`);
      const matches = a.rows === b.rows && a.sha256 === b.sha256;
      return [
        table,
        { ...b, status: !matches ? "mismatch" : b.rows ? "matched" : "no_historical_rows" },
      ];
    }),
  );
}
