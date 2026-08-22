# M03-03 Provider 适配器运维说明

## 宝塔部署

1. 在宝塔备份 `product_scout`，用业务账号执行 `0016c_provider_adapters_m03_03.up.sql`。
2. 在 Node API 与后续调用适配器的 Node Worker 宝塔受限环境配置 `PROVIDER_ADAPTER_HEALTH_TIMEOUT_MS`、`PROVIDER_ADAPTER_MAX_RESPONSE_BYTES`、`PROVIDER_ADAPTER_MAX_ITEMS_PER_BATCH`；初始值以 `config/env.example` 为准。
3. 运行 `npm run build`，由宝塔重启 Node API；M03-03 不新增 systemd、独立 PM2、宿主机 crontab、面板外 Docker 或常驻采集进程。当前 Crawler 不调用该包，无需因本模块重启。
4. 访问 `/platform-admin/providers/adapters`。未在代码中注册的 Provider 显示“待登记”，健康检查显示“受阻”是预期的真实状态；原始 `adapter_not_registered` 只在“技术详情”展示，不得手工改为健康。
5. 核对来源健康的 24 小时窗口：成功率、P95 和样本量来自已完成子查询；网络、解析、登录和成功空结果必须分开显示。样本量为 0 时页面应显示“暂无样本”，不得用探针延迟填充运行 P95。
6. 核对“错误预算与恢复门”：连续运行失败和阈值必须分别来自 `provider_runtime_circuits` 与 `providers`。来源暂停后先在本页执行真实健康检查；只有检查结果为健康且时间晚于暂停时间，页面才显示可解除并直达采集调度。健康检查不得自动清零运行熔断，探针自身连续失败也不得冒充运行错误预算。
7. 在热点来源页选择一个已有真实 HTML/DOM 证据的公开页面或登录页面来源，打开“解析兼容矩阵”。页面版本必须等于留存证据的 SHA-256，解析结论必须与对应子查询成功或解析类失败一致；网络与登录失败只能显示待验证。没有证据时保持空状态，不得触发新采集或自动启停来源。

三个上限都在进程启动时读取，修改后必须由宝塔重启 Node API；Worker 在后续模块接入该包后也必须重启。每个 Provider 自身的 `timeout_ms` 继续生效，健康探针采用 Provider timeout 与全局健康 timeout 中较小者。

## 验证与恢复

```powershell
npm run verify:module -- M03-03
```

门禁覆盖运行时 scope/limit/字节/超时、normalize provenance、缺失实现失败关闭、provider:configure/Origin/幂等、MySQL 5.7 当前健康/不可变版本/审计、桌面与 390px 视觉和文档。MySQL 实测只在验证进程注册合成适配器，结束后清理 Provider、用户和健康记录，不会写入生产注册表。

390px 验证时，适配器应显示摘要卡片；详情抽屉必须保留健康检查按钮与完整业务字段，只有展开“技术详情”才显示来源 UUID、来源代码、原始接入模式、适配器版本和错误码。

来源暂停的移动详情必须同时显示错误预算、恢复门和真实健康检查按钮。检查通过后进入采集调度，按 M08-05 的二次确认解除当前来源；禁止直接改表、批量清零或使用早于暂停时间的旧健康结果。

热点来源的兼容矩阵在 390px 下使用单列卡片，不得横向溢出；主卡只显示截断页面指纹，完整 SHA-256 只在技术详情。该查询只读现有证据，不增加环境变量、迁移或常驻进程；单独发布 API 代码需要由宝塔重启统一 Node 后端，Web 静态文件同时替换。

- `adapter_not_registered`：确认该 Provider 是否属于 M03-07 已准入的真实来源；不要猜请求合同或伪造成功。
- `adapter_mode_mismatch`：Provider access_mode 与代码注册声明冲突，停止调用并修正版本化定义或适配器实现。
- `timeout` / `rate_limited` / `dependency_unavailable`：保留 request_id/trace_id，按 Provider 失败规则退避；M03-05 接入后由任务状态机负责重试和死信。
- `login_expired`：停止自动探针并由获授权人员处理凭证；不得绕过验证码、登录或平台限制。
- `invalid_payload` / `response_too_large`：隔离该结果，检查 Parser 与全局边界，不扩大上限掩盖合同错误。

回滚前按架构文档冻结入口并备份；down 迁移只删除适配器健康与操作历史，不删除 Provider 定义。恢复时同时恢复三张表和对应应用版本。
