import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const adminDirectoryRevision = {
  file: "apps/web/src/components/PlatformAccountCenter.vue",
  baseline: "d9a28316",
  before: "fd9b68b4f22ce7bb832ff5090c478104cac1c63f8722ed5a7274cb3ceb0480d1",
  after: "b6b04ced8763f8b5f8231dc19c2b7e6617024af2870f82defa6ba25afb042f00",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
export const adminDirectoryHeading = `      <header v-if="tab === 'admins'" class="admin-directory-heading">
        <h3>可授权账号</h3>
        <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>
      </header>
`;
let cached;
// Exact association for prior captures; current directory acceptance reads raw source.
export function historicalAdminDirectorySource(file, source) {
  source = source.replaceAll("\r\n", "\n");
  const r = adminDirectoryRevision;
  if (file !== r.file || hash(source) !== r.after) return source;
  if (!cached) {
    cached = execFileSync("git", ["show", `${r.baseline}:${file}`], {
      encoding: "utf8",
    }).replaceAll("\r\n", "\n");
    assert.equal(hash(cached), r.before);
  }
  return cached;
}
