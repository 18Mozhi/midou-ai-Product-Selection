import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { historicalUserCreationSource } from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { userReasonCases } from "../../scripts/lib/ui-phase2-user-reason-cases.mjs";
import { userPasswordPreview } from "../../scripts/lib/ui-phase2-user-password-preview.mjs";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";
const read = (f) =>
  historicalAdminResultsSource(f, readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const folder = "output/playwright/p43-reasons-vue-preview";
const evidence = () => JSON.parse(read(folder + "/evidence.json"));
test("P43 ten non-password reason variants have exact original semantic titles", () => {
  assert.deepEqual(
    userReasonCases.map((c) => c.title),
    [
      "停用用户并撤销会话",
      "恢复用户",
      "授予运营管理员",
      "撤销运营管理员",
      "授予安全管理员",
      "撤销安全管理员",
      "授予超级管理员",
      "撤销超级管理员",
      "撤销该会话",
      "撤销全部活动会话",
    ],
  );
  assert.equal(new Set(userReasonCases.map((c) => c.id)).size, 10);
  assert.equal(userReasonCases.filter((c) => c.color === "blue").length, 4);
  assert.equal(userReasonCases.filter((c) => c.role !== null).length, 3);
  assert.deepEqual(evidence().cases, userReasonCases);
});
test("P43 reason evidence binds captured sources, shared transformations and280 exact PNGs", () => {
  const e = evidence();
  assert.equal(e.kind, "P43-REASONS-VUE-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 1244);
  assert.equal(e.screenshots.length, 280);
  assert.equal(Object.keys(e.sourceHashes).length, 42);
  for (const [f, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalUserCreationSource(f, read(f))), sha, f);
  for (const [file, surface] of [
    ["apps/web/src/components/PlatformAccountCenter.vue", "parent"],
    ["apps/web/src/components/PlatformUserDetailDialog.vue", "detail"],
  ])
    assert.equal(
      e.transformedHashes[file],
      hash(userPagePreview(historicalUserCreationSource(file, read(file)), surface)),
    );
  const child = "apps/web/src/components/PlatformAccountDialogs.vue";
  assert.equal(e.transformedHashes[child], hash(userPasswordPreview(read(child))));
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(folder + "/" + s.file)), s.sha256, s.file);
});
test("P43 each real trigger returns focus on cancel/Escape with only two GET fixtures", () => {
  const e = evidence();
  assert.equal(e.observations.length, 40);
  for (const width of [390, 760, 761, 1440])
    for (const c of userReasonCases) {
      const rows = e.observations.filter((o) => o.width === width && o.caseId === c.id);
      assert.equal(rows.length, 1);
      const o = rows[0];
      assert.deepEqual(
        o.requests.map((r) => r.method),
        ["GET", "GET"],
      );
      assert.deepEqual(o.errors, []);
      assert.deepEqual(o.unexpected, []);
      assert.equal(o.fixture.status, c.status);
      assert.deepEqual(o.fixture.selectedPlatformRoles, c.role ? [c.role] : []);
      const checks = e.checks.filter((k) => k.width === width && k.caseId === c.id);
      const get = (name) => {
        const found = checks.filter((k) => k.name === name);
        assert.equal(found.length, 1, name);
        return found[0].actual;
      };
      assert.equal(get("exact reason title"), c.title);
      assert.equal(get("exact accessible name"), c.title);
      assert.equal(get("cancel returns exact invoking control"), true);
      assert.equal(get("Escape returns exact invoking control"), true);
      assert.equal(get("pressed cancellation keeps dialog open"), true);
      assert.equal(
        get("confirmation direction color"),
        c.color === "blue" ? "rgb(37, 74, 156)" : "rgb(163, 41, 52)",
      );
      if (c.status === "disabled")
        assert.equal(get("disabled user role controls stay disabled"), 3);
      assert.deepEqual(
        e.screenshots.filter((s) => s.width === width && s.caseId === c.id).map((s) => s.state),
        [
          "default",
          "field-focus",
          "cancel-focus",
          "confirm-focus",
          "confirm-hover",
          "confirm-pressed",
          "long-reason",
        ],
      );
    }
});
test("P43 reason direction styles remain review-only, not authorization or submit acceptance", () => {
  const e = evidence();
  assert.match(e.scope, /final writes never submitted/);
  assert.match(e.scope, /not safety/);
  assert.ok(!read("apps/web/src/main.ts").includes("user-reason-preview"));
  const css = read("design-plans/ui-phase-2-2026-09-07/implementation/user-reason-preview.css");
  assert.equal((css.match(/aria-label=/g) || []).length, 8);
  assert.ok(!css.includes("!important"));
});
