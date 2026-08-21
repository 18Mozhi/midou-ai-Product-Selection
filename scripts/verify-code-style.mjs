import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const write = process.argv.includes("--write");
const maximumLineLength = 640;
const codeRoots = ["apps/", "packages/", "scripts/", "tests/"];
const rootCodeFiles = new Set([
  ".prettierrc.json",
  "package.json",
  "playwright.config.ts",
  "tsconfig.base.json",
]);
const supportedExtensions = new Set([".css", ".js", ".json", ".mjs", ".ts", ".vue"]);
const excludedFiles = new Set(["package-lock.json", "verification/state.json"]);
const lineLengthExcludedFiles = new Set([".prettierrc.json", "package.json"]);
const repositoryPathPattern = /^(?:apps|packages)\/.+\/src\/.+repository\.[cm]?[jt]s$/u;

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function lines(value) {
  return value ? value.split(/\r?\n/u).filter(Boolean) : [];
}

function changedFiles() {
  const requestedBase = process.env.CODE_STYLE_BASE_REF?.trim();
  const worktree = lines(git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]));
  const untracked = lines(git(["ls-files", "--others", "--exclude-standard"]));
  let committed = [];
  if (requestedBase) {
    const mergeBase = git(["merge-base", requestedBase, "HEAD"]);
    committed = lines(
      git(["diff", "--name-only", "--diff-filter=ACMR", `${mergeBase}...HEAD`, "--"]),
    );
  } else if (!worktree.length && !untracked.length) {
    committed = lines(
      git(["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", "HEAD", "--"]),
    );
  }
  return [...new Set([...committed, ...worktree, ...untracked])];
}

function parseAddedLines(diff) {
  const result = new Set();
  let path = null;
  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith("+++ b/")) {
      path = line.slice(6);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (!path || !hunk) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    for (let offset = 0; offset < count; offset += 1) result.add(`${path}:${start + offset}`);
  }
  return result;
}

function addedLineKeys() {
  const requestedBase = process.env.CODE_STYLE_BASE_REF?.trim();
  const worktree = lines(git(["diff", "--name-only", "HEAD", "--"]));
  let diff;
  if (requestedBase) {
    const mergeBase = git(["merge-base", requestedBase, "HEAD"]);
    diff = git(["diff", "--unified=0", mergeBase, "--"]);
  } else if (worktree.length) {
    diff = git(["diff", "--unified=0", "HEAD", "--"]);
  } else {
    diff = git(["show", "--format=", "--unified=0", "HEAD", "--"]);
  }
  const result = parseAddedLines(diff);
  for (const path of lines(git(["ls-files", "--others", "--exclude-standard"]))) {
    if (!existsSync(resolve(root, path))) continue;
    readFileSync(resolve(root, path), "utf8")
      .split(/\r?\n/u)
      .forEach((_, index) => result.add(`${path}:${index + 1}`));
  }
  return result;
}

function isCodeFile(path) {
  if (excludedFiles.has(path) || !supportedExtensions.has(extname(path))) return false;
  return rootCodeFiles.has(path) || codeRoots.some((prefix) => path.startsWith(prefix));
}

const files = changedFiles()
  .filter(isCodeFile)
  .filter((path) => existsSync(resolve(root, path)));
const productionFiles = [
  ...new Set([
    ...lines(git(["ls-files", "apps", "packages", "--"])),
    ...lines(git(["ls-files", "--others", "--exclude-standard", "apps", "packages", "--"])),
  ]),
]
  .filter(isCodeFile)
  .filter((path) => existsSync(resolve(root, path)));
const formatFiles = [...new Set([...productionFiles, ...files])];
const repositoryFiles = productionFiles
  .filter((path) => repositoryPathPattern.test(path))
  .filter((path) => existsSync(resolve(root, path)));
const addedLines = addedLineKeys();

if (formatFiles.length) {
  const prettier = resolve(root, "node_modules", "prettier", "bin", "prettier.cjs");
  if (!existsSync(prettier)) {
    console.error("code_style_prettier_missing: run npm install");
    process.exit(1);
  }
  const prettierResult = spawnSync(
    process.execPath,
    [prettier, write ? "--write" : "--check", ...formatFiles],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (prettierResult.stdout) process.stdout.write(prettierResult.stdout);
  if (prettierResult.stderr) process.stderr.write(prettierResult.stderr);
  if (prettierResult.status !== 0) process.exit(prettierResult.status ?? 1);
}

const violations = [];
const repositoryLineViolations = [];
const lineCheckFiles = [...new Set([...formatFiles, ...repositoryFiles])];
for (const path of lineCheckFiles) {
  if (lineLengthExcludedFiles.has(path)) continue;
  const source = readFileSync(resolve(root, path), "utf8");
  if (productionFiles.includes(path) && /@ts-nocheck/u.test(source))
    violations.push(`${path}: @ts-nocheck is forbidden in production source`);
  if (productionFiles.includes(path) && /catch\s*(?:\([^)]*\))?\s*\{\s*\}/u.test(source))
    violations.push(`${path}: empty catch is forbidden in production source`);
  if (productionFiles.includes(path) && /(?:window\.)?prompt\s*\(/u.test(source))
    violations.push(`${path}: prompt is forbidden in production source`);
  source.split(/\r?\n/u).forEach((line, index) => {
    if (line.length > maximumLineLength && addedLines.has(`${path}:${index + 1}`)) {
      const violation = `${path}:${index + 1} ${line.length} > ${maximumLineLength}`;
      violations.push(violation);
      if (repositoryPathPattern.test(path)) repositoryLineViolations.push(violation);
    }
  });
}
if (violations.length) {
  if (repositoryLineViolations.length) {
    console.error("repository_sql_max_line_length_failed");
    for (const violation of repositoryLineViolations) console.error(violation);
  }
  console.error("code_style_max_line_length_failed");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log(
  `code_style_gate_passed changed=${files.length} production=${productionFiles.length} repositories=${repositoryFiles.length} max_line_length=${maximumLineLength}`,
);
