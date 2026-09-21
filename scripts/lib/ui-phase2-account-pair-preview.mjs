import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";
import { userPagePreview } from "./ui-phase2-user-page-current-preview.mjs";
import { userCreatePreview } from "./ui-phase2-user-create-preview.mjs";
import {
  previewShellVue,
  shellReviewCss,
  shellReviewModule,
} from "./ui-phase2-shell-vue-preview.mjs";

export const accountPairRoot = "design-plans/ui-phase-2-2026-09-07/implementation";
export const accountPairCss = [
  `${accountPairRoot}/user-page-preview.css`,
  `${accountPairRoot}/user-create-preview.css`,
  `${accountPairRoot}/admin-comparison-preview.css`,
  `${accountPairRoot}/admin-page-assembly-preview.css`,
  shellReviewCss,
  `${accountPairRoot}/account-pair-app-preview.css`,
];
export const accountPairSupport = [
  "scripts/lib/ui-phase2-account-pair-preview.mjs",
  "scripts/lib/ui-phase2-user-page-current-preview.mjs",
  "scripts/lib/ui-phase2-user-page-preview.mjs",
  "scripts/lib/ui-phase2-user-create-preview.mjs",
  "scripts/lib/ui-phase2-shell-vue-preview.mjs",
  shellReviewModule,
  ...accountPairCss,
];
export function previewAccountPair(source, surface) {
  if (surface === "shell") return previewShellVue(source);
  if (surface === "create") return userCreatePreview(source);
  if (surface === "detail") return userPagePreview(source, "detail");
  assert.equal(surface, "parent");
  let result = userPagePreview(source, "parent");
  const replace = (before, after) => {
    assert.equal(result.split(before).length, 2, `Pair composition drift: ${before}`);
    result = result.replace(before, after);
  };
  // One actual shared Vue instance: headings must follow its real tab, not a static P43 host label.
  replace("以下汇总不随当前用户筛选变化。", "以下为全平台汇总，不是当前列表条数。");
  replace(
    'aria-label="用户目录"',
    ":aria-label=\"tab === 'admins' ? '可授权账号目录' : '用户目录'\"",
  );
  replace(
    '<header class="p43-directory-heading">',
    '<header v-if="tab !== \'admins\'" class="p43-directory-heading">',
  );
  replace('class="admin-directory-heading"', 'class="p43-directory-heading"');
  replace("<span>用户邮箱</span>", "<span>{{ tab === 'admins' ? '账号邮箱' : '用户邮箱' }}</span>");
  replace(
    "平台角色与组织关系在账号详情中核对。",
    "{{ tab === 'admins' ? '仅筛选账号状态，不代表角色权限范围。' : '平台角色与组织关系在账号详情中核对。' }}",
  );
  assert.equal(
    parse(result).descriptor.scriptSetup.content,
    parse(source).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(result).errors, []);
  return result;
}
