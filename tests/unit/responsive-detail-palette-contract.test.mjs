import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  responsiveFocusRevision as revision,
  verifyResponsivePalette,
  verifyResponsiveFocusDependencies,
} from "../../scripts/lib/ui-phase2-responsive-focus-contract.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const withChange = (file, transform) => (requested) =>
  requested === file ? transform(read(requested)) : read(requested);

test("current palette contract returns raw current SHA, not reconstructed historical bytes", () => {
  assert.equal(verifyResponsivePalette(), revision.paletteAfter);
  assert.equal(
    verifyResponsivePalette(),
    createHash("sha256").update(read(revision.file)).digest("hex"),
  );
  assert.notEqual(revision.paletteAfter, revision.contentAfter);
  assert.equal(
    revision.contentAfter,
    "6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac",
  );
});
test("removing the imported palette cannot reuse the current source binding", () => {
  assert.throws(
    () =>
      verifyResponsivePalette(
        withChange(revision.file, (source) =>
          source.replace('@import "../design/platform-overlay-tokens.css";', ""),
        ),
      ),
    /unreviewed current responsive source/,
  );
});
test("behavioral and selector changes fail before any historical source substitution", () => {
  for (const transform of [
    (source) => source.replace("selectedKey.value = null;", "selectedKey.value = 'stale';"),
    (source) => source.replace("appearance === 'governance'", "appearance === 'content'"),
    (source) => source + "\n<!-- unregistered -->\n",
  ]) {
    assert.notEqual(transform(read(revision.file)), read(revision.file));
    assert.throws(
      () => verifyResponsivePalette(withChange(revision.file, transform)),
      /unreviewed current responsive source/,
    );
  }
});
test("palette value drift and missing palette roles cannot be hidden by the unchanged Vue hash", () => {
  for (const transform of [
    (source) => source.replace(/#[0-9a-f]{6}/, "#123456"),
    (source) => source.replace(/--so-workspace-overlay-[\w-]+:[^;]+;/, ""),
  ]) {
    assert.notEqual(transform(read(revision.paletteFile)), read(revision.paletteFile));
    assert.throws(
      () => verifyResponsivePalette(withChange(revision.paletteFile, transform)),
      /unreviewed overlay palette/,
    );
  }
});

test("legacy entry retains all17 current dependency bindings alongside historical capture bindings", () => {
  assert.equal(verifyResponsiveFocusDependencies(), 17);
});
test("notification scope is required and cannot admit extra palette selectors", () => {
  for (const transform of [
    (source) => source.replace(",\n.responsive-filter-drawer--notifications", ""),
    (source) => source.replace("--notifications {", "--notifications, body {"),
  ]) {
    assert.notEqual(transform(read(revision.paletteFile)), read(revision.paletteFile));
    assert.throws(
      () => verifyResponsivePalette(withChange(revision.paletteFile, transform)),
      /unreviewed overlay palette/,
    );
  }
});
test("unknown current modal, reason and global-style changes still fail closed", () => {
  for (const file of [
    "apps/web/src/use-modal-dialog.ts",
    revision.reasonFile,
    "apps/web/src/signal-ledger.css",
  ])
    assert.throws(
      () =>
        verifyResponsiveFocusDependencies(withChange(file, (source) => source + "\n/* drift */\n")),
      /unreviewed current dependency/,
    );
});
