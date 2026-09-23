import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewSchedulerPage } from "../../scripts/lib/scheduler-page-preview.mjs";

const source = readFileSync("apps/web/src/components/CrawlerSchedulerCenter.vue", "utf8");
const preview = parse(previewSchedulerPage(source)).descriptor;
const original = parse(source).descriptor;
const evidence = parse(
  readFileSync("apps/web/src/components/CrawlerSchedulerEvidence.vue", "utf8"),
).descriptor;

test("P70 C review preserves scheduler script and recovery dialogs", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.match(preview.template.content, /采集调度核验/);
  assert.match(original.template.content, /crawler-scheduler--c/);
  assert.match(preview.template.content, /CrawlerSchedulerEvidence/);
  assert.equal((preview.template.content.match(/<ConfirmDialog/g) ?? []).length, 2);
});

test("P70 C review separates providers from resource and receipt evidence", () => {
  const template = preview.template.content;
  for (const id of ["p70-providers", "p70-runtime", "CrawlerSchedulerEvidence"])
    assert.ok(template.includes(id), id);
  for (const id of ["p70-evidence", "p70-receipts", "p70-leases", "p70-trend"])
    assert.ok(evidence.template.content.includes(id), id);
  assert.match(template, /宝塔受管/);
  assert.match(evidence.template.content, /不授权自动删除/);
  const css = readFileSync("apps/web/src/crawler-scheduler-c.css", "utf8");
  assert.match(css, /\.crawler-scheduler--c/);
  assert.match(css, /\.role-sidebar/);
});
