import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const providerAsyncRevisions = [
  {
    file: "scripts/lib/ui-phase2-provider-focus-baseline.mjs",
    before: "034d45633716446e2a79204afb377123285e051c4977778dde99a41fa190f16a",
    after: "2f56a4c30c1ba96187c91294b48e9d2d2d3d914bc708a5033dfd1f78b9dd0a4b",
  },
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "2e6aed1eb23b4402719d2d031a61215aad27be0613c36b2f9f4477971638d20c",
    after: "ffb8a98b8df1c966ee092cf1377f51c2ab67748d66377cda5734ac9646906df3",
  },
];
const cached = new Map(),
  hash = (s) => createHash("sha256").update(s).digest("hex");
export function historicalProviderAsyncSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const r = providerAsyncRevisions.find((r) => r.file === file);
  if (!r || hash(source) !== r.after) return source;
  if (!cached.has(file)) {
    const old = execFileSync("git", ["show", `af60b101:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(old), r.before);
    cached.set(file, old);
  }
  return cached.get(file);
}
