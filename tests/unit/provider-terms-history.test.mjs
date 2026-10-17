import { readPreSelectionRebuild } from "../fixtures/pre-selection-rebuild-snapshot.mjs";
// Archived pre-rebuild inputs only; current UI acceptance is verified separately.
import { beforePublishedPresentation } from "../../scripts/lib/ui-phase2-published-presentation-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalProviderTermsSource,
  providerTermsHistory,
} from "../../scripts/lib/ui-phase2-provider-terms-history.mjs";
test("permanent terms history binds only the exact known delta and cannot approve current screenshots", () => {
  const hash = (x) => createHash("sha256").update(x).digest("hex");
  for (const revision of providerTermsHistory) {
    const raw = readPreSelectionRebuild(revision.file).replaceAll("\r\n", "\n");
    assert.equal(hash(beforePublishedPresentation(revision.file, raw)), revision.after);
    assert.equal(hash(historicalProviderTermsSource(revision.file, raw)), revision.before);
    assert.equal(
      historicalProviderTermsSource(revision.file, raw + "\n/* unknown */"),
      raw + "\n/* unknown */",
    );
  }
  assert.match(
    readPreSelectionRebuild("apps/web/src/components/ProviderRegistry.vue"),
    /form\.terms_permanent/,
  );
  assert.equal(historicalProviderTermsSource("unknown.vue", "unchanged"), "unchanged");
});
