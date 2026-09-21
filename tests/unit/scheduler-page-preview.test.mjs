import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewSchedulerPage } from "../../scripts/lib/scheduler-page-preview.mjs";

const source = readFileSync("apps/web/src/components/CrawlerSchedulerCenter.vue", "utf8");
const preview = parse(previewSchedulerPage(source)).descriptor;
const original = parse(source).descriptor;

test("P70 C review preserves scheduler script and recovery dialogs", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.match(preview.template.content, /采集调度核验/);
  assert.equal((preview.template.content.match(/<ConfirmDialog/g) ?? []).length, 2);
});

test("P70 C review separates providers from resource and receipt evidence", () => {
  const template = preview.template.content;
  for (const id of ["p70-providers", "p70-runtime", "p70-receipts", "p70-leases", "p70-trend"])
    assert.ok(template.includes(id), id);
  assert.match(template, /宝塔受管/);
  assert.match(template, /不授权自动删除/);
});
