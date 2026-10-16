import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateRouteCatalog } from "../../scripts/generate-route-artifacts.mjs";
import { readArchivedReportSource } from "../../scripts/lib/retired-report-surface.mjs";

const catalog = JSON.parse(readFileSync("config/route-catalog.json", "utf8"));
test("member report surface and its runtime styles are removed", () => {
  const route = catalog.routes.find(({ path }) => path === "/reports");
  assert.equal(route.redirect, "/opportunities");
  assert.equal(route.surface, "");
  assert.equal(route.cachePolicy, "none");
  const registry = readFileSync("apps/web/src/components/navigation-surface-registry.ts", "utf8");
  assert.doesNotMatch(registry, /ReportCenter|report-center/);
  for (const file of [
    "apps/web/src/components/ReportCenter.vue",
    "apps/web/src/report-center.css",
    "apps/web/src/design/report-center-tokens.css",
  ])
    assert.equal(existsSync(file), false, file);
  assert.match(
    readFileSync("apps/web/src/route-catalog.ts", "utf8"),
    /redirect: \{ path: entry.redirect, query: \{\}, hash: "" \}/,
  );
});

for (const target of [
  "https://outside.example/",
  "/missing",
  "/reports",
  "/platform-admin",
  "/opportunities?admin=true",
]) {
  test(`route catalogue rejects unsafe or ambiguous redirect ${target}`, () => {
    const changed = structuredClone(catalog);
    changed.routes.find(({ path }) => path === "/reports").redirect = target;
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  });
}

test("retired report archive is explicit and cannot read unrelated Git files", () => {
  assert.match(
    readArchivedReportSource("apps/web/src/components/ReportCenter.vue"),
    /导出当前报表 CSV/,
  );
  assert.throws(
    () => readArchivedReportSource("config/env.example"),
    /unregistered report archive/,
  );
});

for (const command of [
  "verify-report-page-preview.mjs",
  "verify-ui-phase2-report-c.mjs",
  "verify-ui-phase2-report-read-ownership.mjs",
  "verify-ui-phase2-report-operation-ownership.mjs",
  "build-ui-phase2-report-review.mjs",
]) {
  test(`retired report command refuses before creating a server or capture: ${command}`, () => {
    const result = spawnSync(process.execPath, [`scripts/${command}`], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /report_surface_retired/);
  });
}

test("redirect metadata cannot misreport target capabilities or keep a retired surface", () => {
  for (const patch of [
    { capabilities: ["report:read"] },
    { surface: "report-center" },
    { redirect: "/opportunities/:opportunityId" },
  ]) {
    const changed = structuredClone(catalog);
    Object.assign(
      changed.routes.find(({ path }) => path === "/reports"),
      patch,
    );
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  }
});
