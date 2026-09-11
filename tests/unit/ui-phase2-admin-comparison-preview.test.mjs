import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { historicalAdminControlsSource } from "../../scripts/lib/ui-phase2-admin-controls-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (f) =>
  historicalAdminResultsSource(f, readFileSync(f, "utf8").replaceAll("\r\n", "\n"));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const folder = "output/playwright/p44-comparison-vue-preview";
test("P44 comparison evidence uses current actual sources and exact formal images", () => {
  const e = JSON.parse(read(folder + "/evidence.json"));
  assert.equal(e.kind, "P44-COMPARISON-VUE-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 164);
  assert.equal(e.screenshots.length, 44);
  assert.equal(Object.keys(e.sourceHashes).length, 40);
  for (const [f, h] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalAdminControlsSource(f, read(f))), h, f);
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(folder + "/" + s.file)), s.sha256, s.file);
  for (const width of [390, 760, 761, 1440]) {
    const states = e.screenshots.filter((s) => s.width === width).map((s) => s.state);
    assert.deepEqual(states, [
      "controls-default",
      "selected-focus",
      "role-focus",
      "permission-facts",
      "matrix-first",
      "same-role-empty",
      "same-role-all",
      "search-empty",
      "reset-focus",
      "reset-disabled",
      "group-filter",
    ]);
    const observation = e.observations.find((o) => o.width === width);
    assert.deepEqual(observation.errors, []);
    assert.deepEqual(observation.unexpected, []);
    assert.equal(observation.requests.length, 2);
    assert.ok(observation.requests.every((r) => r.method === "GET"));
    assert.deepEqual(observation.requests.map((r) => r.target).sort(), ["accounts", "roles"]);
  }
});
test("P44 local approvals stay exact without promoting whole comparison package", () => {
  assert.equal(
    hash(readFileSync("output/playwright/p44-page-vue-preview/390-directory.png")),
    "28bfd32d5557df1b2c972de3d7a2d8381a953f7748bb12777ba5da9c8f4b8e74",
  );
  const approval = read("design-plans/ui-phase-2-2026-09-07/P44-MOBILE-DIRECTORY-APPROVAL.md");
  assert.match(approval, /目录组合通过，继续其他区域/);
  assert.match(approval, /角色比较均不包含/);
  assert.equal(
    hash(readFileSync(folder + "/390-controls-default.png")),
    "334c3b208445b67e45aaaae460ecaf802329101af6dbd73e512b79f51cf1cdd0",
  );
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/P44-MOBILE-COMPARISON-CONTROLS-APPROVAL.md"),
    /比较控件组合通过，继续其他状态/,
  );
  assert.equal(
    hash(readFileSync(folder + "/390-same-role-all.png")),
    "eca89c21b71216dffe8f4946215fe04c60489089ee3811b00cf2ddb4543b33c0",
  );
  const allApproval = read(
    "design-plans/ui-phase-2-2026-09-07/P44-MOBILE-SAME-ROLE-ALL-APPROVAL.md",
  );
  assert.match(allApproval, /结果区域通过，继续其他状态/);
  assert.match(allApproval, /不包含上方角色资料、其他状态、其他宽度、整页或真实权限验收/);
  const e = JSON.parse(read(folder + "/evidence.json"));
  assert.match(e.scope, /template\/script unchanged/);
  assert.equal(
    hash(readFileSync(folder + "/390-permission-facts.png")),
    "46e862abba5da101e17ed9d1dad80e53665f2a6ae8286f9a484657a5472efb51",
  );
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/P44-MOBILE-ROLE-FACTS-APPROVAL.md"),
    /角色资料组合通过，继续其他状态/,
  );
  assert.match(e.scope, /no authority inference or real writes/);
  assert.ok(!read("apps/web/src/main.ts").includes("admin-comparison-preview"));
  assert.ok(!read("apps/web/src/components/PlatformRoleComparison.vue").includes("p44-"));
});
