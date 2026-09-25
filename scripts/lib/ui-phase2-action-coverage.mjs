import assert from "node:assert/strict";

const sourceAbsentState = "not-applicable-source-unrepresented";
const visualApprovalLabels = new Set([
  "user-approved-visual-direction",
  "user-approved-visual-direction; production checks recorded separately",
  "user-approved-visual-direction; remaining page visuals auto-approved by user",
  "user-approved-remaining-pages-auto",
]);

function validateSourceStateApplicability(action, context) {
  const states = Object.keys(action.visualStates).filter(
    (state) => action.visualStates[state] === sourceAbsentState,
  );
  const evidence = action.sourceStateApplicability;
  if (!states.length) {
    assert.ok(!evidence, "orphan source applicability evidence");
    return;
  }
  assert.ok(["local", "read"].includes(action.kind), "source absence cannot exclude a write");
  assert.ok(states.every((state) => ["disabled", "busy"].includes(state)));
  assert.equal(evidence?.scope, "current-source-presentation-only-not-runtime-or-approval");
  assert.ok(evidence.reason?.trim() && evidence.handlerBoundary?.trim());
  assert.deepEqual([...evidence.states].sort(), [...states].sort());
  assert.deepEqual([...evidence.sourceCandidateIds].sort(), [...action.sourceCandidateIds].sort());
  const expectedControls = new Set();
  const expectedFiles = new Set();
  const getCandidate = (id) => {
    const candidate = context.candidates.find((item) => item.candidateId === id);
    assert.ok(candidate, "unknown applicability candidate");
    expectedFiles.add(candidate.file);
    return candidate;
  };
  const checkAttributes = (candidate) => {
    assert.ok(candidate.attributes, "source attributes unavailable");
    assert.ok(
      !Object.keys(candidate.attributes).some((key) =>
        /^(?::|v-bind:)?(?:disabled|aria-disabled|aria-busy|busy|loading|inert)$|^v-bind$/u.test(
          key,
        ),
      ),
      "source declares state or dynamic attributes; cannot exclude it",
    );
  };
  for (const id of action.sourceCandidateIds) {
    const candidate = getCandidate(id);
    checkAttributes(candidate);
    if (["button", "input", "summary"].includes(candidate.tag)) expectedControls.add(id);
    else {
      assert.match(candidate.tag, /^[A-Z]/u, "unsupported source control");
      const childFiles = new Set(
        context.candidates
          .filter((item) => item.file.endsWith("/" + candidate.tag + ".vue"))
          .map((item) => item.file),
      );
      assert.equal(childFiles.size, 1, "shared control source is ambiguous or missing");
      const childFile = [...childFiles][0];
      const children = context.candidates.filter(
        (item) => item.file === childFile && item.kind === "control",
      );
      assert.ok(children.length, "shared rendered controls missing");
      for (const child of children) expectedControls.add(child.candidateId);
    }
  }
  assert.deepEqual([...evidence.renderedControlIds].sort(), [...expectedControls].sort());
  for (const id of expectedControls) {
    const candidate = getCandidate(id);
    assert.ok(["button", "input", "summary"].includes(candidate.tag));
    checkAttributes(candidate);
  }
  assert.deepEqual(Object.keys(evidence.sourceHashes).sort(), [...expectedFiles].sort());
  for (const [file, hash] of Object.entries(evidence.sourceHashes)) {
    assert.ok(typeof hash === "string" && hash.length > 0, "missing supporting source hash");
    assert.equal(hash, context.sourceHashes[file], "applicability supporting source drift");
  }
}

