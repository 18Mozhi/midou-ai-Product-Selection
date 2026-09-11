import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adminResultsBaseline = "67cb00f3";
export const adminResultsRevisions = {
  "apps/web/src/components/PlatformRoleComparison.vue": {
    before: "d97345c58748d4dd480bd80dd0ee7106b411bb1488652a7621a5a3adfc3dd0ba",
    after: "53ea620ad7ef16c2e451d83e0be2a141a060a3668c50eb36c852bcabd9125809",
  },
  "apps/web/src/components/PlatformAdminComparisonMobile.css": {
    before: "492517572b9ff66dad74bf08c5372caab32bb09adf3deb08d8aa728c61bebbe7",
    after: "aab8b73f01e26f8da808c60e5cdef04dfb67504d179292e0d4a9f3209670a64d",
  },
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
const cache = new Map();
// Exact association for existing captured artifacts, never current acceptance.
export function historicalAdminResultsSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = adminResultsRevisions[file];
  if (!revision || hash(source) === revision.before) return source;
  assert.equal(hash(source), revision.after, `Unreviewed admin results source: ${file}`);
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `${adminResultsBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), revision.before);
    cache.set(file, old);
  }
  return cache.get(file);
}
