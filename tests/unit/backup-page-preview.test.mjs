import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import {
  backupNodes,
  previewBackupPage,
  previewBackupTableControls,
} from "../../scripts/lib/backup-page-preview.mjs";
import { backupReviewFixtures } from "../../scripts/lib/backup-review-fixtures.mjs";
const original = readFileSync("apps/web/src/components/BackupRecoveryCenter.vue", "utf8");
const preview = previewBackupPage(original);
test("P64 review column labels use native association without changing shared business script", () => {
  const shared = readFileSync("apps/web/src/components/TableViewControls.vue", "utf8");
  const review = previewBackupTableControls(shared);
  assert.equal(
    parse(review).descriptor.scriptSetup.content,
    parse(shared).descriptor.scriptSetup.content,
  );
  assert.match(review, /<label :for="`\$\{controlId\}-column-\$\{column.index\}`"/);
  assert.deepEqual(
    compileTemplate({
      source: parse(review).descriptor.template.content,
      filename: "TableViewControls.vue",
      id: "p64-table",
    }).errors,
    [],
  );
});
test("P64 review avoids an outer scroll clip while preserving the original table scroller", () => {
  const css = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/implementation/backup-page-preview.css",
    "utf8",
  );
  assert.match(
    css,
    /\.backup-center--review \.responsive-data-view__desktop\s*\{\s*overflow: visible;/,
  );
  assert.match(
    css,
    /\.backup-center\.backup-center--review \.p64-assets\s*\{\s*overflow: visible;/,
  );
  assert.match(
    css,
    /\.backup-center--review \.table-view-controls__toolbar fieldset\s*\{\s*left: 0;\s*right: auto;/,
  );
  const shared = readFileSync("apps/web/src/components/TableViewControls.vue", "utf8");
  assert.match(shared, /\.table-view-controls__content\s*\{[^}]*overflow-x: auto;/);
});
test("P64 loading/failure and retained refresh regions have named headings and busy semantics", () => {
  const template = parse(original).descriptor.template.content;
  assert.match(template, /aria-labelledby="backup-read-title"/);
  assert.equal((template.match(/id="backup-read-title"/g) ?? []).length, 2);
  assert.match(template, /aria-labelledby="backup-refresh-title"/);
  assert.match(template, /<h3 id="backup-refresh-title">/);
  assert.equal((template.match(/:aria-busy="refreshing"/g) ?? []).length, 4);
});
test("P64 review leaves the original business script byte-equivalent after newline normalization", () => {
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(original.replaceAll("\r\n", "\n")).descriptor.scriptSetup.content,
  );
});
test("P64 review compiles its real template without errors", () => {
  const result = compileTemplate({
    source: parse(preview).descriptor.template.content,
    filename: "BackupRecoveryCenter.vue",
    id: "p64-review",
  });
  assert.deepEqual(result.errors, []);
});
test("P64 original table and complete mobile detail slots remain identical", () => {
  const node = (s) =>
    backupNodes(s).nodes.find((n) => n.type === 1 && n.tag === "ResponsiveDataView").loc.source;
  assert.equal(node(preview), node(original.replaceAll("\r\n", "\n")));
  assert.equal((node(preview).match(/<th>/g) ?? []).length, 7);
});
test("P64 new layout orders objectives, evidence, assets without the old hero/card structure", () => {
  assert.ok(preview.indexOf('id="p64-objectives"') < preview.indexOf('id="p64-evidence"'));
  assert.ok(preview.indexOf('id="p64-evidence"') < preview.indexOf('id="p64-assets"'));
  assert.equal(parse(preview).descriptor.template.content.includes('class="policy-grid"'), false);
  assert.equal(parse(preview).descriptor.template.content.includes('class="backup-grid"'), false);
  assert.equal(preview.includes("高强度加密</span>"), false);
});
test("P64 actual null/zero values and original target values remain expressions, not invented metrics", () => {
  const t = parse(preview).descriptor.template.content;
  for (const field of [
    "data.policy.rpo_minutes",
    "data.policy.rto_minutes",
    "data.latest_backup?.actual_rpo_minutes == null",
    "data.latest_drill?.actual_rto_minutes == null",
    "data.policy.maximum_drill_age_days",
  ])
    assert.equal(t.split(field).length, 2, field);
  assert.equal(t.includes('href="#p64-assets"'), true);
});
test("P64 fixture reuses original partial E2E baseline without inventing a verified drill", async () => {
  const { fixture } = await backupReviewFixtures();
  assert.equal(fixture.state, "blocked");
  assert.equal(fixture.latest_drill, null);
  assert.equal(fixture.targets.length, 1);
  assert.equal(fixture.recovery_copy_verified, false);
});
