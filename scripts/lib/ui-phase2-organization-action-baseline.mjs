import assert from "node:assert/strict";
import { historicalUserCreationSource } from "./ui-phase2-user-creation-baseline.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Historical source proof only. Never use this substitution for current acceptance.
export const organizationActionBaseline = "aa611c4033cfaf341730c46248beddc31c9e5f98";
export const organizationActionParent = "apps/web/src/components/PlatformAccountCenter.vue";
export const organizationActionRevisions = {
  [organizationActionParent]: {
    before: "2b41c1f174bf0a1a67c97e8252e1d805a01c559d7bcb6817da80d7affd4b3474",
    after: "3ac56e41a5f5b78a4f01d6ee4298dacd0c80f243f414a7a48de8105eb292aa76",
  },
  "scripts/lib/ui-phase2-account-overview-design-data.mjs": {
    before: "df765906f1eda3eb7c1c4158ee5e808796024df6bba3a841ce7ceaa3f2a7ba93",
    after: "296ddf796f1bfea00fa250e4d2b2127fecd5aed8c23e89662f416cd112023563",
  },
  "scripts/lib/ui-phase2-platform-organizations-design-data.mjs": {
    before: "ba14e316c24538ffad21b0ae06622546762e2c28b296f6449de41a7ccbb36c91",
    after: "98f022a75f8ec0361b0cf50f997b1cbb71dba39465e36537b3f977faa76d23c1",
  },
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
const cache = new Map();
export function historicalOrganizationActionSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const revision = organizationActionRevisions[file];
  if (!revision || hash(source) === revision.before) return source;
  source = historicalUserCreationSource(file, source);
  assert.equal(hash(source), revision.after, `Unreviewed organization action source: ${file}`);
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `${organizationActionBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), revision.before, `Historical organization source drift: ${file}`);
    cache.set(file, old);
  }
  return cache.get(file);
}
