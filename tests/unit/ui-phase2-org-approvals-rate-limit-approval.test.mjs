import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

test("P34 mobile first rate-limit approval pins one region without changing runtime scope", () => {
  const base = "design-plans/ui-phase-2-2026-09-07";
  const sha = "de8e853182d5cffae40d5ff1b3f8a4063637663f8237ceda572c5865d6396792";
  const image = readFileSync(
    `${base}/design/org-approvals-parent-direction-c/initial-rate-limited-390.png`,
  );
  assert.equal(createHash("sha256").update(image).digest("hex"), sha);
  const record = readFileSync(`${base}/P34-MOBILE-RATE-LIMIT-COMPOSITION-APPROVAL.md`, "utf8");
  assert.ok(record.includes(sha));
  assert.match(record, /这张组合通过，继续其他状态/);
  assert.match(record, /排除：顶部/);
  assert.match(record, /该429区域尚未接入真实Vue/);
  const evidence = JSON.parse(
    readFileSync(`${base}/design/org-approvals-parent-direction-c/evidence.json`, "utf8"),
  );
  assert.equal(evidence.approval, "pending-concrete-parent-section-review");
});
