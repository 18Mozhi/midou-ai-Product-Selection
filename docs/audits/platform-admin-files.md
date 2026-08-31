# `/platform-admin/files` 逐页 UI、功能与链路审计

## 页面审计记录

1. 页面名称和路由：文件存储，`/platform-admin/files`；平台后台 / 系统运维 / 文件存储。
2. 服务角色：具备 `platform:operate` 的平台运营管理员、平台超级管理员。匿名真实 GET 为 401；本地测试账号临时降为平台安全管理员后真实 GET 为 403，随后已恢复超级管理员。
3. 业务目标：在惠州当前单机和宝塔唯一运维入口边界内，核对证据、导出、临时目录、容量水位、有界校验和与同机加密恢复事实。本页不是文件浏览器、上传器、清理器或备份执行器。
4. 当前截图：修复前桌面 [before-desktop-1440.png](../../output/playwright/platform-admin-files/before-desktop-1440.png)、修复前 390px [before-mobile-390.png](../../output/playwright/platform-admin-files/before-mobile-390.png)、重复刷新悬挂 [before-refresh-hanging-mobile.png](../../output/playwright/platform-admin-files/before-refresh-hanging-mobile.png)、证据目录不可用 [before-evidence-unavailable-mobile.png](../../output/playwright/platform-admin-files/before-evidence-unavailable-mobile.png)、停库 500 [before-mysql-unavailable-mobile.png](../../output/playwright/platform-admin-files/before-mysql-unavailable-mobile.png)；修复后桌面 [after-desktop-1440.png](../../output/playwright/platform-admin-files/after-desktop-1440.png)、390px [after-mobile-390.png](../../output/playwright/platform-admin-files/after-mobile-390.png)、超时保留 [after-refresh-timeout-preserved-mobile.png](../../output/playwright/platform-admin-files/after-refresh-timeout-preserved-mobile.png)、证据目录阻断 [after-evidence-unavailable-blocked-mobile.png](../../output/playwright/platform-admin-files/after-evidence-unavailable-blocked-mobile.png)、停库保留 [after-mysql-unavailable-preserved-mobile.png](../../output/playwright/platform-admin-files/after-mysql-unavailable-preserved-mobile.png)。
5. 页面所有可操作入口：刷新文件事实、失败后重新核验、会话失效后重新登录、面包屑、十个系统运维二级入口、平台导航、主题、新建组织、个人中心、返回用户工作台和移动端更多。本页没有上传、下载、导入、导出、删除、清理、恢复或路径浏览按钮。
6. 每个按钮和控件：见“前端功能测试结果”，无“其他按钮正常”概括。
7. 调用接口：`GET /api/v1/platform/operations/files`；覆盖 200、401、403、重复点击、14 秒锁等待、MySQL 停止、目录不可用、恢复和脱敏。
8. 涉及数据表：`file_assets`、`report_exports`、`backup_recovery_runs`、`backup_recovery_assets`、`file_resilience_observations`、`file_resilience_views`、`platform_audit_events`；权限链涉及 session、role、capability 与 authorization decision 表。
9. 权限和数据隔离：平台全局只读聚合，不接受租户参数；文件路径仍由组织/工作区范围生成。响应不返回路径、文件名、哈希、组织/工作区 ID、账号、Cookie、Token 或凭证。
10. 正常状态：隔离 MySQL 5.7、Redis、Node API、Node Worker、Python Crawler 与 Vite 实际运行；页面显示三个目录、2/2 校验、verified 同机恢复和 `S0 · READY`。恢复材料仅为本地合成测试记录，不冒充生产。
11. 空数据状态：`data=null` 显示尚无观测；缺少恢复记录由服务失败关闭而非美化 READY。接口空返回通过 E2E 合同验证。
12. 加载状态：首次无快照显示核对态；已有快照刷新时保持全部事实，按钮显示“正在刷新…”，并具 `disabled`、`aria-busy`。
13. 接口失败状态：修复前真实停库返回 500 且清空旧事实；修复后连接类故障为 503 `file_resilience_dependency_unavailable`，保留最后成功事实。
14. 超时状态：对 `file_resilience_observations` 持有写锁；API 14 秒中止、浏览器 15 秒兜底，返回 `file_resilience_read_timeout`，事务在锁释放后回滚且不接受迟到响应。
15. 无权限状态：匿名 401；缺 `platform:operate` 为 403。401/403 不保留旧平台事实；401 提供重新登录。
16. 表单校验状态：本页无表单与查询参数。阈值和样本数由后端配置校验；不存在的上传格式或字段不能标记通过。
17. 重复提交状态：修复前两次快速刷新让 observation/view/audit 从 3/3/3 增至 5/5/5；修复后单个 AbortController 阻止额外 DOM click。
18. 刷新和返回状态：成功刷新更新 `observed_at` 与 `request_id`；依赖恢复后重新核验回 READY。reload、返回、多标签页分别走真实权限和 API，不用 localStorage 冒充当前事实。
19. 不同分辨率：1440×1000 与 390×844 实际打开、截图并检查溢出；移动端按结论、指标、目录、恢复、告警顺序排列。
20. UI 和交互问题：本批修复刷新闪空、按钮可重复、失败无保留、无界等待、会话失效缺登录动作及 390px 面板头长文拥挤；保留原高密度信息结构。
21. 功能问题：修复前锁等待造成请求/审计放大，停库错误语义为 500；修复后单飞、有界取消、稳定 503、事务回滚和恢复重试闭环。
22. 性能问题：SHA-256 为有界样本且流式读取，现支持 AbortSignal；未验证超大文件、长期审计、50/100 并发或生产 p95/p99，容量只能标记未验证。
23. 安全问题：GET 读取真实文件/数据库事实并写三类审计；响应 `private, no-store` 且错误脱敏。未使用生产账号、真实第三方、通知、支付或不可逆清理。
24. 企业级缺失：生产宝塔目录故障演练、真实加密恢复材料、正式容量基线、外部告警确认、长期审计归档仍阻塞。共享存储和备用服务器是明确不建设边界，不是缺陷。
25. 具体优化建议：见“逐页面优化升级方案”；必须保留三个目录、校验和、恢复、全部 findings、观测/关联 ID、权限、审计与宝塔边界。

