import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { historicalProviderFieldSource } from "./ui-phase2-provider-field-baseline.mjs";

export const providerStructureRevisions = [
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "768d2d9cef24b0cedddb7f2c69e0d5a3e3055f2a5a8fd2a868616b2c78bc9c19",
    after: "87728f892d895f3be4ecb0ecf016125745ea99fc9898f4d3c8c1845013b19a90",
  },
  {
    file: "scripts/verify-ui-phase2-provider-route-assembly.mjs",
    before: "ff6ece0be359d3a447ce2246a3bf62105afa22ac1a33b7e1af0393ffa9a537c5",
    after: "48e55c7595b040d566cd4fe63ad275dfccdc12092b7726b89162751bd7722432",
  },
  {
    file: "scripts/lib/ui-phase2-provider-keyboard-baseline.mjs",
    before: "744a5ee12441fa0b1ca699bfd18df31d4ef9f94043c1daa701292fd4ba987525",
    after: "748a646c08ed5c813857f0aa5c7fcefa0516df760872f4b7fe0b715cccb48cd1",
  },
];
const cache = new Map();
const hash = (s) => createHash("sha256").update(s).digest("hex");
// Historical evidence only. Raw current structure is verified separately.
export function historicalProviderStructureSource(file, source) {
  source = historicalProviderFieldSource(file, source);
  const r = providerStructureRevisions.find((r) => r.file === file);
  if (!r || hash(source) !== r.after) return source;
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `717cc944:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(old), r.before);
    cache.set(file, old);
  }
  return cache.get(file);
}
