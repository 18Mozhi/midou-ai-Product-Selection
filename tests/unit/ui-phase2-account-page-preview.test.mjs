import { historicalOrganizationActionSource } from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { accountPagePreview } from "../../scripts/lib/ui-phase2-account-page-preview.mjs";
const component = "apps/web/src/components/PlatformAccountCenter.vue";
const output = "output/playwright/p39-page-composed";
// Frozen visual/diagnostic captures use their exact pre-repair source, not current acceptance.
const read = (f) => historicalOrganizationActionSource(f, readFileSync(f, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const original = read(component),
  transformed = accountPagePreview(original);
function bindings(source) {
  const result = [];
  function visit(n) {
    if (n.type === 1)
      for (const p of n.props)
        if (p.type === 7)
          result.push(
            JSON.stringify([
              n.tag,
              p.name,
              p.arg?.content,
              p.exp?.content,
              p.modifiers.map((m) => m.content),
            ]),
          );
    for (const c of n.children ?? []) visit(c);
  }
  visit(baseParse(parse(source).descriptor.template.content));
  return result.sort();
}
test("P39 composed template preserves complete original script and every native directive", () => {
  assert.equal(parse(transformed).errors.length, 0);
  assert.equal(
    parse(transformed).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(bindings(transformed), bindings(original));
  assert.match(transformed, /p39-directory/);
  assert.match(transformed, /p39-results-head/);
  assert.equal(
    (transformed.match(/刷新数据/g) || []).length,
    (original.match(/刷新数据/g) || []).length,
  );
  assert.throws(() =>
    accountPagePreview(original.replace('class="account-metrics"', 'class="different"')),
  );
});
test("P39 whole-page captures have six normal breakpoints, exact files and current sources", () => {
  const e = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(e.approval, "pending");
  assert.equal(e.processesClosed, true);
  assert.match(e.scope, /Not complete app shell/);
  assert.equal(e.transformedSourceHash, hash(transformed));
  assert.equal(e.checks.length, 57);
  assert.equal(e.screenshots.length, 28);
  assert.deepEqual(
    e.screenshots.filter((s) => s.state === "normal").map((s) => s.viewport.width),
    [390, 759, 760, 761, 1024, 1440],
  );
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const b = readFileSync(`${output}/${s.file}`);
    assert.equal(hash(b), s.sha256);
    assert.equal(s.kind, "vue-review-template-composed");
    assert.equal(s.sourceSha, hash(JSON.stringify(e.sourceHashes)));
    assert.deepEqual(s.imageDimensions, { width: b.readUInt32BE(16), height: b.readUInt32BE(20) });
  }
  for (const observation of e.observations)
    assert.ok(observation.requests.every((r) => r.method === "GET"));
});
test("original P39 code and previously presented146 images/styles are not rewritten by assembly", () => {
  for (const f of [
    component,
    "design-plans/ui-phase-2-2026-09-07/implementation/account-filter-preview.css",
    "design-plans/ui-phase-2-2026-09-07/implementation/account-create-preview.css",
  ])
    assert.equal(
      read(f),
      execFileSync("git", ["show", `6e01d1cf:${f}`], { encoding: "utf8" }).replaceAll("\r\n", "\n"),
      f,
    );
  let count = 0;
  for (const dir of [
    "design-plans/ui-phase-2-2026-09-07/design/account-overview-direction-c",
    "output/playwright/p39-filter-preview",
    "output/playwright/p39-create-user-preview",
  ]) {
    const old = execFileSync("git", ["show", `6e01d1cf:${dir}/evidence.json`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(read(`${dir}/evidence.json`), old);
    for (const s of JSON.parse(old).screenshots) {
      assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256);
      count++;
    }
  }
  assert.equal(count, 146);
});
