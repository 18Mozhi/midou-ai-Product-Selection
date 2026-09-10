import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { auditParentFile, undoAuditPageDelta } from "./lib/ui-phase2-audit-page-delta.mjs";
import { capturedExportDetailHash } from "./lib/ui-phase2-export-detail-token-delta.mjs";

const write = process.argv.includes("--write");
assert.ok(process.argv.slice(2).every((v) => v === "--write"));
const journalFile = "design-plans/ui-phase-2-2026-09-07/P37-PAGINATION-SOURCE-ASSOCIATIONS.json";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const text = async (f) => (await readFile(f, "utf8")).replaceAll("\r\n", "\n");
const serialized = (v) => JSON.stringify(v, null, 2) + "\n";
let prior;
try {
  prior = JSON.parse(await text(journalFile));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const proofDir = "output/playwright/p37-parent-read-vue-r2/";
const proof = JSON.parse(await text(proofDir + "evidence.json"));
assert.equal(proof.kind, "P37-PARENT-READ-VUE-r2");
assert.equal(proof.acceptanceComplete, false);
for (const [f, sha] of Object.entries(proof.sourceHashes))
  assert.equal(capturedExportDetailHash(f, await text(f)), sha, f);
for (const s of proof.screenshots)
  assert.equal(hash(await readFile(proofDir + s.file)), s.sha256, s.file);
const copyProof = JSON.parse(await text("output/playwright/p37-copy-ownership-vue/evidence.json"));
const changedSources = [
  auditParentFile,
  "scripts/lib/ui-phase2-org-audit-design-data.mjs",
  "scripts/lib/ui-phase2-audit-copy-baseline.mjs",
];
const sourceChanges = Object.fromEntries(
  await Promise.all(
    changedSources.map(async (f) => [
      f,
      {
        before: prior?.sourceChanges[f].before ?? copyProof.sourceHashes[f],
        after: hash(await text(f)),
      },
    ]),
  ),
);
assert.equal(
  hash(undoAuditPageDelta(await text(auditParentFile))),
  sourceChanges[auditParentFile].before,
  "Exact audit pagination delta; no other parent changes",
);
if (prior)
  assert.deepEqual(sourceChanges, prior.sourceChanges, "Source changed since pagination proof");
const files = [];
async function find(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = dir + "/" + item.name;
    if (item.isDirectory()) await find(file);
    else if (item.isFile() && item.name === "evidence.json") files.push(file);
  }
}
await find("design-plans/ui-phase-2-2026-09-07/design");
await find("output/playwright");
const frozen = new Set([
  "output/playwright/p34-first-failure-vue/evidence.json",
  "output/playwright/p37-parent-read-vue/evidence.json",
  "output/playwright/p36-parent-read-vue/evidence.json",
  proofDir + "evidence.json",
  "output/playwright/p35-export-token-equivalence/evidence.json",
]);
const originals = new Map(),
  current = new Map(),
  originalHashes = new Map();
