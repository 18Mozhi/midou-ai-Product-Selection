import test from "node:test";
import assert from "node:assert/strict";
import { selectionCandidateExistsSql } from "../../packages/database/dist/index.js";
import {
  automaticEvaluationCandidatePresenceSql,
  automaticEvaluationAdmissionCandidatesSql,
  automaticEvaluationAdmissionInsertSql,
  nativeAutomaticEvaluationAdmissionCandidatesSql,
  nativeAutomaticEvaluationAdmissionInsertSql,
  nativeAutomaticEvaluationLockSql,
  accountAutomaticEvaluationQueries,
  enqueueMissingSelectionEvaluations,
} from "../../apps/worker/dist/automatic-selection-evaluation-admission.js";
import { skippedSelectionAccountRecoverySql, recoverSkippedSelectionEvaluations } from "../../apps/worker/dist/automatic-selection-skipped-recovery.js";
import { deviceFitAccountRecoverySql, recoverDeviceFitEvaluations, SUPPLY_DEVICE_FIT_REVISION } from "../../apps/worker/dist/automatic-selection-device-fit-recovery.js";
import { primarySourceAccountRecoverySql, recoverPrimarySourceEvaluations } from "../../apps/worker/dist/primary-source-support-recovery.js";
import { PRIMARY_SOURCE_SUPPORT_REVISION } from "../../apps/worker/dist/primary-source-support.js";
import { supplyClassifierAccountRecoverySql, recoverSupplyClassifierEvaluations, SUPPLY_TITLE_CLASSIFIER_REVISION } from "../../apps/worker/dist/automatic-selection-classifier-recovery.js";
const now = new Date("2026-10-20T00:00:00Z");
const legacyColumns = [[{Field:"organization_id"},{Field:"workspace_id"}]];

test("0195 admission, lock and all revision recoveries use the native account and original evidence lineage", async () => {
  for (const sql of [...Object.values(accountAutomaticEvaluationQueries),
    ...[skippedSelectionAccountRecoverySql, deviceFitAccountRecoverySql, primarySourceAccountRecoverySql,
      supplyClassifierAccountRecoverySql].flatMap(Object.values)]) {
    assert.doesNotMatch(sql, /organization_id|workspace_id|\b(organizations|workspaces)\b/);
    assert.match(sql, /o\.account_id=ao\.account_id/);
    assert.match(sql, /seed_t\.account_id=seed_e\.account_id/);
    assert.match(sql, /active_t\.account_id=seed_e\.account_id/);
    assert.match(sql, /link_owner\.source_id=l_primary\.id/);
    assert.match(sql, /seed_e\.account_id=ao\.account_id/);
  }
  const calls = [];
  const db = { async query(sql, args) {
    calls.push([sql,args]);
    return sql.startsWith("SELECT") ? [[{ id: "id", opportunity_id: "id", account_id: "owner" }]] : [{ affectedRows: 1 }];
  } };
  assert.equal(await enqueueMissingSelectionEvaluations(db, now, true, true), 1);
  assert.equal(await recoverSkippedSelectionEvaluations(db, now, true, true), 1);
  assert.deepEqual(calls, [[accountAutomaticEvaluationQueries.candidates,undefined],
    [accountAutomaticEvaluationQueries.insert,[now,now,now,"id","owner"]],
    [skippedSelectionAccountRecoverySql.candidates,undefined],
    [skippedSelectionAccountRecoverySql.update,[now,now,"id","owner"]]]);
});

