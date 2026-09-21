import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Historical review packages may reference this captured dialog contract.
// This bridge proves only the archived source, never current UI acceptance.
export const modalDialogRevision = Object.freeze({
  file: "apps/web/src/use-modal-dialog.ts",
  baseline: "a9b1495cca558b331d5de1983abc61b5e45657db",
  captured: "08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f",
  current: "5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc",
});

const hash = (source) => createHash("sha256").update(source).digest("hex");
let cached;

export function historicalModalDialogSource(file, source) {
  file = file.replaceAll("\\", "/");
  source = source.replaceAll("\r\n", "\n");
  if (file !== modalDialogRevision.file || hash(source) === modalDialogRevision.captured)
    return source;
  assert.equal(
    hash(source),
    modalDialogRevision.current,
    "Unreviewed modal dialog source: " + file,
  );
  if (!cached) {
    cached = execFileSync(
      "git",
      ["show", modalDialogRevision.baseline + ":" + modalDialogRevision.file],
      { encoding: "utf8" },
    ).replaceAll("\r\n", "\n");
    assert.equal(
      hash(cached),
      modalDialogRevision.captured,
      "Historical modal dialog source drift",
    );
  }
  return cached;
}
