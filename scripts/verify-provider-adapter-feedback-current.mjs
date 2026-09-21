import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAdapterFeedbackCurrentRunner } from "./lib/ui-adapter-feedback-current-runner.mjs";

assert.equal(
  process.argv.length,
  2,
  "This verifier takes no arguments; historical images stay intact",
);
const original = await readFile("scripts/verify-ui-phase2-provider-adapter-feedback.mjs", "utf8");
const runner = buildAdapterFeedbackCurrentRunner(original).replace(
  /from "([^"\n]+)"/g,
  (_full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(`provider_adapter_feedback_failed ${error.name}: ${error.message}`);
  process.exitCode = 1;
}
