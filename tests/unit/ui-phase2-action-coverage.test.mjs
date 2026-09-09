import test from "node:test";
import assert from "node:assert/strict";
import {
  validateActionReview,
  reconcileActionCandidates,
} from "../../scripts/lib/ui-phase2-action-coverage.mjs";

function fixture() {
  const id = "source.vue#identity.1",
    candidate = {
      candidateId: id,
      file: "source.vue",
      line: 1,
      kind: "control",
      label: "保存",
      conditions: [],
    };
  const action = {
    actionId: "EXISTING-SAVE",
    kind: "write",
    condition: "ready",
    handler: "save",
    remaining: "real runtime pending",
    sourceCandidateIds: [id],
    variants: ["submit"],
    scenes: [{ package: "sample", scene: "ready" }],
    testReferences: [{ file: "verify.mjs", evidenceType: "offline-proposal-check-not-Vue" }],
    visualStates: Object.fromEntries(
      ["default", "hover", "focus", "pressed", "disabled", "busy"].map((s) => [s, "not-mapped"]),
    ),
  };
  const review = {
    schemaVersion: 1,
    pageId: "P11",
    approval: "pending-user-review",
    sourceHashes: { "source.vue": "hash" },
    contract: "contract.md",
    actions: [action],
    dialogs: { kind: "none-in-current-source" },
  };
  const context = {
    candidates: [candidate],
    sourceHashes: { "source.vue": "hash" },
    contracts: [
      {
        candidateId: id,
        document: "contract.md",
        status: "identity-current",
        temporalScope: "unclassified",
        claim: "| EXISTING-SAVE |",
      },
    ],
    packages: new Map([
      [
        "sample",
        {
          screenshots: [
            { scene: "ready", width: 1440 },
            { scene: "ready", viewport: { width: 390 } },
          ],
        },
      ],
    ]),
    files: new Set(["verify.mjs"]),
  };
  return { review, context };
}
test("explicit mapping accepted but runtime/approval not promoted", () => {
  const { review, context } = fixture();
  const result = validateActionReview(review, context);
  assert.equal(result.routeActions, 1);
  assert.equal(result.unmappedVisualSlots, 6);
  assert.equal(result.writeActions, 1);
});
test("local presentation is not counted as a server write", () => {
  const { review, context } = fixture();
  review.actions[0].kind = "local";
  const result = validateActionReview(review, context);
  assert.equal(result.writeActions, 0);
  assert.equal(result.routeActions, 1);
  review.actions[0].visualStates.busy = "not-applicable-navigation-only";
  assert.throws(() => validateActionReview(review, context));
});
for (const fault of [
  "none",
  "selector",
  "action",
  "page",
  "missing-evidence",
  "empty-states",
  "missing-scene",
  "mobile-selector",
  "mobile-missing",
  "duplicate",
  "wrong-scope",
  "unsupported-state",
]) {
  test("additional control variant exact binding " + fault, () => {
    const { review, context } = fixture();
    const action = review.actions[0];
    const variant = {
      key: "footer-cancel",
      package: "sample",
      selector: "footer #cancel",
      scope: "additional-control-variant-not-new-action",
      states: { default: "ready" },
    };
    action.additionalControlVariants = [variant];
    const evidence = context.packages.get("sample");
    evidence.controlVariantReferences = {
      [variant.key]: {
        actionId: action.actionId,
        pageId: review.pageId,
        selector: variant.selector,
        scope: variant.scope,
        states: { ...variant.states },
      },
    };
    for (const shot of evidence.screenshots)
      shot.control = {
        key: variant.key,
        selector: variant.selector,
        state: "default",
        actionId: action.actionId,
      };
    const target = evidence.controlVariantReferences[variant.key];
    if (fault === "selector") variant.selector = "header #cancel";
    if (fault === "action") target.actionId = "OTHER-ACTION";
    if (fault === "page") target.pageId = "P20";
    if (fault === "missing-evidence") evidence.controlVariantReferences = {};
    if (fault === "empty-states") {
      variant.states = {};
      target.states = {};
    }
    if (fault === "missing-scene") {
      variant.states.default = "not-linked";
      target.states.default = "not-linked";
    }
    if (fault === "mobile-selector") evidence.screenshots[1].control.selector = "#wrong";
    if (fault === "mobile-missing") delete evidence.screenshots[1].control;
    if (fault === "duplicate") action.additionalControlVariants.push(structuredClone(variant));
    if (fault === "wrong-scope") variant.scope = "approved";
    if (fault === "unsupported-state") {
      variant.states = { accepted: "ready" };
      target.states = { ...variant.states };
    }
    if (fault === "none") {
      const result = validateActionReview(review, context);
      assert.equal(result.routeActions, 1);
      assert.equal(
        result.unmappedVisualSlots,
        6,
        "extra variant does not inflate representative coverage",
      );
    } else assert.throws(() => validateActionReview(review, context));
  });
}
test("explicit contract ID accepts a middle-dot description, never substring matching", () => {
  const { review, context } = fixture();
  context.contracts[0].claim = "| source | EXISTING-SAVE · confirmed handler |";
  assert.equal(validateActionReview(review, context).routeActions, 1);
  context.contracts[0].claim = "| source | prefix EXISTING-SAVE · confirmed handler |";
  assert.throws(() => validateActionReview(review, context));
  context.contracts[0].claim = "| source | OTHER · EXISTING-SAVE |";
  assert.throws(() => validateActionReview(review, context));
});
for (const fault of [
  "none",
  "ref-page",
  "target-page",
  "missing-page",
  "missing-action",
  "selector",
  "mobile-page",
  "mobile-state",
  "mobile-action",
  "mobile-selector",
]) {
  test("page-scoped representative cannot borrow same action from another route " + fault, () => {
    const { review, context } = fixture();
    const action = review.actions[0],
      evidence = context.packages.get("sample");
    action.visualStates.default = "scene-reference-not-acceptance";
    action.visualStateReferences = {
      default: { package: "sample", pageId: "P11", scene: "ready", selector: "#save" },
    };
    const target = {
      pageId: "P11",
      scope: "representative-control-only-not-all-variants-or-Vue",
      selector: "#save",
      states: { default: "ready" },
    };
    evidence.actionVisualReferences = { [action.actionId]: { ...target, pageId: "P20" } };
    evidence.pageActionVisualReferences = { P11: { [action.actionId]: target } };
    for (const shot of evidence.screenshots)
      Object.assign(shot, {
        pageId: "P11",
        control: { selector: "#save", actionId: action.actionId, state: "default" },
      });
    if (fault === "ref-page") action.visualStateReferences.default.pageId = "P20";
    if (fault === "target-page") target.pageId = "P20";
    if (fault === "missing-page") evidence.pageActionVisualReferences = {};
    if (fault === "missing-action") evidence.pageActionVisualReferences.P11 = {};
    if (fault === "selector") target.selector = "#other";
    if (fault === "mobile-page") evidence.screenshots[1].pageId = "P20";
    if (fault === "mobile-state") evidence.screenshots[1].control.state = "busy";
    if (fault === "mobile-action") evidence.screenshots[1].control.actionId = "OTHER";
    if (fault === "mobile-selector") evidence.screenshots[1].control.selector = "#other";
    if (fault === "none")
      assert.equal(validateActionReview(review, context).unmappedVisualSlots, 5);
    else assert.throws(() => validateActionReview(review, context));
  });
}
for (const fault of ["none", "selector", "scene", "missing-state", "missing-evidence"]) {
  test("action-specific visual binding " + fault, () => {
    const { review, context } = fixture();
    const action = review.actions[0];
    action.visualStates.default = "scene-reference-not-acceptance";
    action.visualStateReferences = {
      default: { package: "sample", scene: "ready", selector: "#save" },
    };
    context.packages.get("sample").actionVisualReferences = {
      "EXISTING-SAVE": {
        scope: "representative-control-only-not-all-variants-or-Vue",
        selector: "#save",
        states: { default: "ready" },
      },
    };
    if (fault === "selector") action.visualStateReferences.default.selector = "#other";
    if (fault === "scene") action.visualStateReferences.default.scene = "missing";
    if (fault === "missing-state") action.visualStateReferences = {};
    if (fault === "missing-evidence") context.packages.get("sample").actionVisualReferences = {};
    if (fault === "none")
      assert.equal(validateActionReview(review, context).unmappedVisualSlots, 5);
    else assert.throws(() => validateActionReview(review, context));
  });
}
for (const [name, change] of [
  ["source drift", (r, c) => (c.sourceHashes["source.vue"] = "changed")],
  ["duplicate action", (r) => r.actions.push(structuredClone(r.actions[0]))],
  [
    "duplicate candidate",
    (r) => r.actions[0].sourceCandidateIds.push(r.actions[0].sourceCandidateIds[0]),
  ],
  ["unknown candidate", (r) => (r.actions[0].sourceCandidateIds = ["other.vue#identity.1"])],
  [
    "unmapped source",
    (r, c) => c.candidates.push({ ...c.candidates[0], candidateId: "source.vue#second.1" }),
  ],
  ["unproven contract", (r, c) => (c.contracts[0].temporalScope = "historical")],
  ["substring action not accepted", (r) => (r.actions[0].actionId = "SAVE")],
  ["missing mobile scene", (r, c) => c.packages.get("sample").screenshots.pop()],
  ["missing verifier", (r, c) => c.files.clear()],
  ["fake approval", (r) => (r.approval = "approved")],
  ["unsupported passed state", (r) => (r.actions[0].visualStates.busy = "passed")],
  [
    "write cannot exempt busy as navigation",
    (r) => (r.actions[0].visualStates.busy = "not-applicable-navigation-only"),
  ],
  ["omitted dialog", (r, c) => (c.candidates[0].kind = "dialog-definition")],
  ["unknown dialog review", (r) => (r.dialogs.kind = "accepted")],
  ["unlisted dialog consumers", (r) => (r.dialogs.kind = "local-callers-and-listed-shared-only")],
])
  test("rejects " + name, () => {
    const { review, context } = fixture();
    change(review, context);
    assert.throws(() => validateActionReview(review, context));
  });
