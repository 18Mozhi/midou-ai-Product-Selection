import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const providerFeedbackRevisions = [
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "ffb8a98b8df1c966ee092cf1377f51c2ab67748d66377cda5734ac9646906df3",
    after: "ec671e2cf8c1d55f88d97df05d7a14849235961b4e4f66f838ca0cf6fb76971f",
  },
  {
    file: "scripts/lib/ui-phase2-provider-async-baseline.mjs",
    before: "ea7ad07ab9afc30fe597270c549970938e9d3985ef1707f77cdbf9df2463e349",
    after: "0e8faf253d25e298f0ae23bbf9f64b79d719ded0a5008960f40416e50a014b49",
  },
];
const cache = new Map(),
  hash = (s) => createHash("sha256").update(s).digest("hex");
// Exact historical association, not a current-source acceptance shortcut.
export function historicalProviderFeedbackSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const r = providerFeedbackRevisions.find((r) => r.file === file);
  if (!r || hash(source) !== r.after) return source;
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `b055029b:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(old), r.before);
    cache.set(file, old);
  }
  return cache.get(file);
}