// Validate explicit reviews. Never infer a business action from a label or hash.
export function validateActionReview(
  review,
  { candidates, sourceHashes, contracts, packages, files },
) {
  assert.equal(review.schemaVersion, 1);
  assert.match(review.pageId, /^P\d{2}$/);
  const visualApproval =
    review.visualApproval ??
    (visualApprovalLabels.has(review.approval) ? review.approval : undefined);
  assert.ok(
    review.approval === "pending-user-review" || visualApprovalLabels.has(review.approval),
    "This registry cannot grant action approval",
  );
  assert.equal(review.actionApproval ?? "pending-user-review", "pending-user-review");
  if (review.visualApproval)
    assert.ok(visualApprovalLabels.has(review.visualApproval), "unsupported visual approval label");
  assert.ok(review.actions.length > 0);
  const seen = new Set(),
    actionIds = new Set(),
    variantKeys = new Set();
  const scope = candidates.filter((c) => Object.hasOwn(review.sourceHashes, c.file));
  for (const [file, hash] of Object.entries(review.sourceHashes))
    assert.equal(hash, sourceHashes[file], file + " reviewed source drift");
  for (const action of review.actions) {
    assert.ok(!actionIds.has(action.actionId), "duplicate actionId");
    actionIds.add(action.actionId);
    assert.ok(["navigation", "read", "write", "local", "excluded", "wiring"].includes(action.kind));
    const sourceAbsent = action.sourceCandidateIds.length === 0;
    const contractKeys = action.sourceContractKeys ?? (sourceAbsent ? [] : [action.actionId]);
    if (sourceAbsent) {
      assert.equal(action.kind, "excluded", "source-absent proposal cannot count as an action");
      assert.equal(action.sourceAbsence?.scope, "contract-explicit-no-current-candidate");
      assert.ok(action.sourceAbsence.reason?.trim());
      assert.deepEqual(action.sourceCandidateApplicability, []);
      assert.equal(action.sourceContractKeys, undefined);
    } else
      assert.ok(
        contractKeys.length && contractKeys.every((key) => typeof key === "string" && key.trim()),
      );
    assert.equal(new Set(contractKeys).size, contractKeys.length, "duplicate contract key");
    if (action.sourceContractKeys)
      assert.ok(action.contractAliasReason, "explicit alias needs rationale");
    const usedContractKeys = new Set();
    assert.ok(action.condition && action.handler && action.remaining);
    assert.ok(action.variants.length);
    for (const id of action.sourceCandidateIds) {
      assert.ok(!seen.has(id), "candidate mapped twice within page");
      seen.add(id);
      assert.ok(
        scope.some((c) => c.candidateId === id),
        "unknown or out-of-scope candidate " + id,
      );
      assert.ok(
        contracts.some(
          (r) =>
            r.candidateId === id &&
            r.document === review.contract &&
            r.temporalScope !== "historical" &&
            ["identity-current", "line-moved"].includes(r.status) &&
            contractKeys.some((key) => {
              const cells = r.claim
                .split("|")
                .map((v) => v.replaceAll("`", "").trim().split(" · ")[0])
                .filter(Boolean);
              const matches = (action.sourceContractKeys ? cells.slice(-1) : cells).includes(key);
              if (matches) usedContractKeys.add(key);
              return matches;
            }),
        ),
        "actionId not in current explicit contract " + action.actionId,
      );
    }
    assert.equal(usedContractKeys.size, contractKeys.length, "unused contract alias");
    if (action.kind === "wiring") {
      assert.ok(action.forwardsTo?.length, "wiring requires explicit targets");
      assert.equal(new Set(action.forwardsTo).size, action.forwardsTo.length);
      const eventCandidates = action.sourceCandidateIds.map((id) =>
        scope.find((c) => c.candidateId === id),
      );
      assert.ok(
        eventCandidates.every((c) =>
          [
            "event-binding",
            "dialog-component-call",
            "dialog-script-call",
            "dialog-definition",
          ].includes(c.kind),
        ),
        "business control cannot be wiring",
      );
      const expected = eventCandidates.flatMap((c) =>
        Object.entries(c.events ?? {}).map(([event, handler]) => ({
          candidateId: c.candidateId,
          event,
          handler,
        })),
      );
      assert.deepEqual(
        (action.forwardBindings ?? []).map(({ candidateId, event, handler }) => ({
          candidateId,
          event,
          handler,
        })),
        expected,
        "forward event omitted or changed",
      );
      for (const edge of action.forwardBindings ?? []) {
        assert.ok(edge.targets?.length);
        for (const target of edge.targets)
          assert.ok(action.forwardsTo.includes(target), "undeclared forwarding target");
      }
    } else
      assert.ok(
        !action.forwardsTo && !action.forwardBindings,
        "only wiring may declare forwarding edges",
      );
    for (const state of ["default", "hover", "focus", "pressed", "disabled", "busy"]) {
      const value = action.visualStates[state];
      assert.ok(
        [
          "not-mapped",
          "scene-reference-not-acceptance",
          "not-applicable-excluded",
          "not-applicable-wiring",
          "not-applicable-navigation-only",
          "not-applicable-not-disabled-in-source",
          sourceAbsentState,
        ].includes(value),
        "unsupported visual status",
      );
      if (value === "scene-reference-not-acceptance") assert.ok(action.scenes.length);
      if (value === "not-applicable-excluded") assert.equal(action.kind, "excluded");
      if (value === "not-applicable-wiring") assert.equal(action.kind, "wiring");
      if (value.startsWith("not-applicable-n")) assert.equal(action.kind, "navigation");
    }
    validateSourceStateApplicability(action, { candidates, sourceHashes });
    for (const ref of action.scenes) {
      const evidence = packages.get(ref.package);
      assert.ok(evidence, "missing proposal " + ref.package);
      for (const width of [1440, 390])
        assert.ok(
          evidence.screenshots.some(
            (s) => s.scene === ref.scene && (s.width ?? s.viewport?.width) === width,
          ),
          "missing scene/viewport " + ref.package + "/" + ref.scene + "/" + width,
        );
    }
    for (const ref of action.testReferences) {
      assert.ok(files.has(ref.file), "missing verifier");
      assert.ok(
        [
          "offline-proposal-check-not-Vue",
          "actual-vue-isolated-browser",
          "actual-vue-review-fixture",
          "actual-vue-local-interception",
        ].includes(ref.evidenceType),
        "unknown evidence type",
      );
    }
    if (action.visualStateReferences) {
      for (const [state, ref] of Object.entries(action.visualStateReferences)) {
        assert.equal(action.visualStates[state], "scene-reference-not-acceptance");
        assert.ok(
          action.scenes.some((scene) => scene.package === ref.package && scene.scene === ref.scene),
        );
        const evidence = packages.get(ref.package);
        const pageScoped = Object.hasOwn(ref, "pageId");
        if (Object.hasOwn(ref, "catalogControlId")) {
          assert.equal(pageScoped, false, "catalog and page-scoped references cannot mix");
          const control = evidence?.controls?.find((c) => c.id === ref.catalogControlId);
          assert.ok(control && !control.proposalOnly, "missing business catalog control");
          assert.equal(
            control.actionId,
            action.actionId,
            "catalog control belongs to another action",
          );
          assert.equal(control.selector, ref.selector, "catalog selector differs from evidence");
          assert.ok(control.states.includes(state), "catalog state missing");
          for (const width of [1440, 390])
            assert.ok(
              evidence.screenshots.some(
                (shot) =>
                  shot.pageId === review.pageId &&
                  shot.scene === ref.scene &&
                  shot.width === width &&
                  shot.control?.id === control.id &&
                  shot.control?.selector === ref.selector &&
                  shot.control?.actionId === action.actionId &&
                  shot.control?.variant === state,
              ),
              "missing exact catalog screenshot/viewport",
            );
          continue;
        }
        if (pageScoped)
          assert.equal(ref.pageId, review.pageId, "visual reference belongs to another page");
        const target = pageScoped
          ? evidence?.pageActionVisualReferences?.[ref.pageId]?.[action.actionId]
          : evidence?.actionVisualReferences?.[action.actionId];
        assert.ok(target, "missing action-specific visual evidence");
        if (pageScoped || target.pageId)
          assert.equal(target.pageId, review.pageId, "visual evidence belongs to another page");
        assert.equal(target.scope, "representative-control-only-not-all-variants-or-Vue");
        assert.equal(target.selector, ref.selector, "control selector differs from evidence");
        assert.equal(target.states[state], ref.scene, "state differs from evidence");
        if (pageScoped)
          for (const width of [1440, 390])
            assert.ok(
              evidence.screenshots.some(
                (shot) =>
                  shot.pageId === review.pageId &&
                  shot.scene === ref.scene &&
                  (shot.width ?? shot.viewport?.width) === width &&
                  shot.control?.selector === ref.selector &&
                  shot.control?.actionId === action.actionId &&
                  shot.control?.state === state,
              ),
              "missing page-specific exact control screenshot",
            );
      }
      for (const [state, value] of Object.entries(action.visualStates))
        if (value === "scene-reference-not-acceptance")
          assert.ok(action.visualStateReferences[state], "missing explicit state reference");
    }
    for (const variant of action.additionalControlVariants ?? []) {
      assert.ok(!["excluded", "wiring"].includes(action.kind), "variant needs a reachable action");
      assert.ok(variant.key && !variantKeys.has(variant.key), "duplicate/empty variant key");
      variantKeys.add(variant.key);
      assert.equal(variant.scope, "additional-control-variant-not-new-action");
      const evidence = packages.get(variant.package);
      const target = evidence?.controlVariantReferences?.[variant.key];
      assert.ok(target, "missing variant evidence");
      assert.equal(target.scope, variant.scope);
      assert.equal(target.actionId, action.actionId, "variant belongs to another action");
      assert.equal(target.pageId, review.pageId, "variant belongs to another page");
      assert.ok(variant.selector, "variant selector missing");
      assert.equal(target.selector, variant.selector, "variant selector differs from evidence");
      assert.ok(Object.keys(variant.states ?? {}).length, "variant states empty");
      assert.deepEqual(target.states, variant.states, "variant states differ from evidence");
      for (const [state, scene] of Object.entries(variant.states)) {
        assert.ok(["default", "hover", "focus", "pressed", "disabled", "busy"].includes(state));
        assert.ok(
          action.scenes.some((ref) => ref.package === variant.package && ref.scene === scene),
          "variant scene not linked to action",
        );
        for (const width of [1440, 390]) {
          assert.ok(
            evidence.screenshots.some(
              (shot) =>
                shot.scene === scene &&
                (shot.width ?? shot.viewport?.width) === width &&
                shot.control?.key === variant.key &&
                shot.control?.state === state &&
                shot.control?.selector === variant.selector &&
                shot.control?.actionId === action.actionId,
            ),
            "missing exact variant screenshot/viewport",
          );
        }
      }
    }
  }
  for (const action of review.actions.filter((a) => a.kind === "wiring"))
    for (const id of action.forwardsTo) {
      const target = review.actions.find((a) => a.actionId === id);
      assert.ok(
        target && target.kind !== "wiring",
        "forward target must be a local action or explicit exclusion, never a cycle",
      );
    }
  assert.deepEqual(
    [...seen].sort(),
    scope.map((c) => c.candidateId).sort(),
    "reviewed source scope has unmapped candidates",
  );
  if (review.dialogs.kind === "none-in-current-source")
    assert.equal(scope.filter((c) => c.kind.startsWith("dialog-")).length, 0, "dialog omitted");
  else {
    assert.equal(
      review.dialogs.kind,
      "local-callers-and-listed-shared-only",
      "unknown dialog review kind",
    );
    assert.ok(review.surfaceReview, "positive dialog review requires explicit caller surfaces");
  }
  return {
    pageId: review.pageId,
    actionApproval: "pending-user-review",
    ...(visualApproval ? { visualApproval } : {}),
    sourceSites: seen.size,
    semanticGroups: actionIds.size,
    routeActions: review.actions.filter((a) => !["excluded", "wiring"].includes(a.kind)).length,
    wiringGroups: review.actions.filter((a) => a.kind === "wiring").length,
    excludedGroups: review.actions.filter((a) => a.kind === "excluded").length,
    writeActions: review.actions.filter((a) => a.kind === "write").length,
    sourceAbsentProposals: review.actions.filter((a) => !a.sourceCandidateIds.length).length,
    sourceInapplicableVisualSlots: review.actions.reduce(
      (sum, action) =>
        sum +
        Object.values(action.visualStates).filter((value) => value === sourceAbsentState).length,
      0,
    ),
    testEvidenceTypes: [
      ...new Set(
        review.actions.flatMap((action) => action.testReferences.map((ref) => ref.evidenceType)),
      ),
    ].sort(),
    unmappedVisualSlots: review.actions
      .filter((a) => a.kind !== "excluded")
      .reduce(
        (sum, a) => sum + Object.values(a.visualStates).filter((v) => v === "not-mapped").length,
        0,
      ),
  };
}

