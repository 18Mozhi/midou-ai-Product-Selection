import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAdapterEmptyMobileCurrentRunner,
  resolveEmptyMobileRunnerImports,
} from "./lib/ui-adapter-empty-mobile-current-runner.mjs";

assert.equal(
  process.argv.length,
  2,
  "Current empty verifier takes no arguments; old images cannot be overwritten",
);
const original = await readFile("scripts/verify-provider-adapter-empty-mobile.mjs", "utf8");
const runner = resolveEmptyMobileRunnerImports(
  buildAdapterEmptyMobileCurrentRunner(original),
  (specifier) => import.meta.resolve(specifier),
  await readFile("scripts/verify-ui-phase2-provider-adapter-empty.mjs", "utf8"),
);
await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
