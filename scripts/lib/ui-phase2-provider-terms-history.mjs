// Test/review provenance only. Never use this adapter to validate the current runtime.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
export const providerTermsHistory = [
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "8d57edec7fe4b960e85854e2cad9e3c89376c2c1359f14d13e3806c9ee2ba8bc",
    after: "c97497796c891fe8d11219c1678db0bfb692b0a7642cb5ecb74abbb12f012d22",
  },
  {
    file: "apps/web/src/styles/provider-registry-c-completion.css",
    before: "15141ec791e8f9cd927fd7ee36eb90c172e319343522747b26b79904cafabd3d",
    after: "6f75e077b0ae9610f312a1cb0533c22547612526f1e038a87de1802368494bce",
  },
];
const hash = (value) => createHash("sha256").update(value).digest("hex"),
  cache = new Map();
export function historicalProviderTermsSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = providerTermsHistory.find(
    (item) => item.file === file && item.after === hash(source),
  );
  if (!revision) return source;
  if (!cache.has(file)) {
    const before = execFileSync(
      "git",
      ["show", `7392e67499b3f34bbe0c7f1e8483b9dfbbd1a501:${file}`],
      { encoding: "utf8" },
    ).replaceAll("\r\n", "\n");
    assert.equal(hash(before), revision.before, "immutable pre-permanent-terms source");
    cache.set(file, before);
  }
  return cache.get(file);
}
