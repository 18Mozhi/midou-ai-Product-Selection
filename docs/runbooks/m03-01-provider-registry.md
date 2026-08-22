# M03-01 来源注册中心运维说明

## 部署和启用

部署 `0056_provider_terms_version_expiry.up.sql` 后，已有公开来源不会被自动填写虚构版本或到期日。平台管理员必须根据实际条款登记版本和未来到期时间；完成前公开页/公开 RSS 的新执行会失败关闭。发布包上传后通过宝塔重启 `ai选品` Node 项目以加载新的 API 与 Worker 合规门，Python 项目无需因本迁移单独重启。

1. 在宝塔数据库管理中备份 `product_scout`，使用业务账号依次执行 `0016a_provider_registry_m03_01.up.sql` 与 `0052b_provider_public_compliance.up.sql`。
2. 在宝塔 Node 项目 `ai选品` 中发布已验证代码并重启统一 Node 进程；静态站点发布新的 Web 构建产物。Python 项目不需要重启。
3. 本模块不新增环境变量。保留既有 `APP_WEB_ORIGIN`、MySQL 连接和会话配置，不创建 systemd、独立 PM2、宿主机 crontab 或面板外容器。
4. 以具备 `provider:configure` 的平台管理员访问 `/platform-admin/providers`。登记真实合同后先保持 `disabled`，由项目负责人确认目标地址、访问条款、字段和容量，填写真实条款 HTTPS 参考地址并将复核状态设为“已批准”，再改为 `enabled`。迁移不会替现有来源自动填写批准结论；原有公开来源必须逐项复核。
5. 新建来源按四步抽屉完成。可按接入模式应用技术模板，但模板不是平台接口文档；必须逐项核对目标地址、字段、失败规则和条款事实。即时校验未通过时不能进入发布，公开来源启用仍以服务端合规门为最终依据。

配置调整通过版本化页面完成：频率 1–10080 分钟、并发 1–20、超时 1000–120000ms、重试 0–10、熔断阈值 1–20、保留期 1–3650 天。修改必须基于页面最新版本；409 表示需要刷新后重做，不能覆盖他人的版本。

## 验证与排障

在代码发布目录执行：

```powershell
npm run verify:module -- M03-01
```

该门禁包含构建、单元/契约测试、MySQL 5.7 事务实测、Playwright 桌面/390px 视觉回归和文档检查。实测会创建唯一用户与来源，验证两版快照、两条幂等操作、过期版本阻断，然后清理全部数据。

390px 验证时，来源列表应显示摘要卡片；点“查看详情”后应能查看完整业务字段并进入编辑器，只有展开“技术详情”才显示来源 UUID、来源代码、目标地址和原始接入模式。关闭按钮、遮罩与 Esc 均应关闭抽屉并把焦点还给原卡片。

- 401：会话过期，重新登录。
- 403：确认平台角色包含 `provider:configure`；写请求还应来自 `APP_WEB_ORIGIN`。
- 409：刷新最新版本，或为新的业务操作生成新的 Idempotency-Key。
- `public_source_compliance_required`：公开来源尚未批准条款或缺少 HTTPS 参考地址，保持禁用并由负责人复核。
- `robots_disallowed`：目标路径被同源 robots 明确禁止，任务进入 robots 受阻；不得绕过，先由负责人复核来源政策。
- robots 判定审计：在采集任务详情展开对应子查询，核对 `scoutops-robots-policy-v1`、命中 User-agent、Allow/Disallow 规则预览与 HTTP 状态。规则预览被截断时使用同一事件中的 SHA-256 对照原始 robots 文本；没有判定元数据的旧任务不得补猜命中规则。
- 503/blocked：在宝塔检查 Node API 和 MySQL 状态、连接数与错误日志，携带 request_id/trace_id 定位。
- 页面空态：表示尚未登记来源，不得以示例数据填充。

M03-01 本身没有 Crawler、Worker、Redis 队列、文件或计划任务，排障时不要创建临时生产服务。登记为 enabled 也不会在 M03-03 前自动采集。

## 回滚与恢复

1. 在宝塔停止统一 Node 项目 `ai选品`，并记录变更窗口和备份编号。
2. 若需要保留配置，先在受控位置导出 `providers`、`provider_versions`、`provider_operations`。
3. 执行 `0016a_provider_registry_m03_01.down.sql`，回滚应用和静态站点版本。
4. 由宝塔重启 Node API，检查 `/api/v1/health/live` 与 `/api/v1/health/ready`。
5. 若需恢复，先重建迁移，再从同一备份恢复三张表并核对 provider_id、version 与外键。

回滚 SQL 会永久删除来源定义和版本审计，未完成备份与恢复演练前不得在生产执行。
