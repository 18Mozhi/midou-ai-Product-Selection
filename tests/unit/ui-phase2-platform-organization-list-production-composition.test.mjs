import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile("apps/web/src/components/PlatformAccountCenter.vue", "utf8");
const styles = await readFile("apps/web/src/components/PlatformAccountCenter.css", "utf8");

test("P40 organization route gets an explicit production composition scope", () => {
  assert.match(panel, /account-center--organization-review/);
  assert.match(panel, /organizationListRoute/);
});

test("P40 keeps organization-specific filtering and record actions", () => {
  assert.match(panel, /搜索组织名称或标识/);
  assert.match(panel, /组织状态/);
  assert.match(panel, /PlatformOrganizationRecords/);
  assert.match(panel, /openOrganization/);
});

test("P40 emphasizes the organization query and results workbench", () => {
  assert.match(styles, /\.account-center--organization-review \.account-filter/);
  assert.match(styles, /border-top: 3px solid var\(--account-review-blue\)/);
  assert.match(styles, /\.account-center--organization-review \.account-table-wrap/);
});
