import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
async function repository(name) {
  const file = resolve(process.env.WORKSPACE_BASELINE_DIR || ".", "apps/api/src", name + ".ts");
  const source = await readFile(file, "utf8");
  const code = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    .outputText.replace(
      /(from |import )(["'])(\.\/[^"']+)\2/g,
      (_, prefix, quote, specifier) =>
        prefix + quote + pathToFileURL(resolve("apps/api/dist", specifier)).href + quote,
    );
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}
const scope = {
  organizationId: "org-fixture",
  workspaceId: "workspace-fixture",
  actorId: "actor-fixture",
  page: 1,
  pageSize: 20,
  selectionView: "all",
  scope: "all",
};
function pool(response = () => []) {
  let active = 0,
    max = 0,
    count = 0;
  return {
    stats: () => ({ queries: count, max_parallel: max }),
    async query(sql, args) {
      count++;
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return [response(sql, args)];
    },
  };
}
test("workspace identical scoped reads overlap without changing results", async () => {
  const { MySqlHomeDashboardRepository } = await repository("mysql-home-dashboard-repository");
  const p = pool();
  const result = await new MySqlHomeDashboardRepository(
    p,
    () => new Date("2026-11-03T00:00:00Z"),
  ).automaticSelection(scope);
  assert.equal(result.candidate_count, 0);
  assert.equal(result.daily_production.completed_count, null);
  assert.equal(p.stats().queries, 4);
  console.log("HOME " + JSON.stringify(p.stats()) + " completed=null candidate_count=0");
  if (!process.env.WORKSPACE_BASELINE_DIR) assert.equal(p.stats().max_parallel, 4);
  const { MySqlOpportunityRepository } = await repository("mysql-opportunity-repository");
  const listPool = pool();
  const list = await new MySqlOpportunityRepository(listPool).list(scope);
  assert.deepEqual(list, { items: [], total: 0 });
  console.log("CATALOGUE " + JSON.stringify(listPool.stats()) + " items=[] total=0");
  if (!process.env.WORKSPACE_BASELINE_DIR) assert.equal(listPool.stats().max_parallel, 2);
});
test("comparison hydration is batched and retains scoped historical quote selection", async () => {
  const { MySqlSourcingRepository } = await repository("mysql-sourcing-repository");
  const p = pool((sql) =>
    sql.includes("FROM sourcing_comparisons")
      ? [1, 2].map((id) => ({
          id: String(id),
          name: "saved-" + id,
          quote_ids_json: JSON.stringify(["quote-" + id]),
          created_at: "2026-11-03T00:00:00Z",
        }))
      : [],
  );
  const result = await new MySqlSourcingRepository(p).listComparisons(scope);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((x) => x.quotes),
    [[], []],
  );
  console.log("SOURCING " + JSON.stringify(p.stats()) + " comparisons=2 quotes=[[],[]]");
  if (!process.env.WORKSPACE_BASELINE_DIR) assert.equal(p.stats().queries, 2);
});

test("sourcing list projects the original same-task image without product expansion or detail N+1", async () => {
  const { MySqlSourcingRepository } = await repository("mysql-sourcing-repository");
  if (process.env.WORKSPACE_BASELINE_DIR) return;
  let queries = 0;
  const p = {
    async query(sql, args) {
      queries++;
      assert.match(sql, /image_query.task_id=s.collection_task_id/);
      assert.match(sql, /image_query.organization_id=s.organization_id/);
      assert.match(sql, /image_query.workspace_id=s.workspace_id/);
      assert.match(sql, /image_provider.code='1688_search'/);
      assert.deepEqual(args, [
        scope.organizationId,
        scope.workspaceId,
        scope.organizationId,
        scope.workspaceId,
      ]);
      assert.match(sql, /CONVERT\(id USING utf8mb4\) COLLATE utf8mb4_unicode_ci lookup_ref/);
      assert.match(sql, /s.input_ref=o.lookup_ref/);
      return [
        [
          {
            id: "search",
            input_ref: "opp",
            input_type: "opportunity",
            image_url: "https://m.media-amazon.com/image.jpg",
            candidate_count: 0,
            missing_fields_json: "[]",
            created_at: "2026-11-03T00:00:00Z",
            updated_at: "2026-11-03T00:00:00Z",
          },
        ],
      ];
    },
  };
  const rows = await new MySqlSourcingRepository(p).list(scope);
  assert.equal(queries, 1);
  assert.equal(rows[0].image_url, "https://m.media-amazon.com/image.jpg");
});
