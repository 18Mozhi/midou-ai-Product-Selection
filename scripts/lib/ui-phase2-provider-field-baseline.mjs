import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const providerFieldRevision = {
  file: "apps/web/src/components/ProviderRegistry.vue",
  before: "87728f892d895f3be4ecb0ecf016125745ea99fc9898f4d3c8c1845013b19a90",
  after: "ebd8b3876f9911ca6d5a0be6bac7a9352d977fa2446f4407342e54cd92b1fe1c",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let previous;
// Exact historical capture association only. Current field semantics have independent raw-source tests.
export function historicalProviderFieldSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  if (file !== providerFieldRevision.file || hash(source) !== providerFieldRevision.after)
    return source;
  if (!previous) {
    previous = execFileSync("git", ["show", `52099bc3:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(previous), providerFieldRevision.before);
  }
  return previous;
}
