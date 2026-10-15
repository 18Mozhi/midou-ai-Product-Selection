import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  historicalSharedReviewSource,
  historicalSharedReviewVariantSource,
  sharedReviewRevisions,
  sharedReviewVariants,
} from "../../scripts/lib/ui-phase2-shared-review-baseline.mjs";

const hash = (source) => createHash("sha256").update(source).digest("hex");
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

test("message reader revision changes only the closed-dialog assertion scope", () => {
  const source = read("tests/e2e/platform-message-management.spec.ts");
  const scoped = 'page.getByRole("dialog", { name: "长正文审核通知", exact: true })';
  assert.equal(source.split(scoped).length, 2);
  const previous = source.replace(scoped, 'page.getByRole("dialog")');
  assert.equal(hash(previous), "e778e82379e814664d85f8ad8862a36da4538db8aad539bfe8444e05d20d4c0e");
});

for (const [file, revision] of Object.entries(sharedReviewRevisions)) {
  test("shared historical review source is exact and fail-closed: " + file, () => {
    const current = read(file);
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");

    assert.equal(hash(current), revision.current);
    assert.equal(hash(captured), revision.captured);
    assert.equal(historicalSharedReviewSource(file, current), captured);
    assert.throws(() => historicalSharedReviewSource(file, current + "\n// unknown"));
  });
}

for (const [key, revision] of Object.entries(sharedReviewVariants)) {
  const split = key.lastIndexOf("#");
  const file = key.slice(0, split);
  const expected = key.slice(split + 1);
  test("shared historical review variant is exact and fail-closed: " + file, () => {
    const current = read(file);
    const captured = execFileSync("git", ["show", revision.baseline + ":" + file], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");

    assert.equal(expected, revision.captured);
    assert.equal(hash(current), revision.current);
    assert.equal(hash(captured), revision.captured);
    assert.equal(historicalSharedReviewVariantSource(file, expected, current), captured);
    assert.throws(() =>
      historicalSharedReviewVariantSource(file, expected, current + "\n// unknown"),
    );
  });
}
