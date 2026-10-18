import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  retiredTaskFiles,
  readArchivedTaskSource,
} from "../../scripts/lib/retired-task-surface.mjs";
import { validateRouteCatalog } from "../../scripts/generate-route-artifacts.mjs";
import { MySqlDiscoveryRepository } from "../../apps/api/dist/mysql-discovery-repository.js";

test("member business-task runtime modules are deleted while management surfaces remain", () => {
  for (const file of retiredTaskFiles) assert.equal(existsSync(file), false, file);
  const registry = readFileSync("apps/web/src/components/navigation-surface-registry.ts", "utf8");
  assert.doesNotMatch(registry, /TaskWorkspace|task-workspace/);
  assert.match(registry, /ApprovalWorkspace|CollectionRuntimeSurface/);
  const product = readFileSync("apps/web/src/components/OpportunityDecisionPanel.vue", "utf8");
  assert.doesNotMatch(product, /RouterLink|\/tasks\//);
  assert.match(product, /blocker.progress_percent/);
  assert.match(product, /blocker.next_action/);
});
test("legacy task routes are fixed guarded aliases and keep organization approval intact", () => {
  const catalog = JSON.parse(readFileSync("config/route-catalog.json", "utf8"));
  validateRouteCatalog(catalog);
  for (const [path, target] of [
    ["/work", "/home"],
    ["/tasks", "/opportunities"],
    ["/tasks/:taskId", "/opportunities"],
  ]) {
    const route = catalog.routes.find((item) => item.path === path);
    const destination = catalog.routes.find((item) => item.path === target);
    assert.equal(route.redirect, target);
    assert.equal(route.surface, "");
    assert.equal(route.cachePolicy, "none");
    assert.deepEqual(route.capabilities, destination.capabilities);
  }
  assert.equal(
    catalog.routes.find((item) => item.path === "/tasks/approvals").surface,
    "approval-workspace",
  );
  assert.equal(
    catalog.routes.find((item) => item.path === "/org-admin/approvals").redirect,
    undefined,
  );
});
test("task archive is explicitly bounded to fixed Git history", () => {
  assert.match(
    readArchivedTaskSource("apps/web/src/components/TaskWorkspace.vue"),
    /TaskListPanel/,
  );
  assert.throws(() => readArchivedTaskSource("config/env.example"), /unregistered task archive/);
});
for (const command of [
  "verify-task-page-preview.mjs",
  "verify-all-task-page-preview.mjs",
  "verify-task-detail-page-preview.mjs",
  "verify-ui-phase2-task-c-forms.mjs",
  "verify-ui-phase2-task-c.mjs",
  "verify-ui-phase2-task-detail-review.mjs",
  "verify-ui-phase2-task-list-review.mjs",
  "verify-ui-phase2-work-c.mjs",
]) {
  test(`retired task capture refuses before runtime creation: ${command}`, () => {
    const result = spawnSync(process.execPath, [`scripts/${command}`], {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /task_surface_retired/);
  });
}
test("discovery excludes both task rows and stale task documents before pagination with exact SQL bindings", async () => {
  const queries = [];
  const repository = new MySqlDiscoveryRepository({
    query: async (sql, params) => {
      queries.push({ sql, params });
      return [[]];
    },
  });
  const input = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    workspaceId: "00000000-0000-4000-8000-000000000002",
    query: "商品",
    capabilities: ["opportunity:read", "task:read"],
    limit: 10,
  };
  await repository.search(input);
  assert.equal(queries.length, 1);
  assert.doesNotMatch(queries[0].sql, /FROM tasks|CONCAT\('\/tasks\//);
  assert.match(queries[0].sql, /search_documents[^;]*resource_type<>'task'/);
  assert.equal(
    (queries[0].sql.replace(/'(?:''|[^'])*'/g, "").match(/\?/g) ?? []).length,
    queries[0].params.length,
  );
  queries.length = 0;
  await repository.search({
    ...input,
    cursor: "00000000-0000-4000-8000-000000000003",
    resourceType: "task",
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /resource_type<>'task'/);
  assert.equal(
    (queries[0].sql.replace(/'(?:''|[^'])*'/g, "").match(/\?/g) ?? []).length,
    queries[0].params.length,
  );
});
