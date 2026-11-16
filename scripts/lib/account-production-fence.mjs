import { inspectAccountReleaseReceiptPrefix } from "../verify-account-release-receipt-prefix.mjs";

// The BaoTa coordinator is responsible for stopping every project writer.
// The database check verifies the fixed identity and lock on the actual
// connection; visible same-account sessions are an additional veto.
export async function assertAccountProductionTarget(connection) {
  const [[target]] = await connection.query(
    "SELECT DATABASE() db,VERSION() version,CURRENT_USER() authenticated_as",
  );
  if (
    target?.db !== "product_scout" ||
    !/^5\.7\./.test(target?.version ?? "") ||
    !/^product_scout@[^@]+$/.test(target?.authenticated_as ?? "")
  )
    throw new Error("account_release_legacy_schema_target_invalid");
}

export async function assertAccountProductionFence(connection, code) {
  const [[state]] = await connection.query(
    "SELECT IS_USED_LOCK('scoutops:account-retirement:production')=CONNECTION_ID() AS locked, " +
      "(SELECT COUNT(*) FROM information_schema.PROCESSLIST WHERE DB=DATABASE() AND ID<>CONNECTION_ID()) AS other_sessions",
  );
  if (Number(state?.locked) !== 1 || Number(state?.other_sessions) !== 0)
    throw new Error(code);
}

export async function assertAccountProductionPrerequisitePrefix(connection, plan, code) {
  const [rows] = await connection.query(
    "SELECT name,checksum FROM schema_migrations WHERE SUBSTRING(name,1,4) BETWEEN '0077' AND '0197'",
  );
  const prefix = inspectAccountReleaseReceiptPrefix(plan, rows);
  if (prefix.status !== "verified_receipt_prefix" || prefix.applied !== 3)
    throw new Error(code);
}