test("0195 revision recoveries pin both revisions and recheck the same account at update time", async () => {
  for (const [operation, queries, revision] of [
    [recoverDeviceFitEvaluations, deviceFitAccountRecoverySql, SUPPLY_DEVICE_FIT_REVISION],
    [recoverPrimarySourceEvaluations, primarySourceAccountRecoverySql, PRIMARY_SOURCE_SUPPORT_REVISION],
    [recoverSupplyClassifierEvaluations, supplyClassifierAccountRecoverySql, SUPPLY_TITLE_CLASSIFIER_REVISION],
  ]) {
    let reads = 0, writes = 0;
    assert.equal(await operation({async query(sql, bound) {
      assert.equal(Array.from(sql.replace(/'[^']*'/g, "").matchAll(/\?/g)).length, bound.length);
      if (sql === queries.candidates) {
        reads++;
        assert.deepEqual(bound, [revision]);
        return [[{ opportunity_id: "original", account_id: "scanned-owner" }]];
      }
      writes++;
      assert.equal(sql, queries.update);
      assert.deepEqual(bound, [revision, now, now, "original", revision, "scanned-owner"]);
      assert.match(sql, /o\.account_id=ao\.account_id AND ao\.account_id=\?/);
      return [{ affectedRows: 0 }]; // The account/eligibility changed between the scan and update.
    }}, now, true, true), 0);
    assert.deepEqual([reads, writes], [1, 1]);
  }
});
test("0190 admission rechecks the same primary lineage and bound owner under insertion and evaluation lock", async () => {
  const calls = [];
  for (const sql of [nativeAutomaticEvaluationAdmissionCandidatesSql,nativeAutomaticEvaluationAdmissionInsertSql,nativeAutomaticEvaluationLockSql]) {
    assert.doesNotMatch(sql, /\bn_primary(?:_current)?\.(organization_id|workspace_id)|uq_normalized_scope_record_version/);
    assert.match(sql, /seed_e.account_id=ao.account_id/);
    assert.match(sql, /active_t.workspace_id=seed_t.workspace_id/);
    assert.match(sql, /ao.account_id=cut.primary_account_id/);
  }
  assert.equal(await enqueueMissingSelectionEvaluations({async query(sql,args) {
    if (sql.startsWith("SHOW COLUMNS")) return [[{Field:"account_id"}]];
    calls.push([sql,args]);
    return sql === nativeAutomaticEvaluationAdmissionCandidatesSql
      ? [[{id:"id",organization_id:"org",workspace_id:"ws",account_id:"owner"}]] : [{affectedRows:1}];
  }}, now), 1);
  assert.deepEqual(calls, [[nativeAutomaticEvaluationAdmissionCandidatesSql,undefined],
    [nativeAutomaticEvaluationAdmissionInsertSql,[now,now,now,"id","org","ws","owner"]]]);
});
test("indexed presence restores exactly the original scoped source proof", () => {
  const restored = automaticEvaluationCandidatePresenceSql
    .replace(
      "STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (idx_normalized_evidence) ON",
      "JOIN normalized_records n_primary ON",
    )
    .replace(
      "STRAIGHT_JOIN normalized_records n_primary_current FORCE INDEX (uq_normalized_scope_record_version) ON",
      "JOIN normalized_records n_primary_current ON",
    );
  assert.equal(restored, selectionCandidateExistsSql);
  assert.match(
    automaticEvaluationCandidatePresenceSql,
    /n_primary FORCE INDEX \(idx_normalized_evidence\)/,
  );
  assert.match(
    automaticEvaluationCandidatePresenceSql,
    /n_primary_current FORCE INDEX \(uq_normalized_scope_record_version\)/,
  );
  assert.doesNotMatch(automaticEvaluationCandidatePresenceSql, /ORDER BY|LIMIT|FOR UPDATE/);
});
test("ordinary bounded read filters full eligibility before LIMIT and never writes or locks", () => {
  assert.ok(
    automaticEvaluationAdmissionCandidatesSql.startsWith(
      "SELECT o.id,o.organization_id,o.workspace_id",
    ),
  );
  assert.ok(
    automaticEvaluationAdmissionCandidatesSql.endsWith(
      automaticEvaluationCandidatePresenceSql + " LIMIT 100",
    ),
  );
  assert.match(
    automaticEvaluationAdmissionCandidatesSql,
    /LEFT JOIN automatic_selection_evaluations e ON e.opportunity_id=o.id WHERE e.opportunity_id IS NULL/,
  );
  assert.doesNotMatch(automaticEvaluationAdmissionCandidatesSql, /FOR UPDATE|INSERT|UPDATE /);
});
test("per-resource admission repeats original lifecycle, pending and entire presence proof", () => {
  assert.match(
    automaticEvaluationAdmissionInsertSql,
    /INSERT IGNORE INTO automatic_selection_evaluations/,
  );
  assert.match(
    automaticEvaluationAdmissionInsertSql,
    /WHERE o.id=\? AND o.organization_id=\? AND o.workspace_id=\?/,
  );
  for (const sql of [
    automaticEvaluationAdmissionCandidatesSql,
    automaticEvaluationAdmissionInsertSql,
  ]) {
    assert.match(
      sql,
      /o.decision_status='pending' AND o.lifecycle_status NOT IN \('archived','deleted'\)/,
    );
    assert.ok(sql.includes(automaticEvaluationCandidatePresenceSql));
  }
  assert.match(automaticEvaluationAdmissionInsertSql, /'queued',0,\?,\?,\?/);
  assert.doesNotMatch(
    automaticEvaluationAdmissionInsertSql,
    /ON DUPLICATE|lease_owner|result_json|UPDATE |collection_tasks|opportunity_events/,
  );
});
test("empty candidate read has no write, model, queue claim or transaction", async () => {
  const calls = [];
  const pool = {
    query: async (sql, args) => {
      if (sql.startsWith("SHOW COLUMNS")) return legacyColumns;
      calls.push({ sql, args });
      return [[]];
    },
  };
  assert.equal(await enqueueMissingSelectionEvaluations(pool, now), 0);
  assert.deepEqual(calls, [{ sql: automaticEvaluationAdmissionCandidatesSql, args: undefined }]);
});
test("two selected scopes are rechecked independently and only actually inserted rows count", async () => {
  const rows = [
      { id: "one", organization_id: "org-a", workspace_id: "ws-a" },
      { id: "two", organization_id: "org-b", workspace_id: "ws-b" },
    ],
    calls = [];
  const pool = {
    query: async (sql, args) => {
      if (sql.startsWith("SHOW COLUMNS")) return legacyColumns;
      calls.push({ sql, args });
      return sql.startsWith("SELECT") ? [rows] : [{ affectedRows: args[3] === "one" ? 1 : 0 }];
    },
  };
  assert.equal(await enqueueMissingSelectionEvaluations(pool, now), 1);
  assert.deepEqual(
    calls.slice(1).map((x) => x.args),
    rows.map((r) => [now, now, now, r.id, r.organization_id, r.workspace_id]),
  );
  assert.ok(calls.slice(1).every((x) => x.sql === automaticEvaluationAdmissionInsertSql));
});
test("lost or duplicate candidates do not reset existing evaluation state", async () => {
  const calls = [];
  const pool = {
    query: async (sql, args) => {
      if (sql.startsWith("SHOW COLUMNS")) return legacyColumns;
      calls.push(sql);
      return sql.startsWith("SELECT")
        ? [[{ id: "changed", organization_id: "org", workspace_id: "ws" }]]
        : [{ affectedRows: 0 }];
    },
  };
  assert.equal(await enqueueMissingSelectionEvaluations(pool, now), 0);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(
    calls.join(" "),
    /UPDATE automatic_selection_evaluations|SET status|attempt_count=0/,
  );
});
test("read failure aborts without any point insert", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      enqueueMissingSelectionEvaluations(
        {
          query: async () => {
            calls++;
            throw new Error("read unavailable");
          },
        },
        now,
      ),
    /read unavailable/,
  );
  assert.equal(calls, 1);
});
