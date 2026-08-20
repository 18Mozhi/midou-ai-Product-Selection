import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { verifyReleaseChangeOwnership } from "../../scripts/verify-release-change-ownership.mjs";

const root = process.cwd();
const git = (args, nullSeparated = false) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  assert.equal(result.status, 0, result.stderr);
  return nullSeparated
    ? result.stdout.split("\0").filter(Boolean)
    : result.stdout.split(/\r?\n/).filter(Boolean);
};

const currentRangeManifest = () => {
  const [headSha] = git(["rev-parse", "HEAD"]);
  const [baseSha] = git(["rev-parse", "HEAD~2"]);
  return {
    schemaVersion: 1,
    releaseId: "unit-release-ownership",
    baseSha,
    headSha,
    workPackages: [
      {
        id: "verified-batch",
        owner: "测试负责人",
        commits: git(["rev-list", "--reverse", `${baseSha}..${headSha}`]),
        paths: git(["diff", "--name-only", "-z", `${baseSha}..${headSha}`], true),
      },
    ],
  };
};

test("release ownership accepts an exact commit and path assignment", async () => {
  const result = await verifyReleaseChangeOwnership({ root, manifest: currentRangeManifest() });
  assert.equal(result.commits, 2);
  assert.ok(result.paths > 0);
  assert.equal(result.workPackages, 1);
});

test("release ownership rejects unassigned paths, duplicate commits and head drift", async () => {
  const missingPath = currentRangeManifest();
  missingPath.workPackages[0].paths.pop();
  await assert.rejects(
    () => verifyReleaseChangeOwnership({ root, manifest: missingPath }),
    /release_package_paths_missing|release_paths_unassigned/,
  );

  const duplicateCommit = currentRangeManifest();
  duplicateCommit.workPackages.push({
    id: "parallel-batch",
    owner: "并行变更负责人",
    commits: [duplicateCommit.workPackages[0].commits[0]],
    paths: [duplicateCommit.workPackages[0].paths[0]],
  });
  await assert.rejects(
    () => verifyReleaseChangeOwnership({ root, manifest: duplicateCommit }),
    /release_commit_duplicate|release_path_duplicate/,
  );

  const drifted = currentRangeManifest();
  drifted.headSha = drifted.baseSha;
  await assert.rejects(
    () => verifyReleaseChangeOwnership({ root, manifest: drifted }),
    /release_ownership_manifest_invalid|release_ownership_head_drift/,
  );
});
