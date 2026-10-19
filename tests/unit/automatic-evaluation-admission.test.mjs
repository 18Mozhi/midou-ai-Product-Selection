import test from "node:test";
import assert from "node:assert/strict";
import { selectionCandidateExistsSql } from "../../packages/database/dist/index.js";
import {
  automaticEvaluationCandidatePresenceSql,
  automaticEvaluationAdmissionCandidatesSql,
  automaticEvaluationAdmissionInsertSql,
  enqueueMissingSelectionEvaluations,
} from "../../apps/worker/dist/automatic-selection-evaluation-admission.js";
const now = new Date("2026-10-20T00:00:00Z");
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
