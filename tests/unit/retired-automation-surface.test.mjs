import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { validateRouteCatalog } from "../../scripts/generate-route-artifacts.mjs";
import { readArchivedAutomationSource } from "../../scripts/lib/retired-automation-surface.mjs";

const catalog = JSON.parse(readFileSync("config/route-catalog.json", "utf8"));
test("member automation surface and its runtime styles are removed", () => {
  const route = catalog.routes.find(({ path }) => path === "/automations");
  assert.equal(route.redirect, "/opportunities");
  assert.equal(route.surface, "");
  assert.equal(route.cachePolicy, "none");
  const registry = readFileSync("apps/web/src/components/navigation-surface-registry.ts", "utf8");
  assert.doesNotMatch(registry, /AutomationRuleCenter|automation-center/);
  for (const file of [
    "apps/web/src/components/AutomationRuleCenter.vue",
    "apps/web/src/automation-rules.css",
    "apps/web/src/design/automation-rule-tokens.css",
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
  "/automations",
  "/platform-admin",
  "/opportunities?admin=true",
]) {
  test(`route catalogue rejects unsafe or ambiguous redirect ${target}`, () => {
    const changed = structuredClone(catalog);
    changed.routes.find(({ path }) => path === "/automations").redirect = target;
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  });
}

test("retired automation archive is explicit and cannot read unrelated Git files", () => {
  assert.match(
    readArchivedAutomationSource("apps/web/src/components/AutomationRuleCenter.vue"),
    /创建规则/,
  );
  assert.throws(
    () => readArchivedAutomationSource("config/env.example"),
    /unregistered automation archive/,
  );
});

for (const command of [
  "verify-automation-page-preview.mjs",
  "verify-ui-phase2-automation-c.mjs",
  "verify-ui-phase2-automation-read-ownership.mjs",
  "verify-ui-phase2-automation-write-ownership.mjs",
  "verify-ui-phase2-automation-forms-c.mjs",
]) {
  test(`retired automation command refuses before creating a server or capture: ${command}`, () => {
    const result = spawnSync(process.execPath, [`scripts/${command}`], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /automation_surface_retired/);
  });
}

test("redirect metadata cannot misautomation target capabilities or keep a retired surface", () => {
  for (const patch of [
    { capabilities: ["automation:read"] },
    { surface: "automation-center" },
    { redirect: "/opportunities/:opportunityId" },
  ]) {
    const changed = structuredClone(catalog);
    Object.assign(
      changed.routes.find(({ path }) => path === "/automations"),
      patch,
    );
    assert.throws(() => validateRouteCatalog(changed), /route_catalog_redirect_invalid/);
  }
});
