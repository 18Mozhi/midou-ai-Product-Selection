# `/platform-admin/redis` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：Redis 运行，`/platform-admin/redis`；平台后台 / 系统运维 / Redis 运行。
2. 服务角色：具备 `platform:operate` 或 `platform:superadmin` 的平台运营管理员、平台超级管理员。匿名真实接口为 401；移除本地测试账号的平台角色后真实接口为 403，恢复角色后重新可读。
3. 业务目标：在固定惠州单机、宝塔唯一运维入口和单 Redis 实例边界内，核对 AOF、RDB、内存、连接、拒绝连接、淘汰、脱敏有界键空间与阻断项；页面不是 Redis 配置编辑器，也不宣称 Sentinel、集群、副本或跨机房高可用。
4. 当前截图：修复前桌面 [before-desktop-1440.png](../../output/playwright/platform-admin-redis/before-desktop-1440.png)、修复前 390px [before-mobile-390.png](../../output/playwright/platform-admin-redis/before-mobile-390.png)、修复前刷新悬挂 [before-refresh-hanging-mobile.png](../../output/playwright/platform-admin-redis/before-refresh-hanging-mobile.png)；修复后桌面 [after-desktop-1440.png](../../output/playwright/platform-admin-redis/after-desktop-1440.png)、修复后 390px [after-mobile-390.png](../../output/playwright/platform-admin-redis/after-mobile-390.png)、15 秒保留 [after-refresh-timeout-preserved-mobile.png](../../output/playwright/platform-admin-redis/after-refresh-timeout-preserved-mobile.png)、真实 Redis 断连 [after-redis-blocked-mobile.png](../../output/playwright/platform-admin-redis/after-redis-blocked-mobile.png)、真实 MySQL 停止 503 保留 [after-mysql-unavailable-preserved-mobile.png](../../output/playwright/platform-admin-redis/after-mysql-unavailable-preserved-mobile.png)。
5. 可操作入口：刷新运行事实、失败后重新核验、会话失效后重新登录、面包屑、系统运维十个二级导航入口、平台导航菜单、主题切换、新建组织、个人中心、返回用户工作台和移动端更多菜单。本页没有写 Redis 配置、删除键、清空库、故障切换或重启按钮。
6. 控件结果：逐项见“前端功能测试结果”；每个本页业务按钮单独记录，不使用“其他按钮正常”概括。
7. 接口：`GET /api/v1/platform/operations/redis`。正常、匿名、无权限、重复点击、15 秒超时、Redis 断连、MySQL 断连、响应结构、错误码、缓存与审计均有真实或自动化证据。
8. 数据表：`redis_resilience_observations`、`redis_resilience_views`、`platform_audit_events`；权限链涉及 `user_sessions`、`platform_role_assignments`、`role_capabilities`、`authorization_decisions`。Redis 事实来自只读命令与限定 `SCAN`/`MEMORY USAGE`，不把 Redis 当数据库事实源。
9. 权限和数据隔离：平台全局只读运维视图，不接受组织或工作区参数；API 强制 `platform:operate`，记录 actor/request/trace。键空间只聚合为用途和资源类，不返回原始 key、组织、工作区、载荷、哈希、Cookie、Token、密码或连接串。
10. 正常状态：MySQL 5.7.44、Redis 8.8 隔离实例、Node API、Node Worker、Python Crawler 与 Vite 真实运行；页面返回 `S0 · READY`，AOF/RDB 为启用且状态 ok，maxmemory=512 MiB、maxclients=512、策略 noeviction，真实两类受限队列键完成脱敏采样。
11. 空数据状态：真实环境有两类测试队列键，因而真实页面不是空采样；空键空间、部分测量和采样不可用由服务与 E2E 合同覆盖，均不得伪造热点。页面本身始终可返回运行事实，不以“没有 Redis”冒充正常空数据。
12. 加载状态：首次无快照显示读取态；已有快照刷新时保留全部事实，刷新按钮显示“正在刷新…”、`disabled=true`、`aria-busy=true`。
13. 接口失败状态：真实停止 MySQL 后同一 GET 返回 503 `redis_resilience_dependency_unavailable`，request_id/trace_id 一致且不包含 SQL/驱动/主机信息；页面保留最后成功快照并显示恢复提示。
14. 超时状态：真实对 `redis_resilience_observations` 加 45 秒写锁，浏览器 15 秒主动取消；旧 READY 快照、最后观测时间和全部指标持续可见，显示“刷新未完成/已保留”，失败读取不写成功观测或成功审计。
15. 无权限状态：匿名真实 GET 返回 401 `session_invalid`；移除本地测试账号平台角色后真实 GET 返回 403 `permission_denied`，恢复后 200。401/403 前端会清空旧快照，避免权限撤销后继续显示平台事实。
16. 表单校验状态：本页没有输入表单、查询参数、上传或可变配置。错误方法和额外参数属于接口边界；不得把不存在的必填、长度或格式校验标记通过。
17. 重复提交状态：同一页面只保留一个 AbortController。锁表期间同步触发三次 DOM click，只生成一个 request_id；按钮立即禁用。浏览器取消后数据库观测/查看/成功审计均没有增加，证明没有三份迟到成功写入。
18. 刷新和返回状态：刷新成功更新 observed_at/request_id；真实 Redis、MySQL 恢复后“重新核验”回到 READY。reload、浏览器返回和多标签页使用同一路由/权限合同；不把内存快照跨身份持久化。
19. 不同分辨率：1440 桌面与 390×844 手机真实截图均无页面级横向溢出；移动端事实纵向堆叠。共享移动底部导航在长页面全页截图中可能覆盖底部内容，见范围外问题。
20. UI 和交互问题：本批解决刷新时清空/悬挂/重复点击/缺少失败保留。页面信息架构保持“结论→资源→持久化/运行模式→淘汰/键空间→阻断”；共享移动底栏和已有全站控制台噪声未越权修改。
21. 功能问题：修复前 Redis 断连会让接口超过 15 秒无返回，刷新可重复发起并丢失旧快照，MySQL 故障返回 500；修复后断连快速形成受控 BLOCKED 快照、停库为 503、恢复可重新探测。共享 Worker 长连接在 Redis 断连时仍发生一次重启，未在本页顺手修改。
22. 性能问题：探针使用短生命周期、关闭自动重连的独立连接，限定扫描 128 个键、每批最多 16 个 `MEMORY USAGE`；本地小数据正常读取约秒级。没有正式 50/100 并发、百万键空间、长期审计增长或生产 p95/p99，不能宣称容量通过。
23. 安全问题：GET 只读业务事实但会写查看审计；`Cache-Control: private, no-store`，匿名 401、无权限 403、依赖故障 503 脱敏。未使用生产账号、生产数据、生产通知、真实支付、真实第三方 Cookie 或不可逆 Redis 命令。
24. 企业级缺失：Worker Redis 长连接异常恢复仍不稳；没有正式容量指标、跨进程统一熔断、外部监控/告警确认、Redis 配置版本审计、生产宝塔恢复演练和长期保留策略。产品边界明确不建设多服务器、Sentinel 或集群，不能把它们作为已交付能力。
25. 具体优化建议：见“逐页面优化升级方案”；必须保留单实例真相、完整 AOF/RDB/资源/淘汰/采样/阻断事实、宝塔唯一运维边界、平台权限、关联 ID 和脱敏审计。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能 | 接口 | 数据库/Redis | 权限 | 后台任务/依赖 | 实际结果 |
| --- | --- | --- | --- | --- | --- |
| Redis 韧性读取 | GET operations redis | observations、views、audit；独立 Redis 探针 | `platform:operate` | Node API、MySQL、Redis | READY 时 200 并写一组成功事实 |
| AOF/RDB/资源事实 | 同上 | INFO、CONFIG GET、LASTSAVE | 同上 | Redis 单实例 | everysec、RDB、512 MiB、512 连接、noeviction 真实展示 |
| 键空间脱敏采样 | 同上 | `SCAN scoutops:v1:*`、`MEMORY USAGE` | 同上 | Redis；128 键上限 | 只返回用途/资源类/字节占比，不返回 key |
| 刷新与重新核验 | 同上 | 成功时三表原子记录 | 同上 | API/MySQL/Redis | 单飞、15 秒取消、失败保留、恢复重读 |
| Redis 断连 | 同上 | 不可用有界快照 + 三表记录 | 同上 | 短连接探针 | 快速 200/BLOCKED，不悬挂 |
| MySQL 断连 | 同上 | 无成功记录 | 同上 | MySQL | 503 稳定错误码，旧快照保留 |
| 权限拒绝 | 同上 | 会话/角色/能力/授权决定 | 匿名或缺能力 | 无业务后台任务 | 401/403；前端不保留旧事实 |
| Worker 联动观察 | 无新增页面接口 | Redis 队列/租约 | 页面不控制 Worker | Node Worker | 断连时发生一次重启，范围外 P1 |

