import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { historicalProviderStructureSource } from "./ui-phase2-provider-structure-baseline.mjs";

export const providerKeyboardRevisions = [
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "ec671e2cf8c1d55f88d97df05d7a14849235961b4e4f66f838ca0cf6fb76971f",
    after: "768d2d9cef24b0cedddb7f2c69e0d5a3e3055f2a5a8fd2a868616b2c78bc9c19",
  },
  {
    file: "scripts/verify-ui-phase2-provider-route-assembly.mjs",
    before: "d18333019fef76b30875c8d33ee87c4a9f5c0c73974bfffdb2fb199d7c3d381b",
    after: "277da69fb914edb2d051191fc64d7b61ea7a26302fc4cdae866b6cf4e6c7ba3f",
  },
  {
    file: "scripts/lib/ui-phase2-provider-feedback-baseline.mjs",
    before: "1b45a7ebe301630a29fa6c867e4f0bfddf08575b727a787cb6c2544f868c64ef",
    after: "f93bd28ccd6550c5b4738e5249703f328c21429bce51cb00e10fbb74864f9312",
  },
];
const cache = new Map();
const hash = (s) => createHash("sha256").update(s).digest("hex");
// Associate only exact known revisions with immutable pre-keyboard evidence.
// Current implementation tests must read raw files, never this adapter.
export function historicalProviderKeyboardSource(file, source) {
  source = historicalProviderStructureSource(file, source);
  const r = providerKeyboardRevisions.find((r) => r.file === file);
  if (!r || hash(source) !== r.after) return source;
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `29cb58b5:${file}`], { encoding: "utf8" }).replaceAll(
      "\r\n",
      "\n",
    );
    assert.equal(hash(old), r.before);
    cache.set(file, old);
  }
  return cache.get(file);
}
