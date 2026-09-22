import assert from "node:assert/strict";
import { userPagePreview as originalPreview } from "./ui-phase2-user-page-preview.mjs";

// P43 review only. Keep the later P44-only heading/condition without changing the shared archived helper.
export function userPagePreview(original, surface) {
  // Once P44's approved composition is in production, review helpers must inspect
  // the real component rather than replaying the obsolete archived mockup edits.
  if (surface === "parent" && original.includes('class="account-page-layout"')) {
    assert.ok(original.includes('class="account-metrics"'), "Current P44 metrics drift");
    assert.ok(original.includes('class="admin-directory-heading"'), "Current P44 heading drift");
    return original;
  }
  if (surface === "detail" && original.includes('class="user-detail-shell"')) {
    assert.ok(
      original.includes('data-user-detail-section="memberships"'),
      "Current P43 detail section drift",
    );
    return original;
  }
  // The former review-only detail transform is obsolete now that the approved
  // three-section composition ships in the production detail component.
  if (surface === "detail" && original.includes('class="user-detail-shell"')) return original;
  if (surface !== "parent") return originalPreview(original, surface);
  const heading = `      <header v-if="tab === 'admins'" class="admin-directory-heading">
        <h3>可授权账号</h3>
        <p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>
      </header>
`;
  if (!original.includes('class="admin-directory-heading"'))
    return originalPreview(original, surface);
  assert.equal(original.split(heading).length, 2, "Current P43 shared heading drift");
  const preview = originalPreview(original.replace(heading, ""), surface);
  const anchor = "      <ResponsiveFilterDrawer";
  assert.equal(preview.split(anchor).length, 2, "Current P43 filter anchor drift");
  return preview.replace(anchor, heading + anchor);
}
