import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile("apps/web/src/components/PlatformDashboard.vue", "utf8");
const styles = await readFile("apps/web/src/styles/platform-dashboard.css", "utf8");
const header = await readFile("apps/web/src/components/PlatformPageHeader.vue", "utf8");

test("P38 production dashboard opts into the scoped C composition", () => {
  assert.match(panel, /class="platform-dashboard platform-dashboard--review"/);
});

test("platform overview keeps factual actions, trends and source table present", () => {
  assert.match(panel, /平台运行概览/);
  assert.match(panel, /class="platform-action-summary"/);
  assert.match(panel, /class="platform-facts"/);
  assert.match(panel, /class="platform-dashboard-grid"/);
  assert.match(panel, /来源健康/);
});

test("platform overview uses the compact shared header and a full-width workbench", () => {
  assert.match(panel, /<PlatformPageHeader title="平台运行概览"/);
  assert.doesNotMatch(styles, /platform-dashboard-toolbar|grid-row: 1 \/ span 12/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(header, /platform-page-header__actions/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(
    styles,
    /\.platform-dashboard--review :is\(button, select, a, summary\):focus-visible/,
  );
});
