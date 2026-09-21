import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { userLifecycleReviewHistoricalCapture } from "../../scripts/lib/ui-phase2-user-lifecycle-review-historical-capture.mjs";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";
import { userPasswordPreview } from "../../scripts/lib/ui-phase2-user-password-preview.mjs";
import { userCreatePreview } from "../../scripts/lib/ui-phase2-user-create-preview.mjs";
import { historicalPasswordSource } from "../../scripts/lib/ui-phase2-password-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalUserCreationSource,
  userCreationRevisions,
} from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
const read = (file) =>
  historicalAdminResultsSource(file, readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("creation regression retains distinct exact baseline/current Vue sources and 64 images", () => {
  for (const mode of ["baseline", "current"]) {
    const captured = userLifecycleReviewHistoricalCapture(`create-${mode}`);
    const folder = `output/playwright/p43-create-lifecycle/${mode}`;
    const text = read(`${folder}/evidence.json`),
      e = JSON.parse(text);
    assert.equal(e.mode, mode === "baseline" ? "baseline-diagnosis" : "current-regression");
    assert.equal(e.approval, "not-user-approved");
    assert.equal(e.processesClosed, true);
    assert.equal(e.observations.length, 16);
    assert.equal(e.checks.length, 160);
    assert.equal(e.screenshots.length, 32);
    assert(!text.includes("CreationFixtureOnly-123"));
    assert(!text.includes("NewDraftFixtureOnly-456"));
    for (const [file, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(captured.source(file)), sha, file);
    for (const [file, surface] of [
      ["apps/web/src/components/PlatformAccountCenter.vue", "parent"],
      ["apps/web/src/components/PlatformUserDetailDialog.vue", "detail"],
    ])
      assert.equal(
        hash(userPagePreview(captured.source(file), surface)),
        e.transformedHashes[file],
      );
    const child = "apps/web/src/components/PlatformAccountDialogs.vue";
    assert.equal(
      hash(userCreatePreview(userPasswordPreview(captured.source(child)))),
      e.transformedHashes[child],
    );
    assert.deepEqual(
      readdirSync(folder).sort(),
      ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots)
      assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256);
  }
});
test("actual browser response evidence distinguishes defect from intended current behavior", () => {
  for (const mode of ["baseline", "current"]) {
    const e = JSON.parse(read(`output/playwright/p43-create-lifecycle/${mode}/evidence.json`));
    for (const width of [390, 1440]) {
      for (const scenario of ["reopen", "reopen-twice"]) {
        const value = (outcome, name) =>
          e.checks.find(
            (c) =>
              c.width === width &&
              c.scenario === scenario &&
              c.outcome === outcome &&
              c.name === name,
          ).actual;
        assert.equal(value("success", "open state after response"), mode === "current");
        assert.equal(
          value("failure", "error belongs to original still-open form"),
          mode === "current" ? 0 : 1,
        );
      }
    }
    for (const o of e.observations) {
      assert.deepEqual(o.errors, []);
      assert.deepEqual(o.unexpected, []);
      assert.equal(o.requests.filter((r) => r.method === "POST").length, 1);
      assert.equal(
        o.requests.filter((r) => r.method === "GET").length,
        o.outcome === "success" ? 2 : 1,
      );
    }
  }
});
test("historical creation associations are exact, unrelated sources are never substituted", () => {
  for (const [file, revision] of Object.entries(userCreationRevisions)) {
    assert.equal(hash(historicalPasswordSource(file, read(file))), revision.after);
    assert.equal(hash(historicalUserCreationSource(file, read(file))), revision.before);
    assert.throws(
      () => historicalUserCreationSource(file, read(file) + "\n// unknown"),
      /Unreviewed/,
    );
  }
  assert.equal(historicalUserCreationSource("unrelated", "unchanged"), "unchanged");
});
