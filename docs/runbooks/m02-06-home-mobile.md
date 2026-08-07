# M02-06 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 使用 `product_scout` 业务账号执行 `0015b_home_dashboard_m02_06.up.sql`，确认表字符集为 `utf8mb4`、UUID 外键为 ASCII。
2. 通过宝塔 Node 项目发布并重启 Node API，使 `/api/v1/me/home-dashboard` 生效；通过宝塔网站发布 Vue Web 静态资源。Node Worker、Python Crawler 和 Redis 无变更，不重启，不创建面板外服务。
3. 不新增环境变量。验证桌面与 390px `/home`、空状态三个入口、行动排序、变化来源数/时间、仅本人健康提示，以及 `/opportunities/{uuid}` 的诚实骨架。

## 故障定位

- 首页空：检查活动会话的组织/工作区、`home_dashboard_items` 的 capability、受众、站内 route、`source_version` 与 `observed_at`。P03–P05 未写入时空状态是正确结果。
- 行动顺序异常：按 `overdue, blocking, high_risk, high_value, normal` 核对 `priority`，不要用前端重新定义业务排序。
- 健康信息缺失：健康项必须将 `audience_user_id` 设置为受影响用户；禁止改为全工作区广播来绕过过滤。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻并使用 `request_id` 定位宝塔 Node API 日志。

## 回滚

先在宝塔网站和 Node 项目回退 Web/API 并重启 Node API。确认后续模块未依赖首页投影后，备份必要投影并执行 `0015b_home_dashboard_m02_06.down.sql`。该表不包含原始业务真相；不得删除任务、机会、趋势、来源或证据原表。Worker/Crawler/Redis 无需处理。
