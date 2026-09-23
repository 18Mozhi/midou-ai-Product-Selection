import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, compileTemplate } from "@vue/compiler-sfc";
import { previewBackupPage } from "../../scripts/lib/backup-page-preview.mjs";
import { backupReviewFixtures } from "../../scripts/lib/backup-review-fixtures.mjs";

const original = readFileSync("apps/web/src/components/BackupRecoveryCenter.vue", "utf8");
const preview = previewBackupPage(original);

test("P64 review mounts the production Vue page and changes only its review marker", () => {
  assert.equal(
    parse(preview).descriptor.scriptSetup.content,
    parse(original.replaceAll("\r\n", "\n")).descriptor.scriptSetup.content,
  );
  assert.equal(
    preview.replace(
      'class="backup-center backup-center--c backup-center--review"',
      'class="backup-center backup-center--c"',
    ),
    original.replaceAll("\r\n", "\n"),
  );
});

test("P64 uses opt-in native column labels without changing other table controls", () => {
  const controls = readFileSync("apps/web/src/components/TableViewControls.vue", "utf8");
  assert.match(controls, /v-if="props\.columnLabels"/);
  assert.match(controls, /<label[\s\S]*?v-if="props\.columnLabels"[\s\S]*?:for=/);
  assert.match(
    controls,
    /<span v-else :id="`\$\{controlId\}-column-\$\{column\.index\}-description`"/,
  );
  assert.match(original, /column-labels/);
});

test("P64 production styles are route-scoped and retain review controls", () => {
  const css = readFileSync("apps/web/src/backup-recovery-center-c.css", "utf8");
  assert.match(css, /\.backup-center--c \.responsive-data-view__desktop\s*\{\s*overflow: visible;/);
  assert.match(css, /\.backup-center\.backup-center--c \.p64-assets\s*\{\s*overflow: visible;/);
  assert.match(
    css,
    /\.backup-center--c \.table-view-controls__toolbar fieldset\s*\{\s*left: 0;\s*right: auto;/,
  );
  assert.match(css, /body:has\(\.backup-center--c\) \.responsive-data-view__drawer/);
});

test("P64 reading and retained-refresh regions retain named headings and busy semantics", () => {
  const template = parse(original).descriptor.template.content;
  assert.match(template, /aria-labelledby="backup-read-title"/);
  assert.equal((template.match(/id="backup-read-title"/g) ?? []).length, 2);
  assert.match(template, /aria-labelledby="backup-refresh-title"/);
  assert.match(template, /<h2 id="backup-refresh-title">/);
  assert.equal((template.match(/:aria-busy="refreshing"/g) ?? []).length, 4);
});

test("P64 production template compiles and preserves the seven-column asset table and mobile slots", () => {
  const template = parse(original).descriptor.template.content;
  const result = compileTemplate({
    source: template,
    filename: "BackupRecoveryCenter.vue",
    id: "p64",
  });
  assert.deepEqual(result.errors, []);
  assert.equal((template.match(/<th>/g) ?? []).length, 7);
  assert.match(template, /<template #summary=/);
  assert.match(template, /<template #detail=/);
});

test("P64 objective, evidence, and assets appear in the approved order without unsupported encryption claims", () => {
  assert.ok(preview.indexOf('id="p64-objectives"') < preview.indexOf('id="p64-evidence"'));
  assert.ok(preview.indexOf('id="p64-evidence"') < preview.indexOf('id="p64-assets"'));
  assert.equal(preview.includes('class="policy-grid"'), false);
  assert.equal(preview.includes("高强度加密</span>"), false);
  assert.match(
    readFileSync("apps/web/src/components/BackupRecoveryDirectory.vue", "utf8"),
    /href="#p64-assets"/,
  );
});

test("P64 objective labels use returned null/zero values instead of invented metrics", () => {
  const template = parse(preview).descriptor.template.content;
  for (const field of [
    "data.policy.rpo_minutes",
    "data.policy.rto_minutes",
    "data.latest_backup?.actual_rpo_minutes == null",
    "data.latest_drill?.actual_rto_minutes == null",
    "data.policy.maximum_drill_age_days",
  ])
    assert.equal(template.split(field).length, 2, field);
});

test("P64 fixture remains explicitly blocked without inventing a verified restore drill", async () => {
  const { fixture } = await backupReviewFixtures();
  assert.equal(fixture.state, "blocked");
  assert.equal(fixture.latest_drill, null);
  assert.equal(fixture.targets.length, 1);
  assert.equal(fixture.recovery_copy_verified, false);
});
