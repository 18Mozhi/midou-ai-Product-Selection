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
const providerSummaryCurrentRevision = {
  file: providerSummaryRevision.file,
  current: "8d57edec7fe4b960e85854e2cad9e3c89376c2c1359f14d13e3806c9ee2ba8bc",
  captured: providerSummaryRevision.after,
  commit: "b7a7de9e",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous, currentSnapshot;
// Only associate exact immutable historical captures; current raw code is tested separately.
export function historicalProviderSummarySource(file, source) {
  if (
    file === providerSummaryCurrentRevision.file &&
    hash(source) === providerSummaryCurrentRevision.current
  ) {
    if (!currentSnapshot) {
      currentSnapshot = execFileSync(
        "git",
        ["show", `${providerSummaryCurrentRevision.commit}:${file}`],
        {
          encoding: "utf8",
        },
      ).replaceAll("\r\n", "\n");
      assert.equal(hash(currentSnapshot), providerSummaryCurrentRevision.captured);
    }
    source = currentSnapshot;
  }
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
