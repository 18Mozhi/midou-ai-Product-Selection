import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  accountAppFixture,
  accountFixtureFile,
} from "../../scripts/lib/ui-phase2-account-app-fixture.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const root = "output/playwright/p43-actual-app-lifecycle-r1";
const manifestHash = "742a2d8290fd0ae1ac6afce0197e7779c75187cb782cdb0f1e6a03f20d484aed";

test("actual App fixtures retain original account, navigation, dashboard and known membership omission", () => {
  const fixture = accountAppFixture(read(accountFixtureFile));
  assert.equal(fixture.detail.user.id, fixture.overview.users[0].id);
  assert.equal(fixture.navigation.shell, "platform_admin");
  assert.equal(fixture.dashboard.window, "24h");
  assert.equal(fixture.platformRoles.length, 3);
  assert.equal(fixture.detail.memberships[0].organization_id, undefined);
});

test("fixture extraction fails closed on missing fields or disagreeing repeated dashboard facts", () => {
  const source = read(accountFixtureFile);
  assert.throws(
    () => accountAppFixture(source.replace("const overview =", "const differentOverview =")),
    /Fixture declaration overview/,
  );
  assert.throws(
    () => accountAppFixture(source.replaceAll('device_label: "Chrome"', 'device_label: "Changed"')),
    /Original Chrome/,
  );
  assert.throws(() =>
    accountAppFixture(source.replace("active_organizations: 0", "active_organizations: 99")),
  );
});

test("actual App lifecycle evidence pins all 16 combinations, 224 checks and 48 exact screenshots", () => {
  const bytes = readFileSync(`${root}/evidence.json`);
  assert.equal(hash(bytes), manifestHash);
  const evidence = JSON.parse(bytes);
  assert.equal(evidence.functionalOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.designApproval, "not_requested");
  assert.equal(evidence.runs.length, 16);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    224,
  );
  assert.equal(evidence.screenshots.length, 48);
  for (const width of [390, 1440])
    for (const action of ["create", "password"])
      for (const destination of ["shared-account-route", "cached-dashboard"])
        for (const outcome of ["success", "failure"])
          assert.equal(
            evidence.runs.filter(
              (run) =>
                run.width === width &&
                run.action === action &&
                run.destination === destination &&
                run.outcome === outcome,
            ).length,
            1,
          );
  for (const shot of evidence.screenshots) {
    assert.match(shot.file, /^[a-z0-9-]+\.png$/);
    const png = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(png), shot.sha256);
    assert.equal(png.readUInt32BE(16), shot.pixelWidth);
    assert.equal(png.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of evidence.runs) {
    assert.equal(run.requests.filter((request) => request.key.startsWith("POST ")).length, 1);
    assert.ok(
      run.checks.some(
        (check) =>
          check.name === "same cached account instance after history" && check.actual === true,
      ),
    );
    assert.ok(
      run.checks.some(
        (check) => check.name === "replacement remains open" && check.actual === true,
      ),
    );
  }
  assert.ok(!bytes.toString().includes("Local-fixture-43!"));
});

test("captured actual App source set includes router and KeepAlive with no review transformation", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  for (const file of [
    "apps/web/src/App.vue",
    "apps/web/src/router.ts",
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/PlatformAccountCenter.vue",
    "apps/web/src/use-user-creation-owner.ts",
  ])
    assert.ok(file in evidence.sourceHashes, file);
  assert.equal(Object.keys(evidence.sourceHashes).length, 168);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(
      hash(read(file)),
      expected,
      `Current source drift: ${file}; preserve r1 and recapture as a new version`,
    );
  const driver = read("scripts/verify-ui-phase2-account-app-lifecycle.mjs");
  assert.ok(!driver.includes("transformIndexHtml"));
  assert.ok(!driver.includes("__p43_review"));
  assert.ok(driver.includes("page.goForward()") && driver.includes("page.goBack()"));
});

test("capture duplicate is rejected before starting a browser or server without changing original bytes", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-account-app-lifecycle.mjs", "--capture"],
    { encoding: "utf8", timeout: 20000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EEXIST/);
  assert.ok(!result.stdout.includes("P43 actual App lifecycle http"));
  assert.equal(hash(readFileSync(`${root}/evidence.json`)), manifestHash);
});
