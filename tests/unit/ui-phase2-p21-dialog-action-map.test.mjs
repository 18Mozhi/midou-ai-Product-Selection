import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const sourceFile = "apps/web/src/components/SourcingWorkspaceDialogs.vue";
const reviewPath = "design-plans/ui-phase-2-2026-09-07/action-reviews/P21.json";
const source = readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
const sourceHash = createHash("sha256").update(source).digest("hex");
const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const candidateId = (signature) => `${sourceFile}#${signature}.1`;
const dialogs = [
  {
    prefix: "SC-S",
    definition: "d6b978b68b9e050e",
    cancel: "e761df41504fce67",
    form: "2cd14710e221241b",
  },
  {
    prefix: "SC-QUOTE",
    definition: "d730100a2a0668bc",
    cancel: "0a2fd5d5c73aa500",
    form: "00dca39bee5ea478",
  },
  {
    prefix: "SC-PURCHASE",
    definition: "3bc48926013530b0",
    cancel: "33659286562fda16",
    form: "d990de8d6f06fa26",
  },
  {
    prefix: "SC-DELETE",
    definition: "7532644429232b14",
    cancel: "6f31ea2421d022b2",
    form: "8a8ef03aa897476d",
  },
];

test("P21 maps all current native sourcing dialog candidates to their existing actions", () => {
  const current = scanSource(source, sourceFile).candidates.map((item) => item.candidateId);
  const mapped = review.actions.flatMap((action) => action.sourceCandidateIds ?? []);
  const currentForFile = current.filter((id) => id.startsWith(`${sourceFile}#`));
  const mappedForFile = mapped.filter((id) => id.startsWith(`${sourceFile}#`));

  assert.equal(review.route, "/sourcing");
  assert.equal(review.sourceHashes[sourceFile], sourceHash);
  assert.equal(review.surfaceReview.dependencyHashes[sourceFile], sourceHash);
  assert.deepEqual([...new Set(mappedForFile)].sort(), currentForFile.sort());

  for (const dialog of dialogs) {
    const definitionId = candidateId(dialog.definition);
    const cancelId = candidateId(dialog.cancel);
    const formId = candidateId(dialog.form);
    const definition = review.actions.find(
      (action) => action.actionId === `${dialog.prefix}-DIALOG`,
    );
    const close = review.actions.find((action) => action.actionId === `${dialog.prefix}-CLOSE`);
    const submit = review.actions.find((action) => action.actionId === `${dialog.prefix}-SUBMIT`);

    assert.deepEqual(definition.sourceCandidateIds, [definitionId]);
    assert.ok(close.sourceCandidateIds.includes(cancelId));
    assert.ok(submit.sourceCandidateIds.includes(formId));
    assert.ok(definition.handler.includes("useModalDialog"));
  }

  const audit = runContractAudit();
  const dialogCandidates = dialogs.flatMap((dialog) => [
    candidateId(dialog.definition),
    candidateId(dialog.cancel),
    candidateId(dialog.form),
  ]);
  assert.equal(
    audit.unreferenced.some((item) => dialogCandidates.includes(item.candidateId)),
    false,
  );
  assert.ok(
    audit.records
      .filter((item) => dialogCandidates.includes(item.candidateId))
      .every((item) => item.status === "identity-current"),
  );
});
