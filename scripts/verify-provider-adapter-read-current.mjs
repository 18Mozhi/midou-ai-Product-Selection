import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildAdapterReadCurrentRunner } from "./lib/ui-adapter-read-current-runner.mjs";

assert.equal(
  process.argv.length,
  2,
  "This verifier takes no arguments; historical images stay intact",
);
const original = await readFile("scripts/verify-ui-phase2-provider-adapter-read-order.mjs", "utf8");
const runner = buildAdapterReadCurrentRunner(original).replace(
  /from "([^"\n]+)"/g,
  (_full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
