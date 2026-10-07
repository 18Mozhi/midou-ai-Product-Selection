import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseProviderCaptureBlobs } from "./ui-phase2-provider-historical-capture.mjs";

// P37 packets are immutable snapshots. Their source files are retrieved from the
// exact commits that contain those packets, never inferred from current HEAD.
export const p37SourceRevisions = Object.freeze({
  baseline: "c380b995b3a6d55d7f1742dc42baf9479be0e8e7",
  capture: "df4b7263b1684e94e4ecc8d46c856c202fd9ee7b",
});

const sourceCache = new Map();
const historyCache = new Map();
const hash = (source) => createHash("sha256").update(source).digest("hex");
const normalize = (source) => source.replaceAll("\r\n", "\n");

function revisionId(revision) {
  assert.ok(Object.hasOwn(p37SourceRevisions, revision), "Unknown P37 source snapshot");
  return p37SourceRevisions[revision];
}

function safePath(file) {
  assert.ok(
    typeof file === "string" &&
      file.length > 0 &&
      !file.includes("\\") &&
      !file.startsWith("/") &&
      !file.split("/").includes("..") &&
      !/[\r\n]/.test(file),
    "Invalid P37 source path",
  );
  return file;
}

export function p37SourceAt(revision, file) {
  const commit = revisionId(revision),
    path = safePath(file),
    key = `${commit}:${path}`;
  if (!sourceCache.has(key)) {
    const source = execFileSync("git", ["show", key], { encoding: "utf8" });
    sourceCache.set(key, normalize(source));
  }
  return sourceCache.get(key);
}

function sourceVersions(file) {
  const path = safePath(file);
  if (!historyCache.has(path)) {
    const commits = execFileSync(
      "git",
      ["log", "--all", "--format=%H", "--diff-filter=AM", "--", path],
      { encoding: "utf8" },
    )
      .split(/\r?\n/)
      .filter(Boolean);
    assert.ok(commits.length, `P37 source has no committed Git history: ${path}`);
    const paths = commits.map((commit) => `${commit}:${path}`);
    const blobs = parseProviderCaptureBlobs(
      execFileSync("git", ["cat-file", "--batch"], {
        input: paths.map((key) => `${key}\n`).join(""),
        maxBuffer: 128 * 1024 * 1024,
      }),
      paths,
    );
    historyCache.set(path, [
      ...new Set([...blobs.values()].map((bytes) => normalize(bytes.toString("utf8")))),
    ]);
  }
  return historyCache.get(path);
}

// Resolve recorded source bytes only from committed history. Optional normalization
// must be a narrowly specified, separately tested transform.
export function p37SourceMatchingHash(file, expectedHash, transform = (_file, source) => source) {
  const matches = new Set();
  for (const source of sourceVersions(file))
    try {
      if (hash(transform(file, source)) === expectedHash) matches.add(source);
    } catch {
      // A narrow transform can apply to only some historical source versions.
    }
  assert.equal(matches.size, 1, `P37 source fingerprint has no unique Git snapshot: ${file}`);
  return [...matches][0];
}
