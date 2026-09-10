import assert from "node:assert/strict";
import { accountPagePreview } from "./ui-phase2-account-page-preview.mjs";

// P40 review-only composition. Never imported by the production application.
export function organizationListPreview(original) {
  let source = accountPagePreview(original);
  for (const [before, after] of [
    ['"管理组织状态与隔离边界"', '"组织管理"'],
    [
      '"核对成员与工作区数量，进入详情维护资料、停用或恢复。所有操作都会留审计记录。"',
      '"查找组织，核对成员与工作区，进入详情维护资料和状态。"',
    ],
    ['id="p39-query-label">关键词', 'id="p39-query-label">组织名称或标识'],
    [
      "概览只展示组织记录。用户邮箱查询结果请到用户管理查看。",
      "按组织名称或标识查询，不按成员邮箱查询。",
    ],
    ["“已停用”和“已停用组织”是不同的筛选值。", "仅筛选组织状态，不代表成员账号状态。"],
    ["组织名称、成员、工作区与状态", "名称与标识、关系数量和当前状态"],
  ]) {
    assert.equal(source.split(before).length, 2, `P40 review source drift: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}

export function organizationRecordPreview(original) {
  const before = `<small
          >{{ statusText(row.status) }} · {{ row.member_count }} 人 ·
          {{ row.workspace_count }} 个工作区</small
        >`;
  assert.equal(original.split(before).length, 2, "P40 mobile summary source drift");
  return original.replace(
    before,
    `<small class="p40-record-status">{{ statusText(row.status) }}</small>
        <span class="p40-record-counts"><span>成员 <b>{{ row.member_count }}</b> 人</span><span>工作区 <b>{{ row.workspace_count }}</b> 个</span></span>`,
  );
}
