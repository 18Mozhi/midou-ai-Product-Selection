import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const base = "design-plans/ui-phase-2-2026-09-07";
const file = "apps/web/src/components/TaskWorkspace.vue";
const candidateId = `${file}#e0d116e4a9502e30.1`;
const events = [
  "@start",
  "@close",
  "@confirm",
  "@update:reason",
  "@update:due-at",
  "@update:assignee-id",
];
const source = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const sourceHash = createHash("sha256").update(source).digest("hex");
const reviews = Object.fromEntries(
  ["P13", "P23", "P24"].map((id) => [
    id,
    JSON.parse(readFileSync(`${base}/action-reviews/${id}.json`, "utf8")),
  ]),
);

test("TaskWorkspace batch event candidate is current and accounted for across route modes", () => {
  const candidates = scanSource(source, file).candidates;
  const candidate = candidates.find((item) => item.candidateId === candidateId);
  assert.ok(candidate);
  assert.equal(candidate.line, 894);
  assert.equal(candidate.kind, "event-binding");

  for (const review of Object.values(reviews)) {
    assert.equal(review.sourceHashes[file], sourceHash);
    assert.equal(review.surfaceReview.dependencyHashes[file], sourceHash);
  }

  for (const [pageId, actionId] of [
    ["P13", "work.batch.forward"],
    ["P23", "task.all.batch.forward"],
  ]) {
    const action = reviews[pageId].actions.find((item) => item.actionId === actionId);
    assert.ok(action);
    assert.equal(action.kind, "wiring");
    assert.deepEqual(action.sourceCandidateIds, [candidateId]);
    assert.deepEqual(
      action.forwardBindings.map((binding) => binding.event),
      events,
    );
  }

  const detailExclusion = reviews.P24.actions.find((item) =>
    item.sourceCandidateIds.includes(candidateId),
  );
  assert.equal(detailExclusion.kind, "excluded");
  assert.equal(detailExclusion.actionId, "detail.hidden-list-shell");

  const audit = runContractAudit();
  assert.equal(
    audit.unreferenced.some((item) => item.candidateId === candidateId),
    false,
  );
  assert.equal(
    audit.records.find((item) => item.candidateId === candidateId)?.status,
    "identity-current",
  );
});
