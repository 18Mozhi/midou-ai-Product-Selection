import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyReleaseChangeOwnership } from "../../scripts/verify-release-change-ownership.mjs";

const git = (root, args, nullSeparated = false) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  assert.equal(result.status, 0, result.stderr);
  return nullSeparated
    ? result.stdout.split("\0").filter(Boolean)
    : result.stdout.split(/\r?\n/).filter(Boolean);
};

const currentRangeManifest = (root) => {
  const [headSha] = git(root, ["rev-parse", "HEAD"]);
  const [baseSha] = git(root, ["rev-parse", "HEAD~2"]);
  return {
    schemaVersion: 1,
    releaseId: "unit-release-ownership",
    baseSha,
    headSha,
    workPackages: [
      {
        id: "verified-batch",
        owner: "测试负责人",
        commits: git(root, ["rev-list", "--reverse", `${baseSha}..${headSha}`]),
        paths: git(root, ["diff", "--name-only", "-z", `${baseSha}..${headSha}`], true),
      },
    ],
  };
};

async function withReleaseRepository(run) {
  const root = await mkdtemp(join(tmpdir(), "scoutops-release-ownership-"));
  try {
    git(root, ["init"]);
    git(root, ["config", "user.name", "ScoutOps Test"]);
    git(root, ["config", "user.email", "scoutops-test@example.invalid"]);
    await writeFile(join(root, "baseline.txt"), "baseline\n", "utf8");
    git(root, ["add", "baseline.txt"]);
    git(root, ["commit", "-m", "baseline"]);
    await writeFile(join(root, "feature-a.txt"), "feature a\n", "utf8");
    git(root, ["add", "feature-a.txt"]);
    git(root, ["commit", "-m", "feature a"]);
    await writeFile(join(root, "feature-b.txt"), "feature b\n", "utf8");
    git(root, ["add", "feature-b.txt"]);
    git(root, ["commit", "-m", "feature b"]);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("release ownership accepts an exact commit and path assignment", () =>
  withReleaseRepository(async (root) => {
    const result = await verifyReleaseChangeOwnership({
      root,
      manifest: currentRangeManifest(root),
    });
    assert.equal(result.commits, 2);
    assert.equal(result.paths, 2);
    assert.equal(result.workPackages, 1);
  }));

test("release ownership rejects unassigned paths, duplicate commits and head drift", () =>
  withReleaseRepository(async (root) => {
    const missingPath = currentRangeManifest(root);
    missingPath.workPackages[0].paths.pop();
    await assert.rejects(
      () => verifyReleaseChangeOwnership({ root, manifest: missingPath }),
      /release_package_paths_missing|release_paths_unassigned/,
    );

    const duplicateCommit = currentRangeManifest(root);
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

    const drifted = currentRangeManifest(root);
    drifted.headSha = drifted.baseSha;
    await assert.rejects(
      () => verifyReleaseChangeOwnership({ root, manifest: drifted }),
      /release_ownership_manifest_invalid|release_ownership_head_drift/,
    );
  }));
