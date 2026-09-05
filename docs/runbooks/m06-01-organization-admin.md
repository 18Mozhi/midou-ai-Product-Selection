# M06-01 宝塔运行与回滚

## 部署

1. 在宝塔备份 `product_scout`，确认业务账号为 `product_scout`、字符集为 utf8mb4。
2. 执行 `0019_organization_admin_m06_01.up.sql`，再发布 Web 与 Node API 构建。
3. 在宝塔 Node API 受限环境配置 `ORG_INVITATION_TTL_HOURS=72`、`ORG_TOKEN_DEFAULT_TTL_DAYS=90`、`ORG_TOKEN_MAX_ACTIVE=20`，然后重启 Node API。真实密钥不写入仓库。
4. 复核 `/api/v1/health/live`、`/api/v1/health/ready` 和 `/org-admin`。邀请 Outbox 只表示待投递；邮件 Provider 未确认时不得人工改成已发送。
5. 已验证的现有账号需要立即加入组织时，由平台超级管理员在“用户管理 → 账号详情 → 加入其他组织”选择一个正常组织和一个组织角色并填写原因；该操作原子创建成员关系、单一角色和组织级数据范围，并把相同组织、邮箱且尚未过期的待处理邀请结转为已接受，不修改账号原有平台角色。

## 观测与故障处理

- 用 `request_id` / `trace_id` 在 Node API 日志、`audit_logs` 和 `outbox_events` 关联写入。日志不得包含 Token 明文或哈希。
- 409 版本冲突先刷新页面；`last_admin_forbidden` 先分配另一位组织管理员；`default_workspace_archive_forbidden` 先更新默认工作区。
- 审批模板差异异常时，先核对 `approval_templates.current_version`、对应的最近上一条 `approval_template_versions` 和两版 `approval_template_nodes.ordinal`；组织后台只读比较，不发布、回滚或改写模板。节点插入导致后续序号变化时会按真实流程位置逐项显示，不以名称猜测节点身份。
- 在 `/org-admin/audit` 准备大量 `realtime.connected` 与少量业务写入事件，默认应先看到业务记录和“系统连接记录 N 条”；展开后全部连接记录可见，收起后恢复业务优先。页内搜索“实时连接”或精确筛选 `realtime.connected` 应直接显示匹配记录，已加载总数、游标与请求追踪不得变化。
- Token 明文遗失不能恢复，只能轮换；轮换和撤销均保留审计。邀请投递依赖故障时保留 `pending_delivery`，恢复后由受控 Worker 处理。

## 回滚

先在宝塔关闭组织后台写入口，撤销本发布创建且不应继续有效的 Token，回滚 Web/API 至前一版本；确认无应用进程使用新增表后执行 `0019_organization_admin_m06_01.down.sql`。数据库回滚不会删除既有 `audit_logs` 和 `outbox_events`。本模块不需要新增生产服务；配置只在 Node API 重启后生效。
