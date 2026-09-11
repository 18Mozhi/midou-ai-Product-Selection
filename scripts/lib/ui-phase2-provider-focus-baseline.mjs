import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const providerFocusRevision = {
  file: "apps/web/src/components/ProviderRegistry.vue",
  baseline: "651e9898",
  before: "e98ec358ce10015bca5cac1ff9e5b433411bcdc49cb60654458ebed31e4c2a2e",
  after: "2e6aed1eb23b4402719d2d031a61215aad27be0613c36b2f9f4477971638d20c",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
export const providerFocusStyleRevision = {
  file: "apps/web/src/provider-registry.css",
  baseline: "651e9898",
  before: "81dcd2938dd30c404d7285e1952bbcb0a57dd6d8cb214c036651d55b300fcfb8",
  after: "29e5f97d6c728f747e87189cef654aa65cae901b45eafd2e1ca7491da6e41d1d",
};
const cached = new Map();
// Historical screenshots keep their original source association, never current acceptance.
export function historicalProviderFocusSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const r = [providerFocusRevision, providerFocusStyleRevision].find((r) => r.file === file);
  if (!r || hash(source) !== r.after) return source;
  if (!cached.has(file)) {
    const old = execFileSync("git", ["show", `${r.baseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(old), r.before);
    cached.set(file, old);
  }
  return cached.get(file);
}
