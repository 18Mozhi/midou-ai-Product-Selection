import assert from "node:assert/strict";
import { accountFilterPreview } from "./ui-phase2-account-filter-preview.mjs";

// Only the isolated P39 review host imports this transformation.
export function accountPagePreview(original) {
  let source = accountFilterPreview(original).source;
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `P39 review source drift: ${before.slice(0, 70)}`);
    source = source.replace(before, after);
  };
  const refresh =
    '<button class="secondary" :disabled="refreshing || Boolean(busy)" @click="load">\n            {{ refreshing ? "正在刷新…" : "刷新数据" }}\n          </button>';
  replace(refresh, "");
  replace('"查看平台账号使用概况"', '"组织与账号概览"');
  replace(
    '"创建组织、启停账号、分配平台管理员。所有操作都会留审计记录。"',
    '"核对全局规模，进入组织、用户和管理员管理。"',
  );
  replace('"还没有组织"', '"当前没有组织记录"');
  replace(
    '"创建首个组织后，系统会同时建立默认工作区和组织级数据范围。"',
    '"本次读取未返回组织记录；平台全局汇总与当前列表独立显示。"',
  );
  replace(
    '      <div v-if="data" class="account-metrics">',
    `<div class="p39-page-grid"><aside class="p39-directory" aria-label="平台全局规模与管理入口">
      <header><h3>平台全局</h3><p>汇总不随组织列表筛选变化</p></header>
      <div v-if="data" class="account-metrics">`,
  );
  replace(
    "      </nav>\n      <ResponsiveFilterDrawer",
    `      </nav></aside>
      <section class="p39-results" aria-label="组织结果区域"><header class="p39-results-head"><div><h3>组织记录</h3><p>组织名称、成员、工作区与状态</p></div>${refresh}</header>
      <ResponsiveFilterDrawer`,
  );
  replace(
    "    </template>\n    <OrganizationCreationWizard",
    "      </section></div>\n    </template>\n    <OrganizationCreationWizard",
  );
  return source;
}
