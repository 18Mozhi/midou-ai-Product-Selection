# P55 当前 Vue C 组合 · 批108

## 审核范围

本批使用实际 `/platform-admin/governance` 与 `PlatformGovernanceCenter`，仅在本地审核层重构五类治理目录、默认评分规则工作区、筛选快照、记录与来源历史。原有自动化详情、筛选无结果、温和权限拒绝和读取失败保留快照证据继续保留，不被本批覆盖。

## 可审核图

- [手机本批实际审核图](../../output/playwright/p55-page-composition-r1/390-governance.png)
- [桌面本批实际审核图](../../output/playwright/p55-page-composition-r1/1440-governance.png)
- [既有手机自动化详情](design/governance-direction-c/vue-implementation/P55-390-governance-automation-detail.png)
- [既有桌面自动化详情](design/governance-direction-c/vue-implementation/P55-1440-governance-automation-detail.png)

本批两图的 `manifest.json` 保存真实 Vue 路由、视口和零写入检查；既有图的同名 JSON 保存原始断言、源码指纹与溢出检查。全部是本地夹具，不是生产数据。

## 保留的合同

- 五类目录和全局摘要与当前列表筛选保持不同口径。
- 自动化详情中的触发、动作、频控及 0 次频控按返回事实展示。
- 本页只跳转到已有工作台；不新增本地编辑、审批、发布或治理写入。

## 已有本地验证

`node --test tests/unit/governance-page-preview.test.mjs` 通过。

`node scripts/verify-governance-page-preview.mjs --capture-review r1` 在 1440/390 各通过 6 项检查，生成本批永久审核图；每组 2 次本地 GET、零写入。

既有 `tests/e2e/m06-02-platform-dashboard.spec.ts` 继续覆盖自动化详情、筛选空态、拒绝和保留快照；复验不会自动覆盖本批审核图。

## 未覆盖

未验证真实 MySQL、RBAC、跨组织目标工作台、读屏、完整缩放/主题或生产环境；本批不构成生产验收。