## 前端功能测试结果

| 编号 | 功能/入口 | 操作 | 实际结果 | 结论 |
| --- | --- | --- | --- | --- |
| REDIS-FE-001 | 页面访问 | 平台运营管理员打开路由 | 标题、面包屑、READY 事实出现 | 通过 |
| REDIS-FE-002 | 刷新运行事实 | 单击 | 更新当前事实、observed_at 和 request_id | 通过 |
| REDIS-FE-003 | 重复刷新 | 锁表期间同步点击三次 | 只产生一个关联 ID，按钮禁用 | 通过 |
| REDIS-FE-004 | 刷新保留 | 请求在途时观察页面 | 最后成功快照持续可见 | 通过 |
| REDIS-FE-005 | 15 秒超时 | 锁表 45 秒 | 浏览器取消，显示保留提示，不写成功审计 | 通过 |
| REDIS-FE-006 | 重新核验 | 依赖恢复后点击 | 提示消失并回到 READY | 通过 |
| REDIS-FE-007 | Redis 断连 | 精确停止 6435 实例后刷新 | 快速展示 BLOCKED 和 8 个阻断项 | 通过 |
| REDIS-FE-008 | Redis 恢复 | 原参数重启并 PING 后刷新 | AOF/RDB/noeviction/采样恢复，READY | 通过 |
| REDIS-FE-009 | MySQL 断连 | 精确停止 3365 实例后刷新 | 503，旧 READY 快照与重新核验保留 | 通过 |
| REDIS-FE-010 | MySQL 恢复 | 重启 5.7.44 后点击 | READY，业务账号/库/字符集未变 | 通过 |
| REDIS-FE-011 | 首次加载 | 无快照进入 | 显示读取态后切换真实状态 | 通过（E2E + 真实首屏） |
| REDIS-FE-012 | 首次错误 | 无快照返回失败 | 独立错误态、request_id 与重试 | 通过（E2E） |
| REDIS-FE-013 | 会话失效 | 匿名/失效会话 | 401；旧事实清空并提供登录 | 通过（真实 API + 合同） |
| REDIS-FE-014 | 无权限 | 移除平台角色后访问 | 403，不返回 Redis 事实 | 通过（真实 API） |
| REDIS-FE-015 | 资源卡 | 检查四项 | 内存/连接/拒绝/淘汰均为真实值 | 通过 |
| REDIS-FE-016 | 持久化卡 | 检查 AOF/RDB | 已启用、everysec/ok、RDB/ok | 通过 |
| REDIS-FE-017 | 运行模式 | 检查单实例边界 | 单实例；Sentinel/集群均未启用 | 通过 |
| REDIS-FE-018 | 键空间采样 | 检查两类测试键 | 仅资源类、数量、字节与占比 | 通过 |
| REDIS-FE-019 | 阻断项 | Redis 停止 | 8 项稳定码与动作建议逐条可见 | 通过 |
| REDIS-FE-020 | 面包屑/二级导航 | 检查当前链接与十个入口 | 层级、当前页和目标 href 一致 | 通过 |
| REDIS-FE-021 | 键盘与可访问性 | 聚焦刷新/重试 | 原生按钮、禁用、aria-busy、live 区域存在 | 通过 |
| REDIS-FE-022 | 1440 桌面 | 真实截图 | 信息区无横向溢出 | 通过 |
| REDIS-FE-023 | 390 手机 | 真实截图 | 卡片纵向堆叠，无页面横向溢出 | 通过，带共享底栏基线 |
| REDIS-FE-024 | 控制台 | 全新授权标签页与故障演练分别检查 | 全新 READY 标签页 0 error/0 warning；故障演练产生预期 5xx 资源错误 | 通过，故障证据不冒充洁净页 |

