import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  assertTokenFilterDelta,
  tokenFilterBaseline,
  tokenComponent,
} from "../../scripts/lib/ui-phase2-token-filter-delta.mjs";

const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const baseline = (f) =>
  execFileSync("git", ["show", `${tokenFilterBaseline}:${f}`], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).replaceAll("\r\n", "\n");
const current = read(tokenComponent),
  old = baseline(tokenComponent);
const output = "output/playwright/p36-mobile-filters-vue",
  e = JSON.parse(read(`${output}/evidence.json`));

test("P36 filter implementation permits exact presentation plus separately tested query delta", () => {
  assert.equal(assertTokenFilterDelta(current, old), true);
  for (const mutation of [
    current.replace('tokenQuery.value = "";', 'tokenQuery.value = "other";'),
    current.replace('v-model="tokenQuery"', 'v-model="createForm.name"'),
    current.replace('maxlength="120"', 'maxlength="121"'),
    current.replace("仅重置筛选和排序，不更改令牌。", "返回第 1 页。"),
    current.replace('class="org-token-preview"', 'class="changed-preview"'),
    current.replace('id="org-token-sort-help"', 'id="wrong-help"'),
  ])
    assert.throws(() => assertTokenFilterDelta(mutation, old));
});
test("P36 real-child evidence covers four widths and all non-target pixel exclusions", () => {
  assert.equal(e.baselineCommit, tokenFilterBaseline);
  assert.equal(e.baselineSha256, hash(old));
  assert.equal(e.checks.length, 290);
  assert.equal(e.checks.filter((c) => c.name.includes("pixel identical")).length, 56);
  assert.deepEqual([...new Set(e.checks.map((c) => c.width))], [390, 760, 761, 1440]);
  assert.equal(e.screenshots.length, 10);
  assert.deepEqual(
    e.screenshots.map((s) => s.file).sort(),
    [390, 760]
      .flatMap((w) =>
        ["default", "matching", "no-result", "reset-focus", "busy"].map((s) => `${s}-${w}.png`),
      )
      .sort(),
  );
  assert.match(e.boundary, /no parent\/API\/MySQL\/RBAC\/OS clipboard or production proof/);
  for (const s of e.screenshots) assert.match(s.scope, /not-parent-API-or-production-acceptance/);
});
test("P36 original reset, filtering, URL and write boundaries stay covered", () => {
  for (const name of [
    "default reset does not force page one",
    "changed filters reset page one",
    "reset preserves unrelated query",
    "busy filters remain editable",
    "busy reset remains local",
    "native editing retains caret",
    "local input 220 allowed",
    "URL initial reader still truncates to200",
    "technical ID excluded",
    "no business callbacks",
    "no storage or OS clipboard",
    "zero API/external requests",
    "zero browser errors",
  ])
    assert.deepEqual(
      e.checks.filter((c) => c.name === name).map((c) => c.width),
      [390, 760, 761, 1440],
      name,
    );
  assert.equal(e.checks.filter((c) => c.name.startsWith("full sorting ")).length, 40);
  assert.equal(e.checks.filter((c) => c.name.startsWith("status ")).length, 28);
});
test("P36 actual-source and image hashes are current with only permanent delivery files", () => {
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.deepEqual(
    readdirSync(output).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
});
test("P36 proposal source association never rewrites original662 images or approvals", () => {
  const dirs = [
    "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c",
    "output/playwright/p36-controls-review",
    "output/playwright/p36-fields-review",
  ];
  for (const dir of dirs) {
    const previous = JSON.parse(baseline(`${dir}/evidence.json`)),
      now = JSON.parse(read(`${dir}/evidence.json`));
    assert.deepEqual(now.screenshots, previous.screenshots);
    assert.equal(now.approval, previous.approval);
    assert.equal(now.sourceAssociation.baselineCommit, tokenFilterBaseline);
    assert.equal(now.sourceAssociation.script, "query-sync-only");
    assert.equal(now.sourceAssociation.queryProof, "scripts/lib/ui-phase2-token-query-delta.mjs");
    if (previous.models) assert.deepEqual(now.models, previous.models);
    for (const s of now.screenshots) assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  }
  const result = JSON.parse(
    execFileSync(process.execPath, ["scripts/refresh-ui-phase2-token-filter-bindings.mjs"], {
      encoding: "utf8",
    }),
  );
  assert.deepEqual(result, {
    manifests: 3,
    pngCount: 662,
    write: false,
    pngRewritten: 0,
    scriptUnchanged: false,
    querySyncOnly: true,
  });
});
