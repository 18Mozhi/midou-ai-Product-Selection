import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("web build runs strict incremental Vue type checking before bundling", async () => {
  const [packageJson, tsconfig, gitignore] = await Promise.all([
    readFile("package.json", "utf8").then(JSON.parse),
    readFile("apps/web/tsconfig.json", "utf8").then(JSON.parse),
    readFile(".gitignore", "utf8"),
  ]);

  assert.equal(packageJson.scripts["typecheck:web"], "vue-tsc --noEmit -p apps/web/tsconfig.json");
  assert.match(packageJson.scripts["build:web"], /^npm run typecheck:web && vite build/u);
  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.incremental, true);
  assert.equal(tsconfig.compilerOptions.noEmit, true);
  assert.equal(tsconfig.compilerOptions.tsBuildInfoFile, "./.web.tsbuildinfo");
  assert.match(gitignore, /\*\.tsbuildinfo/u);
});
