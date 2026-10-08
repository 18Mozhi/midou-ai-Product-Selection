import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { capturedExportDetailHash } from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";
import { readCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const output = "output/playwright/p35-fields-review";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");

test("P35 eight actual fields are mapped once with no new required/maxlength/error policy", () => {
  const child = text("apps/web/src/components/OrganizationDataPanel.vue");
  assert.deepEqual(
    e.fields.map((f) => f.model),
    [...child.matchAll(/v-model="([^"]+)"/g)].map((m) => m[1]),
  );
  assert.equal(e.fields.length, 8);
  assert.equal(new Set(e.fields.map((f) => f.id)).size, 8);
  for (const c of e.checks) {
    assert.equal(c.metrics.overflow, false);
    for (const f of c.metrics.controls) {
      assert.ok(f.help && f.label && f.height >= 44 && parseFloat(f.font) >= 16);
      assert.equal(f.required, false);
      assert.equal(f.maxlength, null);
      assert.equal(f.invalid, null);
    }
  }
});

test("P35 field state images cover both widths, all options, input edges and eight compositions", () => {
  assert.equal(e.checks.length, 140);
  assert.equal(e.screenshots.length, 140);
  const child = text("apps/web/src/components/OrganizationDataPanel.vue");
  const expected = [];
  for (const f of e.fields) {
    const select = child.match(new RegExp(`<select v-model="${f.model}">([\\s\\S]*?)</select>`));
    const optionCount = select
      ? f.model === "exportWorkspace"
        ? 3
        : [...select[1].matchAll(/<option value=/g)].length
      : null;
    const states = [
      "default",
      "hover",
      "focus",
      ...(select
        ? Array.from({ length: optionCount }, (_, i) => `option-${i}`)
        : ["filled", "whitespace", "long", "no-match", "id-excluded"]),
    ];
    for (const width of [1440, 390])
      for (const state of states) expected.push(`${f.id}-${state}-${width}.png`);
  }
  for (const kind of ["workspace", "export"])
    for (const state of ["default", "filtered", "empty", "reset"])
      for (const width of [1440, 390]) expected.push(`${kind}-composition-${state}-${width}.png`);
  assert.deepEqual(e.screenshots.map((s) => s.file).sort(), expected.sort());
  assert.deepEqual(readdirSync(output).sort(), [...expected, "evidence.json", "index.html"].sort());
  for (const s of e.screenshots)
    assert.ok(e.checks.some((c) => c.name === s.name && c.width === s.width));
  for (const c of e.checks.filter((c) => /-(no-match|id-excluded|composition-empty)$/.test(c.name)))
    assert.deepEqual(c.ids, []);
});

test("P35 keyboard/reset flows and approval boundary are explicit", () => {
  assert.equal(e.interactions.length, 8);
  for (const width of [1440, 390])
    for (const kind of ["workspace", "export"]) {
      const flows = e.interactions.filter((c) => c.kind === kind && c.width === width);
      assert.deepEqual(
        flows.map((c) => c.action),
        ["typing-caret-and-tab-order", "reset-current-view-only"],
      );
      assert.equal(flows[1].retainedOther.query, "新品");
    }
  assert.match(e.boundary, /not mounted Vue\/API\/RBAC\/production/);
  assert.match(e.boundary, /No field approvals implied/);
  assert.equal(Object.hasOwn(e, "approved"), false);
});

test("P35 new source and image hashes are current and 310 previous PNGs are retained", () => {
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(capturedExportDetailHash(f, text(f)), sha, f);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  assert.equal(
    Object.values(e.retained).reduce((sum, r) => sum + r.pngCount, 0),
    310,
  );
  for (const [dir, retained] of Object.entries(e.retained)) {
    const current = JSON.parse(text(`${dir}/evidence.json`));
    const captured = JSON.parse(
      readCaptureSourceRevision(`${dir}/evidence.json`, retained.manifest),
    );
    assert.deepEqual({ ...current, sourceHashes: captured.sourceHashes }, captured, dir);
    for (const [file, sourceHash] of Object.entries(current.sourceHashes))
      if (captured.sourceHashes[file] !== sourceHash)
        assert.equal(hash(readCaptureSourceRevision(file, sourceHash)), sourceHash, file);
    for (const s of captured.screenshots)
      assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256);
  }
});
