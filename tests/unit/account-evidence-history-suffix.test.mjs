import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertAccountEvidencePristine,
  assertAccountEvidenceSuffixPrefix,
  verifyAccountEvidenceHistoryGuards,
} from "../../scripts/apply-account-production-forward.mjs";
import {
  compileAccountRetirementProduction,
  planAccountRetirementProduction,
} from "../../scripts/plan-account-retirement-production.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { verifyInstalledAccountRuntime } from "../../scripts/serve-account-production-evidence-suffix.mjs";

const old = "a4c7b0128bc59aad0601271b473c01b6ce8decee";
const plan = await planAccountRetirementProduction();
const compiled = await compileAccountRetirementProduction(plan.plan_sha256);
const prefix = [...plan.prerequisites, ...plan.forward.slice(0, 110)];
const evidence = compiled.forward[110];
const allReceipts = [...plan.prerequisites, ...plan.forward].map(({ name, candidate_sha256 }) => ({
  name,
  checksum: candidate_sha256,
}));
const file = (name) => readFile(new URL("../../" + name, import.meta.url), "utf8");

test("post-install recovery checks all receipts, retired roots and the seal with reads only", async () => {
  const verify = (receipts, records) =>
    verifyInstalledAccountRuntime(
      {
        async query(sql) {
          assert.match(sql, /^SELECT /);
          if (sql.startsWith("SELECT name,checksum")) return [receipts];
          if (sql.startsWith("SELECT COUNT(*) applied")) return [[{ applied: 1 }]];
          if (sql.includes("information_schema.TABLES"))
            return [
              ["historical_organizations", "historical_workspaces"].map((table_name) => ({
                table_name,
                table_type: "BASE TABLE",
              })),
            ];
          if (sql.includes("information_schema.COLUMNS"))
            return [[{ table_name: "historical_workspaces", column_name: "organization_id" }]];
          if (sql.includes("information_schema.KEY_COLUMN_USAGE"))
            return [
              [
                {
                  local_schema: 1,
                  table_name: "historical_organizations",
                  constraint_name: "fk_organizations_default_workspace",
                  column_name: "default_workspace_id",
                  target_table: "historical_workspaces",
                  target_column: "id",
                },
                {
                  local_schema: 1,
                  table_name: "historical_workspaces",
                  constraint_name: "fk_workspaces_org",
                  column_name: "organization_id",
                  target_table: "historical_organizations",
                  target_column: "id",
                },
              ],
            ];
          assert.match(sql, /FROM account_ownership_cutover/);
          return [[{ n: 1, records }]];
        },
      },
      plan,
      "5685779",
    );
  assert.equal((await verify(allReceipts, "5685779")).tenancy.status, "retired");
  await assert.rejects(verify(allReceipts.slice(0, 120), "5685779"), /recovery_receipts_changed/);
  await assert.rejects(verify(allReceipts, "5685778"), /recovery_seal_changed/);
});

test("the acknowledged prefix remains byte-exact and suffix starts at 0190", () => {
  for (const entry of prefix) {
    const sql = execFileSync("git", ["show", old + ":database/migrations/" + entry.name], {
      encoding: "utf8",
    });
    assert.equal(
      createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"),
      entry.rehearsal_sha256,
      entry.name,
    );
  }
  assert.equal(evidence.metadata.name, "0190_evidence_account_scope.up.sql");
  assert.equal(compiled.forward.slice(110).length, 8);
});

test("gaps, a finished 0190, wrong checksums and truncated portable prefixes fail closed", async () => {
  const verify = (rows) => assertAccountEvidenceSuffixPrefix({ query: async () => [rows] }, plan);
  await verify(allReceipts.slice(0, 113));
  for (const rows of [
    allReceipts.slice(0, 112),
    allReceipts.slice(0, 114),
    allReceipts.slice(1, 113),
    [{ ...allReceipts[0], checksum: "1".repeat(64) }, ...allReceipts.slice(1, 113)],
  ])
    await assert.rejects(verify(rows), /suffix_prefix_changed/);
});

test("partial evidence ALTER or changed old unique index is refused", async () => {
  const shapes = ["normalized_records", "raw_evidence"].map((name) => ({
    name,
    columns_found: "organization_id,workspace_id",
  }));
  const keys = [
    {
      name: "normalized_records",
      index_name: "uq_normalized_scope_record_version",
      columns_found: "organization_id,workspace_id,provider_id,record_key,record_version",
      columns_count: 5,
      prefixes: 0,
      is_nonunique: 0,
    },
    {
      name: "raw_evidence",
      index_name: "uq_raw_evidence_scope_dedupe",
      columns_found: "organization_id,workspace_id,provider_id,dedupe_key",
      columns_count: 4,
      prefixes: 0,
      is_nonunique: 0,
    },
  ];
  const query = (shape, index) => ({
    query: async (sql) => [sql.includes("COLUMNS") ? shape : index],
  });
  await assertAccountEvidencePristine(query(shapes, keys));
  await assert.rejects(
    assertAccountEvidencePristine(
      query(
        [
          { ...shapes[0], columns_found: "account_id,history_chain,organization_id,workspace_id" },
          shapes[1],
        ],
        keys,
      ),
    ),
    /not_pristine/,
  );
  await assert.rejects(
    assertAccountEvidencePristine(query(shapes, [{ ...keys[0], prefixes: 1 }, keys[1]])),
    /index_changed/,
  );
});

test("the six 0190 gates are exact read-only SELECTs and a hit aborts before DDL", async () => {
  let n = 0;
  const query = async (sql) => {
    assert.match(sql, /^SELECT 1 FROM /);
    n++;
    return [[]];
  };
  await verifyAccountEvidenceHistoryGuards({ query }, evidence);
  assert.equal(n, 6);
  n = 0;
  await assert.rejects(
    verifyAccountEvidenceHistoryGuards({ query: async () => [++n === 4 ? [1] : []] }, evidence),
    /guard_raw_key/,
  );
  assert.equal(n, 4);
});

test("historical rows retain keys, and native writers and version projections respect the chain", async () => {
  const [sql, writer, api, worker] = await Promise.all([
    file("database/migrations/0190_evidence_account_scope.up.sql"),
    file("apps/worker/src/evidence-persistence.ts"),
    file("apps/api/src/mysql-opportunity-repository.ts"),
    file("apps/worker/src/automatic-selection-evidence.ts"),
  ]);
  assert.match(
    sql,
    /uq_raw_evidence_account_dedupe \(account_id,provider_id,dedupe_key,history_chain\)/,
  );
  assert.match(
    sql,
    /uq_normalized_account_record_version \(account_id,provider_id,record_key,history_chain,record_version\)/,
  );
  assert.equal(
    (sql.match(/history_chain BINARY\(32\) NOT NULL DEFAULT 0x0{64}\b/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(
    sql,
    /SET [^;]*(?:dedupe_key|record_key|record_version|supersedes_record_id|payload_json)\s*=/i,
  );
  assert.match(writer, /e\.history_chain=0x0{64} AND n\.history_chain=e\.history_chain/);
  assert.match(writer, /n\.history_chain=0x0{64} AND e\.history_chain=n\.history_chain/);
  assert.match(api, /n_primary_current\.history_chain=n_primary\.history_chain/);
  assert.match(api, /n\.history_chain=n_seed\.history_chain/);
  assert.match(worker, /history_chain=\$\{record\}_seed\.history_chain/);
});
