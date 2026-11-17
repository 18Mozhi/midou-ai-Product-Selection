import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueNativeTrendProjection,
  nativeTrendDiscoveredCandidatesSql,
} from "../../apps/worker/dist/trend-projection-account-queue.js";

test("discovered scan picks the owned first evidence per task before excluding projected winners", () => {
  const sql = nativeTrendDiscoveredCandidatesSql;
  const winner = sql.indexOf(") winner JOIN normalized_records");
  assert.ok(winner > 0);
  const aggregation = sql.slice(0, winner);
  assert.match(aggregation, /SELECT STRAIGHT_JOIN seed\.task_id/);
  assert.match(aggregation, /SELECT DISTINCT origin\.id task_id/);
  assert.match(aggregation, /MIN\(n_first\.id\) normalized_record_id/);
  assert.match(aggregation, /n_first\.provider_id=seed\.provider_id AND n_first\.account_id=seed\.account_id/);
  assert.match(aggregation, /GROUP BY seed\.task_id,seed\.provider_id,seed\.account_id$/);
  assert.doesNotMatch(aggregation, /trend_projection_jobs|j\.id IS NULL/);
  assert.match(sql.slice(winner), /j\.id IS NULL/);
  assert.match(sql.slice(winner), /t\.id=winner\.task_id AND/);
  assert.match(sql.slice(winner), /cs\.id=e\.collection_subquery_id AND cs\.task_id=t\.id AND cs\.provider_id=n\.provider_id/);
  assert.match(sql, /ORDER BY n\.created_at,n\.id LIMIT 100$/);
});

test("a discovery winner is rechecked in the original scoped insert and is not replaced on a lost race", async () => {
  const events = [];
  const candidates = [];
  const pool = {
    async query(sql) {
      candidates.push(sql);
      return [sql === nativeTrendDiscoveredCandidatesSql ? [{ id: "record", account_id: "account" }] : []];
    },
    async getConnection() {
      return {
        async beginTransaction() { events.push("begin"); },
        async query(sql, bindings) {
          events.push("insert");
          assert.match(sql, /^INSERT IGNORE INTO trend_projection_jobs /);
          assert.match(sql, /n\.id=\(SELECT MIN\(n_first\.id\)/);
          assert.match(sql, /AND n\.id=\? AND n\.account_id=\? LIMIT 1$/);
          assert.deepEqual(bindings.slice(-2), ["record", "account"]);
          return [{ affectedRows: 0 }];
        },
        async commit() { events.push("commit"); },
        release() { events.push("release"); },
      };
    },
  };
  await enqueueNativeTrendProjection(pool, new Date(0));
  assert.equal(candidates.length, 2);
  assert.equal(candidates[1], nativeTrendDiscoveredCandidatesSql);
  assert.deepEqual(events, ["begin", "insert", "commit", "release"]);
});
