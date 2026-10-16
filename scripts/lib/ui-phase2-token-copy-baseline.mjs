import {
  beforePublishedPresentation,
  publishedPresentationRevisions,
} from "./ui-phase2-published-presentation-baseline.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

// Read versions in one bounded Git batch. Repeated checks still verify the
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
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: commits.map((commit) => `${commit}:${file}\n`).join(""),
    maxBuffer: 64 * 1024 * 1024,
  });
  const sources = [];
  let offset = 0;
  for (const commit of commits) {
    const end = bytes.indexOf(10, offset);
    assert.ok(end >= offset, "Incomplete historical Git header");
    const header = bytes.subarray(offset, end).toString("utf8");
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
  committedSourceCache.set(file, sources);
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
