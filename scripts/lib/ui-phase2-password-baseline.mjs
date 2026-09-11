import assert from "node:assert/strict";
import { historicalAdminControlsSource } from "./ui-phase2-admin-controls-baseline.mjs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const passwordRevision = {
  file: "apps/web/src/components/PlatformAccountCenter.vue",
  baseline: "b93caa7f",
  before: "ec3f2b6535f9625c3fd5d1c3542679ff8887bf65b727e5696b556945a45a861f",
  after: "a1ba7d5a1d8bd8acf801dda4b84b98f23523d0ca7f43c6b216dfacde5c47db20",
};
const hash = (source) => createHash("sha256").update(source).digest("hex");
let cached;
// Historical evidence association only; current password regression reads actual source.
export function historicalPasswordSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  if (file !== passwordRevision.file || hash(source) === passwordRevision.before) return source;
  source = historicalAdminControlsSource(file, source);
  assert.equal(hash(source), passwordRevision.after, `Unreviewed password source: ${file}`);
  if (!cached) {
    cached = execFileSync("git", ["show", `${passwordRevision.baseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(cached), passwordRevision.before);
  }
  return cached;
}
