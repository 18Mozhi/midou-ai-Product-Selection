import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const sourceHistory = new Map();
const lf = (value) => value.replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");

function revisionsFor(file) {
  if (sourceHistory.has(file)) return sourceHistory.get(file);

  const commits = execFileSync(
    "git",
    ["log", "--all", "--diff-filter=ACMRT", "--format=%H", "--", file],
    { encoding: "utf8" },
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const revisions = new Map();

  if (commits.length) {
    const objects = execFileSync("git", ["cat-file", "--batch"], {
      input: `${commits.map((commit) => `${commit}:${file}`).join("\n")}\n`,
      maxBuffer: 64 * 1024 * 1024,
    });
    let offset = 0;

    for (let index = 0; index < commits.length; index += 1) {
      const headerEnd = objects.indexOf(0x0a, offset);
      const header = objects.subarray(offset, headerEnd).toString("ascii");
      const size = Number(header.match(/ (\d+)$/)?.[1]);
      if (!Number.isInteger(size)) throw new Error(`Invalid git cat-file header: ${header}`);
      const start = headerEnd + 1;
      const source = objects.subarray(start, start + size).toString("utf8");
      const fingerprint = hash(lf(source));
      if (!revisions.has(fingerprint)) revisions.set(fingerprint, commits[index]);
      offset = start + size + 1;
    }
  }

  sourceHistory.set(file, revisions);
  return revisions;
}

// Associates old review artifacts only with exact source bytes already committed.
// It never changes evidence and does not treat a historical match as current acceptance.
export function findCommittedHistoricalRevision(file, expectedSha256) {
  return revisionsFor(file).get(expectedSha256) ?? null;
}
