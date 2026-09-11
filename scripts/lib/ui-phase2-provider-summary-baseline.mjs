import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { historicalAdapterFeedbackSource } from "./ui-phase2-adapter-feedback-baseline.mjs";
import { historicalAdapterReadSource } from "./ui-phase2-adapter-read-baseline.mjs";

export const providerSummaryRevision = {
  file: "apps/web/src/components/ProviderRegistry.vue",
  before: "b217ac9898675371d6a6b0406a2574784a7321fac93c233347299991289b0f8e",
  after: "9822fd9a882dd61409420d414e1fcdaae4c8ce513d53c853c9bda9741c609c2c",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous;
// Only associate exact immutable historical captures; current raw code is tested separately.
export function historicalProviderSummarySource(file, source) {
  source = historicalAdapterFeedbackSource(file, historicalAdapterReadSource(file, source));
  if (file !== providerSummaryRevision.file || hash(source) !== providerSummaryRevision.after)
    return source;
  if (!previous) {
    previous = execFileSync("git", ["show", `fa69ae75:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(previous), providerSummaryRevision.before);
  }
  return previous;
}
