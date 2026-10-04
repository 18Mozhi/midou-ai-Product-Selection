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

test("P21 maps current workspace and cost-panel retries and controls", () => {
  const expected = new Map([
    ["apps/web/src/components/SourcingWorkspace.vue#1e3fc27654fc0776.1", "SC-DELETE-OPEN"],
    ["apps/web/src/components/SourcingWorkspace.vue#0e42b816192eb48e.1", "SC-DIALOG-WIRING"],
    ["apps/web/src/components/SourcingWorkspace.vue#5aab87e8ea0ee176.1", "SC-DIALOG-WIRING"],
    [
      "apps/web/src/components/SourcingCostConfirmationPanel.vue#289c8e971f49889b.1",
      "SC-COST-READ-RETRY",
    ],
    [
      "apps/web/src/components/SourcingCostConfirmationPanel.vue#857740e31a8963ec.1",
      "SC-COST-WIRING",
    ],
    ["apps/web/src/components/OpportunityProfitPanel.vue#aa3f50e6ccf98cb4.1", "SC-COST-READ-RETRY"],
    ["apps/web/src/components/OpportunityProfitPanel.vue#d25bbd68583e5a3d.1", "SC-COST-SUBMIT"],
    [
      "apps/web/src/components/OpportunityProfitPanel.vue#f8671d189e947071.1",
      "SC-COST-RECALCULATE",
    ],
    [
      "apps/web/src/components/OpportunityProfitPanel.vue#1dfebd67b12367cb.1",
      "SC-COST-REVIEWER-RETRY",
    ],
  ]);

  for (const [file, expectedHash] of [
    [
      "apps/web/src/components/SourcingWorkspace.vue",
      "382b000c5bbcc5adfadab36170b7fa8bb6a636bc4f2047e493e6c807af847346",
    ],
    [
      "apps/web/src/components/SourcingCostConfirmationPanel.vue",
      "99ff2ace736c0f05862e792a569200faa8c69a8f73c5fac6a282e069adb925b6",
    ],
    [
      "apps/web/src/components/OpportunityProfitPanel.vue",
      "c1d0e8d44af82ed7305481a9d8299c05fd0737e65ded0987a412aa36b5334dd6",
    ],
  ]) {
    const currentSource = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
    const currentHash = createHash("sha256").update(currentSource).digest("hex");
    assert.equal(review.sourceHashes[file], expectedHash);
    assert.equal(review.sourceHashes[file], currentHash);
    assert.equal(review.surfaceReview.dependencyHashes[file], currentHash);

    const candidates = scanSource(currentSource, file).candidates.map((item) => item.candidateId);
    const currentMapped = review.actions.flatMap((action) =>
      (action.sourceCandidateIds ?? []).filter((id) => id.startsWith(`${file}#`)),
    );
    assert.deepEqual([...new Set(currentMapped)].sort(), candidates.sort());
  }

  for (const [candidateId, actionId] of expected) {
    const action = review.actions.find((item) => item.actionId === actionId);
    assert.ok(action?.sourceCandidateIds.includes(candidateId), `${candidateId} -> ${actionId}`);
  }

  const reviewerRetry = review.actions.find(
    (action) => action.actionId === "SC-COST-REVIEWER-RETRY",
  );
  assert.equal(reviewerRetry.kind, "read");
  assert.match(reviewerRetry.handler, /loadReviewers/);

  const audit = runContractAudit();
  assert.equal(
    audit.unreferenced.some((item) => [...expected.keys()].includes(item.candidateId)),
    false,
  );
  assert.ok(
    audit.records
      .filter((item) => [...expected.keys()].includes(item.candidateId))
      .every((item) => item.status === "identity-current"),
  );
});
