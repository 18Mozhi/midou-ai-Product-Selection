import assert from "node:assert/strict";
import { historicalAdminDirectorySource } from "./ui-phase2-admin-directory-baseline.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adminControlsRevision = {
  file: "apps/web/src/components/PlatformAccountCenter.vue",
  baseline: "c489ebf0",
  before: "a1ba7d5a1d8bd8acf801dda4b84b98f23523d0ca7f43c6b216dfacde5c47db20",
  after: "fd9b68b4f22ce7bb832ff5090c478104cac1c63f8722ed5a7274cb3ceb0480d1",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
let cached;
// Exact old-capture association only. Never substitutes source for current UI acceptance.
export function historicalAdminControlsSource(file, source) {
  source = historicalAdminDirectorySource(file, source);
  if (file !== adminControlsRevision.file || hash(source) === adminControlsRevision.before)
    return source;
  assert.equal(
    hash(source),
    adminControlsRevision.after,
    `Unreviewed admin controls source: ${file}`,
  );
  if (!cached) {
    cached = execFileSync("git", ["show", `${adminControlsRevision.baseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(cached), adminControlsRevision.before);
  }
  return cached;
}
