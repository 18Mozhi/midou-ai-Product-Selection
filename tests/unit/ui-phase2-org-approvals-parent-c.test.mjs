import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const folder = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-parent-direction-c";
const evidence = JSON.parse(readFileSync(`${folder}/evidence.json`, "utf8"));
const actual = JSON.parse(
  readFileSync("output/playwright/p34-parent-read-states/evidence.json", "utf8"),
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
test("P34 user approval pins only the displayed mobile first-failure region", () => {
  const approvedSha = "44e14492c3d39be78b50ec6c0536000065a003c585e2a54f5523ab150ede0c30";
  assert.equal(hash(readFileSync(`${folder}/initial-server-error-390.png`)), approvedSha);
  const approval = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/P34-MOBILE-FIRST-FAILURE-COMPOSITION-APPROVAL.md",
    "utf8",
  );
  assert.ok(approval.includes(approvedSha));
  assert.match(approval, /失败区域组合通过，继续其他状态/);
  assert.match(approval, /排除：同图顶部/);
  const revision = readFileSync(
    "design-plans/ui-phase-2-2026-09-07/P34-MOBILE-PERMISSION-REVISION-REQUEST.md",
    "utf8",
  );
  assert.match(revision, /需要调整权限拒绝区域/);
  const revisionSha = "ec9a3d9c909a2386ee6cae41533fe3203e21b23920e82d819da6ee1555474bef";
  assert.ok(revision.includes(revisionSha));
  assert.equal(
    hash(readFileSync(`${folder}/background-permission-forbidden-focus-390.png`)),
    revisionSha,
  );
  assert.equal(evidence.approval, "pending-concrete-parent-section-review");
});
test("P34 C parent proposal keeps distinct first-load, retained-data and auth replacement states", () => {
  assert.equal(evidence.scenes.length, 17);
  for (const scene of evidence.scenes.filter((s) => s.failure)) {
    const actualScenes = actual.scenarios.filter(
      (s) => s.phase === scene.phase && s.failure === scene.failure.id,
    );
    assert.equal(actualScenes.length, 4);
    assert.ok(actualScenes.every((s) => s.childVisible === !scene.replace));
    for (const width of [390, 1440]) {
      assert.ok(
        evidence.checks.some((c) => c.width === width && c.name === `${scene.id}: error alert`),
      );
      assert.ok(
        evidence.checks.some(
          (c) => c.width === width && c.name === `${scene.id}: keyboard focus ring`,
        ),
      );
    }
  }
  assert.equal(evidence.approval, "pending-concrete-parent-section-review");
  assert.match(evidence.boundary, /not production Vue or authorization proof/);
  assert.match(evidence.boundary, /409 is synthetic/);
});

test("P34 C parent 74 images bind unchanged actual behavior and inherited child sources", () => {
  assert.equal(evidence.screenshots.length, 74);
  assert.equal(new Set(evidence.screenshots.map((s) => s.file)).size, 74);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256, s.file);
  for (const name of [
    "new refresh retains edited filter",
    "new refresh records only both existing GET intentions",
    "no fabricated business dialog",
    "no external or API requests",
    "no page errors",
  ])
    assert.deepEqual(
      evidence.checks.filter((c) => c.name === name).map((c) => c.width),
      [1440, 390],
    );
  const script = readFileSync(`${folder}/parent.js`, "utf8");
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|setInterval\s*\(/);
});
