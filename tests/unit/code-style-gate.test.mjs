import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";

test("code style gate formats changed code and enforces the maximum line length", async (t) => {
  const [packageJson, verifier, functionalGate, blueprint, readme, featureMap] = await Promise.all([
    readFile("package.json", "utf8"),
    readFile("scripts/verify-code-style.mjs", "utf8"),
    readFile("scripts/verify-functional.mjs", "utf8"),
    readFile("new-product-enterprise-blueprint.md", "utf8"),
    readFile("README.md", "utf8"),
    readFile("docs/feature-map.json", "utf8"),
  ]);
  assert.match(packageJson, /"prettier": "3\.9\.6"/);
  assert.match(packageJson, /"verify:code-style": "npm run format:check"/);
  assert.match(
    packageJson,
    /"verify:static-analysis": "node scripts\/verify-static-analysis\.mjs"/,
  );
  assert.match(verifier, /maximumLineLength = 640/);
  assert.match(verifier, /CODE_STYLE_BASE_REF/);
  assert.match(verifier, /git\(\["ls-files", "apps", "packages", "--"\]\)/);
  assert.match(verifier, /productionFiles/);
  assert.match(verifier, /@ts-nocheck is forbidden/);
  assert.match(verifier, /empty catch is forbidden/);
  assert.match(verifier, /prompt is forbidden/);
  assert.match(functionalGate, /verify-code-style/);
  assert.match(functionalGate, /verify-static-analysis/);
  assert.match(blueprint, /全部已跟踪 Repository 源文件/);
  assert.match(readme, /npm run verify:code-style/);
  assert.match(featureMap, /"codeStyleCommand": "npm run verify:code-style"/);

  // --write must never target the user's worktree while other tests inspect those sources.
  const temporaryParent = await realpath(tmpdir());
  const fixtureRoot = await mkdtemp(join(temporaryParent, "scoutops-code-style-"));
  const dependencyLink = join(fixtureRoot, "node_modules");
  const fixture = join(fixtureRoot, "tests/invalid.fixture.ts");
  const repositoryFixture = join(fixtureRoot, "apps/api/src/invalid-repository.ts");
  const verifierPath = resolve("scripts/verify-code-style.mjs");
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (key.startsWith("GIT_") || key === "CODE_STYLE_BASE_REF") delete env[key];
  const run = (command, args) =>
    spawnSync(command, args, {
      cwd: fixtureRoot,
      env,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
  const git = (...args) => {
    const result = run("git", ["-c", "core.hooksPath=.disabled-hooks", ...args]);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const runGate = (mode = "--check") => run(process.execPath, [verifierPath, mode]);
  t.diagnostic(`isolated_format_fixture=${fixtureRoot}`);
  try {
    await mkdir(join(fixtureRoot, "tests"), { recursive: true });
    await mkdir(join(fixtureRoot, "apps/api/src"), { recursive: true });
    await mkdir(join(fixtureRoot, ".empty-git-template"));
    await symlink(
      resolve("node_modules"),
      dependencyLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    await copyFile(".prettierrc.json", join(fixtureRoot, ".prettierrc.json"));
    await writeFile(join(fixtureRoot, ".gitignore"), "node_modules/\n", "utf8");
    await writeFile(
      join(fixtureRoot, "apps/api/src/example-repository.ts"),
      "export const value = 1;\n",
      "utf8",
    );
    git("init", "--quiet", "--template=.empty-git-template");
    git("add", "--", ".gitignore", ".prettierrc.json", "apps/api/src/example-repository.ts");
    git(
      "-c",
      "user.name=ScoutOps Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--quiet",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      "test fixture",
    );
    assert.equal(await realpath(git("rev-parse", "--show-toplevel")), await realpath(fixtureRoot));

    await writeFile(fixture, "export   const value=1;\n", "utf8");
    const unformatted = runGate();
    assert.notEqual(unformatted.status, 0);
    assert.match(`${unformatted.stdout}\n${unformatted.stderr}`, /Code style issues found/);

    await writeFile(fixture, `export const value = "${"x".repeat(700)}";\n`, "utf8");
    const tooLong = runGate("--write");
    assert.notEqual(tooLong.status, 0);
    assert.match(`${tooLong.stdout}\n${tooLong.stderr}`, /code_style_max_line_length_failed/);

    await unlink(fixture);
    await writeFile(
      repositoryFixture,
      `export const sql = "SELECT ${"column_name, ".repeat(60)}id FROM example_table";\n`,
      "utf8",
    );
    const repositorySql = runGate("--write");
    assert.notEqual(repositorySql.status, 0);
    assert.match(
      `${repositorySql.stdout}\n${repositorySql.stderr}`,
      /repository_sql_max_line_length_failed/,
    );
    await unlink(repositoryFixture);
    const passing = runGate();
    assert.equal(passing.status, 0, `${passing.stdout}\n${passing.stderr}`);
    assert.match(passing.stdout, /production=1 repositories=1/);
    assert.equal(
      git("status", "--short"),
      "",
      "fixture cleanup must leave only its tracked baseline",
    );
  } finally {
    // Remove the dependency junction itself before recursively deleting the owned temp repo.
    const link = await lstat(dependencyLink).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (link) {
      assert.ok(link.isSymbolicLink(), "dependency path must still be our link");
      await unlink(dependencyLink);
    }
    assert.equal(dirname(fixtureRoot), temporaryParent);
    assert.ok(basename(fixtureRoot).startsWith("scoutops-code-style-"));
    assert.equal(await realpath(fixtureRoot), fixtureRoot);
    await rm(fixtureRoot, { recursive: true });
    t.diagnostic(`isolated_format_fixture_removed=${fixtureRoot}`);
  }
});

test("real worktree code style is still verified without rewriting source files", () => {
  const result = spawnSync(process.execPath, ["scripts/verify-code-style.mjs", "--check"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /code_style_gate_passed/);
});