export function reconcileActionCandidates(current, historical, records) {
  const old = new Map(historical.map((c) => [c.candidateId, c]));
  assert.equal(old.size, historical.length, "duplicate historical candidate");
  const currentIds = new Set(current.map((c) => c.candidateId));
  assert.equal(currentIds.size, current.length, "duplicate current candidate");
  return {
    candidates: current.map((c) => ({
      candidateId: c.candidateId,
      file: c.file,
      line: c.line,
      kind: c.kind,
      label: c.label.slice(0, 120),
      conditions: c.conditions,
      staticRouteIds: old.get(c.candidateId)?.candidateRouteIds ?? [],
      routeAttribution: "historical-static-superset-not-runtime-proof",
      registration: old.has(c.candidateId)
        ? "same-source-site-identity"
        : "not-in-historical-inventory",
      contractReferences: records
        .filter(
          (r) =>
            r.candidateId === c.candidateId &&
            r.temporalScope !== "historical" &&
            ["identity-current", "line-moved"].includes(r.status),
        )
        .map((r) => ({
          file: r.document,
          line: r.documentLine,
          jsonPointer: r.jsonPointer ?? null,
        })),
    })),
    oldOnly: historical
      .filter((c) => !currentIds.has(c.candidateId))
      .map((c) => ({
        candidateId: c.candidateId,
        file: c.file,
        line: c.line,
        disposition: "source-identity-changed-not-safe-to-delete",
      })),
  };
}
