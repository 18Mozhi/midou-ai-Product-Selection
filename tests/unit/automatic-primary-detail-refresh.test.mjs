import { automaticPrimaryRefreshEvaluationCases } from "../fixtures/automatic-primary-detail-refresh-sql.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  findWaitingPrimaryDetailRefresh,
  automaticPrimaryRefreshCandidateSql,
  automaticPrimaryRefreshRecheckSql,
} from "../../apps/worker/dist/automatic-primary-detail-refresh.js";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import {
  competitorRefreshOrderSql,
  competitorRefreshNoActiveDetailSql,
} from "../../apps/worker/dist/competitor-refresh-policy.js";
import {
  latestCompetitorDetailSnapshotSql,
  selectionPrimaryAsinSql,
} from "../../packages/database/dist/index.js";

const now = new Date("2026-10-20T00:00:00Z");
const before = new Date(now.getTime() - 3600000);
const primary = {
  id: "primary",
  organization_id: "org",
  workspace_id: "ws",
  opportunity_id: "op",
  created_by: "actor",
  external_id: "B0B5DJ6KF7",
  product_url: "https://www.amazon.com/dp/B0B5DJ6KF7",
};
const legacy = { ...primary, id: "legacy" };

for (const candidate of [null, {}, { id: "missing-scope" }]) {
  test(`no eligible primary identity ${JSON.stringify(candidate)} stops before locking`, async () => {
    const reads = [];
    const c = {
      query: async (sql, params) => {
        reads.push({ sql, params });
        return [candidate ? [candidate] : []];
      },
    };
    assert.equal(await findWaitingPrimaryDetailRefresh(c, before, 1000), undefined);
    assert.equal(reads.length, 1);
    assert.equal(reads[0].sql, automaticPrimaryRefreshCandidateSql);
    assert.deepEqual(reads[0].params, [before, before, 1000]);
    assert.doesNotMatch(reads[0].sql, /FOR UPDATE/);
  });
}

test("current scoped point recheck may lose the candidate without an enqueue", async () => {
  const reads = [];
  const c = {
    query: async (sql, params) => {
      reads.push({ sql, params });
      return [reads.length === 1 ? [primary] : []];
    },
  };
  assert.equal(await findWaitingPrimaryDetailRefresh(c, before, 1000), undefined);
  assert.equal(reads[1].sql, automaticPrimaryRefreshRecheckSql);
  assert.deepEqual(reads[1].params, ["primary", "org", "ws", "op", before, before, 1000]);
  assert.match(reads[1].sql, /FROM competitors c FORCE INDEX \(PRIMARY\)/);
  assert.ok(reads[1].sql.endsWith(" FOR UPDATE"));
});

test("main waiting for actual detail wins the refresh turn and retains the original producer payload", async () => {
  const reads = [],
    scheduled = [];
  const c = {
    query: async (sql, params) => {
      reads.push({ sql, params });
      return [[primary]];
    },
  };
  const persistence = new TrendProjectionPersistence({}, "worker", () => now);
  persistence.scheduleCoreCollection = async (...args) => scheduled.push(args);
  assert.equal(await persistence.enqueueDueCompetitorRefresh(c, "amazon", now), true);
  assert.equal(reads.length, 2);
  assert.equal(
    reads.some((r) => r.sql.includes(competitorRefreshOrderSql)),
    false,
  );
  assert.equal(scheduled.length, 1);
  assert.deepEqual(scheduled[0][1].organizationId, "org");
  assert.deepEqual(scheduled[0][3], [
    {
      providerId: "amazon",
      required: true,
      target: {
        page_url: primary.product_url,
        asin: primary.external_id,
        projection_type: "competitor_snapshot",
        competitor_id: "primary",
      },
    },
  ]);
  assert.equal(scheduled[0][4], "competitor.collection.auto_scheduled");
});

for (const lostDuringRecheck of [false, true]) {
  test(`original periodic fallback remains available, lost candidate=${lostDuringRecheck}`, async () => {
    const reads = [],
      scheduled = [];
    const c = {
      query: async (sql) => {
        reads.push(sql);
        return [
          sql === automaticPrimaryRefreshCandidateSql
            ? lostDuringRecheck
              ? [primary]
              : []
            : sql === automaticPrimaryRefreshRecheckSql
              ? []
              : [legacy],
        ];
      },
    };
    const persistence = new TrendProjectionPersistence({}, "worker", () => now);
    persistence.scheduleCoreCollection = async (...args) => scheduled.push(args);
    assert.equal(await persistence.enqueueDueCompetitorRefresh(c, "amazon", now), true);
    assert.ok(reads.at(-1).includes(competitorRefreshOrderSql));
    assert.equal(scheduled[0][3][0].target.competitor_id, "legacy");
  });
}

for (const failAt of [1, 2]) {
  test(`priority read failure ${failAt} propagates without silent fallback or retry`, async () => {
    let reads = 0;
    const c = {
      query: async () => {
        if (++reads === failAt)
          throw Object.assign(new Error("synthetic"), { code: "ER_LOCK_DEADLOCK" });
        return [[primary]];
      },
    };
    const persistence = new TrendProjectionPersistence({}, "worker", () => now);
    persistence.scheduleCoreCollection = async () => assert.fail("must not enqueue");
    await assert.rejects(() => persistence.enqueueDueCompetitorRefresh(c, "amazon", now), {
      code: "ER_LOCK_DEADLOCK",
    });
    assert.equal(reads, failAt);
  });
}

test("both reads retain formal primary/detail proof and the original resource safeguards", () => {
  for (const sql of [automaticPrimaryRefreshCandidateSql, automaticPrimaryRefreshRecheckSql]) {
    assert.ok(sql.includes(selectionPrimaryAsinSql));
    assert.ok(sql.includes(latestCompetitorDetailSnapshotSql("c") + " IS NULL"));
    assert.ok(sql.includes(competitorRefreshNoActiveDetailSql));
    assert.match(sql, /o.decision_status='pending'/);
    assert.match(sql, /c.market=o.market/);
    assert.match(sql, /c.latest_snapshot_id IS NULL OR s.id IS NOT NULL/);
    assert.match(
      sql,
      /recent.organization_id=c.organization_id AND recent.workspace_id=c.workspace_id/,
    );
    assert.match(sql, /'amazon_competitor_snapshot_missing','amazon_sale_facts_incomplete'/);
    assert.doesNotMatch(sql, /INSERT|UPDATE automatic_selection_evaluations|DELETE/);
  }
});

test("evaluation, scope, cadence and capacity SQL probes stay read-only with bound identities", () => {
  const cases = automaticPrimaryRefreshEvaluationCases(
    { competitorId: "primary", organizationId: "org", workspaceId: "ws", opportunityId: "op" },
    before,
    1000,
  );
  assert.equal(cases.length, 24);
  assert.equal(cases.filter((c) => c.expected === 1).length, 3);
  for (const c of cases) {
    assert.match(c.sql, /^SELECT /);
    assert.doesNotMatch(c.sql, /FOR UPDATE|INSERT|DELETE|CREATE|DROP/);
    assert.equal(
      (c.sql.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) ?? []).length,
      c.params.length,
    );
  }
});
