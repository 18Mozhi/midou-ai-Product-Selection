import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adapterCRevisions = [
  {
    file: "apps/web/src/components/ProviderAdapterCenter.vue",
    before: "f6352020e923cac9b96a54b358ee69e6b53c5f8c1b820016b2bc038f41ccb08e",
    after: "66b064c2135275b9d173ef316692366823ef4f6276002796d9ed112183218cef",
  },
  {
    file: "tests/e2e/m03-03-provider-adapter.spec.ts",
    before: "f189c28a32f3d25bd0686379f9cfa978bd260df6085ea3650b0f1f5bedf28e74",
    after: "f5c6bd4e0d265e83dbb3179f732ff4db18409f79e87568248767827230ef1452",
  },
];
const history = new Map();
const hash = (source) => createHash("sha256").update(source).digest("hex");
// Only link exact known edits to immutable earlier evidence. Never normalize unknown drift.
export function historicalAdapterCSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = adapterCRevisions.find((entry) => entry.file === file);
  if (!revision || hash(source) !== revision.after) return source;
  if (!history.has(file)) {
    const previous = execFileSync("git", ["show", `18f7792f:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(previous), revision.before);
    history.set(file, previous);
  }
  return history.get(file);
}
