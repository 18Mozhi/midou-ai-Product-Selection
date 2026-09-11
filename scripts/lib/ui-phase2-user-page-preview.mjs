import assert from "node:assert/strict";
import { parse } from "@vue/compiler-sfc";

// Review hosts only: no production import and no script/handler replacement.
export function userPagePreview(original, surface) {
  let source = original;
  const replace = (before, after) => {
    assert.equal(
      source.split(before).length,
      2,
      `P43 ${surface} source drift: ${before.slice(0, 70)}`,
    );
    source = source.replace(before, after);
  };
  if (surface === "parent") {
    replace(
      '      <div v-if="data" class="account-metrics">',
      `<div class="p43-workspace"><aside class="p43-context" aria-label="全平台汇总与管理入口">
      <header><small>平台全局</small><h3>账号与组织</h3><p>以下汇总不随当前用户筛选变化。</p></header>
      <div v-if="data" class="account-metrics">`,
    );
    replace(
      "      </nav>\n      <ResponsiveFilterDrawer",
      `      </nav></aside><section class="p43-directory" aria-label="用户目录">
      <header class="p43-directory-heading"><h3>用户目录</h3><p>先找到账号，再核对组织关系和登录访问。</p></header>
      <ResponsiveFilterDrawer`,
    );
    replace(
      "    </template>\n    <OrganizationCreationWizard",
      "      </section></div>\n    </template>\n    <OrganizationCreationWizard",
    );
    replace(
      '<input v-model="query" :placeholder="searchPlaceholder" />',
      `<label class="p43-filter-field"><span>用户邮箱</span><input v-model="query" :placeholder="searchPlaceholder" aria-describedby="p43-query-help" /><small id="p43-query-help">输入邮箱关键词，搜索后更新列表。</small></label>`,
    );
    replace(
      '<select\n            v-model="status"',
      '<label class="p43-filter-field"><span>账号状态</span><select\n            v-model="status"',
    );
    replace(
      '</option></select\n          ><button :disabled="refreshing">',
      '</option></select><small>平台角色与组织关系在账号详情中核对。</small></label><div class="p43-filter-actions"><button :disabled="refreshing">',
    );
    replace(
      "        </form>\n      </ResponsiveFilterDrawer>",
      "        </div></form>\n      </ResponsiveFilterDrawer>",
    );
  } else if (surface === "detail") {
    replace('class="detail-dialog"', 'class="detail-dialog p43-user-detail"');
    replace(
      "      <h4>组织与角色</h4>",
      '<div class="p43-detail-columns"><section class="p43-memberships"><h4>组织与角色</h4>',
    );
    replace(
      "      <h4>登录会话</h4>",
      '</section><section class="p43-access"><div class="p43-sessions"><h4>登录会话</h4>',
    );
    replace("      <h4>平台角色</h4>", '</div><div class="p43-platform-roles"><h4>平台角色</h4>');
    replace(
      "      <footer>",
      '</div></section></div><footer><p class="p43-safety-note">账号访问操作<span>停用、改密与撤销会话需要进一步确认原因。</span></p>',
    );
  } else {
    throw new Error(`Unknown P43 review surface: ${surface}`);
  }
  assert.equal(
    parse(source).descriptor.scriptSetup.content,
    parse(original).descriptor.scriptSetup.content,
  );
  assert.deepEqual(parse(source).errors, []);
  return source;
}
