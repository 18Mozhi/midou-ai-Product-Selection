import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sha = /^[a-f0-9]{40}$/;
const workPackageId = /^[A-Za-z0-9._-]{2,80}$/;

function git(root, args, { nullSeparated = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(`release_git_command_failed:${args[0]}:${result.stderr.trim()}`);
  return nullSeparated
    ? result.stdout.split("\0").filter(Boolean)
    : result.stdout.split(/\r?\n/).filter(Boolean);
}

function normalizedPath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    isAbsolute(value) ||
    value.split("/").includes("..")
  )
    throw new Error("release_ownership_path_invalid");
  return value;
}

function exactSet(actual, expected, missingCode, extraCode) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  if (missing.length) throw new Error(`${missingCode}:${missing.join(",")}`);
  if (extra.length) throw new Error(`${extraCode}:${extra.join(",")}`);
}

export async function verifyReleaseChangeOwnership({ root, manifest }) {
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.releaseId !== "string" ||
    !workPackageId.test(manifest.releaseId) ||
    !sha.test(manifest.baseSha ?? "") ||
    !sha.test(manifest.headSha ?? "") ||
    manifest.baseSha === manifest.headSha ||
    !Array.isArray(manifest.workPackages) ||
    manifest.workPackages.length === 0
  )
    throw new Error("release_ownership_manifest_invalid");

  const repositoryRoot = resolve(root);
  const [head] = git(repositoryRoot, ["rev-parse", "HEAD"]);
  if (head !== manifest.headSha) throw new Error("release_ownership_head_drift");
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", manifest.baseSha, head], {
    cwd: repositoryRoot,
    shell: false,
    windowsHide: true,
  });
  if (ancestor.status !== 0) throw new Error("release_ownership_base_not_ancestor");

  const expectedCommits = git(repositoryRoot, [
    "rev-list",
    "--reverse",
    `${manifest.baseSha}..${head}`,
  ]);
  const expectedPaths = git(
    repositoryRoot,
    ["diff", "--name-only", "-z", `${manifest.baseSha}..${head}`],
    { nullSeparated: true },
  );
  if (!expectedCommits.length || !expectedPaths.length)
    throw new Error("release_ownership_empty_release");

  const assignedCommits = [];
  const assignedPaths = [];
  const commitOwner = new Map();
  const pathOwner = new Map();
  const packageIds = new Set();

  for (const item of manifest.workPackages) {
    if (
      !item ||
      !workPackageId.test(item.id ?? "") ||
      packageIds.has(item.id) ||
      typeof item.owner !== "string" ||
      item.owner.trim().length < 1 ||
      item.owner.length > 120 ||
      !Array.isArray(item.commits) ||
      item.commits.length === 0 ||
      !Array.isArray(item.paths) ||
      item.paths.length === 0
    )
      throw new Error("release_work_package_invalid");
    packageIds.add(item.id);
    const commits = item.commits.map((value) => {
      if (!sha.test(value)) throw new Error("release_commit_invalid");
      if (commitOwner.has(value)) throw new Error(`release_commit_duplicate:${value}`);
      commitOwner.set(value, item.id);
      assignedCommits.push(value);
      return value;
    });
    const paths = item.paths.map((value) => {
      const path = normalizedPath(value);
      if (pathOwner.has(path)) throw new Error(`release_path_duplicate:${path}`);
      pathOwner.set(path, item.id);
      assignedPaths.push(path);
      return path;
    });
    const pathsFromCommits = new Set();
    for (const commit of commits) {
      for (const path of git(
        repositoryRoot,
        ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "-z", commit],
        { nullSeparated: true },
      )) {
        const existingOwner = pathOwner.get(path);
        if (existingOwner && existingOwner !== item.id)
          throw new Error(`release_path_cross_package_conflict:${path}`);
        pathsFromCommits.add(path);
      }
    }
    exactSet(
      paths,
      [...pathsFromCommits],
      "release_package_paths_missing",
      "release_package_paths_extra",
    );
  }

  exactSet(
    assignedCommits,
    expectedCommits,
    "release_commits_unassigned",
    "release_commits_outside_range",
  );
  exactSet(assignedPaths, expectedPaths, "release_paths_unassigned", "release_paths_outside_range");
  return {
    releaseId: manifest.releaseId,
    baseSha: manifest.baseSha,
    headSha: manifest.headSha,
    commits: expectedCommits.length,
    paths: expectedPaths.length,
    workPackages: manifest.workPackages.length,
  };
}

async function main() {
  const index = process.argv.indexOf("--manifest");
  const manifestPath = index >= 0 ? process.argv[index + 1] : undefined;
  if (!manifestPath) throw new Error("release_ownership_manifest_path_required");
  const manifest = JSON.parse(await readFile(resolve(process.cwd(), manifestPath), "utf8"));
  const result = await verifyReleaseChangeOwnership({ root: process.cwd(), manifest });
  console.log(JSON.stringify({ status: "passed", ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
