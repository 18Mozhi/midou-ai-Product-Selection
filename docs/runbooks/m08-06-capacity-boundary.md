# M08-06 宝塔单机容量边界 Runbook

本 Runbook 是可选运营测量程序，不属于 M08-06、P08 或 P00–P08 的软件完成门。项目的软件完成只验证迁移、后端/API、前端状态、权限、审计、配置、测试、文档和启动链；未执行本程序时必须保持 `capacity_claim=unverified`。

页面上每项未签认事实和容量阻断都显示真实原因、下一动作及“平台运维管理员”责任角色。该角色来自接口既有 `platform:operate` 权限边界，不代表系统已经指定具体值班人；需要个人责任制时应在平台外的值班制度中分派，不能由页面猜测姓名。

## 部署

1. 当前固定目录发布使用 `product_scout` 业务账号执行 `0035_capacity_boundary_m08_06.up.sql`，确认 MySQL 5.7 和三张 `capacity_boundary_*` 表。
2. 在宝塔 Node API 受限环境同步 `CAPACITY_BOUNDARY_*` 配置；阈值变化必须重新构建、重新完成同提交灰度和容量证据，不能为了通过门禁临时放宽。
3. 只通过宝塔启动既有 `ai选品` Node 项目、`ai选品-python` Python 项目和有限容量任务。不得使用 systemd、独立 PM2、宿主 crontab 或屏外 Docker Compose。
4. 发布后按当前固定单后端门核验错误率、读写 P95 与异步滞后；任一门失败立即止损，不复用旧提交观察窗。
5. 同提交容量基线、MySQL live、API、桌面与 390px 旅程、文档和生产证据全部通过后，才能显示实测单机有限边界。

## 受控基线

- 规划 100 用户、规划并发 5–20 仅用于安排测量；`scripts/capture-capacity-boundary-production.mjs` 固定按 5→10→20 逐档执行，每档不少于 `CAPACITY_BOUNDARY_STAGE_SECONDS=60` 秒，任何门失败即停止扩大，不能通过配置跳过档位。固定并发 5 失败时不签发容量；5 或 10 已通过而下一档失败时，只签发最后通过档位，失败下一档不计入容量。
- 每个样本必须来自本机宝塔 Nginx TLS，分别记录核心读/写 P95、错误率、异步滞后、归一化负载、可用内存和磁盘。
- 最新 `production_benchmark` 必须属于当前提交；`observed_at` 按 UTC 写入，并由容量仓储从 MySQL 5.7 `DATETIME(3)` 文本规范化为 UTC ISO 时间，不能受 MySQL `system_time_zone` 或驱动本地时区影响。页面和生产 verifier 会拒绝缺失、未来时间或超过配置时效的证据。
- 归档与恢复只复用 M08-04 已验证的本机加密目录和隔离恢复库，不使用备用服务器，也不把客户数据移出中国境内。

宝塔有限任务在当前已晋级 release 根目录运行 `node scripts/capture-capacity-boundary-production.mjs --run --env-file <宝塔受限环境文件>`。release 包不要求包含 `.git`；任务以环境中的 40 位 `BUILD_SHA` 为期望值，并通过本机宝塔 Nginx TLS 版本接口和 MySQL `healthy` 发布记录交叉确认同一提交。环境文件必须保持 0600，任务输出只留脱敏指标与 request_id/trace_id；真实数据库密码和签名密钥不得打印。任务开始即把旧证据标为 blocked。固定并发 5 未通过、持久写不匹配、资源门异常或归档/恢复未验证时保留 schema v1 blocked 证据；至少一个档位通过且其持久写、资源门、归档/恢复和事务审计全部通过时，原子签发 schema v1 ready 证据，其中 `measuredConcurrentUsers` 等于最后通过档位，`stages` 只包含连续通过档位，`boundaryStop` 保留规划上限结束或下一档失败的指标与失败码。失败证据必须原子保留已完成档位、原阈值、失败码和失败档位；不得只留下无指标占位、把失败档位算入容量或隐藏停止原因。

## 告警与降级

- `warning`：已签发最后通过档位，但下一档触发停止线；保持当前实测边界，暂停非关键后台工作，不晋级失败档位。
- `blocked`：停止新增后台工作，保留既有请求、任务、审计和证据；通过 `request_id`/`trace_id` 定位 API、MySQL、Redis、Worker 或 Crawler。
- 证据过期/缺失：重新运行宝塔有限任务，禁止手写时间或复用旧提交文件。
- 归档/恢复未验证：先按 M08-04 Runbook 在隔离目标完成真实演练，禁止只改数据库标志。

## 回滚

1. 立即通过宝塔保持 Nginx 的单一 4101 上游，并以本地目标 Git 提交重新构建、部署上一版 API、Worker、Crawler。
2. 保留 `capacity_boundary_*` 与 `platform_audit_events`，不得删除失败样本或修改阈值伪造通过。
3. 只有确认上一版不再读取/写入 0035 表后，才使用 `0035_capacity_boundary_m08_06.down.sql` 删除新表；否则表保持兼容留存。
4. 回滚后重新核验 TLS、单一 4101、MySQL/Redis、稳定版本健康与审计链。不得启用备用服务器、负载均衡、多节点或面板外服务绕过。
