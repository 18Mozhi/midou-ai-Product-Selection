import { historicalAdapterCSource } from "../../scripts/lib/ui-phase2-adapter-c-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { historicalProviderKeyboardSource } from "../../scripts/lib/ui-phase2-provider-keyboard-baseline.mjs";
import { parse } from "@vue/compiler-sfc";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import {
  providerFeedbackRevisions,
  historicalProviderFeedbackSource,
} from "../../scripts/lib/ui-phase2-provider-feedback-baseline.mjs";

// This suite preserves the pre-keyboard approved feedback capture, not current-source coverage.
const read = (file) =>
  historicalProviderKeyboardSource(
    file,
    historicalAdapterCSource(file, readFileSync(file, "utf8")),
  );
const hash = (data) => createHash("sha256").update(data).digest("hex");
const file = "apps/web/src/components/ProviderRegistry.vue";
const current = read(file),
  old = historicalProviderFeedbackSource(file, current);
const style = "apps/web/src/styles/provider-approved-feedback.css";
const folder = "output/playwright/p46-provider-feedback-implementation";
const evidence = (mode) => JSON.parse(read(folder + "/" + mode + "/evidence.json"));

test("P46 approved feedback changes no script, event, model, text or business rule", () => {
  const a = parse(current).descriptor,
    b = parse(old).descriptor;
  assert.equal(a.scriptSetup.content, b.scriptSetup.content);
  assert.deepEqual(
    a.styles.map((s) => s.src),
    ["../styles/provider-approved-feedback.css"],
  );
  const reverted = a.template.content
    .replace(
      /<p\s+v-if="successMessage"\s+class="provider-feedback"\s+data-tone="success"\s+:data-refresh-incomplete="loadMessage \? true : undefined"\s+role="status"\s*>/,
      '<p v-if="successMessage" class="provider-feedback" data-tone="success" role="status">',
    )
    .replace(
      /<button\s+v-else\s+type="submit"\s+:disabled="saving \|\| Object.keys\(formErrors\).length > 0"\s+:data-waiting-previous="\s+saving && pendingSaveGeneration !== editorFocusGeneration \? true : undefined\s+"\s*>/,
      '<button v-else type="submit" :disabled="saving || Object.keys(formErrors).length > 0">',
    );
  assert.equal(reverted, b.template.content);
  const candidates = (source) => scanSource(source, file).candidates;
  assert.equal(candidates(current).length, 22);
  const changed = candidates(current).filter(
    (c, i) => c.candidateId !== candidates(old)[i].candidateId,
  );
  assert.equal(changed.length, 1);
  assert.equal(changed[0].signature, "addbc979a88d3d3a");
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/provider-definition-contract-review.md"),
    new RegExp(hash(current)),
  );
});

test("P46 CSS is limited to approved mobile attributes, no preview layout or focus override", () => {
  const css = read(style);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.equal((css.match(/@media/g) ?? []).length, 1);
  assert.equal((css.match(/\{/g) ?? []).length, 4);
  assert.match(css, /button\[data-waiting-previous="true"\]:disabled/);
  assert.match(css, /> \.provider-feedback\[data-refresh-incomplete="true"\]/);
  assert.doesNotMatch(
    css,
    /!important|@import|position:|outline:|z-index:|p46-page-review|p46-editor-review/,
  );
  for (const value of ["#66748a", "#e8edf4", "#d8e1ed", "#75461f", "#fff8ef", "#e5bca4", "#294caf"])
    assert.ok(css.includes(value));
});

test("P46 feedback history and two user-approved PNGs remain exact, unknown drift fails closed", () => {
  for (const r of providerFeedbackRevisions) {
    const s = read(r.file);
    assert.equal(hash(s), r.after);
    assert.equal(hash(historicalProviderFeedbackSource(r.file, s)), r.before);
    assert.equal(
      historicalProviderFeedbackSource(r.file, s + "\n/* drift */"),
      s + "\n/* drift */",
    );
  }
  for (const [name, sha] of [
    [
      "review-390-late-success-create-pending-new.png",
      "5d30dcef0f4343c5c1c01547a95c52546e97510c4bc58043e0bcd7b08f7e6714",
    ],
    [
      "review-390-refresh-failure-edit-settled.png",
      "5685cc1a78b937358d1041b2314bf4b3302a16cf2519d6c678ddb8822461c1bd",
    ],
  ])
    assert.equal(
      hash(readFileSync("output/playwright/p46-provider-async-implementation/current/" + name)),
      sha,
    );
});

test("P46 feedback80 actual Vue pictures bind current raw source, baseline, network and closed processes", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = folder + "/" + mode;
    assert.equal(e.kind, "P46-APPROVED-FEEDBACK-r1");
    assert.equal(e.mode, mode);
    assert.equal(e.processesClosed, true);
    assert.equal(e.screenshots.length, 40);
    assert.equal(e.visuals.length, 40);
    assert.equal(e.checks.length, mode === "current" ? 244 : 230);
    assert.equal(Object.keys(e.sourceHashes).length, mode === "current" ? 43 : 42);
    for (const [f, sha] of Object.entries(e.sourceHashes)) {
      // Only Registry is loaded from the old commit in this baseline host.
      const s = mode === "baseline" && f === file ? old : read(f);
      assert.equal(hash(s), sha, mode + ":" + f);
    }
    assert.deepEqual(
      readdirSync(dir).sort(),
      ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots) {
      const bytes = readFileSync(dir + "/" + s.file);
      assert.equal(hash(bytes), s.sha256);
      assert.equal(bytes.readUInt32BE(16), s.width);
      assert.equal(bytes.readUInt32BE(20), 900);
    }
    assert.match(e.scope, /no real persistence\/permissions/);
  }
  assert.deepEqual(evidence("current").observations, evidence("baseline").observations);
  const requests = evidence("current").observations.flatMap((o) => o.requests);
  assert.equal(requests.filter((r) => r.method === "POST").length, 16);
  assert.equal(requests.filter((r) => r.method === "PUT").length, 8);
  assert.ok(requests.filter((r) => r.method !== "GET").every((r) => r.idempotencyPresent));
});