## 页面—功能—接口—数据库—权限—后台任务矩阵

| 页面功能            | 接口                 | 数据库/文件事实                                | 权限               | 后台任务/依赖            | 验收目标                              |
| ------------------- | -------------------- | ---------------------------------------------- | ------------------ | ------------------------ | ------------------------------------- |
| 文件韧性读取        | GET operations files | 三个受控根、assets/exports、recovery、三类审计 | `platform:operate` | API、MySQL、本机文件系统 | 200 READY/WARNING/BLOCKED，成功同事务 |
| 校验和              | 同上                 | evidence/export 索引与有界 SHA-256             | 同上               | 流式文件读取             | 缺失/不一致失败关闭，取消可终止       |
| 同机恢复            | 同上                 | backup runs/assets                             | 同上               | M07-04 恢复材料          | 无证据不冒充 verified，无备用服务器   |
| 刷新/重试           | 同上                 | 成功才写 observation/view/audit                | 同上               | API/MySQL/文件系统       | 单飞、14/15 秒、回滚、旧事实保留      |
| 目录不可用          | 同上                 | 不写入路径，只返回类别和 finding               | 同上               | 本机受控根               | BLOCKED 和逐条 action hint            |
| 权限拒绝            | 同上                 | session/role/capability/decision               | 匿名或缺能力       | 无业务任务               | 401/403，平台事实清除                 |
| Worker/Crawler 联动 | 无新增接口           | Worker 导出哈希，Crawler 不生成本页事实        | 本页不控制         | Worker、Crawler 实际运行 | 只证明运行，不冒充第三方生命周期      |

## 前端功能测试结果

| 编号        | 功能/入口       | 操作                 | 预期/验收                        | 结果                      |
| ----------- | --------------- | -------------------- | -------------------------------- | ------------------------- |
| FILE-FE-001 | 页面访问        | 超级管理员打开路由   | 标题、面包屑、真实事实可见       | 通过                      |
| FILE-FE-002 | 刷新            | 单击                 | 更新观测时间与关联 ID            | 通过                      |
| FILE-FE-003 | 重复刷新        | 在途触发额外 click   | 一个请求、按钮禁用               | 通过                      |
| FILE-FE-004 | 在途保留        | READY 后刷新         | 旧事实持续可见                   | 通过                      |
| FILE-FE-005 | 有界超时        | 写锁 120 秒          | API 14 秒 503、回滚、旧事实保留  | 通过                      |
| FILE-FE-006 | 重新核验        | 依赖恢复后点击       | 提示消失并回 READY               | 通过                      |
| FILE-FE-007 | 目录不可用      | 临时移走 evidence 根 | BLOCKED、目录/缺失/容量 findings | 通过                      |
| FILE-FE-008 | MySQL 停止/恢复 | 精确停止并原参数重启 | 503 保留，恢复 200               | 通过                      |
| FILE-FE-009 | 首次加载/空态   | 无快照或 data=null   | 明确 loading/empty               | 通过（真实 + E2E）        |
| FILE-FE-010 | warning/blocked | 水位、缺失、恢复失效 | 状态和 action hint 可读          | 通过（模块 + 真实 + E2E） |
| FILE-FE-011 | 401/403/429/503 | 各状态               | 登录、权限、频率、依赖语义明确   | 通过（真实 + E2E）        |
| FILE-FE-012 | 桌面/移动端     | 1440 与 390          | 无业务横向溢出、长文不重叠       | 通过                      |
| FILE-FE-013 | 键盘/可访问性   | Tab/Enter/忙态/live  | 原生按钮、disabled、aria 属性    | 通过                      |
| FILE-FE-014 | 导航入口        | 面包屑与十个二级入口 | href、当前项和返回逻辑正确       | 通过                      |
| FILE-FE-015 | 控制台/日志     | 正常和故障分别检查   | 正常无业务错误，故障仅预期 5xx   | 通过                      |

