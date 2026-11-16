import test from "node:test";
import assert from "node:assert/strict";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import { collectedProductProjectionSql } from "../../apps/worker/dist/collected-product-projection-policy.js";

const now = new Date("2026-10-20T00:00:00Z");
function fixture(options = {}) {
  const calls = [];
  const row = {
    id: "job",
    normalized_record_id: "record",
    attempt_count: 0,
  };
  const connection = {
    beginTransaction: async () => calls.push(["begin"]),
    commit: async () => calls.push(["commit"]),
    rollback: async () => calls.push(["rollback"]),
    release: () => calls.push(["release"]),
    query: async (sql, params) => {
      if (sql.startsWith("SHOW COLUMNS FROM collection_tasks"))
        return [options.native?[{Field:"account_id"}]:[{Field:"organization_id"},{Field:"workspace_id"}]];
      calls.push([sql, params]);
      assert.equal((sql.match(/\?/g) ?? []).length, params.length);
      if (sql.startsWith("SELECT id,normalized_record_id")) return [[row]];
      if (sql.startsWith("SELECT * FROM trend_projection_jobs")) return [options.lost ? [] : [row]];
      if (sql.startsWith("UPDATE trend_projection_jobs")) return [{ affectedRows: 1 }];
      if (sql.startsWith("SELECT t.organization_id") || sql.startsWith("SELECT t.account_id"))
        return [
          [
            {
              ...row,
              organization_id: "org",
              workspace_id: "ws",
              account_id: "original-account",
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
test("native claim rechecks owned job and original evidence without old tenant fields", async () => {
  const f=fixture({native:true});
  const claimed=await f.worker.claim(true);
  assert.deepEqual([claimed.id,claimed.normalizedRecordId,claimed.rawEvidenceId,claimed.organizationId,claimed.workspaceId],
    ["job","record","evidence","",""]);
  const reads=f.calls.filter(([s])=>s.startsWith("SELECT")&&s.includes("FROM trend_projection_jobs"));
  assert.equal(reads.length,2);
  for(const [sql,params] of reads){
    assert.doesNotMatch(sql,/organization_id|workspace_id/);
    assert.match(sql,/a.source_table='trend_projection_jobs' AND a.source_id=trend_projection_jobs.id AND a.account_id=t.account_id/);
    assert.match(sql,/n_collected.account_id=e_collected.account_id/);
    assert.equal(params.at(-1),1000);
  }
});
test("collected-result candidate and PK recheck both bind original completion1000 and exact evidence guard", async () => {
  const f = fixture();
  const claimed = await f.worker.claim(true);
  assert.deepEqual([claimed.id, claimed.organizationId, claimed.workspaceId], ["job", "org", "ws"]);
  const reads = f.calls.filter(
    ([sql]) => sql.startsWith("SELECT") && sql.includes("FROM trend_projection_jobs"),
  );
  assert.equal(reads.length, 2);
  for (const [sql, params] of reads) {
    assert.ok(sql.includes(collectedProductProjectionSql));
    assert.equal(params.at(-1), 1000);
  }
  assert.doesNotMatch(reads[0][0], /FOR UPDATE/);
  assert.match(reads[1][0], /WHERE id=\? AND normalized_record_id=\?/);
  assert.deepEqual(reads[1][1].slice(0, 2), ["job", "record"]);
  assert.match(reads[1][0], /projection_scope_record.id=trend_projection_jobs.normalized_record_id/);
});
test("lost collected-result eligibility consumes no attempt", async () => {
  const f = fixture({ lost: true });
  assert.equal(await f.worker.claim(true), null);
  assert.ok(!f.calls.some(([sql]) => sql.startsWith("UPDATE")));
});
test("raw projection admission still binds997 without the collected predicate", async () => {
  const f = fixture();
  await f.worker.claim();
  const read = f.calls.find(([sql]) => sql.startsWith("SELECT id,normalized_record_id"));
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

test("a due collected result retains its turn under backpressure and blocks this loop's producer", async () => {
  const f = fixture(),
    events = [],
    w = f.worker;
  w.enqueueMissing = async () => {};
  w.sourceRecovery.processOnce = async () => 0;
  w.claim = async (only) => {
    events.push(only ? "collected-check" : "raw-check");
    return null;
  };
  w.hasReadyCollectedResult = async () => true;
  w.persistence.enqueueMissingAutomaticDownstream = async () => {
    throw Error("producer must wait");
  };
  for (let i = 0; i < 3; i++) assert.deepEqual(await w.processOnce(), { status: "idle" });
  assert.deepEqual(events, ["collected-check", "collected-check", "collected-check"]);
  assert.equal(w.preferCollectedResult, true);
});

test("ready-collected debt uses the same proof and due/active guards without a capacity condition", async () => {
  const calls = [];
  const w = new MySqlTrendProjectionWorker(
    {
      query: async (sql, params) => {
        if (sql.startsWith("SHOW COLUMNS FROM collection_tasks")) return [[{Field:"organization_id"},{Field:"workspace_id"}]];
        calls.push([sql, params]);
        return [[{ id: "job" }]];
      },
    },
    "worker",
    120,
    () => now,
  );
  assert.equal(await w.hasReadyCollectedResult(), true);
  assert.ok(calls[0][0].includes(collectedProductProjectionSql));
  assert.match(calls[0][0], /available_at<=\?.*lease_expires_at<=\?/);
  assert.match(calls[0][0], /collection_scope_workspace.status='active'/);
  assert.doesNotMatch(calls[0][0], /backlog|FOR UPDATE|UPDATE |INSERT /);
  assert.deepEqual(calls[0][1], [now, now]);
});
