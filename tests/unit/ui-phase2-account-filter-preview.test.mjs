import { accountHistoricalCapture } from "../../scripts/lib/ui-phase2-account-historical-capture.mjs";
import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import { historicalOrganizationActionSource } from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { accountFilterPreview } from "../../scripts/lib/ui-phase2-account-filter-preview.mjs";

const component = "apps/web/src/components/PlatformAccountCenter.vue";
const output = "output/playwright/p39-filter-preview";
const capture = accountHistoricalCapture("filter");
// Frozen visual/diagnostic captures use their exact pre-repair source, not current acceptance.
const read = (file) =>
  historicalAdminResultsSource(
    file,
    historicalOrganizationActionSource(file, readFileSync(file, "utf8")),
  );
const hash = (value) => createHash("sha256").update(value).digest("hex");
const source = read(component),
  preview = accountFilterPreview(source);
function directives(template) {
  const result = [];
  const visit = (node) => {
    if (node.type === 1)
      for (const prop of node.props)
        if (prop.type === 7)
          result.push([
            node.tag,
            prop.name,
            prop.arg?.content,
            prop.exp?.content,
            prop.modifiers.map((m) => m.content),
          ]);
    for (const child of node.children ?? []) visit(child);
  };
  visit(baseParse(template));
  return result;
}
test("P39 preview preserves the entire script, native directives and production template outside the form", () => {
  assert.equal(
    parse(preview.source).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  assert.equal(preview.source.replace(preview.form, preview.original), source);
  assert.deepEqual(directives(preview.form), directives(preview.original));
  assert.equal(parse(preview.source).errors.length, 0);
  assert.doesNotMatch(preview.form, /maxlength|aria-invalid|required|readonly/);
  assert.match(preview.form, /aria-labelledby="p39-query-label"/);
  assert.match(preview.form, /id="p39-query-label">关键词/);
});
test("P39 review refuses changed source markup instead of silently rendering an obsolete form", () => {
  assert.throws(() =>
    accountFilterPreview(source.replace('class="account-filter"', 'class="changed"')),
  );
  assert.throws(() =>
    accountFilterPreview(
      source.replace(':placeholder="searchPlaceholder"', ':placeholder="other"'),
    ),
  );
});
test("P39 evidence has captured source revisions, exact images and explicit fixture boundaries", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.match(e.scope, /Not unchanged production template/);
  assert.equal(e.processesClosed, true);
  assert.equal(e.templateTransform.originalHash, hash(preview.original));
  assert.equal(e.templateTransform.reviewHash, hash(preview.form));
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(capture.source(file)), sha, file);
  assert.equal(e.screenshots.length, 18);
  assert.equal(e.checks.length, 82);
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    assert.deepEqual(o.requests, [{}, { query: "米豆", status: "archived" }, {}]);
    assert.equal(o.pendingFieldsEditable, true);
    assert.match(o.fixtureSemantics, /does not prove backend filtering/);
  }
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${output}/${s.file}`);
    assert.equal(hash(bytes), s.sha256);
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.kind, "vue-review-template");
    assert.equal(s.sourceSha, hash(JSON.stringify(e.sourceHashes)));
  }
});
test("P39 original 86-image proposal and production parent remain unchanged at this review boundary", () => {
  const baseline = "54ec4736";
  const folder = "design-plans/ui-phase-2-2026-09-07/design/account-overview-direction-c";
  const old = JSON.parse(
    execFileSync("git", ["show", `${baseline}:${folder}/evidence.json`], { encoding: "utf8" }),
  );
  assert.equal(old.screenshots.length, 86);
  for (const shot of old.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256);
  for (const file of [
    component,
    ...["index.html", "accounts.js", "accounts.css", "data.js"].map((f) => `${folder}/${f}`),
  ]) {
    assert.equal(
      read(file),
      execFileSync("git", ["show", `${baseline}:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
      file,
    );
  }
});
