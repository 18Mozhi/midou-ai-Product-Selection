import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  historicalModalDialogSource,
  modalDialogRevision,
} from "../../scripts/lib/ui-phase2-modal-dialog-baseline.mjs";

const hash = (source) => createHash("sha256").update(source).digest("hex");
const current = readFileSync(modalDialogRevision.file, "utf8").replaceAll("\r\n", "\n");
const captured = execFileSync(
  "git",
  ["show", modalDialogRevision.baseline + ":" + modalDialogRevision.file],
  { encoding: "utf8" },
).replaceAll("\r\n", "\n");

test("shared modal dialog history is exact and fail-closed", () => {
  assert.equal(hash(current), modalDialogRevision.current);
  assert.equal(hash(captured), modalDialogRevision.captured);
  assert.equal(historicalModalDialogSource(modalDialogRevision.file, current), captured);
  assert.throws(() =>
    historicalModalDialogSource(modalDialogRevision.file, current + "\n// unknown"),
  );
});