搜索、筛选、重置、排序、分页、全选、批量操作、新增、编辑、复制、删除、上传、下载、导入和导出不是该只读实时 Redis 运维页的既有能力，均标记“不适用”。暂停、恢复、取消和失败重跑属于采集/任务控制页；本页不能执行 Redis 服务控制或危险键操作。

## 接口清单及逐接口测试

### `GET /api/v1/platform/operations/redis`

| 场景 | 实际结果 | 结论 |
| --- | --- | --- |
| 正常请求 | 200，`data/request_id/trace_id`，READY 真实值 | 通过 |
| 参数缺失 | 无必填查询参数 | 不适用/合同明确 |
| 参数类型/边界 | 无查询参数；扫描边界由服务固定 128/16 | 通过 |
| 未登录 | 401 `session_invalid` | 通过 |
| 无权限 | 403 `permission_denied` | 通过 |
| 跨租户 | 平台全局接口且不接收组织/工作区参数 | 不适用/边界明确 |
| 重复页面请求 | 前端三次点击只保留一个在途请求 | 通过 |
| Redis 断连 | 200，脱敏有界 `blocked` 快照 | 通过 |
| Redis 恢复 | 独立非重试探针重新读到 READY | 通过 |
| MySQL 异常 | 503 `redis_resilience_dependency_unavailable` | 通过 |
| 超时 | 浏览器 15 秒取消并保留快照 | 通过 |
| 第三方依赖失败 | 本接口不调用第三方 | 不适用 |
| 返回结构 | READY/BLOCKED 均稳定 data；错误为标准 envelope | 通过 |
| 状态码/错误码 | 200/401/403/503 均有证据 | 通过 |
| 分页/排序/筛选 | 当前有界快照，无此类参数 | 不适用 |
| 幂等性 | GET 不改 Redis；每次成功授权读取独立记录观测/查看/审计 | 通过 |
| 日志和审计 | 成功读取三表同事务；失败/取消不伪造 succeeded | 通过 |
| 缓存 | `private, no-store` | 通过（自动化） |
| 返回秘密扫描 | 不含密码、Cookie、Token、连接串、原始 key 或 payload | 通过 |
| 并发/容量 | 仅单页单飞和定向 E2E；正式 50/100 并发未测 | 未验证 |

