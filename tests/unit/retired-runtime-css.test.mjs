import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  retiredCssHashes,
  readArchivedRuntimeCss,
  readLegacyCssFile,
  readLegacyCssFileSync,
  assertLegacyCssPreviewReadOnly,
} from "../../scripts/lib/retired-runtime-css.mjs";
test("eight retired styles exist only as pinned hash-verified historical evidence", () => {
  assert.equal(Object.keys(retiredCssHashes).length, 8);
  for (const [name, expected] of Object.entries(retiredCssHashes)) {
    assert.equal(existsSync(name), false, name);
    assert.equal(createHash("sha256").update(readArchivedRuntimeCss(name)).digest("hex"), expected);
  }
});
test("historical CSS readers preserve buffer and UTF-8 modes but unrelated paths remain current", async () => {
  const name = Object.keys(retiredCssHashes)[0];
  assert.ok(Buffer.isBuffer(readLegacyCssFileSync(name)));
  assert.equal(await readLegacyCssFile(name, "utf8"), readArchivedRuntimeCss(name));
  assert.equal(
    await readLegacyCssFile("package.json", "utf8"),
    readFileSync("package.json", "utf8"),
  );
  assert.equal(readLegacyCssFileSync("package.json", "utf8"), readFileSync("package.json", "utf8"));
});
test("historical CSS archive rejects unregistered or escaping paths", () => {
  assert.throws(
    () => readArchivedRuntimeCss("../../config/product_scout.env"),
    /unregistered historical CSS/,
  );
  assert.throws(
    () => readArchivedRuntimeCss("apps/web/src/styles.css"),
    /unregistered historical CSS/,
  );
});
test("retired CSS previews cannot create new current screenshots", () => {
  for (const flag of ["--capture", "--smoke", "--refresh-source"])
    assert.throws(() => assertLegacyCssPreviewReadOnly([flag]), /legacy_css_preview_retired/);
  assert.doesNotThrow(() => assertLegacyCssPreviewReadOnly([]));
});
