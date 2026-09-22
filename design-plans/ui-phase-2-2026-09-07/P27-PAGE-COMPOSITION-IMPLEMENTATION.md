# P27 自动化规则 C 方向生产实施

## 范围

本批将已审核的蓝白 C 方向迁移到真实 `/automations` 页面与 `AutomationRuleCenter.vue`。页面包含规则目录、触发流程、条件与限流事实、最近执行、详情抽屉，以及创建/编辑规则弹窗和只读影响预览。

## 保留的运行合同

- 规则与当前工作区成员仍通过既有读取接口加载。
- 试运行继续调用 `POST /automations/preview`，只读，不创建通知或任务。
- 暂停/恢复继续调用 `POST /automations/{id}/actions`，保留 `action`、`expected_version` 与既有原因字段。
- 创建、编辑、版本冲突、权限拒绝、限流与失败追踪沿用现有状态机；本批不新增 API、数据库字段、Worker 或权限规则。

## 实施内容

- 在生产组件上启用 `automation-center--review` C 方向作用域，并将页面主标题升级为单一 `h1`。
- 以扁平蓝色标题区、白色事实卡、浅蓝流程区、零圆角控件、明确键盘焦点和响应式单列移动布局替换旧视觉层。
- 统一详情抽屉、创建/编辑窗、业务模板、影响预览和禁用/悬停/焦点按钮状态的视觉合同。

## 验证证据

- `node --test tests/unit/automation-page-preview.test.mjs`：通过。
- `node scripts/verify-automation-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 四组 40 项检查通过，生成 6 张审阅图。
- Web 类型检查、格式检查、生产构建与宝塔部署在本批提交前完成。

## 未覆盖边界

真实 RBAC、成员目录写入、规则创建/编辑保存、Worker 限流与死信、数据库事实、屏幕阅读器完整回归和正式 M07-03 生产证据不在本批假设为已验收。
