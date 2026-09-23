import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Historical capture/diagnosis only, never a substitute for current runtime acceptance.
export const tokenCopyBaseline = "b4fc398d9b696b1a9922e284d12d792ea7852265";
export const tokenCopyComponent = "apps/web/src/components/OrganizationTokenPanel.vue";
export const tokenCopyRevisions = {
  "scripts/lib/ui-phase2-org-token-design-data.mjs": {
    before: "408840ae6f80aa140d617544bdae231a418fe449ec6d96b9fa03402f3a2fe135",
    after: "28a8951aa0bd373352df39ffb76d5ff936bdedad9444d3795989dda066b587c2",
  },
  [tokenCopyComponent]: {
    before: "81ba6a86c80bdcdb1cfea7832b3c13b0d85a5a9bf8dd6922583a5ada5d0e326d",
    after: "f1e3167ae749d8e7c3469fe6a3b766793f68838feda467eb5010bb8bf4c4669c",
  },
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
const cache = new Map();
export function historicalTokenCopySource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = tokenCopyRevisions[file];
  if (!revision || hash(source) === revision.before) return source;
  assert.equal(hash(source), revision.after, `Unreviewed token copy source: ${file}`);
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `${tokenCopyBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), revision.before, `Historical token source drift: ${file}`);
    cache.set(file, old);
  }
  return cache.get(file);
}
