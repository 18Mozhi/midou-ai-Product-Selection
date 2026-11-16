import assert from "node:assert/strict";
import test from "node:test";
import { MySqlSourcingRepository } from "../../apps/api/dist/mysql-sourcing-repository.js";

test("retired sourcing lists and locates the original account records with both owner proofs", async () => {
  const legacyRef = "original imported request";
  const historical = {
    id: "original-search-id",
    input_type: "opportunity",
    input_ref: legacyRef,
    collection_task_id: "original-task-id",
    display_name: legacyRef,
    owned_candidate_count: 0,
    status: "succeeded",
    missing_fields_json: [],
    created_at: new Date("2026-10-15T00:00:00Z"),
    updated_at: new Date("2026-10-15T00:00:00Z"),
  };
  const calls = [];
  const pool = {
    async query(sql, args = []) {
      if (sql.startsWith("SELECT slot")) return [[{ slot: "current" }]];
      calls.push({ sql, args });
      assert.equal((sql.match(/\?/g) || []).length, args.length);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.match(
        sql,
        /original_task\.id=s\.collection_task_id AND original_task\.account_id=so\.account_id/,
      );
      assert.match(
        sql,
        /ra\.source_table='collection_tasks'.*s\.collection_task_id.*ra\.account_id=so\.account_id/,
      );
      assert.match(sql, /original_opportunity\.account_id=so\.account_id/);
      assert.match(sql, /history_task\.request_id=BINARY s\.request_id/);
      assert.match(sql, /history_task\.trace_id=BINARY s\.trace_id/);
      assert.match(sql, /history_candidate\.search_id=s\.id/);
      if (sql.includes("JOIN sourcing_searches target")) {
        assert.match(
          sql,
          /original_task\.id=target\.collection_task_id AND original_task\.account_id=so\.account_id/,
        );
        assert.match(sql, /original_opportunity\.id=CONVERT\(target\.input_ref USING ascii\)/);
        assert.deepEqual(args, [historical.id, "primary", "%imported%"]);
        return [[{ preceding_count: 1 }]];
      }
      if (sql.includes("SUM(")) return [[{ total: 2, ready: 0 }]];
      if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: 2 }]];
      assert.match(sql, /image_task\.account_id=(?:so\.account_id|s\.account_owner)/);
      assert.match(sql, /image_evidence\.account_id=(?:so\.account_id|s\.account_owner)/);
      if (args.includes("another-account")) return [[]];
      return [[historical]];
    },
  };
  const repo = new MySqlSourcingRepository(pool, true);
  assert.equal((await repo.list({ accountId: "primary" }))[0].input_ref, legacyRef);
  const page = await repo.listPage({
    accountId: "primary",
    page: 1,
    pageSize: 1,
    query: "imported",
    locateRecord: historical.id,
  });
  assert.equal(page.items[0].id, historical.id);
  assert.equal(page.meta.page, 2);
  assert.equal(page.meta.total, 2);
  await assert.rejects(repo.detail({ accountId: "another-account", searchId: historical.id }), {
    code: "sourcing_search_not_found",
  });
  assert.equal(calls.length, 6);
});
