import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalPasswordSource,
  passwordRevision,
} from "../../scripts/lib/ui-phase2-password-baseline.mjs";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";
import { userPasswordPreview } from "../../scripts/lib/ui-phase2-user-password-preview.mjs";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
test("password ownership preserves exact before/after Vue sources and 80 diagnostic/regression images", () => {
  for (const mode of ["baseline", "current"]) {
    const folder = `output/playwright/p43-password-lifecycle/${mode}`,
      text = read(folder + "/evidence.json"),
      e = JSON.parse(text);
    assert.equal(e.mode, mode === "baseline" ? "baseline-diagnosis" : "current-regression");
    assert.equal(e.approval, "not-user-approved");
    assert.equal(e.processesClosed, true);
    assert.equal(e.observations.length, 20);
    assert.equal(e.checks.length, 220);
    assert.equal(e.screenshots.length, 40);
    assert(!text.includes("PasswordLifecycleFixture-123"));
    const captured = (f) => (mode === "baseline" ? historicalPasswordSource(f, read(f)) : read(f));
    for (const [file, sha] of Object.entries(e.sourceHashes))
      assert.equal(hash(captured(file)), sha, file);
    for (const [file, surface] of [
      [passwordRevision.file, "parent"],
      ["apps/web/src/components/PlatformUserDetailDialog.vue", "detail"],
    ])
      assert.equal(hash(userPagePreview(captured(file), surface)), e.transformedHashes[file]);
    const child = "apps/web/src/components/PlatformAccountDialogs.vue";
    assert.equal(hash(userPasswordPreview(captured(child))), e.transformedHashes[child]);
    assert.deepEqual(
      readdirSync(folder).sort(),
      ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const s of e.screenshots)
      assert.equal(hash(readFileSync(folder + "/" + s.file)), s.sha256);
  }
});
test("real replacement-detail flow distinguishes old closing defect and current protection", () => {
  for (const mode of ["baseline", "current"]) {
    const e = JSON.parse(read(`output/playwright/p43-password-lifecycle/${mode}/evidence.json`));
    for (const width of [390, 1440])
      for (const scenario of ["reopen-account", "switch-account"]) {
        const value = (outcome, name) =>
          e.checks.find(
            (c) =>
              c.width === width &&
              c.scenario === scenario &&
              c.outcome === outcome &&
              c.name === name,
          ).actual;
        assert.equal(value("success", "detail after original response"), mode === "current");
        assert.equal(value("success", "replacement reset is still disabled"), true);
        assert.equal(
          value("failure", "error feedback stays in valid original detail scope"),
          mode === "current" ? 0 : 1,
        );
      }
    for (const o of e.observations) {
      assert.deepEqual(o.errors, []);
      assert.deepEqual(o.unexpected, []);
      const writes = o.requests.filter((r) => r.method === "POST");
      assert.equal(writes.length, 1);
      assert(writes[0].path.endsWith("000000000621/password"));
      assert(
        !o.requests.some((r) => r.method === "POST" && r.path.endsWith("000000000629/password")),
      );
    }
  }
});
test("password history mapping rejects unregistered revisions instead of accepting arbitrary source drift", () => {
  assert.equal(hash(read(passwordRevision.file)), passwordRevision.after);
  assert.equal(
    hash(historicalPasswordSource(passwordRevision.file, read(passwordRevision.file))),
    passwordRevision.before,
  );
  assert.throws(
    () =>
      historicalPasswordSource(passwordRevision.file, read(passwordRevision.file) + "\n// unknown"),
    /Unreviewed/,
  );
  assert.equal(historicalPasswordSource("unrelated", "unchanged"), "unchanged");
});
