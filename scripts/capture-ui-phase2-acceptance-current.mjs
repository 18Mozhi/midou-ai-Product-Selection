import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  acceptanceCaptureRoot,
  acceptanceCaptureDrivers,
  buildAcceptanceCurrentCapture,
} from "./lib/ui-phase2-acceptance-current-capture.mjs";

assert.equal(
  process.argv.length,
  3,
  "Supply exactly one stage: page/read-states/actions/robustness/lifecycle",
);
const stage = process.argv[2];
assert.ok(Object.hasOwn(acceptanceCaptureDrivers, stage), "Unknown P49 capture stage");
const original = await readFile(`scripts/verify-ui-phase2-1688-acceptance-${stage}.mjs`, "utf8");
const runner = buildAcceptanceCurrentCapture(original, stage).replace(
  /from "([^"\n]+)"/g,
  (_full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
const root = path.resolve(acceptanceCaptureRoot),
  output = path.resolve(root, stage);
assert.equal(path.dirname(output), root, "Capture must stay inside its fixed new root");
await mkdir(root, { recursive: true });
// Atomic exclusive ownership. Existing or partial packages are never silently overwritten.
await mkdir(output);
await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
