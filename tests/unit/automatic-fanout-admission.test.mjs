import { automaticIntakeBacklogLimit } from "../../apps/worker/dist/automatic-intake-capacity-policy.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CoreCollectionProjectionWorker } from "../../apps/worker/dist/core-collection-projection-worker.js";
import { MySqlTrendProjectionWorker } from "../../apps/worker/dist/trend-projection-worker.js";
import { automaticCollectionBacklogCountSql } from "../../apps/worker/dist/collection-source-scheduling-policy.js";
import { automaticFanoutAdmissionCases } from "../fixtures/automatic-fanout-admission-sql.mjs";

for (const limit of [1, 7, 1000]) {
  for (const kind of ["trend", "core"])
    test(`${kind} admission binds configured limit ${limit} before claiming or writing`, async () => {
      const calls = [];
      const c = {
        beginTransaction: async () => {},
        query: async (sql, params) => {
          calls.push({ sql, params });
          return [[]];
        },
        commit: async () => calls.push("commit"),
        release: () => calls.push("release"),
        rollback: async () => {
          throw new Error("not expected");
        },
      };
      const pool = { getConnection: async () => c };
      const now = () => new Date("2026-10-19T00:00:00Z");
      const worker =
        kind === "trend"
          ? new MySqlTrendProjectionWorker(pool, "worker", 120, now, undefined, 3600, limit)
          : new CoreCollectionProjectionWorker(pool, "worker", now, limit);
      assert.equal(await worker.claim(), null);
      assert.equal(calls.length, 3);
      assert.deepEqual(calls.slice(1), ["commit", "release"]);
      assert.equal(
        calls[0].params.at(-1),
        kind === "trend" ? automaticIntakeBacklogLimit(limit) : limit,
      );
      assert.ok(calls[0].sql.includes(automaticCollectionBacklogCountSql + "<?"));
      assert.doesNotMatch(calls[0].sql, /FOR UPDATE|INSERT|UPDATE |DELETE /);
      if (kind === "core")
        assert.match(calls[0].sql, /projection_type'\)\)<>'opportunity_competitors'\s+OR/);
      else assert.equal(calls[0].params.length, 3);
    });
}

test("budget query retains all unfinished statuses and active matching scope without locking history", () => {
  for (const status of [
    "scheduled",
    "queued",
    "leased",
    "running",
    "parsing",
    "validating",
    "retry_scheduled",
    "rate_limited",
  ])
    assert.ok(automaticCollectionBacklogCountSql.includes(`'${status}'`));
  assert.match(automaticCollectionBacklogCountSql, /collection_scope_org.status='active'/);
  assert.match(automaticCollectionBacklogCountSql, /collection_scope_workspace.status='active'/);
  assert.match(
    automaticCollectionBacklogCountSql,
    /collection_scope_workspace.organization_id=collection_scope_org.id/,
  );
  assert.doesNotMatch(
    automaticCollectionBacklogCountSql,
    /FOR UPDATE|succeeded|failed_terminal|dead_letter/,
  );
  const cases = automaticFanoutAdmissionCases();
  assert.equal(cases.length, 34);
  assert.ok(
    cases.every(
      (c) =>
        c.sql.startsWith("SELECT ") &&
        c.expected.detail_allowed === 1 &&
        c.expected.sourcing_allowed === 1,
    ),
  );
});

test("both production workers receive the same existing runtime backlog setting", async () => {
  const entry = await readFile("apps/worker/src/index.ts", "utf8");
  assert.match(
    entry,
    /new MySqlTrendProjectionWorker\([\s\S]*?config.automaticSources.queueBacklogLimit/,
  );
  assert.match(
    entry,
    /new CoreCollectionProjectionWorker\([\s\S]*?config.automaticSources.queueBacklogLimit/,
  );
});
