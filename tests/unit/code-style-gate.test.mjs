import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import test from "node:test";

test("code style gate formats changed code and enforces the maximum line length", async () => {
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
  assert.match(verifier, /maximumLineLength = 160/);
  assert.match(verifier, /CODE_STYLE_BASE_REF/);
  assert.match(functionalGate, /verify-code-style/);
  assert.match(blueprint, /触碰即治理/);
  assert.match(readme, /npm run verify:code-style/);
  assert.match(featureMap, /"codeStyleCommand": "npm run verify:code-style"/);

  const fixture = `tests/code-style-gate-${process.pid}.fixture.ts`;
  const repositoryFixture = `apps/api/src/code-style-gate-${process.pid}-repository.ts`;
  try {
    await writeFile(fixture, "export   const value=1;\n", "utf8");
    const unformatted = runGate();
    assert.notEqual(unformatted.status, 0);
    assert.match(`${unformatted.stdout}\n${unformatted.stderr}`, /Code style issues found/);

    await writeFile(fixture, `export const value = "${"x".repeat(170)}";\n`, "utf8");
    const tooLong = runGate("--write");
    assert.notEqual(tooLong.status, 0);
    assert.match(`${tooLong.stdout}\n${tooLong.stderr}`, /code_style_max_line_length_failed/);

    await unlink(fixture);
    await writeFile(
      repositoryFixture,
      `export const sql = "SELECT ${"column_name, ".repeat(15)}id FROM example_table";\n`,
      "utf8",
    );
    const repositorySql = runGate("--write");
    assert.notEqual(repositorySql.status, 0);
    assert.match(
      `${repositorySql.stdout}\n${repositorySql.stderr}`,
      /repository_sql_max_line_length_failed/,
    );
  } finally {
    await unlink(fixture).catch(() => undefined);
    await unlink(repositoryFixture).catch(() => undefined);
  }

  const passing = runGate();
  assert.equal(passing.status, 0, `${passing.stdout}\n${passing.stderr}`);
});

function runGate(mode = "--check") {
  return spawnSync(process.execPath, ["scripts/verify-code-style.mjs", mode], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}