搜索、筛选、重置、排序、分页、全选、批量、新增、编辑、复制、删除、上传、下载、导入和导出均不是此只读快照页能力，标记“不适用”，不是通过。文件清理、恢复、暂停、取消和重跑必须在对应任务或宝塔运维流程完成，本页不得暗中新增。

## 接口与联合流程

`GET /api/v1/platform/operations/files` 正常为 200 稳定 envelope；无参数；匿名 401、无能力 403、依赖 503、读取超时 503，429 由通用限流/E2E 覆盖。平台接口不接受租户 ID，跨租户参数不适用；响应不得含驱动/SQL/主机/路径/文件名/哈希/作用域 ID/凭证。每次成功授权读取独立写 observation/view/audit，取消或失败不伪造成功；`private, no-store`。页面单飞已验证，正式并发容量未验证。

联合链路：本地管理员登录 → 平台导航和权限 → Web GET → API 鉴权/授权 → probe 读取三根、索引、SHA-256 与恢复材料 → service 评估 → repository 同事务写观测/查看/审计 → 页面展示 → 目录故障 BLOCKED → 目录恢复 READY → MySQL 故障 503 保留 → MySQL 恢复 READY。Worker 与 Crawler 实际启动；真实 Amazon/1688 登录、验证码、代理、解析、清洗和入库不属于本页，不能据此标记通过。

## 问题记录

### FILE-P1-001 刷新重复提交、无界等待且丢失可信快照（已修复）

- 所属页面/模块：文件存储页、API、probe/service/repository；类型：核心运维可靠性；等级：P1。
- 描述/复现：READY → 写锁 `file_resilience_observations` → 快速点击两次；修复前整页 loading、按钮可点、旧事实消失，锁释放后三表 3/3/3 变 5/5/5。
- 预期/实际：应单飞、有界取消、保留快照、取消事务回滚；修复后 API 14 秒、浏览器 15 秒、旧 READY 可见、迟到写入无效。
- 证据：before/after timeout 截图、真实计数、API 日志；涉及上述五个实现/测试文件与 GET 接口。
- 影响：事故认知、连接池、文件 I/O、审计放大；建议即本批 AbortSignal/sequence/disabled/回滚方案；验收为额外 click 不增请求且恢复可重试，已满足。

### FILE-P2-002 MySQL 依赖故障返回 500 并清空旧事实（已修复）

- 复现：READY → 精确停止隔离 MySQL → 刷新；修复前 500，页面只剩不可用态。
- 预期/实际：稳定 503、关联 ID、脱敏、旧事实保留、恢复后 200；修复后满足 `file_resilience_dependency_unavailable`。
- 影响/范围：页面恢复、告警分类、隐私；涉及 route、OpenAPI、前端及接口，不改数据库结构。
- 验收：停库 503 不含底层细节，旧 READY 可见，原参数重启后成功；已满足。

### FILE-P3-003 390px 面板头长文拥挤（已修复）

- 复现：390×844 查看“宝塔受控目录 / 组织工作区隔离”；横向两端布局压缩标题区域。
- 预期/实际：520px 以下纵向、左对齐、8px 间距；修复后无覆盖和业务横向溢出，桌面不变。
- 证据：before/after mobile；仅改 `file-resilience.css`，无接口数据影响。

### FILE-P4-004 正式容量、生产恢复与共享 readiness 未验证（阻塞）

