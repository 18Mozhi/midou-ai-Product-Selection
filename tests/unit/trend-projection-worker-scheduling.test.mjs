import test from "node:test";
import assert from "node:assert/strict";

import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import {
  projectedTrendProviderContext,
  isAutomaticProductDiscoveryProvider,
} from "../../apps/worker/dist/trend-projection-calculation.js";

const now = new Date("2026-09-04T05:30:00.000Z");
const jobScope = {
  organization_id: "organization-1",
  workspace_id: "workspace-1",
  normalized_record_id: "record-1",
};

function createPool(job) {
  const calls = [];
  const statements = [];
  let claimed;
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql) => {
      if (sql.startsWith("SELECT * FROM trend_projection_jobs")) {
        calls.push("claim");
        claimed = Array.isArray(job) ? job.shift() : job;
        return [claimed ? [claimed] : [], []];
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
              provider_code: claimed?.providerCode ?? "amazon_product",
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
    statements,
    pool: {
      query: async (sql) => {
        statements.push(sql);
        if (sql.startsWith("UPDATE trend_projection_jobs SET status=?")) calls.push("finish");
        else {
          assert.match(sql, /^INSERT IGNORE INTO trend_projection_jobs/);
          calls.push("enqueue");
        }
        return [[], []];
      },
      getConnection: async () => connection,
    },
  };
}

test("1688 sourcing evidence cannot become intelligence or trigger product discovery", () => {
  assert.deepEqual(projectedTrendProviderContext("1688_search"), { accepted: false });
  assert.equal(isAutomaticProductDiscoveryProvider("1688_search"), false);
});

test("legacy supplier projections drain before a real job without running supplier intelligence", async () => {
  const jobs = [
    { ...jobScope, id: "legacy", providerCode: "1688_search", attempt_count: 0 },
    { ...jobScope, id: "news", providerCode: "amazon_product", attempt_count: 0 },
  ];
  const { pool, calls, statements } = createPool(jobs);
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.project = async () => "topic-1";
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  assert.deepEqual(await worker.processOnce(), {
    status: "succeeded",
    job_id: "news",
    topic_id: "topic-1",
  });
  assert.equal(calls.filter((call) => call === "finish").length, 1);
  assert.match(statements[0], /p\.code NOT IN \('1688_search','amazon_product'/);
});

test("legacy supplier cleanup is bounded to twenty durable jobs per polling turn", async () => {
  const jobs = Array.from({ length: 21 }, (_, index) => ({
    ...jobScope,
    id: `legacy-${index}`,
    providerCode: "1688_search",
    attempt_count: 0,
  }));
  const { pool, calls } = createPool(jobs);
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  worker.persistence.project = async () => {
    throw new Error("supplier must not project");
  };
  assert.deepEqual(await worker.processOnce(), { status: "succeeded_empty", job_id: "legacy-19" });
  assert.equal(calls.filter((call) => call === "finish").length, 20);
  assert.equal(jobs.length, 1);
});

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

test("projection worker also repairs immediately when the queue is idle", async () => {
  const { pool, calls } = createPool(null);
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.enqueueMissingAutomaticDownstream = async () => calls.push("repair");

  const result = await worker.processOnce();

  assert.deepEqual(result, { status: "idle" });
  assert.ok(calls.indexOf("claim") < calls.indexOf("repair"));
});

test("a continuously busy projection queue gives historical repair a bounded turn", async () => {
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
  for (let index = 0; index < 20; index += 1) await worker.processOnce();
  assert.equal(calls.includes("repair"), false);
  await worker.processOnce();
  const repair = calls.indexOf("repair");
  assert.equal(calls.slice(0, repair).filter((value) => value === "project").length, 20);
  assert.equal(calls.slice(repair).filter((value) => value === "project").length, 1);
});

test("failed bounded repair does not permanently block fresh projection work", async () => {
  const { pool } = createPool({
    id: "job-1",
    organization_id: "organization-1",
    workspace_id: "workspace-1",
    normalized_record_id: "record-1",
    attempt_count: 0,
  });
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.persistence.project = async () => "topic-1";
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {
    throw new Error("repair failed");
  };
  for (let index = 0; index < 20; index += 1) await worker.processOnce();
  await assert.rejects(worker.processOnce(), /repair failed/);
  assert.equal((await worker.processOnce()).status, "succeeded");
});
