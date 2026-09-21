import test from "node:test";
import { adminReviewHistoricalCapture } from "../../scripts/lib/ui-phase2-admin-review-historical-capture.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { adminPageAssemblyPreview } from "../../scripts/lib/ui-phase2-admin-page-assembly-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const root = "output/playwright/p44-page-boundary-vue-";
const evidence = (variant) => JSON.parse(read(root + variant + "/evidence.json"));
const states = [
  "default",
  "default-top",
  "keyboard-create",
  "keyboard-navigation",
  "keyboard-email",
  "keyboard-differences",
  "keyboard-left-role",
  "keyboard-reset",
];
const names = ["create", "navigation", "email", "differences", "left-role", "reset"];

for (const variant of ["baseline", "preview"]) {
  test(`P44 boundary ${variant} pins historical source, transformations, images and read-only replay`, () => {
    const historical = adminReviewHistoricalCapture(`boundary-${variant}`);
    const e = evidence(variant),
      folder = root + variant;
    assert.equal(e.kind, "P44-PAGE-BOUNDARY-VUE-PREVIEW-r1");
    assert.equal(e.variant, variant === "baseline" ? "baseline" : "focus-corrected-review");
    assert.equal(e.approval, "pending-user-review");
    assert.equal(e.processesClosed, true);
    assert.equal(e.checks.length, variant === "baseline" ? 238 : 274);
    assert.equal(Object.keys(e.sourceHashes).length, variant === "baseline" ? 44 : 45);
    for (const [file, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(historical.source(file)), sha, file);
    for (const [file, surface] of [
      ["apps/web/src/components/PlatformAccountCenter.vue", "parent"],
      ["apps/web/src/components/PlatformUserDetailDialog.vue", "detail"],
    ])
      assert.equal(
        hash(adminPageAssemblyPreview(historical.source(file), surface)),
        e.transformedHashes[file],
      );
    assert.equal(e.screenshots.length, 16);
    assert.deepEqual(
      readdirSync(folder).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const shot of e.screenshots)
      assert.equal(hash(readFileSync(folder + "/" + shot.file)), shot.sha256, shot.file);
    assert.deepEqual(
      e.observations.map((o) => o.width),
      [1200, 1201],
    );
    for (const o of e.observations) {
      assert.deepEqual(
        e.screenshots
          .filter((s) => s.width === o.width)
          .map((s) => s.state)
          .sort(),
        [...states].sort(),
      );
      assert.deepEqual(o.errors, []);
      assert.deepEqual(o.unexpected, []);
      assert.equal(o.requests.length, 19);
      assert.ok(o.requests.every((r) => r.method === "GET"));
      assert.equal(o.requests.filter((r) => r.target === "accounts").length, 10);
      assert.equal(o.requests.filter((r) => r.target === "roles").length, 8);
      assert.equal(o.requests.filter((r) => r.target === "detail").length, 1);
      const checks = e.checks.filter((c) => c.width === o.width);
      for (const name of [
        "assembly context placement",
        "keyboard traversal no requests",
        "keyboard traversal no URL changes",
        "comparison reset initially disabled",
        "comparison reset enabled with search",
        "creation cancel no request",
      ])
        assert.ok(
          checks.some((c) => c.name === name),
          name,
        );
      const foci = e.focusObservations.filter((f) => f.width === o.width);
      assert.deepEqual(
        foci.map((f) => f.name),
        names,
      );
      for (const f of foci) {
        assert.ok(f.trace.length > 0 && f.trace.length <= 30);
        assert.equal(f.actual.focusVisible, true);
        assert.equal(f.actual.inViewport, true);
        assert.equal(f.actual.outlineStyle, "solid");
        if (variant === "preview") {
          assert.equal(f.matchesDesign, true, f.name);
          assert.equal(f.actual.outlineInViewport, true, f.name);
          assert.equal(f.actual.outlineWidth, "3px");
          assert.equal(f.actual.outlineOffset, f.name === "differences" ? "4px" : "3px");
        }
      }
    }
  });
}

test("P44 correction preserves default pixels, discloses baseline gaps and stays review-only", () => {
  const before = evidence("baseline"),
    after = evidence("preview");
  assert.deepEqual(
    before.focusObservations.filter((f) => !f.matchesDesign).map((f) => `${f.width}:${f.name}`),
    [
      "1200:create",
      "1200:navigation",
      "1200:email",
      "1201:create",
      "1201:navigation",
      "1201:email",
    ],
  );
  assert.deepEqual(
    before.focusObservations
      .filter((f) => !f.actual.outlineInViewport)
      .map((f) => `${f.width}:${f.name}`),
    ["1200:reset", "1201:differences"],
  );
  for (const s of before.screenshots.filter((s) => ["default", "default-top"].includes(s.state)))
    assert.equal(s.sha256, after.screenshots.find((a) => a.file === s.file).sha256, s.file);
  const css = read(
    "design-plans/ui-phase-2-2026-09-07/implementation/admin-page-boundary-preview.css",
  );
  assert.match(css, /body\.p44-boundary/);
  const properties = [...css.matchAll(/\{([^{}]*)\}/g)].flatMap((block) =>
    [...block[1].matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]),
  );
  assert.ok(properties.length > 0);
  assert.ok(
    properties.every((p) =>
      ["outline", "outline-color", "outline-offset", "scroll-margin-block"].includes(p),
    ),
  );
  for (const file of ["apps/web/src/main.ts", "apps/web/src/components/PlatformAccountCenter.vue"])
    assert.doesNotMatch(read(file), /admin-page-boundary|p44-boundary/);
  assert.match(after.scope, /GET-only/);
  assert.match(after.scope, /no full App/);
  assert.match(after.scope, /original72 images preserved/);
});
