import test from "node:test";
import { assertP34LegacySourceHash } from "../../scripts/lib/ui-phase2-org-approvals-shared-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const output = "output/playwright/p34-parent-read-states";
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P34 actual parent evidence pins source and all 64 state images", () => {
  assert.equal(e.kind, "P34-PARENT-READ-STATES");
  assert.equal(e.screenshots.length, 64);
  assert.equal(new Set(e.screenshots.map((s) => s.file)).size, 64);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assertP34LegacySourceHash(file, readFileSync(file, "utf8"), sha);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  for (const file of [
    "api-client.ts",
    "components/OrganizationAdminCenter.vue",
    "components/OrganizationApprovalPanel.vue",
  ])
    assert.ok(e.sourceHashes[`apps/web/src/${file}`]);
  assert.match(e.boundary, /intercepted fixture HTTP only/);
  assert.match(e.boundary, /C visual approval are not proven/);
});

test("P34 parent matrix covers both reads, phases and widths without promoting partial success", () => {
  assert.equal(e.scenarios.length, 56);
  assert.deepEqual(
    e.failures.map((f) => f.status),
    [500, 503, 409, 429, 401, 403, 0],
  );
  for (const width of [1440, 390]) {
    for (const target of ["summary", "approvals"]) {
      for (const phase of ["initial", "background"]) {
        for (const f of e.failures) {
          const matching = e.scenarios.filter(
            (s) =>
              s.width === width && s.target === target && s.phase === phase && s.failure === f.id,
          );
          assert.equal(matching.length, 1);
          const s = matching[0];
          const replace = phase === "initial" || [401, 403].includes(f.status);
          assert.equal(s.childVisible, !replace);
          assert.equal(s.state, replace ? f.state : "ready");
          assert.equal(s.attempts, [503, 429, 0].includes(f.status) ? 3 : 1);
          assert.equal(s.recovery, "passed");
          const name = `${phase}-${target}-${f.id}`;
          assert.ok(e.screenshots.some((p) => p.width === width && p.scene === name));
          if (!replace) {
            for (const suffix of [
              "old template retained atomically",
              "old summary retained atomically",
              "template filter retained",
            ])
              assert.ok(e.checks.some((c) => c.width === width && c.name === `${name}: ${suffix}`));
          }
        }
      }
    }
    for (const name of [
      "no business writes",
      "no unmatched or external requests",
      "no page errors",
      "no business dialogs fabricated",
    ])
      assert.ok(e.checks.some((c) => c.width === width && c.name === name));
  }
});
