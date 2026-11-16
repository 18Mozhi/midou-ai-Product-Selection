import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { backfillAccountOwnedRecords, backfillAccountProductionOwnedRecords } from "../../scripts/backfill-account-owned-records.mjs";
import { planAccountRetirementProduction } from "../../scripts/plan-account-retirement-production.mjs";
import { accountScopeSourceNames } from "../../scripts/stage-account-scope-retirement.mjs";
import { readAccountRetirementReview } from "../../scripts/read-account-retirement-review.mjs";

const run = "00000000-0000-4000-8000-000000000999";
const tableCount = String(accountScopeSourceNames.length);

test("production backfill requires explicit review and refuses writers or a partial receipt prefix", async () => {
  await assert.rejects(
    backfillAccountProductionOwnedRecords({}, run, undefined, {}),
    /account_release_review_digest_required/,
  );
  const plan = await planAccountRetirementProduction();
  for (const [state, prefix, message] of [
    [{ locked: 1, other_sessions: 1 }, [], "account_release_backfill_not_fenced"],
    [{ locked: 1, other_sessions: 0 }, [], "account_release_backfill_requires_exact_prerequisites"],
    [{ locked: 1, other_sessions: 0 }, plan.prerequisites.map(({name, candidate_sha256: checksum}) => ({name, checksum})), "committed_staging_run_required"],
  ]) {
    const calls = [];
    const db = {
      async query(sql) {
        calls.push(sql);
        if (sql.startsWith("SELECT DATABASE")) return [[{ db: "product_scout", version: "5.7.44", authenticated_as: "product_scout@localhost" }]];
        if (sql.startsWith("SELECT IS_USED_LOCK")) return [[state]];
        if (sql.startsWith("SELECT name,checksum")) return [prefix];
        if (sql.startsWith("SET TRANSACTION") || sql.startsWith("START TRANSACTION")) return [];
        if (sql.includes("FROM account_ownership_cutover")) return [[]];
        assert.fail(sql);
      },
      async execute(sql) {
        calls.push(sql);
        assert.match(sql, /^SELECT primary_account_id FROM account_retirement_runs/);
        return [[]];
      },
      async rollback() { calls.push("rollback"); },
    };
    await assert.rejects(backfillAccountProductionOwnedRecords(db, run, "a".repeat(64), plan), { message });
    assert.equal(calls.includes("rollback"), message === "committed_staging_run_required");
    assert.ok(!calls.some((sql) => /^(CREATE|INSERT|UPDATE|DELETE)/.test(sql)));
  }
});

test("indexed review preserves the exact fingerprint order and rejects an unmapped scope", async () => {
  const records = {
    collection_tasks: [{ source_id: "x", legacy_org_id: "a", legacy_workspace_id: "b" }],
    tasks: [{ source_id: "y", legacy_org_id: "c", legacy_workspace_id: "d" }],
  };
  let taskContentSha = "a".repeat(64);
  const connection = {
    async execute(sql, params) {
      if (sql.includes("FROM account_retirement_runs")) return [[{ primary_account_id: "main" }]];
      if (sql.includes("FROM account_retirement_scopes"))
        return [
          [
            { legacy_org_id: "a", legacy_workspace_id: "b", account_id: "main", reason: "shared" },
            {
              legacy_org_id: "c",
              legacy_workspace_id: "d",
              account_id: "private",
              reason: "private",
            },
          ],
        ];
      if (sql.startsWith("SELECT source_table")) {
        const next = Object.keys(records).find((name) => name > params[1]);
        return [next ? [{ source_table: next }] : []];
      }
      if (sql.startsWith("SELECT source_id")) {
        assert.match(sql, /FORCE INDEX \(PRIMARY\)/);
        assert.match(sql, /source_table=\? AND source_id>\?/);
        assert.match(sql, /LOCK IN SHARE MODE$/);
        return [records[params[1]].filter((row) => row.source_id > params[2])];
      }
      if (sql.includes("facts_sha256")) {
        assert.match(
          sql,
          /s.organization_id=r.legacy_org_id AND s.workspace_id=r.legacy_workspace_id/,
        );
        assert.match(sql, /LOCK IN SHARE MODE$/);
        if (params[1] !== "tasks") return [[]];
        assert.match(
          sql,
          /SHA2\(JSON_ARRAY\(s.title,s.description,s.status,s.assignee_id,s.source_type,s.source_ref_id,s.created_by\),256\)/,
        );
        return [
          params[2] || !taskContentSha ? [] : [{ source_id: "y", facts_sha256: taskContentSha }],
        ];
      }
      if (sql.includes("FROM trend_topic_follows")) return [[]];
      assert.fail(sql);
    },
  };
  const canonical = [
    ["account_retirement_review_v3", run, "main"],
    ["scope", "a", "b", "main", "shared"],
    ["scope", "c", "d", "private", "private"],
    ["record", "collection_tasks", "x", "a", "b"],
    ["record", "tasks", "y", "c", "d"],
    ["source_facts", "tasks", "y", taskContentSha],
  ];
  const report = await readAccountRetirementReview(connection, run, { lockForBackfill: true });
  assert.equal(
    report.review_sha256,
    createHash("sha256")
      .update(canonical.map((row) => JSON.stringify(row) + "\n").join(""))
      .digest("hex"),
  );
  assert.deepEqual(report.record_counts_by_table_and_reason, {
    collection_tasks: { shared: "1" },
    tasks: { private: "1" },
  });
  assert.equal(report.source_fact_rows.tasks, "1");
  assert.equal(report.source_fact_rows.supplier_quotes, "0");
  taskContentSha = "b".repeat(64);
  assert.notEqual(
    (await readAccountRetirementReview(connection, run, { lockForBackfill: true })).review_sha256,
    report.review_sha256,
  );
  taskContentSha = null;
  await assert.rejects(
    readAccountRetirementReview(connection, run, { lockForBackfill: true }),
    /account_retirement_review_source_coverage_mismatch:tasks/,
  );
  records.tasks[0].legacy_workspace_id = "unmapped";
  await assert.rejects(
    readAccountRetirementReview(connection, run, { lockForBackfill: true }),
    /account_retirement_review_scope_missing/,
  );
});

