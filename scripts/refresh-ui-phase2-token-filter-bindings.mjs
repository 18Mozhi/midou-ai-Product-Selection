import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  assertTokenFilterDelta,
  tokenFilterBaseline as baselineCommit,
  tokenComponent,
} from "./lib/ui-phase2-token-filter-delta.mjs";
import { undoTokenQuerySync } from "./lib/ui-phase2-token-query-delta.mjs";
import { historicalTokenCopySource } from "./lib/ui-phase2-token-copy-baseline.mjs";
import {
  readBeforeAuditPage,
  hasAuditPageAssociations,
} from "./lib/ui-phase2-audit-page-evidence.mjs";

const write = process.argv.includes("--write");
assert.ok(process.argv.slice(2).every((v) => v === "--write"));
assert.ok(
  !write || !hasAuditPageAssociations(),
  "Historical P36 writer is frozen; use refresh-ui-phase2-audit-page-bindings.mjs for current associations",
);
const hash = (v) => createHash("sha256").update(v).digest("hex");
// Frozen historical association audit. Never relabel it as current acceptance.
const text = async (f) => historicalTokenCopySource(f, readBeforeAuditPage(f));
const baseline = (f) =>
  execFileSync("git", ["show", `${baselineCommit}:${f}`], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).replaceAll("\r\n", "\n");
const current = await text(tokenComponent),
  oldSource = baseline(tokenComponent);
assertTokenFilterDelta(current, oldSource);
const actual = JSON.parse(await text("output/playwright/p36-mobile-filters-vue/evidence.json"));
assert.equal(actual.baselineCommit, baselineCommit);
assert.deepEqual([...new Set(actual.checks.map((c) => c.width))], [390, 760, 761, 1440]);
for (const [f, sha] of Object.entries(actual.sourceHashes))
  assert.equal(hash(await text(f)), sha, f);
for (const s of actual.screenshots)
  assert.equal(
    hash(await readFile(`output/playwright/p36-mobile-filters-vue/${s.file}`)),
    s.sha256,
  );
const dirs = [
  "design-plans/ui-phase-2-2026-09-07/design/org-token-direction-c",
  "output/playwright/p36-controls-review",
  "output/playwright/p36-fields-review",
];
const serialized = new Map();
const legacySerialized = new Map();
let pngCount = 0;
for (const dir of dirs) {
  const file = `${dir}/evidence.json`,
    old = JSON.parse(baseline(file)),
    now = JSON.parse(await text(file)),
    next = structuredClone(old);
  assert.equal(old.sourceHashes[tokenComponent], hash(oldSource));
  for (const [f, sha] of Object.entries(old.sourceHashes))
    if (f !== tokenComponent) assert.equal(hash(await text(f)), sha, f);
  for (const s of old.screenshots)
    assert.equal(hash(await readFile(`${dir}/${s.file}`)), s.sha256, s.file);
  pngCount += old.screenshots.length;
  next.sourceHashes[tokenComponent] = hash(current);
  next.sourceAssociation = {
    baselineCommit,
    kind: "exact-template-help-and-mobile-CSS-only",
    script: "unchanged",
    models: "capture-time-attributes-retained",
    approval: "unchanged",
    proof: "scripts/lib/ui-phase2-token-filter-delta.mjs",
  };
  const legacy = structuredClone(next);
  legacy.sourceHashes[tokenComponent] = hash(undoTokenQuerySync(current));
  next.sourceAssociation.kind = "exact-mobile-presentation-and-query-sync-only";
  next.sourceAssociation.script = "query-sync-only";
  next.sourceAssociation.queryProof = "scripts/lib/ui-phase2-token-query-delta.mjs";
  if (next.retained)
    for (const [retainedDir, r] of Object.entries(next.retained))
      r.manifest = hash(serialized.get(`${retainedDir}/evidence.json`));
  if (legacy.retained)
    for (const [retainedDir, r] of Object.entries(legacy.retained))
      r.manifest = hash(legacySerialized.get(`${retainedDir}/evidence.json`));
  legacySerialized.set(file, JSON.stringify(legacy, null, 2) + "\n");
  // Existing evidence may be original or exactly this authorized association, never arbitrary drift.
  if (JSON.stringify(now) !== JSON.stringify(old) && JSON.stringify(now) !== JSON.stringify(legacy))
    assert.deepEqual(now, next, file);
  const content = JSON.stringify(next, null, 2) + "\n";
  serialized.set(file, content);
  if (!write) assert.deepEqual(now, next, file);
}
if (write) for (const [file, content] of serialized) await writeFile(file, content);
console.log(
  JSON.stringify({
    manifests: serialized.size,
    pngCount,
    write,
    pngRewritten: 0,
    scriptUnchanged: false,
    querySyncOnly: true,
  }),
);
