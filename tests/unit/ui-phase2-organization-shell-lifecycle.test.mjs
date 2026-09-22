import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import { historicalProviderFocusSource } from "../../scripts/lib/ui-phase2-provider-focus-baseline.mjs";
import test from "node:test";
import { historicalUserCreationSource } from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
import { historicalFilterResetSource } from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import { historicalTokenCopySource } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const folder = "output/playwright/p42-shell-lifecycle";
const capturedRevision = "af056d31";
const read = (file) => {
  let source;
  try {
    source = execFileSync("git", ["show", `${capturedRevision}:${file}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    source = readFileSync(file, "utf8");
  }
  return historicalAdminResultsSource(file, source.replaceAll("\r\n", "\n"));
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const evidence = JSON.parse(read(`${folder}/evidence.json`));
test("P42 historical full app capture binds original loaded sources and exact screenshot inventory", () => {
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.scenarios.length, 20);
  assert.equal(evidence.screenshots.length, 44);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(
      hash(
        historicalUserCreationSource(
          file,
          historicalProviderFocusSource(
            file,
            historicalFilterResetSource(file, historicalTokenCopySource(file, read(file))),
          ),
        ),
      ),
      sha,
      file,
    );
  for (const file of [
    "apps/web/src/main.ts",
    "apps/web/src/App.vue",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/components/PlatformOrganizationDetailDialog.vue",
    "apps/web/src/use-platform-organization-actions.ts",
    "apps/web/src/use-modal-dialog.ts",
  ])
    assert.ok(evidence.sourceHashes[file], file);
  assert.equal(evidence.transformedHashes, undefined);
  assert.match(evidence.scope, /No C design approval/);
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P42 full app matrix includes cached return, stale reason and unchanged write contracts", () => {
  assert.equal(
    evidence.scenarios.reduce((n, scenario) => n + scenario.checks.length, 0),
    212,
  );
  const expected = [];
  for (const width of [390, 1440])
    for (const action of ["profile", "status"])
      for (const mode of ["success-away", "error-away", "success-return", "error-return", "reason"])
        expected.push(`${width}/${action}/${mode}`);
  assert.deepEqual(
    evidence.scenarios.map((scenario) => `${scenario.width}/${scenario.action}/${scenario.mode}`),
    expected,
  );
  for (const scenario of evidence.scenarios) {
    for (const check of [
      "same cached dialog node",
      "late result does not trigger overview read",
      "new draft retained and no stale success/error feedback",
      "Escape closes and real background link clickable",
      "no browser errors",
      "no unexpected network",
    ])
      assert.ok(scenario.checks.includes(check), check);
    const writes = scenario.requests.filter((request) => request.method !== "GET");
    assert.equal(writes.length, scenario.mode === "reason" ? 0 : 1);
    if (!writes.length) continue;
    const request = writes[0];
    assert.equal(request.key, true);
    assert.equal(request.method, scenario.action === "profile" ? "PATCH" : "POST");
    assert.equal(
      request.path,
      `/api/v1/platform/accounts/organizations/00000000-0000-4000-8000-000000000622${scenario.action === "status" ? "/status" : ""}`,
    );
    assert.deepEqual(
      request.body,
      scenario.action === "profile"
        ? {
            name: "已提交的旧资料",
            timezone: "Asia/Shanghai",
            data_retention_days: 365,
            reason: "缓存离页验证",
          }
        : { status: "archived", reason: "缓存离页验证" },
    );
  }
});
test("P42 full app screenshots distinguish pending reason, dashboard and returned detail", () => {
  for (const shot of evidence.screenshots) {
    assert.equal(
      shot.url,
      shot.state === "away"
        ? "/platform-admin"
        : "/platform-admin/organizations/00000000-0000-4000-8000-000000000622",
    );
    assert.ok(["away", "returned", "pending-reason"].includes(shot.state));
    if (shot.state === "pending-reason") assert.equal(shot.mode, "reason");
  }
  assert.equal(evidence.screenshots.filter((shot) => shot.state === "pending-reason").length, 4);
  assert.equal(evidence.screenshots.filter((shot) => shot.state === "away").length, 20);
  assert.equal(evidence.screenshots.filter((shot) => shot.state === "returned").length, 20);
});
