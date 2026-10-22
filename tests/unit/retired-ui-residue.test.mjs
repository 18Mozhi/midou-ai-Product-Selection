import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readArchivedCompetitorSource } from "../../scripts/lib/retired-competitor-surface.mjs";
const retired = ["selection-journey-enhancements.css", "MonitoringReadinessStrip.vue"];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );
}
test("retired unused journey styles and monitoring card cannot return to the current UI", () => {
  assert.equal(existsSync("apps/web/src/selection-journey-enhancements.css"), false);
  assert.equal(existsSync("apps/web/src/components/shared/MonitoringReadinessStrip.vue"), false);
  for (const file of files("apps/web/src")) {
    if (!/\.(?:vue|ts|css)$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const name of retired) assert.ok(!source.includes(name), `${file} retains ${name}`);
  }
  assert.equal(existsSync("apps/web/src/components/shared/monitoring-readiness.ts"), true);
});
test("retired monitoring card historical evidence remains explicit and read-only", () => {
  const source = readArchivedCompetitorSource(
    "apps/web/src/components/shared/MonitoringReadinessStrip.vue",
  );
  assert.match(source, /MonitoringReadinessFact/);
  assert.match(source, /monitoring-readiness__summary/);
});
