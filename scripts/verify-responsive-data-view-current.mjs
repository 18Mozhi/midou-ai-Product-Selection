import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildDetailCurrentRunner } from "./lib/ui-responsive-detail-current-runner.mjs";

// No captures or business writes; preserve the original historical packet and driver.
assert.equal(process.argv.length, 2, "This verifier takes no arguments");
const source = await readFile("scripts/verify-responsive-data-view-focus.mjs", "utf8");
for (const appearance of ["default", "governance", "content"]) {
  for (const reducedMotion of ["reduce", "no-preference"]) {
    const runner = buildDetailCurrentRunner(source, appearance, reducedMotion).replace(
      /from "([^"\n]+)"/g,
      (full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
    );
    try {
      await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
    } catch (error) {
      console.error(`responsive_detail_failed ${appearance}/${reducedMotion}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (process.exitCode) break;
}
if (!process.exitCode)
  console.log("responsive_detail_current_passed scenarios=6 widths=4 checks=80 captures=0");