function at(value, keys) {
  for (const k of keys) value = value[k];
  return value;
}
function set(value, keys, item) {
  for (const k of keys.slice(0, -1)) value = value[k];
  value[keys.at(-1)] = item;
}
for (const file of files.sort()) {
  const raw = await text(file),
    value = JSON.parse(raw),
    original = structuredClone(value),
    entry = prior?.entries.find((v) => v.file === file);
  if (entry) {
    assert.equal(hash(raw), entry.afterHash, file);
    for (const change of entry.changes) {
      assert.deepEqual(at(original, change.keys), change.after);
      set(original, change.keys, change.before);
    }
    assert.equal(hash(serialized(original)), entry.beforeHash, file);
  } else
    assert.equal(
      serialized(original),
      raw,
      `Noncanonical manifest requires explicit review: ${file}`,
    );
  originals.set(file, original);
  current.set(file, value);
  originalHashes.set(file, hash(serialized(original)));
}
function advanceSources(file, original) {
  const next = structuredClone(original);
  if (frozen.has(file)) return next;
  for (const [f, pair] of Object.entries(sourceChanges))
    if (Object.hasOwn(next.sourceHashes ?? {}, f)) {
      assert.equal(next.sourceHashes[f], pair.before, `Unknown prior source ${file}: ${f}`);
      next.sourceHashes[f] = pair.after;
    }
  const a = next.sourceAssociation;
  if (a?.proof && sourceChanges[a.proof]) {
    assert.equal(a.proofHash, sourceChanges[a.proof].before);
    a.proofHash = sourceChanges[a.proof].after;
  }
  return next;
}
function advanceReferences(value, translations) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (/historical|original|baseline|previous/i.test(key)) continue;
    if (
      typeof item === "string" &&
      /manifest|evidenceHash|evidence\.json$/i.test(key) &&
      translations.has(item)
    )
      value[key] = translations.get(item);
    else if (typeof item === "object") advanceReferences(item, translations);
  }
}
let drafts = new Map([...originals].map(([file, old]) => [file, advanceSources(file, old)]));
for (let iteration = 0; ; iteration++) {
  assert.ok(iteration < files.length, "Manifest reference cycle");
  const translations = new Map(
    [...drafts].map(([file, value]) => [originalHashes.get(file), hash(serialized(value))]),
  );
  const next = new Map(
    [...originals].map(([file, old]) => {
      const value = advanceSources(file, old);
      if (!frozen.has(file)) advanceReferences(value, translations);
      return [file, value];
    }),
  );
  if ([...next].every(([file, value]) => serialized(value) === serialized(drafts.get(file)))) {
    drafts = next;
    break;
  }
  drafts = next;
}
function differences(before, after, keys = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    assert.deepEqual(
      Object.keys(before),
      Object.keys(after),
      "Association may only change existing leaf values",
    );
    return Object.keys(before).flatMap((k) => differences(before[k], after[k], [...keys, k]));
  }
  return [{ keys, before, after }];
}
const entries = [];
let images = 0;
for (const [file, next] of drafts) {
  const original = originals.get(file),
    changes = differences(original, next);
  if (!changes.length) continue;
  assert.deepEqual(next.screenshots, original.screenshots, "Never recapture historical PNG");
  for (const s of original.screenshots ?? []) {
    assert.equal(hash(await readFile(path.join(path.dirname(file), s.file))), s.sha256, s.file);
    images++;
  }
  entries.push({
    file,
    beforeHash: originalHashes.get(file),
    afterHash: hash(serialized(next)),
    images: original.screenshots?.length ?? 0,
    changes,
  });
}
const journal = {
  kind: "P37-PAGINATION-SOURCE-ASSOCIATION",
  scope:
    "Exact loadAuditPage-only guard; inherited source hashes and retained-manifest links, no image/approval/content rewrites. Historical P36/P37 problem packages remain frozen.",
  proofFile: "scripts/lib/ui-phase2-audit-page-delta.mjs",
  proofHash: hash(await text("scripts/lib/ui-phase2-audit-page-delta.mjs")),
  runtimeProof: proofDir + "evidence.json",
  runtimeProofHash: hash(await text(proofDir + "evidence.json")),
  sourceChanges,
  entries,
};
if (prior && !write) assert.deepEqual(journal, prior);
if (prior && write)
  for (const old of prior.entries)
    assert.equal(entries.find((e) => e.file === old.file)?.beforeHash, old.beforeHash);
if (write) {
  for (const e of entries) await writeFile(e.file, serialized(drafts.get(e.file)));
  await writeFile(journalFile, serialized(journal));
} else {
  assert.ok(prior, "Run --write after passing current browser proof");
  for (const e of entries) assert.deepEqual(current.get(e.file), drafts.get(e.file), e.file);
}
console.log(
  JSON.stringify({ write, manifests: entries.length, imagesRetained: images, imagesRewritten: 0 }),
);
