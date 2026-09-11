import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import {
  responsiveFocusContractHash,
  responsiveFocusRevision,
} from "../../scripts/lib/ui-phase2-responsive-focus-contract.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const output = "output/playwright/responsive-data-view-focus";
const baseline = (file) =>
  execFileSync("git", ["show", `ea005452:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");
const p50Base = (file) =>
  execFileSync("git", ["show", `7398aa8a:${file}`], { encoding: "utf8" }).replaceAll("\r\n", "\n");

test("shared detail focus evidence binds actual Vue, existing dialog primitives and all four images", () => {
  const evidence = JSON.parse(read(`${output}/evidence.json`));
  assert.equal(evidence.approval, "pending");
  assert.match(evidence.scope, /no business API, permission or production acceptance/);
  assert.equal(evidence.processesClosed, true);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.equal(evidence.screenshots.length, 4);
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${output}/${shot.file}`)), shot.sha256, shot.file);
  for (const width of [390, 760]) {
    const names = evidence.checks
      .filter((check) => check.width === width)
      .map((check) => check.name)
      .join("\n");
    for (const topic of [
      "Tab/Shift+Tab",
      "background focus blocked",
      "ConfirmDialog",
      "AuditedReasonDialog",
      "handoff",
      "removed-row fallback",
      "unmount releases background",
    ])
      assert.ok(names.includes(topic), `${width}:${topic}`);
  }
  for (const width of [761, 1440])
    assert.equal(evidence.checks.filter((check) => check.width === width).length, 1);
});

test("historical contract rebind permits only the tested exact revision and preserves unrelated hashes", () => {
  const { file, before, after } = responsiveFocusRevision;
  assert.equal(responsiveFocusContractHash(file, before), after);
  assert.throws(() => responsiveFocusContractHash(file, "unknown"), /unknown historical/);
  assert.equal(responsiveFocusContractHash("unrelated-file", "unchanged"), "unchanged");
});

test("unrelated consumers and modal helpers are unchanged while P50 revisions stay evidence-bound", () => {
  const root = "apps/web/src/components";
  const consumers = readdirSync(root).filter(
    (file) =>
      file.endsWith(".vue") && read(`${root}/${file}`).includes("import ResponsiveDataView"),
  );
  assert.equal(consumers.length, 20);
  for (const file of [
    ...consumers
      .filter((file) => file !== "CredentialAssetCenter.vue")
      .map((file) => `${root}/${file}`),
    `${root}/AuditedReasonDialog.vue`,
    "apps/web/src/main.ts",
  ])
    assert.equal(read(file), p50Base(file), file);
  const p50Evidence = JSON.parse(
    read("output/playwright/p50-credential-write-ownership-review/evidence.json"),
  );
  for (const file of [`${root}/CredentialAssetCenter.vue`, `${root}/ConfirmDialog.vue`])
    assert.equal(hash(read(file)), p50Evidence.sourceHashes[file], file);
  assert.match(read(`${root}/ConfirmDialog.vue`), /busy\?: boolean/);
  assert.match(read(`${root}/ConfirmDialog.vue`), /if \(props\.busy\) return/);
  const editorFocusEvidence = JSON.parse(
    read("output/playwright/p50-credential-editor-focus-review/evidence.json"),
  );
  assert.equal(
    hash(read("apps/web/src/use-modal-dialog.ts")),
    editorFocusEvidence.sourceHashes["apps/web/src/use-modal-dialog.ts"],
  );
  assert.match(read("apps/web/src/use-modal-dialog.ts"), /discardReturnFocus/);
  const file = responsiveFocusRevision.file;
  const added = "\n.responsive-data-view__overlay--suspended {\n  z-index: 99;\n}\n";
  const current = read(file).split("<style scoped>")[1];
  assert.ok(current.includes(added));
  assert.equal(current.replace(added, ""), baseline(file).split("<style scoped>")[1]);
  assert.match(
    read(file),
    /confirmationObserver\.observe\(document\.body, \{ childList: true \}\)/,
  );
  assert.match(read(file), /confirmationObserver\?\.disconnect/);
  assert.match(read(file), /:scope > \.confirm-backdrop/);
});

test("recaptured proposals allow only exact recorded edge-pixel differences, not new visual drift", () => {
  const review = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/shared-mobile-detail-capture-review.json"),
  );
  assert.equal(review.approvedByUser, false);
  assert.equal(review.baselineCommit, "ea005452");
  assert.equal(review.manifests.length, 21);
  const require = createRequire(import.meta.url);
  const { PNG } = require(
    path.join(path.dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
  );
  const changed = [];
  const nextReview = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/technical-copy-capture-review.json"),
  );
  const lifecycleReview = JSON.parse(
    read("design-plans/ui-phase-2-2026-09-07/detail-lifecycle-capture-review.json"),
  );
  assert.equal(nextReview.baselineCommit, "e704cd24");
  for (const manifest of review.manifests) {
    const current = JSON.parse(read(manifest)),
      prior = JSON.parse(baseline(manifest));
    for (const shot of prior.screenshots) {
      let now = current.screenshots.find((item) => item.file === shot.file);
      assert.ok(now, `${manifest}:${shot.file}`);
      const file = `${path.posix.dirname(manifest)}/${shot.file}`;
      const lifecycle = lifecycleReview.differences.find((item) => item.file === file);
      if (lifecycle) {
        assert.equal(now.sha256, lifecycle.afterSha256);
        now = { ...now, sha256: lifecycle.beforeSha256 };
      }
      const next = nextReview.differences.find((item) => item.file === file);
      if (next) {
        assert.equal(now.sha256, next.afterSha256);
        now = { ...now, sha256: next.beforeSha256 };
      }
      if (now.sha256 === shot.sha256) continue;
      const entry = review.differences.find((item) => item.file === file);
      assert.ok(entry, `unreviewed image change ${file}`);
      changed.push(file);
      assert.equal(entry.beforeSha256, shot.sha256);
      assert.equal(entry.afterSha256, now.sha256);
      const old = execFileSync("git", ["show", `ea005452:${file}`], { maxBuffer: 20_000_000 }),
        bytes = next
          ? execFileSync("git", ["show", `e704cd24:${file}`], { maxBuffer: 20_000_000 })
          : lifecycle
            ? execFileSync("git", ["show", `3023a030:${file}`], { maxBuffer: 20_000_000 })
            : readFileSync(file);
      assert.equal(hash(bytes), entry.afterSha256);
      const a = PNG.sync.read(old),
        b = PNG.sync.read(bytes);
      assert.deepEqual([a.width, a.height], entry.dimensions);
      assert.deepEqual([b.width, b.height], entry.dimensions);
      let pixels = 0,
        delta = 0;
      for (let p = 0; p < a.width * a.height; p++) {
        let different = false;
        for (let c = 0; c < 4; c++) {
          const difference = Math.abs(a.data[p * 4 + c] - b.data[p * 4 + c]);
          delta = Math.max(delta, difference);
          different ||= difference > 0;
        }
        if (different) pixels++;
      }
      assert.equal(pixels, entry.changedPixels, file);
      assert.equal(delta, entry.maxChannelDelta, file);
    }
  }
  assert.deepEqual(changed.sort(), review.differences.map((item) => item.file).sort());
});
