import test from "node:test";
import assert from "node:assert/strict";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import { collectedProductProjectionSql } from "../../apps/worker/dist/collected-product-projection-policy.js";

const now = new Date("2026-10-20T00:00:00Z");
function fixture(options = {}) {
  const calls = [];
  const row = {
    id: "job",
    organization_id: "org",
    workspace_id: "ws",
    normalized_record_id: "record",
    attempt_count: 0,
  };
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, params) => {
      calls.push([sql, params]);
      assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.startsWith("SELECT id,organization_id")) return [[row]];
      if (sql.startsWith("SELECT * FROM trend_projection_jobs")) return [options.lost ? [] : [row]];
      if (sql.startsWith("UPDATE trend_projection_jobs")) return [{ affectedRows: 1 }];
      if (sql.startsWith("SELECT n.organization_id"))
        return [
          [
            {
              ...row,
              provider_id: "provider",
              provider_code: "amazon_product",
              raw_evidence_id: "evidence",
              collection_task_id: "task",
              payload_json: { title: "Fan" },
              target_json: {
                projection_type: "intelligence_product_discovery",
                intelligence_source_record_id: "00000000-0000-4000-8000-000000000123",
                query: "Fan",
              },
            },
          ],
        ];
      throw Error("unexpected query");
    },
  };
  return {
    calls,
    worker: new MySqlTrendProjectionWorker(
      { getConnection: async () => connection },
      "worker",
      120,
      () => now,
    ),
  };
}
test("collected-result candidate and PK recheck both bind original completion1000 and exact evidence guard", async () => {
  const f = fixture();
  assert.equal((await f.worker.claim(true)).id, "job");
  const reads = f.calls.filter(
    ([sql]) => sql.startsWith("SELECT") && sql.includes("FROM trend_projection_jobs"),
  );
  assert.equal(reads.length, 2);
  for (const [sql, params] of reads) {
    assert.ok(sql.includes(collectedProductProjectionSql));
    assert.equal(params.at(-1), 1000);
  }
  assert.doesNotMatch(reads[0][0], /FOR UPDATE/);
  assert.match(reads[1][0], /WHERE id=\? AND organization_id=\? AND workspace_id=\?/);
  assert.deepEqual(reads[1][1].slice(0, 3), ["job", "org", "ws"]);
});
test("lost collected-result eligibility consumes no attempt", async () => {
  const f = fixture({ lost: true });
  assert.equal(await f.worker.claim(true), null);
  assert.ok(!f.calls.some(([sql]) => sql.startsWith("UPDATE")));
});
test("raw projection admission still binds997 without the collected predicate", async () => {
  const f = fixture();
  await f.worker.claim();
  const read = f.calls.find(([sql]) => sql.startsWith("SELECT id,organization_id"));
  assert.equal(read[1].at(-1), 997);
  assert.ok(!read[0].includes(collectedProductProjectionSql));
});
test("already-collected turn precedes a producer, then yields to the original repair/fresh turn", async () => {
  const f = fixture(),
    events = [];
  const w = f.worker;
  w.enqueueMissing = async () => {};
  w.sourceRecovery.processOnce = async () => 0;
  w.claim = async (only) => {
    events.push(only ? "collected-claim" : "raw-claim");
    return { id: only ? "collected" : "raw", providerCode: "amazon_product" };
  };
  w.prepareIntelligence = async () => true;
  w.persistence.project = async (job) => {
    events.push(job.id + "-project");
    return "topic";
  };
  w.persistence.enqueueMissingAutomaticDownstream = async () => {
    events.push("repair");
    return true;
  };
  await w.processOnce();
  await w.processOnce();
  await w.processOnce();
  assert.deepEqual(events, [
    "collected-claim",
    "collected-project",
    "repair",
    "raw-claim",
    "raw-project",
    "collected-claim",
    "collected-project",
  ]);
});
