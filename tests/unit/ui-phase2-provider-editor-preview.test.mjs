import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { providerPagePreview } from "../../scripts/lib/ui-phase2-provider-page-preview.mjs";
import { historicalProviderFocusSource } from "../../scripts/lib/ui-phase2-provider-focus-baseline.mjs";

const read = (f) => historicalProviderFocusSource(f, readFileSync(f, "utf8"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p46-provider-editor-vue-preview";
const source = "apps/web/src/components/ProviderRegistry.vue";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));

test("P46 historical editor template, all23 field models and script keep exact associations", () => {
  const original = read(source),
    transformed = providerPagePreview(original);
  const marker = '    <div\n      v-if="editorOpen"';
  assert.equal(original.split(marker).length, 2);
  assert.equal(transformed.split(marker)[1], original.split(marker)[1]);
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  const models = [...original.matchAll(/v-model(?:\.[\w]+)?="form\.(\w+)"/g)].map((m) => m[1]);
  assert.equal(models.length, 23);
  assert.equal(new Set(models).size, 23);
  assert.deepEqual(
    models.sort(),
    evidence().observations[0].requests.find((r) => r.method === "POST").body
      ? Object.keys(
          evidence().observations[0].requests.find((r) => r.method === "POST").body,
        ).sort()
      : [],
  );
});

test("P46 editor historical source and134 image inventory remain pinned", () => {
  const e = evidence();
  assert.equal(e.kind, "P46-PROVIDER-EDITOR-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 444);
  assert.equal(e.screenshots.length, 134);
  assert.equal(Object.keys(e.sourceHashes).length, 39);
  for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
  assert.deepEqual(e.transformedHashes, { [source]: hash(providerPagePreview(read(source))) });
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(folder + "/" + s.file);
    assert.equal(hash(bytes), s.sha256, s.file);
    assert.deepEqual(s.imageDimensions, {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    });
    assert.equal(s.imageDimensions.width, s.width);
    assert.equal(s.imageDimensions.height, s.state.startsWith("short-screen") ? 568 : 900);
  }
});

test("P46 actual fields, errors, templates and rejected requests preserve known runtime edges", () => {
  const e = evidence();
  assert.deepEqual(
    e.observations.map((o) => o.width),
    [390, 760, 761, 1440],
  );
  for (const o of e.observations) {
    const value = (name) => {
      const c = e.checks.find((c) => c.width === o.width && c.name === name);
      assert.ok(c, name);
      return c.actual;
    };
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.deepEqual(
      o.requests.map((r) => r.method),
      ["GET", "POST", "PUT", "POST"],
    );
    assert.deepEqual(
      o.requests.slice(1).map((r) => r.status),
      [503, 409, 409],
    );
    assert.ok(o.requests.slice(1).every((r) => r.idempotencyPresent));
    const states = e.screenshots.filter((s) => s.width === o.width).map((s) => s.state);
    assert.equal(states.length, o.width === 390 ? 35 : 33);
    assert.equal(new Set(states).size, states.length);
    for (let n = 1; n <= 4; n++) {
      assert.equal(value("step " + n + " exact fields").length, [5, 6, 7, 5][n - 1]);
      assert.equal(value("step " + n + " controls meet 44px and 16px"), true);
      for (const prefix of ["create", "edit"]) {
        assert.ok(states.includes(prefix + "-step-" + n));
        assert.ok(states.includes(prefix + "-step-" + n + "-bottom"));
      }
    }
    assert.equal(value("all six numeric errors visible"), 6);
    assert.equal(value("new public RSS remains disabled"), "disabled");
    assert.equal(value("public enable missing terms disables save"), true);
    assert.equal(value("invalid save gray background"), "rgb(232, 237, 244)");
    assert.equal(value("busy save gray background"), "rgb(232, 237, 244)");
    for (const mode of ["public_page", "public_rss", "authenticated_browser", "import", "manual"]) {
      assert.ok(value("template fields " + mode).startsWith("title,"));
      assert.ok(states.includes("template-" + mode));
    }
    assert.equal(value("one dialog after mobile handoff"), 1);
    assert.equal(value("edit expected version"), 1);
    assert.equal(value("actual readonly property retention"), true);
    assert.equal(value("current timezone behavior observed not fixed"), "2027-08-07T09:00:00.000Z");
    assert.equal(value("edit then create still retains original readonly keys"), true);
    assert.equal(value("create after edit has no expected_version"), false);
    assert.equal(value("Escape returns create focus"), true);
    assert.equal(value("Tab reaches first step"), true);
    assert.equal(value("create close returns focus"), true);
  }
});

test("P46 editor CSS stays review-only and production/lifecycle acceptance is not implied", () => {
  assert.doesNotMatch(read("apps/web/src/main.ts"), /provider-editor-preview/);
  const css = read("design-plans/ui-phase-2-2026-09-07/implementation/provider-editor-preview.css");
  assert.match(css, /body\.p46-editor-review/);
  assert.match(css, /\.provider-editor > footer button:disabled/);
  assert.match(evidence().scope, /rejected POST\/PUT intercepted only/);
  assert.match(evidence().scope, /not fixed/);
  assert.match(evidence().scope, /no successful save\/reload/);
  assert.match(evidence().scope, /modal accessibility acceptance/);
});
