import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
test("home uses its actual Vue and one layout owner without legacy template injection", async () => {
  const [dashboard, automation, css, commerce, ledger] = await Promise.all(
    [
      "apps/web/src/components/HomeDashboard.vue",
      "apps/web/src/components/HomeAutomationOverview.vue",
      "apps/web/src/home-dashboard.css",
      "apps/web/src/commerce-workspace.css",
      "apps/web/src/signal-ledger.css",
    ].map((p) => readFile(p, "utf8")),
  );
  assert.match(dashboard, /request<Summary>\("\/me\/home-dashboard"/);
  assert.match(dashboard, /resumeRule\(pausedRules\[0\]\)/);
  assert.match(dashboard, /五项质量门/);
  assert.match(automation, /selection\.recommended_count/);
  assert.doesNotMatch(dashboard, /01 \/|02 \/|p12-hero/);
  assert.doesNotMatch(commerce, /\.home-/);
  assert.doesNotMatch(ledger, /\.home-/);
  assert.match(css, /font-family: var\(--so-font-ui\)/);
  await assert.rejects(access("scripts/lib/home-page-preview.mjs"));
});
test("retired home preview cannot create servers or generated captures", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-home-page-preview.mjs"], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /home_preview_retired/);
  assert.doesNotMatch(result.stdout, /http:/);
});
