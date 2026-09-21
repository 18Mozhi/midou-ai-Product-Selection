import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acceptanceReviewImagePath,
  buildAcceptanceReviewR2,
  verifyAcceptanceCapturedSource,
  verifyAcceptanceCapturedManifest,
} from "../../scripts/lib/ui-phase2-acceptance-review-r2.mjs";
import { acceptanceCaptureRoot } from "../../scripts/lib/ui-phase2-acceptance-current-capture.mjs";
import {
  beforeAdapterPaginationFocus,
  paginationFocusRevision,
} from "../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs";

test("P49 review rejects image traversal, URLs and unknown sections", () => {
  for (const file of ["../x.png", "x/y.png", 'x\".png', "https://x.png", "x.svg", "x.png?x"])
    assert.throws(() => acceptanceReviewImagePath("page", file));
  assert.throws(() => acceptanceReviewImagePath("__proto__", "x.png"));
  assert.equal(acceptanceReviewImagePath("page", "390-default.png"), "page/390-default.png");
});

test("P49 review binds 143 captured images and distinguishes verified historical sources from current", async () => {
  const { html, summary } = await buildAcceptanceReviewR2(process.cwd());
  assert.equal(summary.pictures, 143);
  assert.equal(summary.userReview, "pending");
  assert.equal(summary.sections.length, 5);
  assert.equal(summary.sourceMatchesCurrent, false);
  for (const section of summary.sections) {
    assert.equal(section.sourceMatchesCurrent, false);
    assert.deepEqual(section.sourceChanges, [
      {
        file: "apps/web/src/components/ProviderAdapterCenter.vue",
        capturedSha: paginationFocusRevision.before,
        currentSha: paginationFocusRevision.current,
        lineage: "P47-pagination-focus",
      },
    ]);
  }
  assert.equal(html, readFileSync(`${acceptanceCaptureRoot}/index.html`, "utf8"));
  assert.deepEqual(
    summary,
    JSON.parse(readFileSync(`${acceptanceCaptureRoot}/review.json`, "utf8")),
  );
  assert.match(html, /现有导航壳尚未重构/);
  assert.match(html, /提交双反馈与缓存返回修复仍是提案/);
  assert.match(html, /当前源码已有后续改动/);
  assert.match(html, /本图包未重新拍摄/);
  assert.doesNotMatch(html, /当前源码提案/);
  assert.doesNotMatch(html, /<script|<form|http[s]?:\/\//);
  assert.equal((html.match(/<figure>/g) ?? []).length, 145);
  assert.equal((html.match(/<summary>/g) ?? []).length, 5);
});

test("P49 capture verifier rejects unknown source and revision drift without altering images", () => {
  const file = "apps/web/src/components/ProviderAdapterCenter.vue";
  const current = readFileSync(file, "utf8");
  const previous = beforeAdapterPaginationFocus(current);
  assert.equal(
    verifyAcceptanceCapturedSource(file, paginationFocusRevision.before, previous),
    null,
  );
  assert.equal(
    verifyAcceptanceCapturedSource(file, paginationFocusRevision.current, current),
    null,
  );
  const change = verifyAcceptanceCapturedSource(file, paginationFocusRevision.before, current);
  assert.equal(change.currentSha, paginationFocusRevision.current);
  assert.deepEqual(
    verifyAcceptanceCapturedSource(
      file,
      paginationFocusRevision.before,
      current.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    ),
    change,
  );
  for (const [path, expected, text] of [
    ["apps/web/src/components/Other.vue", paginationFocusRevision.before, current],
    [file, "0".repeat(64), current],
    [file, paginationFocusRevision.before, current + "\n"],
    [file, paginationFocusRevision.before, current.replace("pageSize = 20", "pageSize = 10")],
  ])
    assert.throws(() => verifyAcceptanceCapturedSource(path, expected, text));
});

test("P49 all original manifests remain pinned; edits and unknown stages fail closed", () => {
  for (const stage of ["page", "read-states", "actions", "robustness", "lifecycle"]) {
    const raw = readFileSync(`${acceptanceCaptureRoot}/${stage}/evidence.json`, "utf8").replaceAll(
      "\r\n",
      "\n",
    );
    verifyAcceptanceCapturedManifest(stage, raw);
    verifyAcceptanceCapturedManifest(stage, raw.replaceAll("\n", "\r\n"));
    assert.throws(() => verifyAcceptanceCapturedManifest(stage, raw + "\n"));
    assert.throws(() =>
      verifyAcceptanceCapturedManifest(
        stage,
        raw.replace('"userReview": "pending"', '"userReview": "approved"'),
      ),
    );
    assert.throws(() => verifyAcceptanceCapturedManifest("__proto__", raw));
  }
});
