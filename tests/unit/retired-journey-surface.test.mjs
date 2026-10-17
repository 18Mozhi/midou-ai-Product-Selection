import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateRouteCatalog } from "../../scripts/generate-route-artifacts.mjs";
import { readArchivedJourneySource } from "../../scripts/lib/retired-journey-surface.mjs";

const catalog = JSON.parse(readFileSync("config/route-catalog.json", "utf8"));
test("member manual journey surface and its runtime styles are removed", () => {
  const route = catalog.routes.find(({ path }) => path === "/opportunities/start");
  assert.equal(route.redirect, "/opportunities");
  assert.equal(route.surface, "");
  assert.equal(route.cachePolicy, "none");
  const registry = readFileSync("apps/web/src/components/navigation-surface-registry.ts", "utf8");
  assert.doesNotMatch(registry, /SelectionJourney|selection-journey/);
  for (const file of [
    "apps/web/src/components/SelectionJourney.vue",
    "apps/web/src/selection-journey.css",
    "apps/web/src/selection-journey-validation.css",
    "apps/web/src/design/selection-tokens.css",
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
  "/opportunities/start",
  "/platform-admin",
  "/opportunities?admin=true",
]) {
  test(`route catalogue rejects unsafe or ambiguous redirect ${target}`, () => {
    const changed = structuredClone(catalog);
    changed.routes.find(({ path }) => path === "/opportunities/start").redirect = target;
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  });
}

test("retired journey archive is explicit and cannot read unrelated Git files", () => {
  assert.match(
    readArchivedJourneySource("apps/web/src/components/SelectionJourney.vue"),
    /创建选品/,
  );
  assert.throws(
    () => readArchivedJourneySource("config/env.example"),
    /unregistered journey archive/,
  );
});

for (const command of [
  "verify-ui-phase2-journey-c.mjs",
  "verify-ui-phase2-journey-vue.mjs",
  "verify-ui-phase2-journey-fields.mjs",
  "verify-ui-phase2-journey-write-lifetime.mjs",
  "verify-ui-phase2-shell-journey-c.mjs",
  "verify-ui-phase2-shell-journey-vue-c.mjs",
]) {
  test(`retired journey command refuses before creating a server or capture: ${command}`, () => {
    const result = spawnSync(process.execPath, [`scripts/${command}`], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /journey_surface_retired/);
  });
}

test("redirect metadata cannot mismatch target capabilities or keep a retired surface", () => {
  for (const patch of [
    { capabilities: ["opportunity:decide"] },
    { surface: "selection-journey" },
    { redirect: "/opportunities/:opportunityId" },
  ]) {
    const changed = structuredClone(catalog);
    Object.assign(
      changed.routes.find(({ path }) => path === "/opportunities/start"),
      patch,
    );
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  }
});

test("current home and selection library do not offer the retired manual journey", () => {
  for (const name of ["HomeDashboard", "OpportunityWorkspace", "NavigationShell"]) {
    const source = readFileSync(`apps/web/src/components/${name}.vue`, "utf8");
    assert.doesNotMatch(source, /to="\/opportunities\/start"|创建选品/);
  }
  const source = readFileSync("apps/web/src/components/HomeDashboard.vue", "utf8");
  assert.match(source, /查看选品库/);
});
