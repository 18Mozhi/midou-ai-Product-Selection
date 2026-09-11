import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Historical images/contracts retain the captured source. Never current acceptance.
export const filterResetRevision = Object.freeze({
  file: "apps/web/src/components/ResponsiveFilterDrawer.vue",
  baseline: "07c492963f56e266864143cfadaa1e6f6ef5627d",
  before: "daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39",
  after: "a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011",
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
let cached;
export function historicalFilterResetSource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  file = file.replaceAll("\\", "/");
  if (file !== filterResetRevision.file && !file.endsWith("/" + filterResetRevision.file))
    return source;
  if (hash(source) === filterResetRevision.before) return source;
  assert.equal(hash(source), filterResetRevision.after, `Unreviewed filter focus source: ${file}`);
  if (!cached) {
    cached = execFileSync(
      "git",
      ["show", `${filterResetRevision.baseline}:${filterResetRevision.file}`],
      { encoding: "utf8" },
    ).replaceAll("\r\n", "\n");
    assert.equal(hash(cached), filterResetRevision.before);
  }
  return cached;
}