- 本地仅小文件、小审计和单用户；`/health/live=200`、页面接口可用，但共享 `/health/ready=503`。未获准线上目录故障、生产备份恢复、长期历史或 50/100 并发。
- 建议在独立生产验收窗口按批准 SLO、脱敏合成规模和宝塔操作单验证 p50/p95/p99、错误率、连接池、文件 I/O、审计增长和告警；未满足前不能声称容量或生产韧性通过。

## 逐页面优化升级方案

- 页面定位/使用者/核心任务：平台运维角色在最短路径判断三个本机目录、完整性、容量与恢复是否允许继续大文件任务。
- 保留/合并/删除：保留完整事实、findings、时间、关联 ID、宝塔与单机边界；不删除指标，不新增路径浏览、网页清理或伪恢复按钮；刷新和失败重试共享单飞逻辑。
- 信息架构/布局：保持“定位和刷新 → 总结论 → 五项指标 → 目录/恢复 → 阻断 → 关联信息”；桌面双列、390px 单列，面板头在小屏纵向。
- 主要/次要操作：主要是刷新和重新核验；会话失效单独登录；导航为次要。按钮必须忙态、有界且保留旧事实。
- 字段/筛选/表单：当前快照无表格、筛选、分页和表单。未来历史列表须服务端分页并仅提供时间、状态、finding code；任何文件写入需独立审批、权限、幂等和回滚。
- 状态/反馈：首次 loading；data=null empty；warning/blocked 逐项；429/503/timeout 行内保留；401/403 清空；成功用 state/observed_at/request_id，失败用稳定码/action hint/request_id。
- 动效/响应式/可访问性：只保留加载旋转和按钮忙态；颜色必须伴随文字；390px 无覆盖，长 ID 可换行，底部导航安全区由共享壳层专项处理。
- 权限/联动/数据变化：`platform:operate` 只读；系统状态看总览、日志按关联 ID、拓扑看进程、备份恢复看材料、容量边界看承诺。成功读取写三表，失败取消不写；数据库结构与接口成功 DTO 不变。
- 验收标准：真实全栈、正常/空/加载/超时/目录失败/停库/恢复/401/403/429/503、单飞、脱敏、两档分辨率、构建/模块/E2E/文档和日志均有可验证证据。

## 阻塞项

- 真实生产账号、生产数据、真实通知、支付、第三方 Cookie、不可逆删除未使用，不能标记通过。
- 真实 Amazon、1688 与供应链爬虫完整生命周期不属于本页；本批仅证明 Worker/Crawler 实际运行与注册，不冒充外部生命周期通过。
- 真实宝塔生产目录、线上 MySQL 停止/重启、生产恢复和容量未执行；本地合成证据不能替代。
- 共享 readiness 503、既有静态分析/单元测试/模块状态基线按全量门禁结果记录，不在本页越权修改。

## 验证门禁与交付边界

- 独立分支：`codex/platform-admin-files-page-53`；修改前回退点 `a8a536346a78f3ede3ec8ef297a9ab5d68c7cabb`。本页验收前不提交。
- 真实运行：MySQL 5.7、Redis、Node API、Node Worker、Python Crawler、Vite 均由本批隔离端口实际启动；最终 API live=200、available=200，严格 ready=503 按共享前置基线记录。
- 真实文件/接口：正常为 200 READY、三个目录、2/2 校验且响应无测试根路径/作用域 ID；移走 evidence 根为 BLOCKED 和三个 finding；恢复后 READY。
- 真实超时：锁前后 observation/view/audit 保持 `9/9/9`；API 约 14 秒返回 503，页面保留 READY，按钮忙态且取消事务在锁释放后不补写。
- 真实停库：隔离 MySQL 停止后 503，页面保留最后 READY；原参数重启后重新核验为 READY。Worker 停库期间只记录预期依赖失败，恢复后继续 idle 调度。
- 权限：匿名 401；平台安全管理员 403 `permission_denied` 且无 data；恢复超级管理员后 200。
- 页面：1440 的 `scrollWidth=1425 <= 1440`；390 的 `scrollWidth=375 <= 390`，面板头 `flex-direction=column`；正常场景浏览器控制台 error=0。
- 定向门禁：`build:api`、`typecheck:web`、M08-04 模块测试 8/8、定向 Playwright 双项目 6/6 全通过。
- 完整门禁：22 workspace 全量构建、73 路由/60 受保护路由/6 角色、136 个必需文档、格式门禁均通过。
- 范围外基线：`verify:module M08-04` 仅因前置 M08-01 blocked；静态分析仅命中 `CompetitorMonitor.vue` 既有未观察 Promise；共享单元测试为 170/180，10 项均为既有主题/UI 治理等基线。本批没有修改范围外代码掩盖失败。
