import test from "node:test";
import assert from "node:assert/strict";

import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";

const now = new Date("2026-09-04T05:30:00.000Z");

function createPool(job) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql) => {
      if (sql.startsWith("SELECT * FROM trend_projection_jobs")) {
        calls.push("claim");
        return [job ? [job] : [], []];
      }
      if (sql.startsWith("UPDATE trend_projection_jobs SET status='leased'")) {
        calls.push("lease");
        return [[], []];
      }
      if (sql.startsWith("SELECT n.organization_id")) {
        calls.push("record");
        return [
          [
            {
              organization_id: "organization-1",
              workspace_id: "workspace-1",
              provider_id: "provider-1",
              provider_code: "amazon_product",
              raw_evidence_id: "evidence-1",
              collection_task_id: "collection-task-1",
              target_json: JSON.stringify({
                projection_type: "rule_product_discovery",
                monitoring_rule_id: "rule-1",
                query: "手机壳",
              }),
              payload_json: { title: "Phone Case" },
              created_by: "user-1",
              request_id: "request-1",
              trace_id: "trace-1",
            },
          ],
          [],
        ];
      }
      throw new Error(`unexpected connection query: ${sql}`);
    },
  };
  return {
    calls,
    pool: {
      query: async (sql) => {
        assert.match(sql, /^INSERT IGNORE INTO trend_projection_jobs/);
        calls.push("enqueue");
        return [[], []];
      },
      getConnection: async () => connection,
    },
  };
}

test("projection worker serves a queued job before running downstream repair", async () => {
  const { pool, calls } = createPool({
    id: "job-1",
    organization_id: "organization-1",
    workspace_id: "workspace-1",
    normalized_record_id: "record-1",
    attempt_count: 0,
  });
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.enqueueMissingAutomaticDownstream = async () => calls.push("repair");
  worker.persistence.project = async () => {
    calls.push("project");
    return "topic-1";
  };

  const result = await worker.processOnce();

  assert.deepEqual(result, { status: "succeeded", job_id: "job-1", topic_id: "topic-1" });
  assert.equal(calls.includes("repair"), false);
  assert.ok(calls.indexOf("enqueue") < calls.indexOf("claim"));
  assert.ok(calls.indexOf("claim") < calls.indexOf("project"));
});

test("projection worker runs downstream repair only after finding the queue idle", async () => {
  const { pool, calls } = createPool(null);
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.enqueueMissingAutomaticDownstream = async () => calls.push("repair");

  const result = await worker.processOnce();

  assert.deepEqual(result, { status: "idle" });
  assert.ok(calls.indexOf("claim") < calls.indexOf("repair"));
});
