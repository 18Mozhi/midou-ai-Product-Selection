import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { readArchivedCompetitorSource } from "../../scripts/lib/retired-competitor-surface.mjs";
const catalog = JSON.parse(readFileSync("config/route-catalog.json", "utf8"));
test("standalone competitor runtime and styles are removed while fixed aliases preserve destination permissions", () => {
  const destination = catalog.routes.find((r) => r.path === "/opportunities");
  for (const path of ["/competitors", "/competitors/monitoring-rules"]) {
    const route = catalog.routes.find((r) => r.path === path);
    assert.equal(route.redirect, "/opportunities");
    assert.equal(route.surface, "");
    assert.equal(route.cachePolicy, "none");
    assert.deepEqual(route.capabilities, destination.capabilities);
  }
  for (const file of [
    "apps/web/src/components/CompetitorMonitor.vue",
    "apps/web/src/competitor.css",
    "apps/web/src/design/competitor-review-tokens.css",
    "scripts/lib/competitor-page-preview.mjs",
    "scripts/lib/competitor-rules-page-preview.mjs",
  ])
    assert.equal(existsSync(file), false, file);
  assert.doesNotMatch(
    readFileSync("apps/web/src/components/navigation-surface-registry.ts", "utf8"),
    /CompetitorMonitor|competitor-monitor/,
  );
  assert.match(
    readFileSync("apps/web/src/components/OpportunityDetailInsights.vue", "utf8"),
    /SelectionProductComparison/,
  );
  assert.doesNotMatch(
    readFileSync("apps/web/src/automatic-selection-readiness.ts", "utf8"),
    /competitor-monitor-rules|hasEnabledCompetitorRule/,
  );
});
test("retired competitor historical source is bounded and never restored into runtime", () => {
  assert.match(
    readArchivedCompetitorSource("apps/web/src/components/CompetitorMonitor.vue"),
    /createApiClient/,
  );
  assert.throws(() => readArchivedCompetitorSource(".env"), /unregistered/);
});
for (const script of [
  "verify-competitor-page-preview.mjs",
  "verify-competitor-rules-page-preview.mjs",
]) {
  test(`old preview fails before creating a server or output: ${script}`, () => {
    const result = spawnSync(process.execPath, [`scripts/${script}`], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /competitor_surface_retired/);
    assert.doesNotMatch(result.stdout, /http:/);
  });
}
