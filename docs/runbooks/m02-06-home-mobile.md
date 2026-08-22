# M02-06 宝塔发布、验证与回滚

## 发布

1. 在宝塔 MySQL 5.7 使用 `product_scout` 业务账号执行 `0015b_home_dashboard_m02_06.up.sql`，确认表字符集为 `utf8mb4`、UUID 外键为 ASCII。
2. 通过宝塔 Node 项目发布并重启 Node API，使 `/api/v1/me/home-dashboard` 生效；通过宝塔网站发布 Vue Web 静态资源。Node Worker、Python Crawler 和 Redis 无变更，不重启，不创建面板外服务。
3. 不新增环境变量。验证桌面与 390px `/home` 合并本人任务、当前审批节点和本人待决策机会，阻断项可进入完整详情，行动显示来源、风险、已有价值分数和时限；同时验证固定排序、按路由去重、变化来源数/时间、仅本人健康提示、空状态三个入口，以及 `/opportunities/{uuid}` 的真实详情。

## 故障定位

- 首页空：检查活动会话的组织/工作区、本人未完成任务、本人当前审批节点、本人待决策机会，以及 `home_dashboard_items` 的 capability、受众、站内 route、`source_version` 与 `observed_at`。上述范围都为空时空状态才是正确结果。
- 行动顺序异常：先核对逾期时间、暂停或关联采集阻断、任务优先级、机会风险、推荐状态与已有总分，再按 `overdue, blocking, high_risk, high_value, normal` 检查排序；不要用前端重新定义业务排序。
- 阻断项无法进入上下文：任务必须使用 `/tasks/{id}`，审批使用 `/tasks/approvals?approval={id}`，机会使用 `/opportunities/{id}`；关联采集上下文由任务详情中的 `collection_task_id` 继续下钻。
- 健康信息缺失：健康项必须将 `audience_user_id` 设置为受影响用户；禁止改为全工作区广播来绕过过滤。
- 401/403/409：重新登录、检查 capability 或重新选择组织/工作区。429/502/503/504 显示受阻并使用 `request_id` 定位宝塔 Node API 日志。

## 回滚

先在宝塔网站和 Node 项目回退 Web/API 并重启 Node API。确认后续模块未依赖首页投影后，备份必要投影并执行 `0015b_home_dashboard_m02_06.down.sql`。该表不包含原始业务真相；不得删除任务、机会、趋势、来源或证据原表。Worker/Crawler/Redis 无需处理。
