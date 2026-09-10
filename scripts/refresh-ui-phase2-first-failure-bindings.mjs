import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  firstFailureBaseline,
  firstFailureParent,
  assertFirstFailureParentDelta,
} from "./lib/ui-phase2-first-failure-retention.mjs";

const write = process.argv.includes("--write");
assert.ok(process.argv.slice(2).every((a) => a === "--write"));
const lf = (s) => s.replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const oldText = (file) =>
  execFileSync("git", ["show", `${firstFailureBaseline}:${file}`], {
    encoding: "utf8",
    maxBuffer: 4000000,
  });
const read = (file) => readFile(file, "utf8");
assertFirstFailureParentDelta(oldText(firstFailureParent), await read(firstFailureParent));
const actualVerifier = "scripts/verify-ui-phase2-org-approvals-parent.mjs";
let verifier = lf(await read(actualVerifier));
for (const fragment of [
  '    "components/OrganizationApprovalFirstFailure.vue",\n',
  '    "approval-read-failure.css",\n',
  '    "design/approval-read-failure-tokens.css",\n',
]) {
  assert.equal(verifier.split(fragment).length, 2);
  verifier = verifier.replace(fragment, "");
}
assert.equal(
  verifier,
  lf(oldText(actualVerifier)),
  "Actual parent verifier may only add transitive source bindings",
);
const actualProof = "output/playwright/p34-parent-read-states/evidence.json";
const profileHarness = "scripts/lib/ui-phase2-organization-profile-design-data.mjs";
const harness = lf(await read(profileHarness));
const statusRef = '          "lastReadFailureStatus",\n';
assert.equal(harness.split(statusRef).length, 2);
assert.equal(
  harness.replace(statusRef, ""),
  lf(oldText(profileHarness)),
  "Only the new presentation ref may be added to the inert harness",
);
const known = [firstFailureParent, actualVerifier, actualProof, profileHarness];
const deltas = Object.fromEntries(
  await Promise.all(
    known.map(async (file) => [
      file,
      { before: hash(lf(oldText(file))), after: hash(lf(await read(file))) },
    ]),
  ),
);
const mounted = JSON.parse(await read("output/playwright/p34-first-failure-vue/evidence.json"));
assert.equal(mounted.baselineCommit, firstFailureBaseline);
assert.equal(mounted.checks.filter((c) => c.name.endsWith("pixels unchanged")).length, 52);
for (const [file, sha] of Object.entries(mounted.sourceHashes))
  assert.equal(hash(lf(await read(file))), sha, file);
const refreshed = [],
  checked = [];
const folders = [
  ...(await readdir("design-plans/ui-phase-2-2026-09-07/design", { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name.includes("-direction-c"))
    .map((e) => `design-plans/ui-phase-2-2026-09-07/design/${e.name}`),
  "output/playwright/p31-approved-controls-review",
  "output/playwright/p32-approved-restore-review",
  "output/playwright/p34-permission-tone-r2",
];
const candidates = new Map();
for (const folder of folders) {
  const file = `${folder}/evidence.json`,
    e = JSON.parse(await read(file));
  if (!e.sourceHashes?.[firstFailureParent]) continue;
  const originalText = lf(oldText(file)),
    original = JSON.parse(originalText);
  assert.deepEqual(
    { ...e, sourceHashes: null },
    { ...original, sourceHashes: null },
    `Changed historical evidence: ${file}`,
  );
  assert.deepEqual(
    Object.keys(e.sourceHashes),
    Object.keys(original.sourceHashes),
    `Changed binding set: ${file}`,
  );
  for (const s of e.screenshots || []) {
    const image = path.resolve(folder, s.file);
    assert.ok(image.startsWith(path.resolve(folder) + path.sep));
    assert.equal(hash(await readFile(image)), s.sha256, image);
  }
  checked.push({ file, screenshots: e.screenshots?.length ?? 0 });
  candidates.set(file, { current: e, original, originalText });
}
const planned = new Map(),
  visiting = new Set();
async function planBinding(file) {
  if (planned.has(file)) return planned.get(file);
  assert.ok(!visiting.has(file), `Cyclic evidence binding: ${file}`);
  visiting.add(file);
  const item = candidates.get(file),
    next = structuredClone(item.original),
    changes = [];
  for (const [source, sha] of Object.entries(item.original.sourceHashes)) {
    let target;
    if (deltas[source]) {
      assert.equal(sha, deltas[source].before, `Unrecognized baseline: ${source}`);
      target = deltas[source].after;
    } else if (candidates.has(source)) {
      assert.equal(
        sha,
        hash(candidates.get(source).originalText),
        `Unrecognized nested evidence: ${source}`,
      );
      target = hash(await planBinding(source));
    } else {
      target = hash(lf(await read(source)));
      assert.equal(target, sha, `Unrelated source drift: ${source}`);
    }
    assert.ok(
      [sha, target].includes(item.current.sourceHashes[source]),
      `Unknown intermediate binding: ${source}`,
    );
    next.sourceHashes[source] = target;
    if (item.current.sourceHashes[source] !== target) changes.push(source);
  }
  const text = JSON.stringify(next, null, 2) + "\n";
  planned.set(file, text);
  visiting.delete(file);
  if (changes.length) refreshed.push({ file, sources: changes });
  return text;
}
// Validate the whole dependency graph before any write; resume only exact known intermediate hashes.
for (const file of candidates.keys()) await planBinding(file);
if (write) for (const { file } of refreshed) await writeFile(file, planned.get(file));
if (!write)
  assert.equal(
    refreshed.length,
    0,
    "Run --write after reviewing the guarded presentation-only source delta",
  );
console.log(
  JSON.stringify({
    mode: write ? "write" : "check",
    baseline: firstFailureBaseline,
    checked: checked.length,
    refreshed,
    pngBytesPreserved: true,
    authoritativeMountedPixelChecks: 52,
  }),
);
