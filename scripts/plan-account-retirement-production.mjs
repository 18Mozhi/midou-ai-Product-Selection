import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  listAccountRetirementMigrationNames,
  splitSqlStatements,
} from "./apply-deployment-migrations.mjs";
import { inspectAccountReleaseReceiptPrefix } from "./verify-account-release-receipt-prefix.mjs";

const isolatedGuard = "SELECT 1 WHERE DATABASE() NOT REGEXP '^product_scout_[a-z0-9_]+rehearsal$'";
const productionGuard = "SELECT 1 WHERE BINARY DATABASE() <> BINARY 'product_scout'";
const guarded = new Set(["0189", "0190", "0191", "0192", "0193", "0194", "0195", "0196", "0197"]);
const sha = (source) => createHash("sha256").update(source).digest("hex");
const root = new URL("../database/migrations/", import.meta.url);
const prerequisites = [
  "0077_account_scope_retirement_staging.up.sql",
  "0078_account_owned_records.up.sql",
  "0079_account_trend_topic_follows.up.sql",
];

function compileAccountMigrationFile(name, source) {
  if (!/^(?:00|01)\d{2}_[a-z0-9_]+\.(?:up|down)\.sql$/.test(name))
    throw new Error("account_release_migration_name_invalid");
  const normalized = source.replaceAll("\r\n", "\n");
  const original = splitSqlStatements(normalized);
  const shouldTranslate = guarded.has(name.slice(0, 4));
  const indexes = original.flatMap((statement, index) =>
    statement.includes(isolatedGuard) ? [index] : [],
  );
  if (shouldTranslate !== (indexes.length === 1) || indexes.length > 1)
    throw new Error(`account_release_target_guard_drift:${name}`);
  if (
    shouldTranslate &&
    !/^INSERT INTO scoutops_[a-z0-9_]+_guard\nSELECT 1 WHERE DATABASE\(\)/.test(
      original[indexes[0]],
    )
  )
    throw new Error(`account_release_unexpected_guard_statement:${name}`);
  const candidate = shouldTranslate
    ? normalized.replace(isolatedGuard, productionGuard)
    : normalized;
  const changed = splitSqlStatements(candidate);
  if (
    changed.length !== original.length ||
    changed.some(
      (statement, index) =>
        statement !==
        (indexes[0] === index
          ? original[index].replace(isolatedGuard, productionGuard)
          : original[index]),
    )
  )
    throw new Error(`account_release_non_target_statement_drift:${name}`);
  if (changed.some((statement) => /DATABASE\(\).*rehearsal/i.test(statement)))
    throw new Error(`account_release_isolation_guard_remaining:${name}`);
  const metadata = Object.freeze({
    name,
    rehearsal_sha256: sha(normalized),
    candidate_sha256: sha(candidate),
    statement_count: original.length,
    retargeted: shouldTranslate,
  });
  return Object.freeze({ metadata, statements: Object.freeze(changed) });
}

export function planAccountMigrationFile(name, source) {
  return compileAccountMigrationFile(name, source).metadata;
}

async function readAccountRetirementProductionInputs() {
  const names = listAccountRetirementMigrationNames();
  if (
    names.length !== 118 ||
    new Set(names).size !== 118 ||
    !names.every((name, index) => name.startsWith(String(80 + index).padStart(4, "0") + "_"))
  )
    throw new Error("account_release_migration_order_drift");
  const down = [...names].reverse().map((name) => name.replace(/\.up\.sql$/, ".down.sql"));
  const load = (list) =>
    Promise.all(
      list.map(async (name) =>
        compileAccountMigrationFile(name, await readFile(new URL(name, root), "utf8")),
      ),
    );
  const [required, forward, rollback] = await Promise.all([
    load(prerequisites),
    load(names),
    load(down),
  ]);
  const release = {
    status: "offline_plan_only",
    target_database: "product_scout",
    source_contract_version: 25,
    prerequisites: Object.freeze(required.map((item) => item.metadata)),
    forward: Object.freeze(forward.map((item) => item.metadata)),
    rollback: Object.freeze(rollback.map((item) => item.metadata)),
  };
  const plan = Object.freeze({
    ...release,
    plan_sha256: sha(JSON.stringify(release)),
    executable: false,
  });
  return Object.freeze({
    plan,
    prerequisites: Object.freeze(required),
    forward: Object.freeze(forward),
    rollback: Object.freeze(rollback),
  });
}

export async function planAccountRetirementProduction() {
  return (await readAccountRetirementProductionInputs()).plan;
}

// Internal only: validates source and target bytes together on the same read.
// A fingerprint proves identity, not production authorization.
export async function compileAccountRetirementProduction(expectedPlanSha256) {
  if (typeof expectedPlanSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedPlanSha256))
    throw new Error("account_release_expected_plan_digest_required");
  const compiled = await readAccountRetirementProductionInputs();
  if (compiled.plan.plan_sha256 !== expectedPlanSha256)
    throw new Error("account_release_plan_digest_mismatch");
  return compiled;
}

export function renderAccountReleaseReceipts(plan) {
  const lines = [...plan.prerequisites, ...plan.forward].map(
    ({ name, candidate_sha256 }) =>
      `  [\n    ${JSON.stringify(name)},\n    ${JSON.stringify(candidate_sha256)},\n  ],`,
  );
  return (
    "// Generated from scripts/plan-account-retirement-production.mjs --receipt-module.\n" +
    "// The SQL is deliberately not included in the runtime.\n" +
    "export const accountReleaseReceipts = [\n" +
    lines.join("\n") +
    "\n] as const;\n"
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length === 3 && process.argv[2] === "--receipt-module") {
    process.stdout.write(renderAccountReleaseReceipts(await planAccountRetirementProduction()));
  } else if (process.argv.length === 3 && process.argv[2] === "--check-receipts") {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of process.stdin) {
      bytes += chunk.length;
      if (bytes > 131072) throw new Error("account_release_prefix_input_too_large");
      chunks.push(chunk);
    }
    const rows = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = inspectAccountReleaseReceiptPrefix(
      await planAccountRetirementProduction(),
      rows,
    );
    console.log(JSON.stringify(result));
    if (result.status !== "verified_receipt_prefix") process.exitCode = 1;
  } else if (process.argv.length !== 2) {
    console.error("account_release_plan_invalid_argument");
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await planAccountRetirementProduction()));
  }
}
