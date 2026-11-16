const digest = /^[a-f0-9]{64}$/;

/** Verifies the ordered receipt boundary but never authorizes DDL. */
export function inspectAccountReleaseReceiptPrefix(plan, rows) {
  if (
    plan?.target_database !== "product_scout" ||
    plan?.source_contract_version !== 25 ||
    !Array.isArray(plan?.prerequisites) ||
    !Array.isArray(plan?.forward) ||
    plan?.prerequisites?.length !== 3 ||
    plan?.forward?.length !== 118 ||
    !digest.test(plan?.plan_sha256 ?? "") ||
    !Array.isArray(rows)
  )
    throw new Error("account_release_prefix_invalid_input");
  const steps = [...plan.prerequisites, ...plan.forward];
  if (
    !steps.every(
      ({ name, candidate_sha256 }, index) =>
        new RegExp(`^${String(77 + index).padStart(4, "0")}_[a-z0-9_]+\\.up\\.sql$`).test(name) &&
        digest.test(candidate_sha256),
    )
  )
    throw new Error("account_release_prefix_invalid_plan");
  const receipts = new Map();
  for (const row of rows) {
    if (
      typeof row?.name !== "string" ||
      !/^\d{4}[a-z]?_[a-z0-9_]+\.up\.sql$/.test(row.name) ||
      typeof row.checksum !== "string" ||
      !digest.test(row.checksum) ||
      receipts.has(row.name)
    )
      throw new Error("account_release_prefix_invalid_receipt");
    receipts.set(row.name, row.checksum);
  }
  const status = {
    status: "verified_receipt_prefix",
    plan_sha256: plan.plan_sha256,
    applied: 0,
    total: steps.length,
    next_receipt: null,
    executable: false,
  };
  const canonical = new Set(steps.map(({ name }) => name));
  for (const name of receipts.keys()) {
    const num = /^\d{4}(?=[a-z_])/i.exec(name)?.[0];
    if (num && Number(num) >= 77 && Number(num) <= 197 && !canonical.has(name))
      return { ...status, status: "unexpected_account_release_receipt" };
  }
  for (const { name, candidate_sha256 } of steps) {
    if (!receipts.has(name)) {
      status.next_receipt ??= name;
      continue;
    }
    if (receipts.get(name) !== candidate_sha256)
      return {
        ...status,
        status: "account_release_receipt_checksum_mismatch",
        invalid_receipt: name,
      };
    if (status.next_receipt !== null)
      return { ...status, status: "account_release_receipt_gap", invalid_receipt: name };
    status.applied++;
  }
  return status;
}
