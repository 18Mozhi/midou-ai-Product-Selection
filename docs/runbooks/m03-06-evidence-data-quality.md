# M03-06 证据与数据质量运维手册

## 宝塔配置与发布

生产只使用宝塔面板管理的 Node API、Node Worker、Python Crawler、MySQL 5.7、Redis 和文件目录，不新增 systemd、独立 PM2、宿主机 crontab或屏外 Docker 服务。

- `EVIDENCE_ROOT`：中国境内、非 Web 根目录的证据文件根目录；Node Worker 需要写权限，Node API 只需受控读取权限。
- `EVIDENCE_MAX_RAW_BYTES`：单份原始证据最大字节数，默认 10485760，可调 1024–104857600。
- `EVIDENCE_DOWNLOAD_GRANT_SECONDS`：下载授权秒数，默认 120，可调 1–300。
- `EVIDENCE_DOWNLOAD_SIGNING_KEY`：至少 32 字符的生产秘密，只写入宝塔受限环境，禁止提交或输出。

配置在进程启动时读取。上述配置变化后必须在宝塔重启 Node Worker 和 Node API；仅页面静态资源变化按现有网站发布流程刷新，不需要新增服务。

## 发布验证

1. 备份 MySQL 与证据目录，确认数据库是 MySQL 5.7、utf8mb4、`product_scout` 业务账号。
2. 在宝塔停止 Node Worker，执行 `0016f_evidence_quality_m03_06.up.sql`；登录型浏览器证据还需在 0048、0049 之后执行 `0050_browser_evidence_artifacts.up.sql`。
3. 复用现有依赖构建并运行 `npm run verify:module -- M03-06`。验收包含 MySQL 5.7 事务、文件完整性、去重冲突、字段溯源、质量阈值、组织隔离、受控下载、审计及桌面/390px 页面。
4. 由宝塔重启 Node API 与 Node Worker；M03-07 完成前不要接入或启动真实 Provider 执行器。
5. 在 `/platform-admin/data` 核对证据、质量问题、核对运行、详情血缘和短时下载。使用 request_id/trace_id 关联 Node Worker、Node API、事件与 Outbox。

## 告警、故障与恢复

- `evidence_dedupe_conflict`：同一来源去重键产生不同内容。停止该 Provider 的继续写入，核对 M03-07 去重合同与 Parser；不得覆盖旧证据。
- `evidence_integrity_failed`：文件大小或 SHA-256 不一致。隔离文件资产，停止下载并从境内备份恢复；不得把数据库哈希改成损坏文件的哈希。
- `insufficient_sample`：保留警告问题并增加合法样本，不得按通过处理。
- MySQL 写入失败：事务回滚并删除本次精确文件；检查宝塔 Node Worker 日志，确认无孤儿文件后重试。
- 文件系统写入失败：不进入数据库事务；检查目录容量、权限和挂载状态。
- `browser_evidence_invalid` / `browser_evidence_conflict`：停止对应来源，核对完成结果中的 DOM、截图、SHA-256 和解析版本；不得跳过哈希或覆盖同一作业的旧制品。
- 下载签名密钥缺失：API 返回 503，列表和详情仍可用；在宝塔补齐密钥并重启 Node API。
- Outbox 积压：证据事实仍以 MySQL 为准，暂停下游消费并修复发布器，不删除事件或宽泛重放。

## 保留与回滚

`retention_until` 取自 Provider 保留天数；本模块只记录到期边界，不在未实现审批前自动物理删除。到期清理任务必须由后续治理模块通过宝塔计划任务交付，且先标记、审计、再精确删除。

回滚前在宝塔停止 Node Worker 和 Node API，确认没有活动写入/下载并完成双备份，再执行 down migration、回退代码/config 并由宝塔恢复旧版本。down migration 不自动删除 `EVIDENCE_ROOT` 文件；依据回滚批次清单精确处理，禁止删除整个共享根目录。验证脚本创建的 OS 临时目录在 finally 精确清理。