## Worker、Crawler 与联合流程证据

- Node Worker 与 Python Crawler 均真实启动；Worker 注册 Amazon、1688、供应链、公共来源适配器及 18 个队列，Crawler 空队列领取返回 204。本页没有用“已注册”或 204 冒充真实 Amazon/1688 登录、验证码、解析、入库完整生命周期。
- 联合链路：本地平台测试账号登录 → 路由权限通过 → Web GET → Node API 鉴权/授权 → 独立 Redis 探针读取 INFO/CONFIG/限定键空间 → 服务评估 READY/BLOCKED → MySQL 原子写 observation/view/audit → 页面显示事实 → Redis 停止快速 BLOCKED → Redis 恢复 READY → MySQL 停止 503 保留 → MySQL 恢复重新核验 READY。
- Redis 断连时共享 Worker Redis 长连接真实触发一次失败与重启；这是跨 Worker 生命周期问题，不能因本页短探针修复而标记通过。
- 前置条件只使用隔离本地数据库、Redis、测试账号和测试键；没有生产账号、生产通知、支付、第三方 Cookie 或不可逆操作。
- 最终结论：Redis 运维页读取、故障降级与恢复链路通过；共享 Worker 断连恢复、真实第三方采集生命周期、生产宝塔重启和正式容量仍未验证或阻塞。

