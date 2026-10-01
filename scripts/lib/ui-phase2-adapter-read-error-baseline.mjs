import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const readErrorRevision = {
  before: "7fce30d574f08ef93c5530b7d609e5d5fde38c0ab246e20c91fbd8c45497b798",
  current: "4dbff48411afac2c6fccea9da1bbf19e4346ff4a472220ae4ef02ab3121ab746",
  approvedCurrent: "1a98c8463bf4922f42c2376294e830cce83d7dbfb6f8e0a15a793c520ac69c9b",
  approvedCommit: "afde2f17866af2f745ae4dbe046ecc3dba7a06b2",
};
const componentPath = "apps/web/src/components/ProviderAdapterCenter.vue";

const readErrorChanges = [
  ['import "../provider-adapters-c-read-error.css";\n', ""],
  ["      :title=\"state === 'error' ? '暂时未能读取采集状态' : ''\"\n", ""],
  [
    "      :description=\"state === 'error' ? '这次读取未完成。你可以重新读取，获取最新状态。' : ''\"\n",
    "",
  ],
];

const hash = (source) => createHash("sha256").update(source).digest("hex");

// Historical comparison only. Current App renders must continue using the unmodified SFC.
export function beforeAdapterReadError(source) {
  source = source.replaceAll("\r\n", "\n");
  if (hash(source) === readErrorRevision.approvedCurrent) {
    source = execFileSync("git", ["show", `${readErrorRevision.approvedCommit}:${componentPath}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(source), readErrorRevision.current, "Pinned P47 read-error source changed");
  }
  if (hash(source) === readErrorRevision.before) return source;
  assert.equal(hash(source), readErrorRevision.current, "Unknown P47 read-error revision");
  for (const [after, before] of readErrorChanges) {
    assert.equal(source.split(after).length, 2, "Unique approved P47 read-error inverse anchor");
    source = source.replace(after, before);
  }
  assert.equal(hash(source), readErrorRevision.before, "P47 read-error inverse must match in full");
  return source;
}
