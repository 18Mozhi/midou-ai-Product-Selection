import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { capturedExportDetailHash } from "../../scripts/lib/ui-phase2-export-detail-token-delta.mjs";
import {
  auditParentFile,
  undoAuditPageDelta,
} from "../../scripts/lib/ui-phase2-audit-page-delta.mjs";
import { readBeforeAuditPage } from "../../scripts/lib/ui-phase2-audit-page-evidence.mjs";

const text = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const root = "output/playwright/p37-parent-read-vue-r2/";
const e = JSON.parse(text(root + "evidence.json"));
const journal = JSON.parse(
  text("design-plans/ui-phase-2-2026-09-07/P37-PAGINATION-SOURCE-ASSOCIATIONS.json"),
);

test("P37 pagination patch removes exactly14 added lines and preserves all other parent code", () => {
  const old = execFileSync(
    "git",
    ["show", "c380b995b3a6d55d7f1742dc42baf9479be0e8e7:" + auditParentFile],
    { encoding: "utf8" },
  ).replaceAll("\r\n", "\n");
  const current = text(auditParentFile);
  assert.equal(undoAuditPageDelta(current), old);
  assert.equal(current.split("\n").length - old.split("\n").length, 14);
  assert.equal(current.split("<template>")[1], old.split("<template>")[1]);
  assert.notEqual(
    undoAuditPageDelta(current.replace("sequence === loadSequence", "sequence !== loadSequence")),
    old,
  );
});
test("P37 current parent r2 proves192 checks and40 images without promoting the two history findings", () => {
  assert.equal(e.kind, "P37-PARENT-READ-VUE-r2");
  assert.equal(e.checks.length, 192);
  assert.equal(e.screenshots.length, 40);
  assert.equal(e.acceptanceComplete, false);
  assert.equal(e.browserAndServerClosed, true);
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(capturedExportDetailHash(f, text(f)), sha, f);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) assert.equal(hash(readFileSync(root + s.file)), s.sha256);
  for (const width of [390, 1440]) {
    assert.deepEqual(
      e.findings.filter((f) => f.width === width).map((f) => f.id),
      ["P37-HISTORY-01", "P37-HISTORY-02"],
    );
    const names = e.checks.filter((c) => c.width === width).map((c) => c.name);
    for (const scene of [
      "page-200-refresh-200-old-first",
      "page-200-refresh-200-new-first",
      "page-403-refresh-200-new-first",
      "page-500-refresh-200-new-first",
      "page-200-refresh-500-new-first",
      "page-200-refresh-403-new-first",
    ]) {
      assert.ok(names.includes(scene + ":latest-row-count"));
      assert.ok(names.includes(scene + ":never-append-old-five"));
    }
    assert.ok(names.includes("normal-page:55-rows"));
    assert.ok(names.includes("copy:old-feedback-ignored"));
  }
  assert.ok(
    e.requestEvidence.every(
      (r) =>
        r.forbidden.length === 0 &&
        r.errors.length === 0 &&
        r.requests.every((v) => v.method === "GET" && v.path.endsWith("/audit-events")),
    ),
  );
  const script = text("scripts/verify-ui-phase2-org-audit-read-r2.mjs");
  assert.match(script, /new MutationObserver/);
  assert.doesNotMatch(script, /transform\(source|historicalAuditSource\(/);
});
test("P37 source-association journal reconstructs40 prior manifests and retains5358 PNG", () => {
  assert.equal(journal.entries.length, 40);
  assert.equal(hash(text(journal.proofFile)), journal.proofHash);
  assert.equal(hash(text(journal.runtimeProof)), journal.runtimeProofHash);
  for (const [f, change] of Object.entries(journal.sourceChanges))
    assert.equal(hash(text(f)), change.after, f);
  let pictures = 0;
  for (const entry of journal.entries) {
    const current = JSON.parse(text(entry.file)),
      old = JSON.parse(readBeforeAuditPage(entry.file));
    assert.equal(hash(text(entry.file)), entry.afterHash);
    assert.equal(hash(JSON.stringify(old, null, 2) + "\n"), entry.beforeHash);
    assert.deepEqual(current.screenshots, old.screenshots);
    assert.deepEqual(current.approval, old.approval);
    for (const c of entry.changes)
      assert.ok(
        ["sourceHashes", "sourceAssociation", "retained", "retainedManifest"].includes(c.keys[0]),
      );
    for (const s of old.screenshots) {
      pictures++;
      assert.equal(hash(readFileSync(path.join(path.dirname(entry.file), s.file))), s.sha256);
    }
  }
  assert.equal(pictures, 5358);
  for (const folder of ["p34-first-failure-vue", "p36-parent-read-vue", "p37-parent-read-vue"])
    assert.ok(!journal.entries.some((v) => v.file === `output/playwright/${folder}/evidence.json`));
});