test("P46 mobile feedback appearances match review reference; desktop and other states keep computed styling", () => {
  const b = evidence("baseline"),
    c = evidence("current");
  const same = (a, z) =>
    a.surface === z.surface &&
    a.width === z.width &&
    a.scenario === z.scenario &&
    a.state === z.state;
  for (const v of c.visuals) {
    const prior = b.visuals.find((p) => same(p, v));
    assert.ok(prior);
    const affected =
      v.surface === "production" &&
      v.width <= 760 &&
      (v.state === "pending-new" ||
        (v.scenario === "refresh-failure-edit" && v.state === "settled"));
    if (!affected) {
      for (const key of Object.keys(v.entries)) {
        assert.equal(!!v.entries[key], !!prior.entries[key]);
        if (v.entries[key])
          assert.deepEqual(
            v.entries[key].styles,
            prior.entries[key].styles,
            [v.surface, v.width, v.scenario, v.state, key].join(":"),
          );
      }
      continue;
    }
    const reference = b.visuals.find((p) => same(p, { ...v, surface: "review" }));
    for (const key of v.state === "pending-new" ? ["waiting"] : ["saved", "warning", "retry"]) {
      assert.deepEqual(
        v.entries[key].styles,
        reference.entries[key].styles,
        [v.width, key].join(":"),
      );
      assert.equal(v.entries[key].text, reference.entries[key].text);
      if (["waiting", "retry"].includes(key))
        assert.ok(v.entries[key].height >= 44 && v.entries[key].width >= 44);
    }
  }
});

test("P46 unaffected screenshots stay pixel-identical apart from three measured raster-edge deltas", () => {
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const exactEdges = {
    "production-761-refresh-failure-edit-settled.png": [2, 1, 760, 707, 760, 708],
    "production-761-refresh-failure-edit-retried.png": [1, 1, 760, 897, 760, 897],
    "review-390-refresh-failure-edit-retried.png": [13, 2, 33, 731, 35, 791],
  };
  const prior = evidence("baseline"),
    seen = [];
  let identical = 0;
  for (const s of evidence("current").screenshots) {
    if (
      s.surface === "production" &&
      s.width <= 760 &&
      (s.state === "pending-new" ||
        (s.scenario === "refresh-failure-edit" && s.state === "settled"))
    )
      continue;
    const b = prior.screenshots.find((b) => b.file === s.file);
    if (b.sha256 === s.sha256) {
      identical++;
      continue;
    }
    assert.ok(exactEdges[s.file], s.file + " unexpected raster difference");
    seen.push(s.file);
    const a = PNG.sync.read(readFileSync(folder + "/baseline/" + s.file));
    const z = PNG.sync.read(readFileSync(folder + "/current/" + s.file));
    let pixels = 0,
      maximum = 0,
      minX = a.width,
      minY = a.height,
      maxX = 0,
      maxY = 0;
    for (let p = 0; p < a.width * a.height; p++) {
      let changed = false;
      for (let k = 0; k < 4; k++) {
        const delta = Math.abs(a.data[p * 4 + k] - z.data[p * 4 + k]);
        changed ||= delta !== 0;
        maximum = Math.max(maximum, delta);
      }
      if (changed) {
        pixels++;
        const x = p % a.width,
          y = Math.floor(p / a.width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    assert.deepEqual([pixels, maximum, minX, minY, maxX, maxY], exactEdges[s.file]);
  }
  assert.equal(identical, 33);
  assert.deepEqual(seen.sort(), Object.keys(exactEdges).sort());
});
