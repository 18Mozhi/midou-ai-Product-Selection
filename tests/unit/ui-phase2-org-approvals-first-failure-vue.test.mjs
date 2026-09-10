import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  assertFirstFailureParentDelta,
  firstFailureBaseline,
  firstFailureParent,
} from "../../scripts/lib/ui-phase2-first-failure-retention.mjs";

const output = "output/playwright/p34-first-failure-vue";
// Keep the original500 evidence immutable; the new429 verifier proves current500 pixel parity.
const originalImplementation = "d2d566c2fceeef6ab1754f409475e2cf7582b8ef";
const historicalSource = (file) =>
  execFileSync("git", ["show", `${originalImplementation}:${file}`], { encoding: "utf8" });
const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
test("P34 original first500 commit leaves parent business code and adjacent template intact", () => {
  const old = execFileSync("git", ["show", `${firstFailureBaseline}:${firstFailureParent}`], {
    encoding: "utf8",
  });
  const current = historicalSource(firstFailureParent);
  assert.doesNotThrow(() => assertFirstFailureParentDelta(old, current));
  assert.throws(() =>
    assertFirstFailureParentDelta(
      old,
      current.replaceAll("lastReadFailureStatus === 500", "lastReadFailureStatus === 403"),
    ),
  );
  assert.throws(() =>
    assertFirstFailureParentDelta(
      old,
      current.replace('api("/org/admin/summary")', 'api("/org/admin/other")'),
    ),
  );
  assert.throws(() =>
    assertFirstFailureParentDelta(
      old,
      current.replace('@reload="load()"', '@reload="load({ background: true })"'),
    ),
  );
  const child = historicalSource("apps/web/src/components/OrganizationApprovalFirstFailure.vue");
  assert.match(child, /\{\{ notice \|\|/);
  assert.match(child, /v-if="requestId"/);
  assert.doesNotMatch(child, /fetch\(|p34-real-parent-fixture|setTimeout\(|@click="load/);
});

test("P34 historical first-failure evidence pins4 breakpoints,52 checks and8 unchanged screenshots", () => {
  assert.equal(e.baselineCommit, firstFailureBaseline);
  assert.equal(e.checks.length, 156);
  assert.equal(e.checks.filter((c) => c.name.endsWith("pixels unchanged")).length, 52);
  assert.deepEqual([...new Set(e.checks.map((c) => c.width))], [390, 760, 761, 1440]);
  assert.equal(e.screenshots.length, 8);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalSource(file).replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  for (const width of [390, 760])
    for (const target of ["summary", "approvals"])
      for (const name of [
        "one visible retry",
        "real actionable notice retained",
        "real request ID",
        "retry reads both once",
        "query preserved after recovery",
      ])
        assert.ok(e.checks.some((c) => c.width === width && c.name === `${target}: ${name}`));
});
