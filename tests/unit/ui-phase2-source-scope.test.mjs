import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  validateScopeRecords,
  verifySourceScope,
  revalidatedScopeSources,
} from "../../scripts/verify-ui-phase2-source-scope.mjs";

const base = "design-plans/ui-phase-2-2026-09-07/";
const read = async (name) => JSON.parse(await readFile(base + name, "utf8"));
const review = await read("source-scope-review.json");
const revalidation = await read("source-scope-revalidation.json");
const candidates = [
  ...(await read("actions.json")).candidates,
  ...(await read("dialogs.json")).candidates,
];
const validate = (value) =>
  validateScopeRecords(value, candidates, review.sourceFingerprint, review.sources);
test("supporting shell revalidation preserves historical review and pins current source", () => {
  const before = structuredClone(review);
  const updated = revalidatedScopeSources(review, revalidation);
  assert.deepEqual(review, before);
  assert.equal(updated[revalidation.bindings[0].file], revalidation.bindings[0].currentSha256);
  assert.throws(() =>
    validateScopeRecords({ ...review, sources: updated }, candidates, review.sourceFingerprint, {
      ...updated,
      [revalidation.bindings[0].file]: "future-source",
    }),
  );
});
test("scope revalidation cannot waive a new source, different history or runtime gate", () => {
  for (const mutate of [
    (r) => {
      r.bindings[0].file = "apps/web/src/App.vue";
    },
    (r) => {
      r.bindings[0].previousSha256 = "unknown";
    },
    (r) => {
      r.bindings.push(r.bindings[0]);
    },
    (r) => {
      r.bindings[0].templateUnchanged = false;
    },
    (r) => {
      r.runtimeAcceptance = "passed";
    },
  ]) {
    const copy = structuredClone(revalidation);
    mutate(copy);
    assert.throws(() => revalidatedScopeSources(review, copy));
  }
});
test("all outside-route source candidates retain exact IDs and partial runtime status", async () => {
  assert.deepEqual(await verifySourceScope(), {
    sourceCandidates: 54,
    semanticActions: 42,
    dialogCalls: 1,
    orphanCandidates: 6,
    runtimeAcceptance: "partial-not-frozen",
  });
});
test("duplicate or missing source candidates cannot silently reduce the denominator", () => {
  const copy = structuredClone(review);
  copy.records[1] = copy.records[0];
  assert.throws(() => validate(copy));
  assert.throws(() => validate({ ...review, records: review.records.slice(1) }));
});
test("stale source or invented runtime completion fails closed", () => {
  assert.throws(() => validate({ ...review, sourceFingerprint: "stale" }));
  assert.throws(() => validate({ ...review, sources: {} }));
  const copy = structuredClone(review);
  copy.records[0].runtimeStatus = "passed";
  assert.throws(() => validate(copy));
});
test("native confirmation and handler contracts cannot disappear from the review", () => {
  const copy = structuredClone(review);
  copy.records.at(-1).dialogId = null;
  assert.throws(() => validate(copy));
  const changed = structuredClone(review);
  changed.records[0].events = { "@click": "inventedHandler" };
  assert.throws(() => validate(changed));
});
