import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "@vue/compiler-sfc";
import { previewApiCoveragePage } from "../../scripts/lib/api-coverage-page-preview.mjs";
const source = readFileSync("apps/web/src/components/ApiCoverageDashboard.vue", "utf8"),
  preview = parse(previewApiCoveragePage(source)).descriptor,
  original = parse(source).descriptor;
test("P63 C review preserves dashboard script", () => {
  assert.equal(preview.scriptSetup.content, original.scriptSetup.content);
  assert.match(preview.template.content, /<h1>接口覆盖核验<\/h1>/);
});
test("P63 C review separates catalog state and five-dimensional operation evidence", () => {
  const template = preview.template.content;
  for (const id of ["p63-truth", "p63-summary", "p63-breakdowns", "p63-operations"])
    assert.ok(template.includes(id), id);
  assert.match(template, /报告不等于全量生产验收/);
  assert.match(template, /查看五维证据/);
});
