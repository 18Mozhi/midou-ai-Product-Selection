import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "design-plans/ui-phase-2-2026-09-07";
const readJson = async (file) => JSON.parse(await readFile(path.join(repo, file), "utf8"));
export function revalidatedScopeSources(review, revalidation) {
  assert.equal(revalidation.schemaVersion, 1);
  assert.equal(revalidation.sourceFingerprint, review.sourceFingerprint);
  assert.equal(revalidation.status, "supporting-shell-source-revalidated-not-runtime-acceptance");
  assert.equal(revalidation.runtimeAcceptance, "partial-not-frozen");
  assert.equal(revalidation.bindings.length, 1);
  const binding = revalidation.bindings[0];
  assert.equal(binding.file, "apps/web/src/components/NavigationShell.vue");
  assert.ok(!review.records.some((r) => r.file === binding.file));
  assert.equal(binding.previousSha256, review.sources[binding.file]);
  assert.match(binding.currentSha256, /^[a-f0-9]{64}$/);
  assert.match(binding.previousRevision, /^[a-f0-9]{40}$/);
  assert.match(binding.changeRevision, /^[a-f0-9]{40}$/);
  assert.ok(binding.reviewConclusion);
  assert.equal(binding.templateUnchanged, true);
  assert.deepEqual(binding.unchangedInitializers, [
    "componentModules",
    "surfaceComponents",
    "selectedSurfaceComponent",
    "activeSurface",
    "activeCachePolicy",
  ]);
  return { ...review.sources, [binding.file]: binding.currentSha256 };
}
export function validateScopeRecords(review, candidates, fingerprint, sourceHashes) {
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.sourceFingerprint, fingerprint, "stale inventory fingerprint");
  assert.deepEqual(review.sources, sourceHashes, "stale source review");
  const outside = candidates.filter((item) => !item.candidateRouteIds.length);
  const requiredSources = [
    ...new Set([
      ...outside.map((item) => item.file),
      "apps/web/src/App.vue",
      "apps/web/src/components/NavigationShell.vue",
      "apps/web/src/router.ts",
      "config/route-catalog.json",
    ]),
  ].sort();
  assert.deepEqual(Object.keys(review.sources).sort(), requiredSources, "missing source evidence");
  assert.equal(outside.length, 54, "source scope changed; review the new denominator");
  assert.equal(review.records.length, outside.length);
  assert.equal(new Set(review.records.map((item) => item.candidateId)).size, outside.length);
  const known = new Map(outside.map((item) => [item.candidateId, item]));
  for (const row of review.records) {
    const source = known.get(row.candidateId);
    assert.ok(source, `unknown candidate ${row.candidateId}`);
    assert.equal(row.file, source.file);
    assert.equal(row.sourceClassification, source.sourceScope);
    assert.equal(row.label, source.label.slice(0, 160));
    assert.deepEqual(row.events, source.events);
    assert.deepEqual(row.conditions, source.conditions);
    assert.deepEqual(row.handlerDefinitions, source.handlerDefinitions);
    assert.equal(row.sourceReview, "reviewed");
    assert.equal(row.navigationTarget, source.tag === "RouterLink" ? source.attributes.to : null);
    assert.equal(
      row.sourceClassification,
      row.view ? "development-query-view" : "no-explicit-render-consumer-found-do-not-delete",
    );
    assert.equal(
      row.runtimeStatus,
      row.view ? "partial-tests-not-per-candidate-completion" : "not-executable-no-render-consumer",
    );
    assert.ok(
      ["navigation", "non-action-placeholder", "local-display", "read-api", "write-api"].includes(
        row.effect,
      ),
    );
    assert.equal(
      row.dialogId,
      source.kind === "dialog-script-call" ? "dev.resource-grants.revoke-confirm" : null,
    );
    if (row.effect === "non-action-placeholder") {
      assert.equal(row.view, null);
      assert.equal(row.semanticActionId, null);
      assert.deepEqual(source.events, {});
    } else assert.match(row.semanticActionId, /^dev\.[a-z-]+\.[a-z-]+$/);
    if (row.effect.endsWith("-api")) assert.ok(row.apiReferences.length > 0);
    else assert.deepEqual(row.apiReferences, []);
    assert.equal(source.candidateRouteIds.length, 0);
  }
  assert.equal(new Set(review.records.map((row) => row.semanticActionId).filter(Boolean)).size, 42);
  return {
    sourceCandidates: review.records.length,
    semanticActions: new Set(review.records.map((row) => row.semanticActionId).filter(Boolean))
      .size,
    dialogCalls: review.records.filter((row) => row.dialogId).length,
    orphanCandidates: review.records.filter((row) => !row.view).length,
    runtimeAcceptance: "partial-not-frozen",
  };
}
export async function verifySourceScope() {
  const review = await readJson(`${base}/source-scope-review.json`);
  const revalidation = await readJson(`${base}/source-scope-revalidation.json`);
  const reviewedSources = revalidatedScopeSources(review, revalidation);
  const baseline = await readJson(`${base}/baseline.json`);
  const actions = await readJson(`${base}/actions.json`);
  const dialogs = await readJson(`${base}/dialogs.json`);
  const sourceHashes = {};
  for (const file of Object.keys(review.sources)) {
    assert.ok(/^(apps\/web\/src\/|config\/route-catalog\.json$)/.test(file));
    assert.ok(!file.split("/").includes(".."));
    sourceHashes[file] = createHash("sha256")
      .update((await readFile(path.join(repo, file), "utf8")).replace(/\r\n/g, "\n"))
      .digest("hex");
  }
  for (const file of new Set(review.records.map((row) => row.testFile).filter(Boolean)))
    await readFile(path.join(repo, file), "utf8");
  return validateScopeRecords(
    { ...review, sources: reviewedSources },
    [...actions.candidates, ...dialogs.candidates],
    baseline.sourceFingerprint,
    sourceHashes,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 2, "No arguments are supported");
  console.log("ui_phase2_source_scope_verified", JSON.stringify(await verifySourceScope()));
}
