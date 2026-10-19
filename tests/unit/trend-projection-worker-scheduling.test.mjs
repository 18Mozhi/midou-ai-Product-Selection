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

function createPool(job, loseCandidate = false) {
  const calls = [];
  const statements = [];
  let claimed;
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql) => {
      statements.push(sql);
      if (sql.startsWith("SELECT * FROM trend_projection_jobs")) {
        calls.push("claim");
        if (loseCandidate) return [[], []];
        claimed = Array.isArray(job) ? job.shift() : job;
        return [claimed ? [claimed] : [], []];
      }
      if (sql.startsWith("SELECT id,organization_id,workspace_id FROM trend_projection_jobs")) {
        calls.push("candidate");
        const candidate = Array.isArray(job) ? job[0] : job;
        return [candidate ? [candidate] : [], []];
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
          assert.match(
            sql,
            /^SELECT n.id,n.organization_id,n.workspace_id FROM normalized_records n /,
          );
          calls.push("enqueue");
        }
        return [[], []];
      },
      getConnection: async () => connection,
    },
  };
}

test("projection admission scans without write locks and inserts only scoped record identities", async () => {
  const reads = [],
    writes = [];
  const worker = new MySqlTrendProjectionWorker(
    {
      query: async (sql, params) => {
        if (sql.startsWith("SELECT n.id,n.organization_id,n.workspace_id")) {
          reads.push(sql);
          return [[{ id: "record-1", organization_id: "org-1", workspace_id: "ws-1" }]];
        }
        writes.push([sql, params]);
        return [{ affectedRows: 0 }];
      },
    },
    "worker",
    120,
    () => now,
  );
  await worker.enqueueMissing();
  assert.equal(reads.length, 2);
  assert.equal(writes.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.doesNotMatch(reads[i], /FOR UPDATE|LOCK IN SHARE MODE|INSERT/);
    assert.match(reads[i], /ORDER BY n.created_at LIMIT 100$/);
    const source = reads[i]
      .replace(/^SELECT n.id,n.organization_id,n.workspace_id /, "")
      .replace(/ ORDER BY n.created_at LIMIT 100$/, "");
    assert.ok(
      writes[i][0].includes(source + " AND n.id=? AND n.organization_id=? AND n.workspace_id=?"),
    );
    assert.match(writes[i][0], /^INSERT IGNORE INTO trend_projection_jobs/);
    assert.match(writes[i][0], /LIMIT 1$/);
    assert.deepEqual(writes[i][1], [now, now, now, "record-1", "org-1", "ws-1"]);
    assert.match(source, /n.status='active' AND j.id IS NULL/);
    assert.match(source, /collection_scope_workspace.status='active'/);
  }
  assert.match(reads[1], /t.status IN \('succeeded','completed_with_warnings'\)/);
  assert.match(reads[1], /MIN\(n_first.id\)/);
});