test("changed identities are not inferred to be a renamed semantic action", () => {
  const { context } = fixture();
  const old = [
    { ...context.candidates[0], candidateId: "source.vue#old.1", candidateRouteIds: ["P11"] },
  ];
  const result = reconcileActionCandidates(context.candidates, old, context.contracts);
  assert.equal(result.candidates[0].registration, "not-in-historical-inventory");
  assert.deepEqual(result.candidates[0].staticRouteIds, []);
  assert.equal(result.oldOnly[0].disposition, "source-identity-changed-not-safe-to-delete");
});
test("historical references cannot count as current contract binding", () => {
  const { context } = fixture();
  const result = reconcileActionCandidates(
    context.candidates,
    [],
    context.contracts.map((r) => ({ ...r, temporalScope: "historical" })),
  );
  assert.equal(result.candidates[0].contractReferences.length, 0);
});

test("explicit full-cell aliases support qualified legacy keys, not substrings", () => {
  const { review, context } = fixture();
  const a = review.actions[0];
  a.sourceContractKeys = ["EXISTING-SAVE：表单入口"];
  a.contractAliasReason = "Exact existing table key, same handler";
  context.contracts[0].claim = "| EXISTING-SAVE：表单入口 |";
  assert.equal(validateActionReview(review, context).routeActions, 1);
  a.sourceContractKeys = ["EXISTING-SAVE"];
  assert.throws(() => validateActionReview(review, context));
  context.contracts[0].claim = "| source.vue#identity.1 | EXISTING-SAVE：表单入口 |";
  a.sourceContractKeys = ["source.vue#identity.1"];
  assert.throws(() => validateActionReview(review, context));
});
for (const fault of [
  "none",
  "missing-alias-reason",
  "unused-alias",
  "no-targets",
  "unknown-target",
  "cycle",
  "wrong-handler",
  "missing-event",
  "undeclared-edge",
  "control-as-wiring",
]) {
  test("explicit forwarding contract " + fault, () => {
    const { review, context } = fixture();
    const id = "source.vue#forward.1";
    context.candidates.push({
      ...context.candidates[0],
      candidateId: id,
      kind: "event-binding",
      events: { "@save": "save" },
    });
    context.contracts.push({ ...context.contracts[0], candidateId: id, claim: "| 保存事件转发 |" });
    const a = {
      ...structuredClone(review.actions[0]),
      actionId: "SAVE-WIRING",
      kind: "wiring",
      sourceCandidateIds: [id],
      sourceContractKeys: ["保存事件转发"],
      contractAliasReason: "Caller forwards to existing save",
      forwardsTo: ["EXISTING-SAVE"],
      forwardBindings: [
        { candidateId: id, event: "@save", handler: "save", targets: ["EXISTING-SAVE"] },
      ],
    };
    a.visualStates = Object.fromEntries(
      Object.keys(a.visualStates).map((s) => [s, "not-applicable-wiring"]),
    );
    review.actions.push(a);
    if (fault === "missing-alias-reason") delete a.contractAliasReason;
    if (fault === "unused-alias") a.sourceContractKeys.push("unused");
    if (fault === "no-targets") a.forwardsTo = [];
    if (fault === "unknown-target") {
      a.forwardsTo = ["missing"];
      a.forwardBindings[0].targets = ["missing"];
    }
    if (fault === "cycle") {
      a.forwardsTo = [a.actionId];
      a.forwardBindings[0].targets = [a.actionId];
    }
    if (fault === "wrong-handler") a.forwardBindings[0].handler = "other";
    if (fault === "missing-event") a.forwardBindings = [];
    if (fault === "undeclared-edge") a.forwardBindings[0].targets = ["missing"];
    if (fault === "control-as-wiring") context.candidates[1].kind = "control";
    if (fault === "none") {
      const result = validateActionReview(review, context);
      assert.equal(result.routeActions, 1);
      assert.equal(result.writeActions, 1);
      assert.equal(result.wiringGroups, 1);
      assert.equal(result.unmappedVisualSlots, 6);
    } else assert.throws(() => validateActionReview(review, context));
  });
}
