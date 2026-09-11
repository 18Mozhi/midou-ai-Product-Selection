import assert from "node:assert/strict";
import { historicalAdminDirectorySource } from "./ui-phase2-admin-directory-baseline.mjs";
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
export const adminRoleFactsRevision = {
  file: "apps/web/src/components/PlatformAdminComparisonMobile.css",
  baseline: "66ea2f60",
  before: "aab8b73f01e26f8da808c60e5cdef04dfb67504d179292e0d4a9f3209670a64d",
  after: "9b74248f24827e8e1e4800b93090ef1fd680acaebf90754bc238680bebedddde",
};
// Associate the previous result captures with their exact CSS, not current acceptance.
export function historicalAdminRoleFactsSource(file, source) {
  source = historicalAdminDirectorySource(file, source);
  const r = adminRoleFactsRevision;
  if (file !== r.file || hash(source) === r.before) return source;
  // The older pre-results stylesheet is also a known historical input.
  if (hash(source) === adminResultsRevisions[file].before) return source;
  assert.equal(hash(source), r.after, `Unreviewed admin results source: ${file}`);
  const key = "role-facts:" + file;
  if (!cache.has(key)) {
    const old = execFileSync("git", ["show", `${r.baseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), r.before);
    cache.set(key, old);
  }
  return cache.get(key);
}
// Exact association for existing captured artifacts, never current acceptance.
export function historicalAdminResultsSource(file, source) {
  source = historicalAdminRoleFactsSource(file, source);
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
