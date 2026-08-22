# M08-04 本机文件韧性 Runbook

## 适用范围

仅处理惠州当前单机、宝塔管理的 `EVIDENCE_ROOT`、`EXPORT_ROOT` 和 `RUNTIME_TMP_ROOT`。生产临时目录固定为 `/www/wwwroot/ai选品/runtime/tmp`。禁止创建共享存储、备用服务器、负载均衡、systemd 服务、面板外 PM2、宿主机 crontab 或屏外 Compose。

## 核验与处置

1. 在宝塔受限配置确认三个根目录为不同绝对路径，且都不位于网站静态根或 Nginx `root`/`alias` 可访问范围；设置 `RUNTIME_TMP_ROOT=/www/wwwroot/ai选品/runtime/tmp` 后必须重启宝塔 Node 项目。
2. 通过宝塔有限任务核对目录所有者、权限、可读写性、文件系统总量和可用量；不得打印目录路径、文件名、哈希或凭证。
3. 对最近的 evidence/export 索引做不超过 `FILE_STORAGE_CHECKSUM_SAMPLE_LIMIT` 的有界 SHA-256 样本核验。临时目录只核对文件系统水位、可读写性和公网暴露，不扫描或返回临时文件名。任何缺失或不一致都停止相关下载和新增大文件任务，不得自动删除未知文件。
4. 运行 `node scripts/verify-file-resilience-live.mjs`，它只在唯一组织/工作区范围写入两个小探针，核对路径与哈希后删除自己的组织子树。
5. 核验 M07-04 同机独立加密恢复目录中同时存在 evidence/export 完整副本，并且 90 天内隔离恢复已验证权限边界、审计链和证据哈希。
6. 生产证据必须与当前 Git 提交一致，明确 `singleHost=true`、`sharedStorageEnabled=false`、`loadBalancingEnabled=false`、`backupServerUsed=false`、`capacityClaim=unverified`。
7. 完成迁移与发布后只通过宝塔重启 Node API 和 Worker；前端为静态构建，由宝塔网站发布。配置运行时读取，修改环境变量后必须在宝塔重启对应 Node 项目。
8. 当前仓库内生产证据早于临时目录水位扩展。部署后必须重新运行受限生产核验并生成与当前提交一致的证据，完成前不得宣称第三目录已在生产验证。

## 告警

- 目录使用率达到 warning：暂停扩大导出/证据并发，按保留策略归档，随后复核同机加密副本。
- 达到 stop、目录不可写、公网暴露、文件缺失、哈希不一致或恢复证据无效：失败关闭，停止新增大文件任务并保留审计证据。
- 不得为了通过门禁提高容量水位、降低校验样本或放宽恢复演练有效期。

## 回滚

异常时通过宝塔恢复上一版本应用与原受限目录配置，并重启上一版本 Node API/Worker。保留文件和审计记录，不删除未知文件。确认上一版本 Worker 已停止写 `content_sha256` 后，才可执行 `0033_file_resilience_m08_04.down.sql`；该回滚先删除本模块查看/观测表，再删除新增列。保留失败的 `request_id`、`trace_id`、宝塔任务日志与证据摘要。
