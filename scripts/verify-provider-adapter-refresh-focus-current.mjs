import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAdapterRefreshFocusCurrentRunner } from "./lib/ui-adapter-refresh-focus-current-runner.mjs";

assert.equal(
  process.argv.length,
  2,
  "This verifier takes no arguments; historical images stay intact",
);
const original = await readFile("scripts/verify-provider-adapter-refresh-focus.mjs", "utf8");
const runner = buildAdapterRefreshFocusCurrentRunner(original).replace(
  /from "([^"\n]+)"/g,
  (_full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
