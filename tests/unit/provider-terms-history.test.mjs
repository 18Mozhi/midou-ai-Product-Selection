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
    const raw = readFileSync(revision.file, "utf8").replaceAll("\r\n", "\n");
    assert.equal(hash(raw), revision.after);
    assert.equal(hash(historicalProviderTermsSource(revision.file, raw)), revision.before);
    assert.equal(
      historicalProviderTermsSource(revision.file, raw + "\n/* unknown */"),
      raw + "\n/* unknown */",
    );
  }
  assert.match(
    readFileSync("apps/web/src/components/ProviderRegistry.vue", "utf8"),
    /form\.terms_permanent/,
  );
  assert.equal(historicalProviderTermsSource("unknown.vue", "unchanged"), "unchanged");
});
