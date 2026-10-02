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
test("P49 review rejects image traversal, URLs and unknown sections", () => {
  for (const file of ["../x.png", "x/y.png", 'x\".png', "https://x.png", "x.svg", "x.png?x"])
    assert.throws(() => acceptanceReviewImagePath("page", file));
  assert.throws(() => acceptanceReviewImagePath("__proto__", "x.png"));
  assert.equal(acceptanceReviewImagePath("page", "390-default.png"), "page/390-default.png");
});

test("P49 review binds 143 captured images and distinguishes confirmed from unverified sources", async () => {
  const { html, summary } = await buildAcceptanceReviewR2(process.cwd());
  assert.equal(summary.pictures, 143);
  assert.equal(summary.userReview, "pending");
  assert.equal(summary.visualApproval.label, "user-approved-remaining-pages-auto");
  assert.equal(
    summary.visualApproval.source,
    "design-plans/ui-phase-2-2026-09-07/action-reviews/P49.json",
  );
  assert.match(summary.visualApproval.sha256, /^[a-f0-9]{64}$/);
  assert.equal(summary.sections.length, 5);
  assert.equal(summary.sourceMatchesCurrent, false);
  for (const section of summary.sections) {
    assert.equal(section.sourceMatchesCurrent, false);
    assert.ok(section.sourceChanges.length > 0);
    for (const change of section.sourceChanges) {
      assert.match(change.capturedSha, /^[a-f0-9]{64}$/);
      assert.match(change.currentSha, /^[a-f0-9]{64}$/);
      assert.ok(
        [
          "captured-git-source",
          "locked-patch-reconstruction",
          "capture-source-unverified",
        ].includes(change.lineage),
      );
      if (change.lineage === "capture-source-unverified") assert.equal(change.capturedCommit, null);
      else assert.match(change.capturedCommit, /^[a-f0-9]{40}$/);
      assert.equal(change.currentCommit, "not-resolved");
    }
  }
  assert.equal(html, readFileSync(`${acceptanceCaptureRoot}/index.html`, "utf8"));
  assert.deepEqual(
    summary,
    JSON.parse(readFileSync(`${acceptanceCaptureRoot}/review.json`, "utf8")),
  );
  assert.match(html, /现有导航壳尚未重构/);
  assert.match(html, /提交双反馈与缓存返回修复仍是提案/);
  assert.match(html, /项无法按当前溯源规则确认/);
  assert.match(html, /原图未重拍/);
  assert.match(html, /视觉方向已按用户授权通过/);
  assert.match(html, /动作批准、当前源码实现、真实权限与生产验收仍未通过/);
  assert.doesNotMatch(html, /此组仍待审核|捕获版本 · r2 · 待审核/);
  assert.doesNotMatch(html, /当前源码提案/);
  assert.doesNotMatch(html, /<script|<form|http[s]?:\/\//);
  assert.equal((html.match(/<figure>/g) ?? []).length, 145);
  assert.equal((html.match(/<summary>/g) ?? []).length, 5);
});

test("P49 capture verifier rejects unknown source and revision drift without altering images", () => {
  const file = "apps/web/src/components/ProviderAdapterCenter.vue";
  const current = readFileSync(file, "utf8");
  const change = verifyAcceptanceCapturedSource(
    file,
    "51c0ba1f86fa1179fcb0d25b9cb327ef8a38f34b0cef53d5a916f0ef2f92a2ee",
    current,
  );
  assert.equal(change.lineage, "locked-patch-reconstruction");
  assert.match(change.capturedCommit, /^[a-f0-9]{40}$/);
  assert.deepEqual(
    verifyAcceptanceCapturedSource(
      file,
      change.capturedSha,
      current.replaceAll("\r\n", "\n").replaceAll("\n", "\r\n"),
    ),
    change,
  );
  assert.throws(() =>
    verifyAcceptanceCapturedSource(
      "apps/web/src/components/Other.vue",
      change.capturedSha,
      current,
    ),
  );
  assert.throws(() => verifyAcceptanceCapturedSource(file, "0".repeat(64), current));
  for (const drifted of [current + "\n", current.replace("<script", "<script ")]) {
    const verifiedDrift = verifyAcceptanceCapturedSource(file, change.capturedSha, drifted);
    assert.equal(verifiedDrift.lineage, "locked-patch-reconstruction");
    assert.notEqual(verifiedDrift.currentSha, verifiedDrift.capturedSha);
  }
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
