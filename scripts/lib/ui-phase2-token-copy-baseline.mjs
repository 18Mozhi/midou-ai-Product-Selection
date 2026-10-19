import {
  beforePublishedPresentation,
  publishedPresentationRevisions,
} from "./ui-phase2-published-presentation-baseline.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Historical capture/diagnosis only, never a substitute for current runtime acceptance.
export const tokenCopyBaseline = "b4fc398d9b696b1a9922e284d12d792ea7852265";
export const tokenCopyComponent = "apps/web/src/components/OrganizationTokenPanel.vue";
export const tokenCopyRevisions = {
  "scripts/lib/ui-phase2-org-token-design-data.mjs": {
    before: "408840ae6f80aa140d617544bdae231a418fe449ec6d96b9fa03402f3a2fe135",
    // Exact current evidence-model delta: retain the original OG-G05 model while
    // representing the newer write/read receipt state without changing the UI.
    after: "0d0db09e6c418a0e4700c67847f8e8fa443a4d6df6146d644a98f352cdcb9a4f",
  },
  [tokenCopyComponent]: {
    before: "81ba6a86c80bdcdb1cfea7832b3c13b0d85a5a9bf8dd6922583a5ada5d0e326d",
    after: "f1e3167ae749d8e7c3469fe6a3b766793f68838feda467eb5010bb8bf4c4669c",
  },
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
const cache = new Map();
const committedSourceCache = new Map();
const captureSourceCache = new Map();
export function historicalTokenCopySource(file, source) {
  source = beforePublishedPresentation(file, source);
  const revision = tokenCopyRevisions[file];
  if (!revision || hash(source) === revision.before) return source;
  assert.equal(hash(source), revision.after, `Unreviewed token copy source: ${file}`);
  if (!cache.has(file)) {
    const old = execFileSync("git", ["show", `${tokenCopyBaseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), revision.before, `Historical token source drift: ${file}`);
    cache.set(file, old);
  }
  return cache.get(file);
}

// Read versions in bounded Git batches. Repeated checks still verify the
// complete transformed bytes; cached history never substitutes a current hash.
function committedSources(file) {
  if (committedSourceCache.has(file)) return committedSourceCache.get(file);
  const commits = execFileSync("git", ["log", "--all", "--format=%H", "--", file], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  if (!commits.length) return [];
  const sources = readCommittedSourceBatches(file, commits);
  committedSourceCache.set(file, sources);
  return sources;
}

export function readCommittedSourceBatches(
  file,
  commits,
  execute = execFileSync,
  batchByteBudget = 32 * 1024 * 1024,
) {
  if (!commits.length) return [];
  const maxBuffer = 64 * 1024 * 1024;
  assert.ok(
    Number.isSafeInteger(batchByteBudget) && batchByteBudget > 0 && batchByteBudget <= maxBuffer,
  );
  const metadata = execute("git", ["cat-file", "--batch-check"], {
    input: commits.map((commit) => `${commit}:${file}\n`).join(""),
    maxBuffer,
  })
    .toString("utf8")
    .trimEnd()
    .split("\n");
  assert.equal(metadata.length, commits.length, "Incomplete historical Git metadata");
  const batches = [];
  let batch = [];
  let batchBytes = 0;
  for (const [index, commit] of commits.entries()) {
    const header = metadata[index];
    const missing = header === `${commit}:${file} missing`;
    const match = /^([a-f0-9]{40,64}) blob (\d+)$/.exec(header);
    assert.ok(missing || match, "Unexpected historical Git metadata");
    const size = missing ? 0 : Number(match[2]);
    const bytes = Buffer.byteLength(header) + 1 + (missing ? 0 : size + 1);
    assert.ok(Number.isSafeInteger(size) && size >= 0 && bytes <= maxBuffer);
    if (batch.length && batchBytes + bytes > batchByteBudget) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push({ commit, header });
    batchBytes += bytes;
  }
  if (batch.length) batches.push(batch);
  const sources = [];
  for (const batch of batches) {
    const bytes = execute("git", ["cat-file", "--batch"], {
      input: batch.map(({ commit }) => `${commit}:${file}\n`).join(""),
      maxBuffer,
    });
    let offset = 0;
    for (const { commit, header: expectedHeader } of batch) {
      const end = bytes.indexOf(10, offset);
      assert.ok(end >= offset, "Incomplete historical Git header");
      const header = bytes.subarray(offset, end).toString("utf8");
      assert.equal(header, expectedHeader, "Historical Git metadata changed");
      offset = end + 1;
      if (header === `${commit}:${file} missing`) continue;
      const match = /^([a-f0-9]{40,64}) blob (\d+)$/.exec(header);
      assert.ok(match, "Unexpected historical Git object");
      const size = Number(match[2]);
      assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + size < bytes.length);
      assert.equal(bytes[offset + size], 10, "Incomplete historical Git blob");
      sources.push(
        bytes
          .subarray(offset, offset + size)
          .toString("utf8")
          .replaceAll("\r\n", "\n"),
      );
      offset += size + 1;
    }
    assert.equal(offset, bytes.length, "Unexpected trailing historical Git bytes");
  }
  return sources;
}

export function assertCaptureSourceRevision(
  file,
  source,
  expectedHash,
  transform = (value) => value,
) {
  const normalized = source.replaceAll("\r\n", "\n");
  const currentCandidates = [normalized];
  try {
    currentCandidates.push(historicalTokenCopySource(file, normalized));
  } catch {
    // Older capture inputs may predate changes outside the reviewed token-copy delta.
  }
  if (currentCandidates.some((candidate) => hash(transform(candidate)) === expectedHash)) return;
  const found = committedSources(file).some((captured) => {
    try {
      if (hash(transform(captured)) === expectedHash) return true;
      return hash(transform(historicalTokenCopySource(file, captured))) === expectedHash;
    } catch {
      // Unknown historical deltas cannot satisfy this exact capture binding.
      return false;
    }
  });
  assert.equal(found, true, `capture-time source is not present in Git history: ${file}`);
}

export function assertCurrentSourceRevision(file, source) {
  const registered = publishedPresentationRevisions[file];
  if (registered && hash(source.replaceAll("\r\n", "\n")) === registered.current) return;
  const head = execFileSync("git", ["show", `HEAD:${file}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).replaceAll("\r\n", "\n");
  assert.equal(source.replaceAll("\r\n", "\n"), head, `current source differs from HEAD: ${file}`);
}

export function readCaptureSourceRevision(file, expectedHash, transform = (value) => value) {
  const key = `${file}:${expectedHash}`;
  const cached = captureSourceCache.get(key);
  if (cached && hash(transform(cached)) === expectedHash) return cached;
  for (const captured of committedSources(file)) {
    try {
      if (hash(transform(captured)) === expectedHash) {
        captureSourceCache.set(key, captured);
        return captured;
      }
    } catch {
      // A transformation may only apply to its explicitly registered revision.
    }
  }
  assert.fail(`capture-time source is not present in Git history: ${file}`);
}

/** Immutable evidence bytes, not current-UI approval. Ignored build inputs may
 * still exist verbatim; changed or retired files require an exact Git version. */
export function readEvidenceSourceBytes(file, expectedHash) {
  if (existsSync(file)) {
    const bytes = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
    if (hash(bytes) === expectedHash) return bytes;
  }
  return readCaptureSourceRevision(file, expectedHash);
}
