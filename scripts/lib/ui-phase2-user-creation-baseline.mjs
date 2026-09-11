import assert from "node:assert/strict";
import { historicalPasswordSource } from "./ui-phase2-password-baseline.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const userCreationBaseline = "01af0262";
export const userCreationRevisions = {
  "apps/web/src/components/PlatformAccountCenter.vue": {
    before: "3ac56e41a5f5b78a4f01d6ee4298dacd0c80f243f414a7a48de8105eb292aa76",
    after: "ec3f2b6535f9625c3fd5d1c3542679ff8887bf65b727e5696b556945a45a861f",
  },
  "scripts/lib/ui-phase2-organization-action-baseline.mjs": {
    before: "fb7ae644405df28b8f8dac2173d1e5945d76de9bf54e4e82f47156866631237b",
    after: "120bf0d7417c51e38c31b8dc38f009a32feb5553bcae49e6064c680fd178ba47",
  },
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
const cache = new Map();
// For old captures only. Current regression checks must read the real source directly.
export function historicalUserCreationSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = userCreationRevisions[file];
  if (!revision || hash(source) === revision.before) return source;
  source = historicalPasswordSource(file, source);
  assert.equal(hash(source), revision.after, `Unreviewed user creation source: ${file}`);
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `${userCreationBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), revision.before, `Historical creation source drift: ${file}`);
    cache.set(file, old);
  }
  return cache.get(file);
}
