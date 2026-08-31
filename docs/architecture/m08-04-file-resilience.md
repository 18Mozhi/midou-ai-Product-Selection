# M08-04 本机文件韧性架构

M08-04 只覆盖惠州当前单机上由宝塔管理的证据目录、导出目录和运行临时目录。证据与导出文件路径固定为 `organizations/{organization_id}/workspaces/{workspace_id}/{category}/{resource_id}/{filename}`，路径段经过白名单校验且最终路径必须留在受控根目录内；原子写入使用同目录临时文件和重命名。`RUNTIME_TMP_ROOT` 只提供文件系统使用率、可读写与公网暴露检查，不把临时文件冒充持久索引资产，也不纳入恢复副本要求。系统不建设共享存储、备用服务器或负载均衡，也不据此给出容量承诺。

Worker 在新导出成功时计算 SHA-256 并写入 `report_exports.content_sha256`。平台 API 对证据和导出的活动索引做有界采样，核对文件存在、范围路径和 SHA-256；同时读取 M07-04 的 evidence/export 同机加密恢复副本及隔离恢复演练。三个目录任一缺失、不可写或公网暴露，以及持久文件校验不一致、文件缺失或恢复证据不完整，都失败关闭。

`platform:operate` 是服务端权限门。每次查看把观测、查看记录和平台审计写入同一 MySQL 事务，并保留 `request_id`、`trace_id`。响应只返回目录类别、容量、文件计数、完整性和恢复结论，不返回主机路径、文件名、哈希、组织 ID、工作区 ID、账号或凭证。

读取链路采用单次请求的 `AbortSignal`：文件流校验、probe 阶段边界、service 与三表事务都检查取消状态。API 在 14 秒停止读取并返回脱敏的 `file_resilience_read_timeout`；明确的 MySQL、网络和文件系统依赖错误返回 `file_resilience_dependency_unavailable`。取消或超时的事务必须回滚，不得在锁释放后补写成功观测。前端同一页面只允许一个刷新在途，并在 15 秒浏览器兜底后保留最后一次成功事实；401/403 仍清除旧平台事实。

页面布局依据 `images-html/61_平台运营-概览.jpg` 的结论层级、`images-html/64_系统监控.jpg` 的指标分组、`images-html/69_异常告警.jpg` 的告警列表，以及 `images-html/10_霓虹科技平台驾驶舱_dashboard.png` 的深蓝驾驶舱视觉。桌面与 390px 均保留 ready、warning、blocked、empty、forbidden、expired、rate_limited、timeout、unavailable、recovering 状态。

生产目录、Nginx 静态根、备份、恢复、清理、配置和进程只允许通过宝塔管理。API 仍是现有单进程 4101，M08-04 不新增常驻服务。
