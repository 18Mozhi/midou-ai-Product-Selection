import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { adminPagePreview } from "./ui-phase2-admin-page-preview.mjs";

// Review composition only. Current production logic and all handlers are retained.
export function adminPageAssemblyPreview(original, surface) {
  // Current P44 production pages already contain the approved composition.
  // Return them unchanged; historical transformations below are only for archived sources.
  assert.ok(["parent", "detail"].includes(surface), "Unknown review surface");
  if (surface === "parent" && original.includes('class="account-page-layout"')) {
    assert.ok(original.includes('class="account-metrics"'), "Current P44 metrics drift");
    assert.ok(original.includes('class="admin-directory-heading"'), "Current P44 heading drift");
    assert.deepEqual(parse(original).errors, []);
    return original;
  }
  if (surface === "detail" && original.includes('class="user-detail-shell"')) {
    assert.ok(
      original.includes('data-user-detail-section="memberships"'),
      "Current P44 detail section drift",
    );
    assert.deepEqual(parse(original).errors, []);
    return original;
  }
  let source = original;
  if (surface === "parent") {
    const heading = `      <header v-if="tab === 'admins'" class="admin-directory-heading">
        <h3>可授权账号</h3>
        <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>
      </header>
`;
    assert.equal(source.split(heading).length, 2, "current P44 directory heading drift");
    // The assembled review adds the same heading in its directory section, not twice.
    source = source.replace(heading, "");
  }
  source = adminPagePreview(source, surface);
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(source).errors, []);
  return source;
}
