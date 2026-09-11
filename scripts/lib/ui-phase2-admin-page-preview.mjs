import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { userPagePreview } from "./ui-phase2-user-page-preview.mjs";

// P44 review host only. Production scripts, directives and handlers remain intact.
export function adminPagePreview(original, surface) {
  if (surface === "detail") return userPagePreview(original, "detail");
  assert.equal(surface, "parent");
  let source = userPagePreview(original, "parent");
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `P44 source drift: ${before}`);
    source = source.replace(before, after);
  };
  replace("以下汇总不随当前用户筛选变化。", "以下为全平台汇总，不是当前列表条数。");
  replace('aria-label="用户目录"', 'aria-label="可授权账号目录"');
  replace(
    "<h3>用户目录</h3><p>先找到账号，再核对组织关系和登录访问。</p>",
    "<h3>可授权账号</h3><p>包含尚未授予平台角色的账号。进入详情后核对身份与当前授权。</p>",
  );
  replace("<span>用户邮箱</span>", "<span>账号邮箱</span>");
  replace("平台角色与组织关系在账号详情中核对。", "仅筛选账号状态，不代表角色权限范围。");
  replace(
    '<PlatformRoleComparison\n          v-if="tab === \'admins\' && platformRoles.length"\n          :roles="platformRoles"\n        />',
    '<section class="p44-comparison"><PlatformRoleComparison\n          v-if="tab === \'admins\' && platformRoles.length"\n          :roles="platformRoles"\n        /></section>',
  );
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(source).errors, []);
  return source;
}
