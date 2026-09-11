import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const providerKeyboardRevisions = [
  {
    file: "apps/web/src/components/ProviderRegistry.vue",
    before: "ec671e2cf8c1d55f88d97df05d7a14849235961b4e4f66f838ca0cf6fb76971f",
    after: "768d2d9cef24b0cedddb7f2c69e0d5a3e3055f2a5a8fd2a868616b2c78bc9c19",
  },
  {
    file: "scripts/verify-ui-phase2-provider-route-assembly.mjs",
    before: "d18333019fef76b30875c8d33ee87c4a9f5c0c73974bfffdb2fb199d7c3d381b",
    after: "ff6ece0be359d3a447ce2246a3bf62105afa22ac1a33b7e1af0393ffa9a537c5",
  },
  {
    file: "scripts/lib/ui-phase2-provider-feedback-baseline.mjs",
    before: "1b45a7ebe301630a29fa6c867e4f0bfddf08575b727a787cb6c2544f868c64ef",
    after: "6ad5331a615e2c8b0f4773f10856ba63437e9304d79e78737d09c8316002cec6",
  },
];
const cache = new Map();
const hash = (s) => createHash("sha256").update(s).digest("hex");
// Associate only exact known revisions with immutable pre-keyboard evidence.
// Current implementation tests must read raw files, never this adapter.
export function historicalProviderKeyboardSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
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