## 问题记录

### REDIS-P1-001 刷新可重复提交且丢失最后可信快照（已修复）

- 所属页面或模块：`/platform-admin/redis` Web 读取生命周期；问题类型/等级：核心运维可靠性，P1。
- 问题描述：修复前刷新立即清空数据，按钮可重复点击，数据库受阻时页面无限 loading；三次点击产生三组成功观测/查看/审计。
- 复现步骤：成功读取 → 锁住 observations 写入 → 连续点击刷新三次 → 等待超过 15 秒。
- 预期结果：单飞、按钮忙态、旧快照持续可见、15 秒有界取消、失败不伪造成功审计。
- 实际结果：修复前悬挂且重复；修复后三次点击只有一个 request_id，旧 READY 快照保留，15 秒后显示保留提示，成功计数不增加。
- 截图或日志证据：[before-refresh-hanging-mobile.png](../../output/playwright/platform-admin-redis/before-refresh-hanging-mobile.png)、[after-refresh-timeout-preserved-mobile.png](../../output/playwright/platform-admin-redis/after-refresh-timeout-preserved-mobile.png)；MySQL 三表 13/13/13 前后不变。
- 涉及文件/接口/数据：`RedisResilienceCenter.vue`、`redis-resilience.css`；GET operations redis；三张审计事实表。
- 影响范围：事故期间事实可信度、数据库压力、审计准确性和操作反馈。
- 修复建议：AbortController 单飞、15 秒超时、同一 request/trace ID、序列保护、卸载取消；429/503/timeout 保留，401/403 清除。
- 验收标准：重复触发只有一个活动请求；已有快照不闪空；15 秒提示可见；失败不写 succeeded；当前满足。

### REDIS-P1-002 Redis 断连导致接口长期悬挂且恢复后仍可能误报（已修复）

- 所属页面或模块：Redis 运行事实探针；问题类型/等级：核心运维可用性，P1。
- 问题描述：修复前复用自动重连长连接，Redis 停止后请求超过 15 秒无响应；共享客户端恢复状态滞后时页面继续 BLOCKED。
- 复现步骤：停止隔离 Redis → 请求 GET → 重启 Redis → 再次刷新。
- 预期结果：断连快速返回有界 BLOCKED；恢复后新探针独立确认 READY。
- 实际结果：修复前超时；修复后短生命周期探针关闭自动重连，断连页面快速出现 8 项阻断，恢复 PING 后刷新回到 READY。
- 截图或日志证据：[after-redis-blocked-mobile.png](../../output/playwright/platform-admin-redis/after-redis-blocked-mobile.png)、恢复后 READY 浏览器快照。
- 涉及文件/接口/数据：`packages/redis/src/index.ts`、`apps/api/src/server.ts`、`redis-resilience-service.ts`；GET operations redis；Redis 只读命令和三表记录。
- 影响范围：Redis 事故发现、恢复确认、API 连接资源。
- 修复建议：运维探针与 Worker 长连接隔离，禁止探针重连；finally 关闭连接；不可用快照必须脱敏有界。
- 验收标准：Redis 停止后在页面超时前完成；API 存活；恢复后同次刷新 READY；当前满足。

### REDIS-P2-003 MySQL 故障返回 500，与可恢复依赖错误合同不一致（已修复）

