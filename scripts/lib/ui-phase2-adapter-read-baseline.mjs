import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adapterReadRevision = {
  file: "apps/web/src/components/ProviderAdapterCenter.vue",
  before: "28d57b9d143bf19419bbc0eb88afdc1126967017d6f3cb421b6be83ad412b1c2",
  after: "f6352020e923cac9b96a54b358ee69e6b53c5f8c1b820016b2bc038f41ccb08e",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous;
// Immutable prior capture only. Unknown edits are never normalized.
export function historicalAdapterReadSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  if (file !== adapterReadRevision.file || hash(source) !== adapterReadRevision.after)
    return source;
  if (!previous) {
    previous = execFileSync("git", ["show", `004c3e0e:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(previous), adapterReadRevision.before);
  }
  return previous;
}
