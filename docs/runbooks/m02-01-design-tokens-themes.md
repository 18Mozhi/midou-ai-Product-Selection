# M02-01 宝塔发布与回滚

## 发布

1. 在宝塔执行 MySQL 备份，依次执行 `0014a`、`0014b`、`0014c` 的 up 迁移；必须使用 `product_scout` 业务账号和 MySQL 5.7。
2. 构建当前提交，在宝塔重启 Node API 以加载偏好路由，再发布 Vue Web 静态资源。Worker 与 Python Crawler 不涉及本模块，无需重启。
3. 登录并选择组织/工作区，打开 `/?view=theme`。验证默认深海蓝、三套预览、保存后刷新保持，以及 390px 键盘操作。
4. 本模块没有新增环境变量；不要在宝塔增加主题密钥或前端主题配置。

## 观测与恢复

- 401：重新登录；403：核对活动成员和当前范围；`preference_scope_required`：先重新选择组织/工作区；`preference_version_conflict`：刷新后再保存。
- 503 或数据库异常：在宝塔检查 Node API 和 MySQL；使用响应的 `request_id` / `trace_id` 关联 Node 日志与 `user_ui_preference_audit_events`。
- 前端读取失败会显示明确恢复入口，不把未确认偏好伪装为已保存。

## 回滚

1. 在宝塔停止新写入并备份三张 M02-01 表；保留审计证据。
2. 回退应用提交并重新发布 Web、重启 Node API。
3. 仅在确认不再需要偏好和审计数据后，按 `0014c`、`0014b`、`0014a` 的 down 文件逆序执行。若只回退页面，可保留兼容表不删除。
