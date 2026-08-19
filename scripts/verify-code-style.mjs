import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const write = process.argv.includes("--write");
const maximumLineLength = 160;
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
const sqlStatementPattern = /\b(?:SELECT|INSERT|UPDATE|DELETE|WITH)\b/iu;

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

function isCodeFile(path) {
  if (excludedFiles.has(path) || !supportedExtensions.has(extname(path))) return false;
  return rootCodeFiles.has(path) || codeRoots.some((prefix) => path.startsWith(prefix));
}

const files = changedFiles()
  .filter(isCodeFile)
  .filter((path) => existsSync(resolve(root, path)));
if (!files.length) {
  console.log("code_style_gate_passed files=0 max_line_length=160");
  process.exit(0);
}

const prettier = resolve(root, "node_modules", "prettier", "bin", "prettier.cjs");
if (!existsSync(prettier)) {
  console.error("code_style_prettier_missing: run npm install");
  process.exit(1);
}
const prettierResult = spawnSync(
  process.execPath,
  [prettier, write ? "--write" : "--check", ...files],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  },
);
if (prettierResult.stdout) process.stdout.write(prettierResult.stdout);
if (prettierResult.stderr) process.stderr.write(prettierResult.stderr);
if (prettierResult.status !== 0) process.exit(prettierResult.status ?? 1);

const violations = [];
const repositorySqlViolations = [];
for (const path of files) {
  if (lineLengthExcludedFiles.has(path)) continue;
  const source = readFileSync(resolve(root, path), "utf8");
  source.split(/\r?\n/u).forEach((line, index) => {
    if (line.length > maximumLineLength) {
      const violation = `${path}:${index + 1} ${line.length} > ${maximumLineLength}`;
      violations.push(violation);
      if (repositoryPathPattern.test(path) && sqlStatementPattern.test(line)) {
        repositorySqlViolations.push(violation);
      }
    }
  });
}
if (violations.length) {
  if (repositorySqlViolations.length) {
    console.error("repository_sql_max_line_length_failed");
    for (const violation of repositorySqlViolations) console.error(violation);
  }
  console.error("code_style_max_line_length_failed");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log(`code_style_gate_passed files=${files.length} max_line_length=${maximumLineLength}`);
