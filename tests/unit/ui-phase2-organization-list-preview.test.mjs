import { historicalOrganizationActionSource } from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import test from "node:test";
import { historicalFilterResetSource } from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import {
  organizationListPreview,
  organizationRecordPreview,
} from "../../scripts/lib/ui-phase2-organization-list-preview.mjs";
import { reviewHash } from "../../scripts/lib/ui-phase2-vue-review-host.mjs";

// Frozen visual/diagnostic captures use their exact pre-repair source, not current acceptance.
const read = (file) => historicalOrganizationActionSource(file, readFileSync(file, "utf8"));
const transforms = {
  "apps/web/src/components/PlatformAccountCenter.vue": organizationListPreview,
  "apps/web/src/components/PlatformOrganizationRecords.vue": organizationRecordPreview,
};
const output = "output/playwright/p40-list-preview";
function templateFacts(source) {
  const directives = [],
    expressions = [];
  function visit(node) {
    if (node.type === 1)
      for (const p of node.props)
        if (p.type === 7)
          directives.push(
            JSON.stringify([
              node.tag,
              p.name,
              p.arg?.content,
              p.exp?.content,
              p.modifiers.map((m) => m.content),
            ]),
          );
    if (node.type === 5) expressions.push(node.content.content);
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parse(source).descriptor.template.content));
  return { directives: directives.sort(), expressions: expressions.sort() };
}
test("P40 review keeps complete parent/record scripts and original directives", () => {
  for (const [file, transform] of Object.entries(transforms)) {
    const original = read(file),
      preview = transform(original),
      parsed = parse(preview);
    assert.equal(parsed.errors.length, 0);
    assert.equal(
      parsed.descriptor.scriptSetup.content,
      parse(original).descriptor.scriptSetup.content,
    );
    assert.deepEqual(templateFacts(preview).directives, templateFacts(original).directives);
    assert.equal(
      read(file),
      execFileSync("git", ["show", `4cfea9db:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
    );
    if (file.endsWith("PlatformOrganizationRecords.vue"))
      assert.deepEqual(templateFacts(preview).expressions, templateFacts(original).expressions);
  }
});
test("P40 rejects source drift and uses organization-specific help without inventing fields", () => {
  const parent = read(Object.keys(transforms)[0]),
    record = read(Object.keys(transforms)[1]);
  assert.throws(() =>
    organizationListPreview(parent.replace("管理组织状态与隔离边界", "其他标题")),
  );
  assert.throws(() =>
    organizationRecordPreview(record.replace("{{ row.member_count }} 人 ·", "其他字段")),
  );
  const preview = organizationListPreview(parent);
  assert.match(preview, /按组织名称或标识查询，不按成员邮箱查询/);
  assert.doesNotMatch(preview, /概览只展示组织记录/);
  assert.match(organizationRecordPreview(record), /p40-record-counts/);
});
test("P40 screenshots bind captured source revisions, exact files and all six normal widths", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 97);
  assert.equal(e.screenshots.length, 36);
  assert.match(e.scope, /Not full App shell/);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(reviewHash(historicalFilterResetSource(file, read(file))), sha, file);
  for (const [file, transform] of Object.entries(transforms))
    assert.equal(e.transformedHashes[file], reviewHash(transform(read(file))));
  assert.deepEqual(
    e.screenshots.filter((s) => s.state === "normal").map((s) => s.viewport.width),
    [390, 759, 760, 761, 1024, 1440],
  );
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${output}/${s.file}`);
    assert.equal(reviewHash(bytes), s.sha256);
    assert.equal(s.sourceSha, reviewHash(JSON.stringify(e.sourceHashes)));
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.routeId, "P40");
  }
  for (const width of [390, 1440])
    for (const state of [
      "many",
      "long",
      "zero",
      "unknown",
      "filters",
      "create-user",
      "empty",
      "filtered-empty",
      "first-failure",
      "loading",
      "refreshing",
      "refresh-failed",
    ])
      assert.ok(
        e.screenshots.some((s) => s.viewport.width === width && s.state === state),
        `${width}/${state}`,
      );
  assert.equal(e.observations.length, 6);
  for (const observation of e.observations) {
    assert.ok(observation.requests.every((r) => r.method === "GET"));
    assert.ok(
      e.checks.some(
        (c) =>
          c.width === observation.width &&
          c.name === "no writes or external requests or browser errors",
      ),
    );
  }
});
test("prior P39 and original P40-P42 C proposal evidence are unchanged", () => {
  for (const dir of [
    "output/playwright/p39-page-composed",
    "design-plans/ui-phase-2-2026-09-07/design/platform-organizations-direction-c",
  ]) {
    const old = execFileSync("git", ["show", `4cfea9db:${dir}/evidence.json`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(read(`${dir}/evidence.json`), old);
    for (const s of JSON.parse(old).screenshots)
      assert.equal(reviewHash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  }
});
