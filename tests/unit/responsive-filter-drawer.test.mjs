import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("member and platform primary filters share one state-preserving mobile drawer", async () => {
  const [drawer, trends, opportunities, collection] = await Promise.all(
    [
      "apps/web/src/components/ResponsiveFilterDrawer.vue",
      "apps/web/src/components/TrendDashboard.vue",
      "apps/web/src/components/OpportunityListPanel.vue",
      "apps/web/src/components/CollectionOperationsConsole.vue",
    ].map((path) => readFile(path, "utf8")),
  );

  assert.match(drawer, /aria-haspopup="dialog"/);
  assert.match(drawer, /@keydown\.esc="close"/);
  assert.match(drawer, /@submit\.capture="close"/);
  assert.match(drawer, /max-width: 760px/);
  assert.match(drawer, /var\(--so-touch-target\)/);
  assert.doesNotMatch(drawer, /!important|#[0-9a-f]{3,8}\b/i);
  for (const source of [trends, opportunities, collection])
    assert.match(source, /ResponsiveFilterDrawer/);
});