function fixture({
  already = false,
  receiptVersion = 25,
  otherRun = false,
  absent = false,
  stale = false,
  broken = false,
  comparisonQuoteMissing = false,
  collision = false,
  readbackMissing = false,
  extra = false,
} = {}) {
  const writes = [];
  const actions = [];
  return {
    writes,
    actions,
    connection: {
      async query(sql) {
        if (sql.startsWith("SHOW COLUMNS FROM automation_rules "))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM approval_templates "))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          sql.startsWith("SHOW COLUMNS FROM trend_monitoring_rules") &&
          sql.includes("historical_context")
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM file_assets"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.startsWith("SHOW COLUMNS FROM notifications"))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (/^SHOW COLUMNS FROM (score_rules|cost_rules) /.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          /^SHOW COLUMNS FROM (?:`reconciliation_runs`|`data_quality_issues`|`competitor_monitor_rules`|exchange_rate_quotes) /.test(
            sql,
          )
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          /^SHOW COLUMNS FROM `(realtime_events|collection_subqueries|selection_journeys)`/.test(
            sql,
          )
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM `trend_(events|topic_change_requests)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM `evidence_data_(events|outbox)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM `opportunity_(outbox|events)`/.test(sql))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (/^SHOW COLUMNS FROM (raw_evidence|normalized_records|trend_topics) /.test(sql))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_searches`"))
          return [["organization_id", "workspace_id"].map((Field) => ({ Field }))];
        if (sql.startsWith("SHOW COLUMNS FROM `sourcing_events`"))
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (
          /^SHOW COLUMNS FROM `(sourcing_comparisons|automation_executions|browser_evidence_artifacts|approval_templates|approval_template_nodes|approval_template_versions|approval_requests|competitor_events|competitor_outbox|trend_outbox|sourcing_outbox)`/.test(
            sql,
          )
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.includes("LEFT JOIN notifications n ON n.id=x.notification_id")) return [[]];
        if (
          new RegExp(
            "^SHOW COLUMNS FROM `(cost_rule_approvals|trend_topic_keywords|trend_signals|task_comments|" +
              "task_events|score_rule_actions|opportunity_operating_facts|opportunity_refresh_jobs|" +
              "opportunity_score_inputs|opportunity_score_jobs|opportunity_profit_jobs|opportunity_score_runs|" +
              "opportunity_profit_runs|opportunity_cost_inputs|opportunity_cost_input_reviews|" +
              "opportunity_evidence_links|opportunity_rule_matches|selection_journey_decisions|" +
              "selection_journey_events|selection_journey_outbox|sourcing_projection_jobs|trend_projection_jobs|" +
              "collection_task_events|collection_task_outbox|collection_task_evidence_links|field_provenance|" +
              "competitor_snapshot_jobs|approval_node_runs|approval_actions|approval_escalation_jobs|" +
              "supplier_quotes|sourcing_purchase_tasks|sourcing_candidates|opportunity_decisions|" +
              "competitor_snapshots|competitor_changes|competitor_alerts)`",
          ).test(sql)
        )
          return [[{ Field: "organization_id" }, { Field: "workspace_id" }]];
        if (sql.includes("SELECT 1 FROM outbox_events o")) return [[]];
        if (sql.includes("SELECT 1 FROM trend_outbox o")) return [[]];
        if (sql.includes("SELECT 1 FROM opportunity_outbox o")) return [[]];
        if (
          /SELECT 1 FROM (?:`evidence_data_(?:events|outbox)` WHERE resource_type|evidence_data_outbox o)/.test(
            sql,
          )
        )
          return [[]];
        if (sql.includes("SELECT 1 FROM browser_evidence_artifacts a")) return [[]];
        if (/SELECT 1 FROM competitor_(snapshot_jobs j|outbox o)/.test(sql)) return [[]];
        if (sql.startsWith("INSERT INTO account_trend_topic_follows")) {
          assert.match(sql, /SELECT id,user_id,topic_id,created_at FROM trend_topic_follows/);
          writes.push("native_follows");
          return [[]];
        }
        if (sql.includes("mismatch_count"))
          return [[{ source_count: "1", target_count: "1", mismatch_count: "0" }]];
        if (sql.includes("FROM `supplier_quotes` q WHERE id IN")) return [[]];
        if (sql.includes("SELECT DATABASE()"))
          return [[{ db: "product_scout_scope_rehearsal", version: "5.7.44" }]];
        if (/^(SET TRANSACTION|START TRANSACTION)/.test(sql)) return [[]];
        if (sql.includes("FROM account_ownership_cutover")) {
          assert.match(sql, /FOR UPDATE$/);
          return [
            otherRun || already
              ? [
                  {
                    source_run_id: otherRun ? "different" : run,
                    primary_account_id: "main",
                    source_record_count: tableCount,
                    contract_version: receiptVersion,
                  },
                ]
              : [],
          ];
        }
        if (sql.includes("FROM workspaces w JOIN organizations"))
          return [[{ workspace_id: "w", organization_id: "org", slug: "team" }]];
        if (sql.includes("FROM account_owned_records")) return [[{ total: tableCount }]];
        if (sql.includes("information_schema.STATISTICS"))
          return [
            [
              {
                table_name: "opportunities",
                index_name: "scope_key",
                column_name: "workspace_id",
                sub_part: null,
              },
            ],
          ];
        if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: "1" }]];
        if (sql.startsWith("SELECT 1 FROM") || sql.startsWith("SELECT 1,(("))
          return [broken ? [{ found: 1 }] : []];
        throw new Error(`unexpected query: ${sql}`);
      },
      async execute(sql, args) {
        if (sql.includes("CAST(source_topic_ids_json AS CHAR)")) return [[]];
        if (sql.includes("CAST(quote_ids_json AS CHAR)"))
          return [
            comparisonQuoteMissing
              ? [
                  {
                    id: run,
                    organization_id: "org",
                    workspace_id: "w",
                    quote_ids: JSON.stringify([run, "00000000-0000-4000-8000-000000000998"]),
                  },
                ]
              : [],
          ];
        if (sql.includes("FROM account_retirement_runs"))
          return [absent ? [] : [{ primary_account_id: "main" }]];
        if (sql.startsWith("SELECT id FROM users")) return [[{ id: "main" }]];
        if (sql.startsWith("SELECT legacy_org_id"))
          return [
            [
              {
                legacy_org_id: "org",
                legacy_workspace_id: "w",
                account_id: stale ? "other" : "main",
                reason: "unassigned",
              },
            ],
          ];
        if (sql.includes("collision_groups"))
          return [
            [{ collision_groups: collision ? "1" : "0", affected_rows: collision ? "2" : "0" }],
          ];
        if (sql.startsWith("SELECT COUNT(*)"))
          return [[{ total: args.length > 1 ? "1" : extra ? "999" : tableCount }]];
        if (sql.includes("LEFT JOIN account_owned_records"))
          return [readbackMissing ? [{ found: 1 }] : []];
        if (sql.startsWith("SELECT 1 FROM")) return [[]];
        if (sql.startsWith("INSERT INTO account_ownership_cutover")) {
          assert.deepEqual(args, [run, "main", tableCount]);
          assert.match(sql, /VALUES \('current',\?,\?,\?,25,UTC_TIMESTAMP/);
          writes.push("receipt");
          return [[]];
        }
        if (sql.startsWith("INSERT INTO account_owned_records")) {
          assert.deepEqual(args, [run]);
          assert.match(sql, /SELECT r.source_table,r.source_id,m.account_id,m.reason/);
          writes.push("account_ownership");
          return [[]];
        }
        throw new Error(`unexpected execute: ${sql}`);
      },
      async rollback() {
        actions.push("ROLLBACK");
      },
      async commit() {
        actions.push("COMMIT");
      },
    },
  };
}

