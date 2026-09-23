# P46 编辑器 · 必填字段可访问语义

## 改动范围

将已有 `formErrors` 所定义的必填关系暴露给辅助技术，不新增或改变校验、错误出现时机、字段顺序、提交门槛或请求内容。

- 16 个始终必填的输入字段增加静态 `aria-required="true"`。
- 条款参考 URL、条款版本、到期时间仅在公开模式（`public_page` / `public_rss`）且发布状态为 `enabled` 时动态声明必填；这与现有 `formErrors` 的启用前检查条件一致。
- 可选健康检查 URL 不声明必填；既有接入模式、发布状态、条款复核选择器及其他选择控件保持原生语义。
- 保持表单 `novalidate`，没有添加原生 `required` 或浏览器拦截；错误关联和 `aria-invalid` 原样保留。

## 组件与合同

| 来源 | 展示含义 |
| --- | --- |
| `ProviderRegistry.formErrors` | 现有必填与条件校验唯一事实来源，不修改。 |
| `publicTermsRequired` | 纯 computed，仅从已有 `access_mode` 与 `status` 派生屏幕阅读器必填语义。 |
| 19 个受约束输入 | 16 个固定必填 + 3 个条件必填；不扩展字段或请求契约。 |

## 验证与边界

- 新静态 SFC 合同：1/1；模板编译并断言必填字段集合与条件计算式。
- M03-01 真实 Vue 路由 E2E：桌面 Chromium 3/3、390px 手机 3/3。覆盖四步字段、可选健康检查 URL、公开/人工模式及启用/禁用状态切换；使用本地 API fixture，不提交数据。
- `npm run typecheck:web`、`npm run build:web`、`npm run verify:docs`、`npm run format:check` 与 `git diff --check` 通过。
- 不证明 NVDA/VoiceOver 等真实读屏器语音输出、真实权限/保存或 M07-03 生产签收。无 API/OpenAPI/DB/env/依赖/权限或服务拓扑改动。
- 部署核验：代码提交 `836967c4104b184dba7d08c01d3ab02715ba0e4f` 已推送；固定 `python scripts/deploy-baota.py` 返回 `deployed`，生产 build SHA 与代码提交一致。部署脚本报告固定网站、Node、Python 目标路径并清理临时包；这不替代真实读屏器、RBAC/保存或正式 M07-03 签收。本次仅静态前端变更，无需 Node/Python 重启。

完整 73 页面目标继续。
