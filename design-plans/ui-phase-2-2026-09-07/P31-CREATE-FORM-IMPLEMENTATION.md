# P31 创建资源授权表单字段反馈实施

## 范围

- 工作区、资源类型、资源 UUID、同组织活动成员、最小动作、业务原因和到期时间增加就近帮助/错误反馈；仅提交尝试后展示必要字段错误。
- 使用已有字段值和前端同源约束校验；首个无效控件获得焦点，有效字段通过 `aria-describedby` 关联帮助及错误。
- 授权目标仍要求用户从资源详情复制 UUID。保留 OrganizationRolePanel → `createGrant` → OrganizationAdminCenter 的提交路径和现有请求合同。

## 未改变

- 未改变 API、payload、权限/RBAC、服务端校验、数据库、依赖或部署配置。
- 未改变成员选择范围、资源类型动作白名单、reason 规则或最长30天既有边界。

## 验证

- M06-01 desktop Chromium：49/49 通过；390px手机：48通过、1跳过；新增创建表单用例双端通过。
- `npm run typecheck:web`、`npm run format:check`、`npm run verify:docs`、`npm run verify:plans`：通过。
- `npm run build:web` 与 `npm run verify:frontend-budget`：通过；P31样式拆到异步子组件 scoped CSS，新增样式包约0.89KB。
- 全站动作映射已按当前 `OrganizationRolePanel.vue` 源码对齐三处P31候选身份；这是既有动作/源位置的身份替换，不增加动作，也未伪造视觉图或提升动作审批状态。
- 隔离 HTTP fixture 不证明真实服务端、RBAC、MySQL 审计或 M07-03。

## 部署

- UI-only 前端改动通过既有 `scripts/deploy-baota.py` 固定宝塔流程发布；生产 Node/Python 服务无需因本改动重启。
- readiness、availability 和实际页面资源分别记录；依赖未就绪时不得把页面可访问等同于正式 M07-03 验收。
