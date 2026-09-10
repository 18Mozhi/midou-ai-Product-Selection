import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { auditParentFile, undoAuditPageDelta } from "./ui-phase2-audit-page-delta.mjs";

// Frozen historical evidence is replayed against its original source, never relabelled
// as current acceptance. Only these exact reviewed revisions may use this association.
export const auditCopyBaseline = "c380b995b3a6d55d7f1742dc42baf9479be0e8e7";
export const auditCopyFile = "apps/web/src/components/OrganizationAuditPanel.vue";
export const auditFixtureFile = "scripts/lib/ui-phase2-org-audit-design-data.mjs";
const parentVerifier = "scripts/verify-ui-phase2-org-audit-parent-read.mjs";
export const auditCopyRevisions = {
  [auditCopyFile]: [
    "b0f7e9452a81914dfa71c3812765f93726804d2ed1e56494e9004314a6f8ac7a",
    "34b990c4ba86043b098d41dd295f48504177ace16c0ae63693e2b3ffe420ff79",
  ],
  [auditFixtureFile]: [
    "f4e417f89d9a63c3b4067ead1ae0ee6f12536432368326c7fe0eb620f4fe7aa1",
    "1d920bd23768d112aaa833d48b5b66fdc333e5e806ea9d6f2077628348ef5ab0",
  ],
  [parentVerifier]: [
    "274d3405dfba7b08f62f8a00ae3f1afecd56bdf5837b0c0b47abc0115f7574c5",
    "83bcb48bbc390e0adf59a28784c23dcca6076ce0dc92f1316d435bcebc8a7ff9",
  ],
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cache = new Map();
export function historicalAuditSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  if (file === auditParentFile) return undoAuditPageDelta(source);
  const pair = auditCopyRevisions[file];
  if (!pair || hash(source) === pair[0]) return source;
  assert.equal(hash(source), pair[1], `Unreviewed P37 source delta: ${file}`);
  if (cache.has(file)) return cache.get(file);
  let old;
  if (file !== parentVerifier) {
    old = execFileSync("git", ["show", `${auditCopyBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
  } else {
    old = source
      .replace(
        String.raw`        if (id.replaceAll("\\", "/").endsWith("/src/components/OrganizationAdminCenter.vue"))
          return historicalAuditSource(
            "apps/web/src/components/OrganizationAdminCenter.vue",
            source,
          );
`,
        "",
      )
      .replace(
        'import { historicalAuditSource } from "./lib/ui-phase2-audit-copy-baseline.mjs";\n',
        "",
      )
      .replace(
        'console.log(\n  "P37 historical baseline replay only; current copy repair is verified separately by verify-ui-phase2-org-audit-copy.mjs",\n);\n',
        "",
      )
      .replace(
        String.raw`      transform(source, id) {
        if (id.replaceAll("\\", "/").endsWith("/src/components/OrganizationAuditPanel.vue"))
          return historicalAuditSource(
            "apps/web/src/components/OrganizationAuditPanel.vue",
            source,
          );
      },
`,
        "",
      )
      .replace(
        String.raw`      files.map(async (f) => [
        f,
        digest(historicalAuditSource(f, (await readFile(f, "utf8")).replaceAll("\r\n", "\n"))),
      ]),`,
        String.raw`      files.map(async (f) => [f, digest((await readFile(f, "utf8")).replaceAll("\r\n", "\n"))]),`,
      );
  }
  assert.equal(hash(old), pair[0], `Historical P37 source mismatch: ${file}`);
  cache.set(file, old);
  return old;
}
