# P18 机会详情 C 方向生产实施

## 范围

本批将蓝白机会详情工作区迁移到真实 `OpportunityWorkspace.vue` 详情分支及决定、概览、证据组件：机会身份、系统结论、五项质量门、人工决定条件和事实分区。

## 保留运行合同

- 保留成员守卫，以及详情、利润、下游和 AI 的独立读取路径。
- 采纳入口只在 `selection_stage === "recommended"` 且五项质量门全部通过时显示。
- 继续使用原生决定窗和既有采纳、观察、驳回、补采任务、评分、成本与 AI 行为。
- 不用缺失字段补造评分、利润、证据或风险结论。

## 实施内容

- 启用 `opportunity-workspace--review` 作用域，重构详情返回、蓝色身份头、决定摘要、质量门、操作区、Tab 和事实分区。
- 以白色/浅蓝台账、明确层级、44px 控件、键盘焦点和手机单列布局替换旧账页皮肤。
- 保留真实组件、数据绑定、权限判断、路由和 API，不新增业务动作或权限规则。

## 验证

- `node --test tests/unit/opportunity-detail-page-preview.test.mjs`：1/1 通过。
- `node scripts/verify-opportunity-detail-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 共 32 项检查，0 次写入，8 张截图。
- 类型检查、格式检查、生产构建、发布归属校验和宝塔部署在本批提交前完成。

## 未覆盖边界

本批不等同于真实会话/RBAC、决定/补采/评分/成本/AI 实写、全部分区状态、屏幕阅读器/真机验收或正式 M07-03 证据。
