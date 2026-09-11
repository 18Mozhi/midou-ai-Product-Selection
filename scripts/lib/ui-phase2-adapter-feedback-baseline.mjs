import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adapterFeedbackRevision = {
  file: "apps/web/src/components/ProviderAdapterCenter.vue",
  before: "0ef775e4638ffdee87eb12caf959891d30b52932f4b5eb6b9b96ebec88851075",
  after: "28d57b9d143bf19419bbc0eb88afdc1126967017d6f3cb421b6be83ad412b1c2",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous;
// Resolve only this exact revision for immutable pre-fix screenshots. Never normalize drift.
export function historicalAdapterFeedbackSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  if (file !== adapterFeedbackRevision.file || hash(source) !== adapterFeedbackRevision.after)
    return source;
  if (!previous) {
    previous = execFileSync("git", ["show", `e7c31b8b:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(previous), adapterFeedbackRevision.before);
  }
  return previous;
}
