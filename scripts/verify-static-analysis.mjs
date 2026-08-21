import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = process.cwd();
const gitFiles = (args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).split(/\r?\n/u).filter(Boolean);
const sourceFiles = [
  ...new Set([
    ...gitFiles(["ls-files", "apps", "packages", "--"]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard", "apps", "packages", "--"]),
  ]),
]
  .filter((path) => [".ts", ".vue"].includes(extname(path)))
  .filter((path) => existsSync(resolve(root, path)));
const violations = [];

for (const path of sourceFiles) {
  const source = readFileSync(resolve(root, path), "utf8");
  for (const pattern of [
    /\.forEach\s*\(\s*async\b/gu,
    /setInterval\s*\(\s*async\b/gu,
    /setTimeout\s*\(\s*async\b/gu,
    /addEventListener\s*\([^,]+,\s*async\b/gu,
    /new\s+Promise\s*\(\s*async\b/gu,
  ]) {
    if (pattern.test(source))
      violations.push(`${path}: asynchronous callback can create an unobserved promise`);
  }

  if (extname(path) !== ".vue") continue;
  for (const match of source.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)) {
    const attributes = match[1] ?? "";
    const body = match[2] ?? "";
    const hasExplicitName = /\b(?:aria-label|aria-labelledby)\s*=/u.test(attributes);
    const readableBody = body
      .replace(/<[^>]+>/gu, "")
      .replace(/<!--.*?-->/gsu, "")
      .trim();
    if (!hasExplicitName && !readableBody)
      violations.push(`${path}: button has no accessible name`);
  }
}

if (violations.length) {
  console.error("static_analysis_failed");
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log(
  `static_analysis_passed files=${sourceFiles.length} accessibility=buttons promises=callbacks`,
);
