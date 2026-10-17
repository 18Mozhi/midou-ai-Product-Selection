import { readArchivedJourneySource } from "../../scripts/lib/retired-journey-surface.mjs";
import { beforePublishedPresentation } from "../../scripts/lib/ui-phase2-published-presentation-baseline.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectionBlockedHistoricalSource } from "../fixtures/selection-blocked-historical-source.mjs";

const file = "apps/web/src/components/SelectionJourney.vue";
const current = readArchivedJourneySource(file).replaceAll("\r\n", "\n");
const before = "7a926cf2ced2b4234ab1f360155321ad01c5d32c66bc45cd4926d1f34f1d9faf";
const after = "ee3863173db351cdf6d434d6509f729c4b84775ae5273d89e319dd7c2a9eae00";
const hash = (source) => createHash("sha256").update(source).digest("hex");

test("historical shell source is exact while current blocked guard remains a separate runtime change", () => {
  const historical = selectionBlockedHistoricalSource(file, current, before);
  assert.equal(hash(historical), before);
  assert.equal(hash(beforePublishedPresentation(file, current)), after);
  assert.notEqual(historical, current);
  assert.equal(
    selectionBlockedHistoricalSource(file, current, after),
    beforePublishedPresentation(file, current),
  );
  assert.equal(
    selectionBlockedHistoricalSource(file, current.replaceAll("\n", "\r\n"), before),
    historical,
  );
});

test("historical binding rejects changed behavior, template, styles, payload and unknown capture hashes", () => {
  for (const text of [
    current + "\n// unrelated change",
    current.replace('state !== "blocked"', 'state !== "failed"'),
    current.replace("<template>", "<template><span>changed</span>"),
    current.replace("...decision,", '...decision, action: "adopt",'),
    current.replace("../selection-journey.css", "../unreviewed.css"),
  ]) {
    assert.notEqual(text, current);
    assert.throws(() => selectionBlockedHistoricalSource(file, text, before));
  }
  assert.throws(() => selectionBlockedHistoricalSource(file, current, "0".repeat(64)));
  assert.equal(selectionBlockedHistoricalSource("unrelated.vue", "unchanged", before), "unchanged");
});