test("backfill rechecks comparison links and rolls back without writing ownership if a quote disappeared", async () => {
  const { connection, writes, actions } = fixture({ comparisonQuoteMissing: true });
  await assert.rejects(
    backfillAccountOwnedRecords(connection, run, { commit: true }),
    /broken_source_link:sourcing_comparisons.quote_ids_json/,
  );
  assert.deepEqual(writes, []);
  assert.deepEqual(actions, ["ROLLBACK"]);
});

test("backfills a single verified staged batch with exact owner and record IDs; dry run rolls back", async () => {
  for (const commit of [false, true]) {
    const { connection, writes, actions } = fixture();
    const report = await backfillAccountOwnedRecords(connection, run, { commit });
    assert.equal(report.account_owned_record_count, tableCount);
    assert.equal(report.status, commit ? "backfilled" : "rolled_back");
    assert.deepEqual(writes, ["receipt", "account_ownership", "native_follows"]);
    assert.deepEqual(actions, [commit ? "COMMIT" : "ROLLBACK"]);
  }
});

test("matching replay is readback-only; stale, conflicting and partially written batches are refused", async () => {
  const replay = fixture({ already: true });
  assert.equal(
    (await backfillAccountOwnedRecords(replay.connection, run, { commit: true })).status,
    "already_backfilled",
  );
  assert.deepEqual(replay.writes, []);
  assert.deepEqual(replay.actions, ["ROLLBACK"]);
  for (const [options, error] of [
    [{ absent: true }, /committed_staging_run_required/],
    [{ stale: true }, /staged_scope_ownership_changed/],
    [{ broken: true }, /broken_source_link/],
    [{ collision: true }, /unresolved_account_unique_key_collisions/],
    [{ otherRun: true }, /another_account_backfill_exists/],
    [{ already: true, receiptVersion: 11 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 14 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 15 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 16 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 17 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 18 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 19 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 20 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 21 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 22 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 23 }, /account_ownership_cutover_receipt_mismatch/],
    [{ already: true, receiptVersion: 24 }, /account_ownership_cutover_receipt_mismatch/],
    [{ extra: true }, /unexpected_staged_records/],
    [{ readbackMissing: true }, /account_owned_record_readback_mismatch/],
  ]) {
    const f = fixture(options);
    await assert.rejects(backfillAccountOwnedRecords(f.connection, run, { commit: true }), error);
    assert.deepEqual(f.actions, ["ROLLBACK"]);
    if (!options.readbackMissing) assert.deepEqual(f.writes, []);
  }
});

test("the durable ownership schema has an account lookup index and no legacy scope dependency", () => {
  const base = new URL("../../database/migrations/", import.meta.url);
  const up = readFileSync(new URL("0078_account_owned_records.up.sql", base), "utf8");
  const down = readFileSync(new URL("0078_account_owned_records.down.sql", base), "utf8");
  assert.match(up, /PRIMARY KEY \(source_table,source_id\)/);
  assert.match(up, /KEY idx_account_owned_record \(account_id,source_table,source_id\)/);
  assert.match(up, /FOREIGN KEY \(account_id\) REFERENCES users \(id\) ON DELETE RESTRICT/);
  assert.doesNotMatch(up, /\b(?:organization_id|workspace_id)\b|REFERENCES account_retirement_/);
  assert.deepEqual(down.trim().split(/\r?\n/), [
    "DROP TABLE account_owned_records;",
    "DROP TABLE account_ownership_cutover;",
  ]);
});