- 所属页面或模块：Redis operations API；问题类型/等级：接口可靠性，P2。
- 问题描述：修复前停库返回 500，调用方无法区分依赖故障与代码错误。
- 复现步骤：停止隔离 MySQL → 认证 GET。
- 预期结果：503 稳定码、关联 ID、无底层细节；页面保留旧事实。
- 实际结果：最终实现真实返回 503 `redis_resilience_dependency_unavailable`，request_id=trace_id；页面保留 READY 并显示宝塔检查提示。
- 截图或日志证据：[after-mysql-unavailable-preserved-mobile.png](../../output/playwright/platform-admin-redis/after-mysql-unavailable-preserved-mobile.png)；浏览器 fetch 只输出 503/稳定码/关联布尔值。
- 涉及文件/接口/数据：`redis-resilience-routes.ts`、OpenAPI；GET operations redis；鉴权/授权/三表 MySQL 依赖。
- 影响范围：前端恢复、监控分类、值班定位。
- 修复建议：仅将数据库/网络依赖码映射 503，不吞编程错误，不回显原始 error。
- 验收标准：停库 503 脱敏，恢复 200；当前满足。

### REDIS-P1-004 共享 Worker Redis 长连接断连会导致 Worker 重启（未修改）

- 所属页面或模块：Node Worker/共享 Redis 连接；问题类型/等级：后台任务生命周期，P1。
- 问题描述：真实停止 Redis 时 Worker 出现连接错误并由监督链重启一次；本页短探针不能修复队列消费者的完整重连语义。
- 复现步骤：全栈启动 → 停止 Redis 6435 → 观察 Worker/监督状态。
- 预期结果：错误受控、停止领取新任务、连接恢复后继续，既有运行结果不丢失且不需要崩溃重启。
- 实际结果：`restart_count` 增加 1；恢复后 Worker 可重新运行，但中断期间任务恢复、租约和幂等未完整演练。
- 截图或日志证据：隔离监督状态文件与 Worker 日志；不输出队列 payload。
- 涉及文件/接口/数据：`packages/redis` 长连接、Worker 入口/队列调度；Redis 队列与租约键。
- 影响范围：所有 Redis 支撑的 Worker 队列、任务时延和恢复可信度。
- 修复建议：在独立 Worker 批次实现 error 监听、连接状态机、有界退避、暂停领取、租约恢复、重启后幂等验证与告警。
- 验收标准：断连/恢复/服务重启完整生命周期不崩溃、不重复业务副作用、任务状态可审计；本批范围外，未验证。

### REDIS-P3-005 共享移动底部导航可能覆盖长页面底部（未修改）

- 所属页面或模块：平台共享移动壳层；问题类型/等级：UI/可访问性，P3。
- 问题描述：390px 全页中固定底栏覆盖靠近页面底部的观测信息风险，且二级导航与底栏共同增加垂直占用。
- 复现步骤：390×844 打开长 Redis 页面并滚到底部。
- 预期结果：最后内容可完全滚入安全区，键盘焦点不被固定导航遮挡。
- 实际结果：页面无横向溢出，但共享固定底栏与长内容存在覆盖风险。
- 截图或日志证据：before/after mobile 全页截图。
- 涉及文件/接口/数据：共享 NavigationShell/移动导航 CSS；不涉及 Redis API/数据。
- 影响范围：多个平台后台长页面。
- 修复建议：共享壳层批次统一 `padding-bottom` 安全区、焦点滚动和二级导航折叠策略。
- 验收标准：全部平台长页面底部内容和最后焦点项可见；本页禁止越权修改。

### REDIS-P2-006 本地监督器 readiness 与实际 API 存活矛盾（未修改，前置基线）

- 所属页面或模块：M07-06/M08-01 后端监督状态；问题类型/等级：运行时监督，P2。
- 问题描述：隔离 API `/health/live` 可返回 200，但监督器连续记录 `readiness_probe_failed: fetch failed` 并重启 API，污染本页故障测试。
- 复现步骤：以隔离环境启动 backend supervisor → 同时 curl live 与观察状态文件。
- 预期结果：同一端口/构建已存活时监督器稳定标 running。
- 实际结果：live=200，监督器仍 degraded/restarting；本页后续用同一构建的独立 API/Worker 进程完成故障验证。
- 截图或日志证据：`backend-supervisor.json` 和脱敏 supervisor 日志；临时日志在结束前删除，结论保留在本审计。
- 涉及文件/接口/数据：`apps/backend/src/supervisor.ts`、health live；不涉及 Redis 页面数据表。
- 影响范围：本地验收稳定性及生产监督可信度，需要前置模块专项复验。
- 修复建议：在监督器批次核对端口、build_sha、探测超时、子进程所有权和失败 detail；不得在本页修改。
- 验收标准：同一子 API 连续稳定 running，真实进程停止才重启；当前未验证。