test("projection locks only the selected scoped ID and rechecks eligibility", async () => {
  const { pool, statements } = createPool({ ...jobScope, id: "job-1", attempt_count: 0 });
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.project = async () => "topic-1";
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  await worker.processOnce();
  const locks = statements.filter((sql) => sql.endsWith("FOR UPDATE"));
  assert.equal(locks.length, 1);
  assert.match(locks[0], /WHERE id=\? AND organization_id=\? AND workspace_id=\?/);
  assert.match(locks[0], /status='scheduled'.*status='leased'/);
  assert.doesNotMatch(locks[0], /ORDER BY/);
  const candidate = statements.find((sql) => sql.startsWith("SELECT id,organization_id"));
  assert.doesNotMatch(candidate, /FOR UPDATE/);
  for (const sql of [
    candidate,
    locks[0],
    ...statements.filter((sql) => sql.startsWith("INSERT IGNORE INTO trend_projection_jobs")),
  ]) {
    assert.match(sql, /collection_scope_org.status='active'/);
    assert.match(sql, /collection_scope_workspace.status='active'/);
    assert.match(sql, /collection_scope_workspace.organization_id=collection_scope_org.id/);
  }
  assert.match(locks[0], /collection_scope_org.id=trend_projection_jobs.organization_id/);
  assert.match(locks[0], /collection_scope_workspace.id=trend_projection_jobs.workspace_id/);
  assert.match(
    candidate,
    /ORDER BY COALESCE\(\(SELECT CASE WHEN p_intelligence.code='amazon_product'/,
  );
  assert.match(
    candidate,
    /intelligence_product_discovery' THEN 0 WHEN p_intelligence.access_mode='public_rss' THEN 1 ELSE 2 END/,
  );
  assert.match(candidate, /\),2\),available_at,id LIMIT 1$/);
  assert.match(candidate, /p_intelligence.access_mode='public_rss'/);
  assert.match(candidate, /projection_type.*intelligence_product_discovery/);
  assert.match(candidate, /n_intelligence.organization_id=trend_projection_jobs.organization_id/);
});

test("losing the candidate race never projects or overwrites another lease", async () => {
  const { pool, calls } = createPool({ ...jobScope, id: "job-1", attempt_count: 0 }, true);
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.project = async () => {
    throw new Error("lost lease must not project");
  };
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  assert.deepEqual(await worker.processOnce(), { status: "idle" });
  assert.equal(calls.includes("lease"), false);
});

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
  worker.sourceRecovery.processOnce = async () => 0;
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
  worker.sourceRecovery.processOnce = async () => 0;
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
  worker.sourceRecovery.processOnce = async () => 0;
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
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => calls.push("repair");

  const result = await worker.processOnce();

  assert.deepEqual(result, { status: "idle" });
  assert.ok(calls.indexOf("claim") < calls.indexOf("repair"));
});

test("each fresh projection gives downstream completion the next turn", async () => {
  const { pool, calls } = createPool({
    id: "job-1",
    organization_id: "organization-1",
    workspace_id: "workspace-1",
    normalized_record_id: "record-1",
    attempt_count: 0,
  });
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => calls.push("repair");
  worker.persistence.project = async () => {
    calls.push("project");
    return "topic-1";
  };
  await worker.processOnce();
  assert.equal(calls.includes("repair"), false);
  await worker.processOnce();
  const repair = calls.indexOf("repair");
  assert.equal(calls.slice(0, repair).filter((value) => value === "project").length, 1);
  assert.equal(calls.slice(repair).filter((value) => value === "project").length, 1);
});

