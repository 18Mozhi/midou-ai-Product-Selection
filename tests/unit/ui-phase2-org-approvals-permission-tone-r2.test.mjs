import test from "node:test";
import { assertP34LegacySourceHash } from "../../scripts/lib/ui-phase2-org-approvals-shared-history.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

test("P34 permission r2 changes only four copy slots and retains both r1 review objects", () => {
  const output = "output/playwright/p34-permission-tone-r2";
  const base = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c";
  const e = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
  const hash = (v) => createHash("sha256").update(v).digest("hex");
  assert.equal(e.checks.length, 38);
  assert.equal(e.screenshots.length, 12);
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assertP34LegacySourceHash(file, readFileSync(file, "utf8"), sha);
  for (const [file, sha] of Object.entries(e.retainedImages))
    assert.equal(hash(readFileSync(`${base}/${file}`)), sha, file);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  for (const width of [390, 1440]) {
    for (const phase of ["initial", "background"]) {
      for (const name of [
        "only four text slots change",
        "header unchanged",
        "button styling unchanged",
        "no content exposed",
        "keyboard focus retained",
        "retry still only existing read intentions",
      ])
        assert.ok(e.checks.some((c) => c.width === width && c.name === `${phase}: ${name}`));
    }
  }
  assert.equal(e.approval, "pending-specific-r2-review");
  const approval = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/P34-PERMISSION-TONE-R2-APPROVAL.md",
    "utf8",
  );
  const approvedSha = "64e7e7d7ab7e2971599d1db317aa03967abbb4b74f63298fe8254d5719220acd";
  assert.ok(approval.includes(approvedSha));
  assert.match(approval, /r2 语气通过，继续其他状态/);
  assert.equal(
    hash(readFileSync(`${output}/background-permission-forbidden-r2-focus-390.png`)),
    approvedSha,
  );
});
