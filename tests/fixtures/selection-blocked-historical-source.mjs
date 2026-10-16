import { beforePublishedPresentation } from "../../scripts/lib/ui-phase2-published-presentation-baseline.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";

const file = "apps/web/src/components/SelectionJourney.vue";
const before = "7a926cf2ced2b4234ab1f360155321ad01c5d32c66bc45cd4926d1f34f1d9faf";
const after = "ee3863173db351cdf6d434d6509f729c4b84775ae5273d89e319dd7c2a9eae00";
const hash = (value) => createHash("sha256").update(value).digest("hex");
let historical;

// Historical image provenance only. This is NOT current UI/runtime acceptance.
// All other files retain their original exact-current-source assertions.
export function selectionBlockedHistoricalSource(path, text, expected) {
  const current = beforePublishedPresentation(path, text);
  if (path !== file || hash(current) === expected) return current;
  assert.equal(expected, before, "Unknown SelectionJourney capture revision");
  assert.equal(hash(current), after, "Unreviewed SelectionJourney current source");
  historical ??= execFileSync("git", ["show", `cc5d97de091b2b410787769493c62d54caaa92a8:${file}`], {
    encoding: "utf8",
    maxBuffer: 1048576,
  }).replaceAll("\r\n", "\n");
  assert.equal(hash(historical), before);
  let projected = historical;
  for (const [old, next] of [
    [
      "  canAdopt = computed(() => eligibleForAdoption(selectedCandidate.value)),",
      '  canAdopt = computed(\n    () => journey.value?.state !== "blocked" && eligibleForAdoption(selectedCandidate.value),\n  ),',
    ],
    [
      'function adoptionHint(candidate: Journey["results"][number]) {',
      'function adoptionHint(candidate: Journey["results"][number]) {\n  if (journey.value?.state === "blocked") return "当前旅程已受阻，不能采纳；可继续观察或驳回。";',
    ],
  ]) {
    assert.equal(projected.split(old).length, 2);
    projected = projected.replace(old, next);
  }
  assert.equal(
    current,
    projected,
    "Only the two exact blocked-adoption script changes are covered",
  );
  const original = parse(historical).descriptor;
  const latest = parse(current).descriptor;
  assert.equal(latest.template.content, original.template.content);
  const styles = (entry) => entry.styles.map(({ content, attrs }) => ({ content, attrs }));
  assert.deepEqual(styles(latest), styles(original));
  return historical;
}
