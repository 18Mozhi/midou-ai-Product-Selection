import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import { historicalOrganizationActionSource } from "../../scripts/lib/ui-phase2-organization-action-baseline.mjs";
import test from "node:test";
import { historicalFilterResetSource } from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { reviewHash } from "../../scripts/lib/ui-phase2-vue-review-host.mjs";
// Frozen visual/diagnostic captures use their exact pre-repair source, not current acceptance.
const read = (file) =>
  historicalAdminResultsSource(
    file,
    historicalOrganizationActionSource(file, readFileSync(file, "utf8")),
  );
const dir = "output/playwright/p42-write-lifecycle";
const evidence = () => JSON.parse(read(`${dir}/evidence.json`));
test("P42 lifecycle is diagnostic, bound to captured source revisions and exact images", () => {
  const e = evidence();
  assert.equal(e.kind, "actual-vue-diagnostic-defects-not-acceptance");
  assert.equal(e.processesClosed, true);
  assert.equal(e.scenarios.length, 16);
  assert.equal(e.screenshots.length, 28);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(reviewHash(historicalFilterResetSource(file, read(file))), sha, file);
  assert.deepEqual(
    readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    e.screenshots.map((s) => s.file).sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${dir}/${s.file}`);
    assert.equal(reviewHash(bytes), s.sha256);
    assert.equal(bytes.readUInt32BE(16), s.width);
    assert.equal(bytes.readUInt32BE(20), 900);
    assert.equal(s.sourceSha, reviewHash(JSON.stringify(e.sourceHashes)));
  }
});
test("P42 reproduces close/reopen and stale overview defects, not a passing product contract", () => {
  const e = evidence();
  for (const width of [390, 1440])
    for (const action of ["profile", "status"]) {
      const rows = e.scenarios.filter((s) => s.width === width && s.action === action);
      assert.deepEqual(
        rows.map((s) => s.mode),
        ["success-close", "failure-close", "refresh-failure", "reason-back"],
      );
      for (const row of rows) {
        const final = row.finalState;
        if (row.mode === "failure-close") {
          assert.equal(final.detailVisible, false);
          assert.ok(final.errors.join(" ").includes("原组织写入失败"));
        } else if (row.mode === "refresh-failure") {
          assert.ok(
            final.feedback
              .join(" ")
              .includes(action === "profile" ? "组织资料已更新" : "组织已停用"),
          );
          assert.notEqual(final.identity, "已提交的组织资料");
        } else {
          assert.equal(final.url, "/platform-admin/organizations");
          assert.equal(final.detailVisible, true);
        }
      }
    }
});
test("P42 lifecycle sends only original fixture payloads to the original organization", () => {
  for (const s of evidence().scenarios) {
    const writes = s.requests.filter((r) => r.method !== "GET");
    assert.equal(writes.length, 1);
    const r = writes[0];
    assert.equal(r.hasIdempotencyKey, true);
    assert.equal(
      r.path,
      "/api/v1/platform/accounts/organizations/00000000-0000-4000-8000-000000000622" +
        (s.action === "status" ? "/status" : ""),
    );
    assert.equal(r.method, s.action === "profile" ? "PATCH" : "POST");
    assert.deepEqual(
      r.body,
      s.action === "profile"
        ? {
            name: "已提交的组织资料",
            timezone: "Asia/Shanghai",
            data_retention_days: 365,
            reason: "生命周期测试",
          }
        : { status: "archived", reason: "生命周期测试" },
    );
  }
});
test("Historical P42 diagnostic retains original source and prior layout review", () => {
  for (const file of [
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/components/PlatformOrganizationDetailDialog.vue",
    "apps/web/src/components/PlatformAccountDialogs.vue",
    "scripts/lib/ui-phase2-vue-review-host.mjs",
  ])
    assert.equal(
      read(file),
      execFileSync("git", ["show", `08aeb8dc:${file}`], { encoding: "utf8" }).replaceAll(
        "\r\n",
        "\n",
      ),
    );
  const old = "output/playwright/p42-detail-preview";
  const original = execFileSync("git", ["show", `08aeb8dc:${old}/evidence.json`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");
  assert.equal(read(`${old}/evidence.json`), original);
  for (const s of JSON.parse(original).screenshots)
    assert.equal(reviewHash(readFileSync(`${old}/${s.file}`)), s.sha256);
});