test("successful completion turns alternate with fresh work without requiring twenty claims", async () => {
  const { pool, calls } = createPool({ ...jobScope, id: "fresh", attempt_count: 0 });
  const worker = new MySqlTrendProjectionWorker(pool, "worker", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.project = async () => {
    calls.push("fresh-work");
    return "topic";
  };
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {
    calls.push("completion-turn");
    return true;
  };
  for (let index = 0; index < 6; index++)
    assert.equal((await worker.processOnce()).status, "succeeded");
  assert.deepEqual(
    calls.filter((value) => ["fresh-work", "completion-turn"].includes(value)),
    ["fresh-work", ...Array.from({ length: 5 }, () => ["completion-turn", "fresh-work"]).flat()],
  );
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
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.project = async () => "topic-1";
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {
    throw new Error("repair failed");
  };
  await worker.processOnce();
  await assert.rejects(worker.processOnce(), /repair failed/);
  assert.equal((await worker.processOnce()).status, "succeeded");
});

test("idle backpressure preserves the owed completion turn before the next fresh claim", async () => {
  const { pool, calls } = createPool({ ...jobScope, id: "fresh", attempt_count: 0 });
  const worker = new MySqlTrendProjectionWorker(pool, "worker", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.project = async () => {
    calls.push("project");
    return "topic";
  };
  let progress = false;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {
    calls.push("repair");
    return progress;
  };
  const claim = worker.claim.bind(worker);
  for (let index = 0; index < 3; index += 1) {
    worker.claim = claim;
    await worker.processOnce();
    worker.claim = async () => null;
    await worker.processOnce();
    assert.equal(worker.repairDue, true);
  }
  assert.equal(worker.repairDue, true);
  for (let index = 0; index < 3; index += 1) {
    await worker.processOnce();
    assert.equal(worker.repairDue, true);
  }
  progress = true;
  worker.claim = claim;
  calls.length = 0;
  await worker.processOnce();
  assert.ok(calls.indexOf("repair") < calls.indexOf("claim"));
  assert.ok(calls.indexOf("claim") < calls.indexOf("project"));
  assert.equal(worker.repairDue, true);
});

for (const method of ["enqueueDueCompetitorRefresh", "enqueueDueCompetitorDiscovery"]) {
  test(`${method} applies active tenant scope and the original capacity guards`, async () => {
    const { TrendProjectionPersistence } =
      await import("../../apps/worker/dist/trend-projection-persistence.js");
    const { activeCollectionScopeSql } =
      await import("../../apps/worker/dist/collection-source-scheduling-policy.js");
    const statements = [];
    const connection = {
      query: async (sql, values) => {
        statements.push(sql);
        if (sql.includes("backlog_count")) {
          assert.deepEqual(values, [""]);
          return [[{ id: "scan-opportunity", backlog_count: 0 }]];
        }
        assert.equal(values.at(-1), 1000);
        return [[]];
      },
    };
    const persistence = new TrendProjectionPersistence({}, "worker", () => now);
    assert.equal(await persistence[method](connection, "amazon", now), false);
    assert.equal(statements.length, method === "enqueueDueCompetitorDiscovery" ? 2 : 1);
    assert.ok(statements[0].includes(activeCollectionScopeSql("backlog")));
    if (method === "enqueueDueCompetitorRefresh") {
      assert.match(
        statements[0],
        /ct_refresh.organization_id=q_refresh.organization_id AND ct_refresh.workspace_id=q_refresh.workspace_id/,
      );
      assert.doesNotMatch(statements[0], /busy.active_count/);
      assert.ok(statements[0].includes(activeCollectionScopeSql("c")));
    } else {
      assert.match(statements[0], /o.id>\?[\s\S]*ORDER BY o.id LIMIT 20/);
      assert.ok(statements[0].includes(activeCollectionScopeSql("o")));
      assert.match(
        statements[1],
        /active_workspace.organization_id=o.organization_id AND active_workspace.status='active'/,
      );
      assert.match(statements[1], /busy.workspace_id=o.workspace_id/);
      assert.match(statements[1], /busy.opportunity_id=CONVERT\(o.id USING utf8mb4\)/);
      assert.match(statements[1], /active_task.workspace_id=q.workspace_id/);
    }
  });
}

test("scope becoming inactive between selection and locked recheck consumes no attempt", async () => {
  const { pool, calls, statements } = createPool(
    { ...jobScope, id: "archived-after-selection", attempt_count: 0 },
    true,
  );
  const worker = new MySqlTrendProjectionWorker(pool, "worker-1", 120, () => now);
  worker.sourceRecovery.processOnce = async () => 0;
  worker.persistence.enqueueMissingAutomaticDownstream = async () => {};
  worker.persistence.project = async () => assert.fail("inactive scope must not project");
  assert.deepEqual(await worker.processOnce(), { status: "idle" });
  assert.equal(calls.includes("lease"), false);
  assert.equal(calls.includes("record"), false);
  const locked = statements.find((sql) => sql.endsWith("FOR UPDATE"));
  assert.match(locked, /collection_scope_org.status='active'/);
  assert.match(locked, /collection_scope_workspace.id=trend_projection_jobs.workspace_id/);
});
