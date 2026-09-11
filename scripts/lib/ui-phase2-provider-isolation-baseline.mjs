import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { historicalProviderSummarySource } from "./ui-phase2-provider-summary-baseline.mjs";

export const providerIsolationRevision = {
  file: "apps/web/src/components/ProviderRegistry.vue",
  before: "ebd8b3876f9911ca6d5a0be6bac7a9352d977fa2446f4407342e54cd92b1fe1c",
  after: "b217ac9898675371d6a6b0406a2574784a7321fac93c233347299991289b0f8e",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous;
// Associate immutable pre-isolation evidence only; current raw source has separate gates.
export function historicalProviderIsolationSource(file, source) {
  source = historicalProviderSummarySource(file, source);
  if (file !== providerIsolationRevision.file || hash(source) !== providerIsolationRevision.after)
    return source;
  if (!previous) {
    previous = execFileSync("git", ["show", `2bfb9038:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(previous), providerIsolationRevision.before);
  }
  return previous;
}
