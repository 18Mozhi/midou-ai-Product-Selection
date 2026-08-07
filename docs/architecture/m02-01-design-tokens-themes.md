# M02-01 设计令牌与主题

## 范围

本模块交付 `deep-ocean`（默认）、`aurora-purple`、`cloud-white` 三套语义令牌和主题设置页。主题仅改变颜色、阴影、背景和图表语义色；权限、组织/工作区范围、功能可见性和业务结论保持不变。图片依据为 `images-html/01_72_page_concepts/22_主题设置.jpg` 与 `images-html/03_source_contact_sheets` 的主题总览。

## 数据与同步合同

- `user_ui_preferences` 以 `user_id + organization_id + workspace_id` 唯一，默认未落库时返回 `deep-ocean`、`source=default`、`version=0`。
- PUT 使用 `expected_version` 乐观锁和 `Idempotency-Key`；偏好、审计、幂等操作在一个 MySQL 事务提交。
- 会话必须已选择活动组织与工作区；服务端重新校验活动成员、组织和工作区，不接受浏览器传入范围。
- 审计只保存主题标识、范围、版本、`request_id` 与 `trace_id`，不保存 Cookie、令牌或页面数据。

## 不适用项

- 偏好写入是同步用户操作，不创建 Worker、Crawler、Outbox、队列、SSE 或重试任务；失败直接返回明确错误并允许用户刷新恢复。
- 不新增环境变量、密钥、文件、导出或下载合同。`config/env.example` 保持不变，生产 API 继续使用既有 MySQL 与会话配置。

## 无障碍合同

状态同时使用图标、文字和说明；图表同时提供数值、时间范围、来源与新鲜度。主题选择使用 `radiogroup`/`radio` 语义并支持键盘，焦点样式与减少动态效果偏好均由令牌层统一处理。
