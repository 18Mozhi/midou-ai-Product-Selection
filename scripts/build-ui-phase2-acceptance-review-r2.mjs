import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildAcceptanceReviewR2 } from "./lib/ui-phase2-acceptance-review-r2.mjs";
import { acceptanceCaptureRoot } from "./lib/ui-phase2-acceptance-current-capture.mjs";
assert.equal(process.argv.length, 3, "Use --write or --check");
const mode = process.argv[2];
assert.ok(["--write", "--check"].includes(mode));
const result = await buildAcceptanceReviewR2(process.cwd());
for (const [file, value] of [
  ["index.html", result.html],
  ["review.json", JSON.stringify(result.summary, null, 2) + "\n"],
]) {
  const target = `${acceptanceCaptureRoot}/${file}`;
  if (mode === "--write") await writeFile(target, value);
  else assert.equal(await readFile(target, "utf8"), value, "Review index/version status is stale");
}
console.log(
  JSON.stringify({
    mode,
    pictures: result.summary.pictures,
    sourceMatchesCurrent: result.summary.sourceMatchesCurrent,
    sections: result.summary.sections.map(
      ({ stage, count, sources, runs, checks, sourceChanges }) => ({
        stage,
        count,
        sources,
        runs,
        checks,
        changedSources: sourceChanges.length,
      }),
    ),
  }),
);
