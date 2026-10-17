import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

// Verify the current Vue route; never replace its template with a historical review design.
const args = process.argv.slice(2);
assert.ok(
  args.length === 0 ||
    (args.length === 2 && args[0] === "--capture-review" && /^r[1-9]\d*$/.test(args[1])),
);
const projects =
  process.env.P22_SMOKE === "1" ? ["mobile-390"] : ["desktop-chromium", "mobile-390"];
const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
for (const project of projects) {
  const output = args.length
    ? path.resolve(`output/playwright/p22-page-composition-${args[1]}/${project}`)
    : undefined;
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "test",
      "tests/e2e/m04-04-profit.spec.ts",
      "--grep",
      "M04-04.A07/A08/A09/A15|compact cost workbench",
      `--project=${project}`,
      ...(output ? ["--output", output] : []),
    ],
    { cwd: process.cwd(), env: process.env, stdio: "inherit", shell: false },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
