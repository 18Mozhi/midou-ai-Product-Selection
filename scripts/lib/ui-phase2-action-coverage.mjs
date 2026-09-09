import assert from "node:assert/strict";

// Validate explicit reviews. Never infer a business action from a label or hash.
export function validateActionReview(
  review,
  { candidates, sourceHashes, contracts, packages, files },
) {
  assert.equal(review.schemaVersion, 1);
  assert.match(review.pageId, /^P\d{2}$/);
  assert.equal(review.approval, "pending-user-review", "This registry cannot grant approval");
  assert.ok(review.actions.length > 0);
  const seen = new Set(),
    actionIds = new Set();
  const scope = candidates.filter((c) => Object.hasOwn(review.sourceHashes, c.file));
  for (const [file, hash] of Object.entries(review.sourceHashes))
    assert.equal(hash, sourceHashes[file], file + " reviewed source drift");
  for (const action of review.actions) {
    assert.ok(!actionIds.has(action.actionId), "duplicate actionId");
    actionIds.add(action.actionId);
    assert.ok(["navigation", "read", "write", "local", "excluded"].includes(action.kind));
    assert.ok(action.condition && action.handler && action.remaining);
    assert.ok(action.sourceCandidateIds.length);
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
            r.claim
              .split("|")
              .map((v) => v.replaceAll("`", "").trim().split(" · ")[0])
              .includes(action.actionId),
        ),
        "actionId not in current explicit contract " + action.actionId,
      );
    }
    for (const state of ["default", "hover", "focus", "pressed", "disabled", "busy"]) {
      const value = action.visualStates[state];
      assert.ok(
        [
          "not-mapped",
          "scene-reference-not-acceptance",
          "not-applicable-excluded",
          "not-applicable-navigation-only",
          "not-applicable-not-disabled-in-source",
        ].includes(value),
        "unsupported visual status",
      );
      if (value === "scene-reference-not-acceptance") assert.ok(action.scenes.length);
      if (value === "not-applicable-excluded") assert.equal(action.kind, "excluded");
      if (value.startsWith("not-applicable-n")) assert.equal(action.kind, "navigation");
    }
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
      assert.equal(ref.evidenceType, "offline-proposal-check-not-Vue");
    }
    if (action.visualStateReferences) {
      for (const [state, ref] of Object.entries(action.visualStateReferences)) {
        assert.equal(action.visualStates[state], "scene-reference-not-acceptance");
        assert.ok(
          action.scenes.some((scene) => scene.package === ref.package && scene.scene === ref.scene),
        );
        const target = packages.get(ref.package)?.actionVisualReferences?.[action.actionId];
        assert.ok(target, "missing action-specific visual evidence");
        assert.equal(target.scope, "representative-control-only-not-all-variants-or-Vue");
        assert.equal(target.selector, ref.selector, "control selector differs from evidence");
        assert.equal(target.states[state], ref.scene, "state differs from evidence");
      }
      for (const [state, value] of Object.entries(action.visualStates))
        if (value === "scene-reference-not-acceptance")
          assert.ok(action.visualStateReferences[state], "missing explicit state reference");
    }
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
    sourceSites: seen.size,
    semanticGroups: actionIds.size,
    routeActions: review.actions.filter((a) => a.kind !== "excluded").length,
    excludedGroups: review.actions.filter((a) => a.kind === "excluded").length,
    writeActions: review.actions.filter((a) => a.kind === "write").length,
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
