import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("member and platform filters stay inline on desktop and use one fullscreen mobile drawer", async () => {
  const [drawer, trends, trendFilters, opportunities, collection] = await Promise.all(
    [
      "apps/web/src/components/ResponsiveFilterDrawer.vue",
      "apps/web/src/components/TrendDashboard.vue",
      "apps/web/src/components/TrendFilterPanel.vue",
      "apps/web/src/components/OpportunityListPanel.vue",
      "apps/web/src/components/CollectionOperationsConsole.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(drawer, /aria-haspopup="dialog"/);
  assert.match(drawer, /@keydown="handleKeydown"/);
  assert.match(drawer, /triggerButton\.value\?\.focus\(\)/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(drawer, /@submit\.capture="close"/);
  assert.match(drawer, /<Teleport to="body" :disabled="!overlay">/);
  assert.match(drawer, /const overlay = computed\(\(\) => mobile\.value\)/);
  assert.match(drawer, /max-width: 760px/);
  assert.match(drawer, /inset: 0;[\s\S]*width: 100%;[\s\S]*height: 100dvh/);
  assert.match(drawer, /var\(--so-touch-target\)/);
  assert.doesNotMatch(drawer, /alwaysDrawer|border-radius|box-shadow|!important|#[0-9a-f]{3,8}\b/i);
  assert.match(trends, /TrendFilterPanel/);
  for (const source of [trendFilters, opportunities, collection])
    assert.match(source, /ResponsiveFilterDrawer/);
  for (const source of [trendFilters, opportunities])
    assert.match(source, /filter-apply-action secondary/);
  assert.doesNotMatch(opportunities, /always-drawer/);
});