### REDIS-P4-007 正式容量和长期键空间/审计规模未验证

- 所属页面或模块：探针、MySQL 审计和页面渲染；问题类型/等级：性能容量，P4。
- 问题描述：只有 2 个受限键和本地小数据，没有百万键空间、长期三表增长、50/100 并发和生产 p95/p99。
- 复现步骤：当前缺少批准的数据规模、容量目标和独立压测环境。
- 预期结果：固定 SLO 下给出探针扫描、连接建立、审计事务、页面首屏和故障返回性能。
- 实际结果：有界实现与本地功能通过，企业容量未验证。
- 截图或日志证据：真实页面只显示扫描 2/2、上限 128；定向测试通过。
- 涉及文件/接口/数据：Redis probe/service/repository、三表、页面组件。
- 影响范围：长期运维读取时延、连接峰值和表增长。
- 修复建议：在容量批次使用脱敏合成键与 30/90 天审计规模测试 p50/p95/p99、错误率、连接池和索引。
- 验收标准：指标先行且证据可复验；未达到前不得宣称企业容量通过。

## 逐页面优化升级方案

- 页面定位：单台宝塔主机上单 Redis 实例的只读韧性事实页，不是通用 Redis GUI、键浏览器或服务控制台。
- 使用者：平台运营管理员和超级管理员；安全管理员、组织管理员和普通成员保持拒绝。
- 核心任务：在一次短路径中判断实例是否可用、持久化是否合规、资源是否接近停止线、是否发生拒绝/淘汰、哪些代码拥有的资源类占用样本内存、需要执行哪些宝塔恢复动作。
- 当前问题：本批解决重复刷新、无界等待、恢复误报和 500；共享 Worker 重连、监督器状态、移动底栏和容量仍缺失。
- 应保留的功能：S0 READY/WARNING/BLOCKED、AOF/RDB、内存/连接、拒绝/淘汰、单实例/无 Sentinel/无集群、脱敏采样、完整阻断项、observed_at/request_id、宝塔边界。
- 应删除或合并的内容：不删除现有能力；不可增加原始 key 浏览、任意命令执行、网页重启或配置编辑。不可将所有未知值美化为 0 或可用。
- 信息架构：页面定位/刷新 → 总结论 → 四项资源 → 持久化与运行模式 → 淘汰/键空间 → 阻断项 → 观测/关联 ID。
- 新页面布局：桌面保持结论和资源优先、持久化/运行模式双列、风险单列；移动端按因果顺序单列，失败通知固定在主操作下方但不遮挡旧快照。
- 页面区域划分：主操作仅刷新；失败后只增加重新核验；资源卡不承载危险动作；技术码与动作建议留在阻断区。
- 主要操作：刷新运行事实、重新核验。必须单飞、有界、可取消、保留最后成功事实并用同一 request/trace 关联。
- 次要操作：面包屑和运维专题导航；本页不新增复制 key、删除、导出或重启。
- 表格字段：当前不需要表格；若未来历史趋势进入本页，字段必须为观测时间、状态、内存/连接基点、拒绝/淘汰增量、finding codes，并服务端分页。
- 筛选条件：当前快照不需要筛选。未来历史只能增加时间范围/状态/阻断码，写入 URL，不能仅过滤当前 DOM。
- 表单字段：无编辑表单。未来配置变更必须独立页面/流程，包含期望版本、变更原因、双人审批、预演、回滚和审计。
- 弹窗和抽屉：当前无必要；阻断项直接阅读效率更高。移动端若未来加入历史详情，可用具名抽屉并恢复焦点。
- 加载状态：首次加载显示读事实；已有快照后台刷新，按钮 disabled/aria-busy，旧数据不闪烁。
- 空白状态：没有业务键时明确“当前受限采样范围没有可归类键”，不把空样本当 Redis 不可用。
- 错误状态：Redis 断连仍显示新的 BLOCKED 事实；MySQL/API/超时保留最后成功事实并显示行内通知；首次失败用独立错误态。
- 无权限状态：路由守卫与 API 401/403双层阻断，清除内存快照，不将平台数据持久化到 localStorage。
- 成功和失败反馈：成功以 state/observed_at/request_id 更新确认；失败以稳定码/action hint/request_id/保留说明确认。
- 动效：仅按钮忙态和轻量加载脉冲；指标不自动跳动，不用装饰动效或颜色替代文字结论。
- 响应式行为：桌面保持高信息密度；390px 卡片单列并预留共享底栏安全区；长 technical code 允许换行，不产生横向滚动。
- 权限差异：只有 `platform:operate`；未来配置写入必须采用更高能力和审批，不复用只读 GET 权限。
- 与其他页面联动：系统状态给总览，拓扑看进程/队列，链路日志按 request_id 排障，MySQL 看事实源，采集调度看任务控制；Redis 页只负责缓存服务专题。
- 涉及接口：GET operations redis；不新增 API 字段，不改数据库结构。
- 数据状态变化：成功授权读取只写一条 observation、一条 view、一条 succeeded audit；失败/取消不写成功事实；不修改 Redis 业务键。
- 验收标准：真实全栈；READY/加载/空样本/超时/Redis 断连/BLOCKED/MySQL 503/恢复/401/403均有证据；单飞；响应脱敏；采样有界；两档截图无溢出；构建、定向测试、E2E、文档与路由产物通过。

