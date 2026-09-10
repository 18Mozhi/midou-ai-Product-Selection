import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const output = "output/playwright/p37-fields-review/";
const design = "design-plans/ui-phase-2-2026-09-07/design/org-audit-fields/";
const original = "design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c/";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (file) => (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
const e = JSON.parse(await text(output + "evidence.json"));

test("P37 field proposal binds current sources and preserves original104 images", async () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(await text(file)), sha, file);
  assert.equal(hash(await readFile(original + "evidence.json")), e.retainedManifest);
  const old = JSON.parse(await text(original + "evidence.json"));
  assert.equal(old.screenshots.length, 104);
  for (const s of old.screenshots) assert.equal(hash(await readFile(original + s.file)), s.sha256);
});

test("P37 exact38 new images remain pending and match all output files", async () => {
  const names = [
    ...[
      "action",
      "outcome",
      "resource_type",
      "request_id",
      "trace_id",
      "occurred_from",
      "occurred_to",
    ].map((k) => `field-${k}-focus`),
    ...["action", "resource_type", "request_id", "trace_id"].map((k) => `field-${k}-maximum`),
    ...["normal", "exact_draft", "advanced", "range_error", "filter_busy", "filter_failure"].map(
      (k) => `combination-${k}`,
    ),
    "local-search-filled",
    "local-search-maximum",
  ];
  assert.deepEqual(
    e.screenshots.map((s) => s.file).sort(),
    [390, 1440].flatMap((w) => names.map((n) => `${n}-${w}.png`)).sort(),
  );
  for (const s of e.screenshots) {
    assert.equal(s.approval, "pending");
    assert.equal(hash(await readFile(output + s.file)), s.sha256);
  }
  assert.deepEqual(
    (await readdir(output)).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
});

test("P37 eight source models and date bounds are not expanded", async () => {
  const source = await text("apps/web/src/components/OrganizationAuditPanel.vue");
  assert.deepEqual(
    [...source.matchAll(/v-model="([^"]+)"/g)].map((m) => m[1]).sort(),
    [
      "loadedQuery",
      ...[
        "action",
        "outcome",
        "resource_type",
        "request_id",
        "trace_id",
        "occurred_from",
        "occurred_to",
      ].map((k) => "form." + k),
    ].sort(),
  );
  assert.match(source, /:max="form.occurred_to"/);
  assert.match(source, /:min="form.occurred_from"/);
  const script = await text(design + "fields.js");
  assert.match(script, /hint.id = "server-actions-help"/);
  assert.match(script, /from.max = to.value/);
  assert.match(script, /to.min = from.value/);
  assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|localStorage|clipboard|\.disabled\s*=/);
});

test("P37 verification proves only scoped offline combinations", () => {
  assert.equal(e.checks, 175);
  assert.match(e.scope, /not actual Vue, backend, authorization or production/);
  assert.match(e.scope, /Browser closed; no server started/);
});
