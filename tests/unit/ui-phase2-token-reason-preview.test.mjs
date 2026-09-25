import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const folder = "output/playwright/p36-reason-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${folder}/evidence.json`));
test("P36 reason review pins current untransformed sources and complete80 image manifest", () => {
  assert.equal(evidence.kind, "P36-REASON-VUE-PREVIEW-r1");
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 408);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assertCaptureSourceRevision(file, read(file), sha);
  const states = [
    "default",
    "invalid",
    "confirm-focus",
    "cancel-focus",
    "close-focus",
    "confirm-hover",
    "confirm-pressed",
    "long-reason",
    "short-long-target-footer",
    "short-long-target-header",
  ];
  assert.deepEqual(
    evidence.screenshots.map((shot) => shot.file).sort(),
    [390, 760, 761, 1440]
      .flatMap((width) =>
        ["rotate", "revoke"].flatMap((action) =>
          states.map((state) => `${width}-${action}-${state}.png`),
        ),
      )
      .sort(),
  );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P36 reason constraints, focus, close and short-screen checks use real parent dialogs without writes", () => {
  for (const run of evidence.runs) {
    assert.equal(run.requests.length, 4);
    assert.ok(
      run.requests.every(
        (r) =>
          r.method === "GET" &&
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(r.path),
      ),
    );
    const names = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const action of ["rotate", "revoke"]) {
      for (const name of [
        "actual target",
        "autofocus",
        "initial empty",
        "initial disabled",
        "disabled gray",
        "minimum two",
        "no maximum",
        "valid enabled",
        "action color",
        "44px controls",
        "forward trap",
        "reverse trap",
        "confirm keyboard outline",
        "cancel keyboard outline",
        "close keyboard outline",
        "confirm focus color",
        "cancel focus color",
        "close focus color",
        "pressed",
        "501 retained without inferred server policy",
        "escape restores trigger",
        "header restores trigger",
        "footer restores trigger",
        "reopen resets",
        "short footer reachable",
        "short header reachable",
      ])
        assert.ok(names.includes(`${action}:${name}`), `${run.width}:${action}:${name}`);
    }
    for (const name of ["zero external or write requests", "zero browser errors", "zero storage"])
      assert.ok(names.includes(name), name);
  }
  assert.match(evidence.scope, /no submission/);
  assert.match(evidence.scope, /do not define backend length policy/);
});
test("P36 reason preview is CSS-only and leaves production and approved filter evidence untouched", () => {
  for (const file of [
    "apps/web/src/main.ts",
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/components/OrganizationTokenPanel.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
  ])
    assert.equal(read(file).includes("token-reason-preview"), false, file);
  const source = read("apps/web/src/components/AuditedReasonDialog.vue");
  assert.match(source, /:minlength="minimumLength \?\? 2"/);
  const parent = read("apps/web/src/components/OrganizationAdminCenter.vue");
  const p36ReasonCall = parent
    .match(/<AuditedReasonDialog\b[\s\S]*?\/>/gu)
    ?.find((tag) => tag.includes("auditedReasonOpen"));
  assert.ok(p36ReasonCall, "P36 reason dialog caller remains present");
  assert.doesNotMatch(p36ReasonCall, /maximum(?:-|_)?length|maximumLength/u);
  const css = read("design-plans/ui-phase-2-2026-09-07/implementation/token-reason-preview.css");
  assert.match(css, /\.p36-reason-preview #app \.audited-reason-dialog\[aria-label\^="撤销"\]/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.equal(
    hash(readFileSync("output/playwright/p36-fields-review/composition-filters-default-390.png")),
    "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b",
  );
});
