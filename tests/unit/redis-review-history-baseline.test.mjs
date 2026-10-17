import { readPreSelectionRebuild } from "../fixtures/pre-selection-rebuild-snapshot.mjs";
// Archived pre-rebuild inputs only; current UI acceptance is verified separately.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  historicalRedisReviewSource,
  redisReviewRevisions,
} from "../../scripts/lib/ui-phase2-redis-review-baseline.mjs";

const hash = (source) => createHash("sha256").update(source).digest("hex");
const read = (file) => readPreSelectionRebuild(file).replaceAll("\r\n", "\n");

for (const [file, revision] of Object.entries(redisReviewRevisions)) {
  test("Archived P67 historical review source is exact and fail-closed: " + file, () => {
    const current = read(file);
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");

    assert.equal(hash(current), revision.current);
    assert.equal(hash(captured), revision.captured);
    assert.equal(historicalRedisReviewSource(file, current), captured);
    assert.throws(() => historicalRedisReviewSource(file, current + "\n// unknown"));
  });
}