## 验证门禁结果

- `npm run build:redis`、`npm run build:api`、`npm run typecheck:web` 通过。
- `node --test tests/m08-02/redis-single-instance-resilience.test.mjs` 11/11 通过，覆盖不可用有界快照、503 脱敏、单飞/超时源代码合同、采样上限与审计。
- M08-02 Playwright 定向测试双项目 6/6 通过，覆盖单飞和 503 保留快照。
- `npm run build` 22 个 workspace 全部通过；`npm run verify:docs` 通过 136 个必需文件与路由产物；`npm run format:check` 通过。
- 全新授权标签页正常 READY，控制台 0 error/0 warning；故障演练标签页的 5xx 资源错误仅对应真实超时/停库注入。
- `npm run test:unit` 为 170/180；10 项均是此前存在的范围外设计质量、共享主题/图标、UI 治理等基线，本页 M08-02 定向 11/11 全过。
- `npm run verify:static-analysis` 仅在范围外 `CompetitorMonitor.vue` 报异步回调可能产生未观测 Promise，本批未修改该文件。
- `npm run verify:module -- M08-02` 返回 `dependency_blocked`，唯一缺失前置状态为 M08-01；不能把定向回归通过写成模块门禁通过。

## 无法测试项与阻塞项

- 真实生产账号、生产数据、真实通知、支付和不可逆操作：按限制未使用，不能标记通过。
- 真实 Amazon/1688 登录、代理、Cookie 过期、验证码、页面结构变化、解析、清洗、去重、入库、暂停、恢复、取消、失败重跑、部分成功、告警、资源释放和服务重启后的任务恢复：本页仅证明服务实际运行与空队列轮询，完整采集生命周期仍为专项阻塞。
- 真实宝塔生产重启、生产 Redis 配置文件、线上反向代理和生产故障演练：本批只使用隔离本地端口，不把本地证据冒充生产。
- Worker Redis 长连接完整断连恢复与任务幂等：真实观察到一次重启，标记 P1 未通过。
- 监督器 readiness 与 live 200 矛盾：前置模块基线，使用独立同构 API/Worker 完成页面验证，未在本页修复。
- 正式大数据、长期审计保留和 50/100 并发容量：缺少批准的指标与环境，标记未验证。
- 共享移动底栏、共享控制台 favicon/既有 5xx 演练噪声：范围外；正常页与故障页必须分别取证，不能把故障演练资源错误写成正常页洁净通过。
