import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile as nativeRead } from "node:fs/promises";
import { readFileSync as nativeReadSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
export const retiredCssRevision = "bc59380f42d1e5aec471f3c159bd61d80bbecfc4";
export const retiredCssHashes = Object.freeze({
  "apps/web/src/navigation-shell-scoped.css":
    "b0aeca5e6240a1f45ac86aa43d961d68e9df71ed946cf7deb8b4f8f22763ed71",
  "apps/web/src/signal-ledger.css":
    "0ee6004a181ee0a70ded70807059b828ed46a374b11026dd37fb51ddc6143ac5",
  "apps/web/src/design/approval-filter-tokens.css":
    "c9b14d85f7ac5c5719432f57e431e521682d177d6b4f43522e836b45ad9fdeb9",
  "apps/web/src/design/approval-read-failure-tokens.css":
    "fa0f67e5a4eb4622ab258ec3de52b43b562fe07b51a8459cd71d532ea64d36c2",
  "apps/web/src/design/export-detail-tokens.css":
    "79e0e39d121567fb0329e34fb468ae657613a81fc0e5c36986bd2c15675da240",
  "apps/web/src/design/organization-audit-tokens.css":
    "7b2c3693dc96828862b86ebe4832c394a8749b98b06c1487366518cd00807eef",
  "apps/web/src/design/tenancy-tokens.css":
    "f703737674e12f4e62176de0b6fd67cfe614871a8d2ed2ccfb5f2746e9981e43",
  "apps/web/src/design/token-filter-tokens.css":
    "2439afbf31dc4fea103d4e8e43bd6de27bd0aa69354da6dd2c3ee515fee65e79",
});
const cache = new Map();
function nameOf(file) {
  return relative(root, resolve(file instanceof URL ? fileURLToPath(file) : file)).replaceAll(
    "\\",
    "/",
  );
}
export function readArchivedRuntimeCss(name) {
  assert.ok(Object.hasOwn(retiredCssHashes, name), `unregistered historical CSS: ${name}`);
  if (!cache.has(name)) {
    const source = execFileSync("git", ["show", `${retiredCssRevision}:${name}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).replaceAll("\r\n", "\n");
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      retiredCssHashes[name],
      `historical CSS hash mismatch: ${name}`,
    );
    cache.set(name, source);
  }
  return cache.get(name);
}
function archived(file, options) {
  const name = nameOf(file);
  if (!Object.hasOwn(retiredCssHashes, name)) return null;
  const source = readArchivedRuntimeCss(name);
  const encoding = typeof options === "string" ? options : options?.encoding;
  return encoding ? Buffer.from(source).toString(encoding) : Buffer.from(source);
}
/** Historical review only: unrelated paths always read their actual current bytes. */
export async function readLegacyCssFile(file, options) {
  return archived(file, options) ?? nativeRead(file, options);
}
export function readLegacyCssFileSync(file, options) {
  return archived(file, options) ?? nativeReadSync(file, options);
}
/** Retired visual CSS cannot be used to create new screenshots of current UI. */
export function assertLegacyCssPreviewReadOnly(args = process.argv.slice(2)) {
  if (args.some((a) => ["--capture", "--smoke", "--refresh-source"].includes(a)))
    throw new Error(
      "legacy_css_preview_retired: use a historical checkout for retired styles; current UI verification must use current E2E surfaces",
    );
}
