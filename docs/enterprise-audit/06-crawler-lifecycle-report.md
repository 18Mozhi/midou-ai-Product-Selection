# 《爬虫完整测试报告》

## 1. 真实链路

页面/接口创建任务 → `collection_tasks` → Node Worker 领取 → Python `lease_client`/`main_loop` → `execution_runner`/Playwright bridge → 解析/清洗/去重 → evidence 与核心投影 → 完成回执 → 页面进度/日志/数据展示。

## 2. 生命周期结果

| 阶段           | 验证内容                                           | 结果              | 证据/阻塞                                      |
| -------------- | -------------------------------------------------- | ----------------- | ---------------------------------------------- |
| 任务创建       | 来源、市场、关键词/URL、组织/工作区、幂等键        | 通过              | opportunity/sourcing/collection API 与页面批次 |
| 参数校验       | 缺失、类型、长度、未知来源                         | 通过合同          | provider/collection tests                      |
| 调度和队列     | 18 队列注册、优先级、老化、最大并发                | 通过              | `worker-queue-registry.ts`、scheduler tests    |
| 并发限制       | 队列级 `maxConcurrency=1`，全局资源探针            | 本地通过          | queue scheduler/容量页                         |
| 代理配置       | 只从环境读取，不下发浏览器                         | 合同存在          | 真实代理可用性未验证                           |
| 登录状态       | 凭证资产/浏览器档案/租约                           | 本地合同通过      | Amazon/1688 真实登录阻塞                       |
| Cookie 过期    | 运行状态、失败码、重新绑定档案                     | 可控状态通过      | 真实长期过期阻塞                               |
| 验证码/风控    | 必须转人工/失败，不能绕过                          | 门禁通过          | 真实挑战阻塞                                   |
| 请求重试       | Worker/adapter 有界重试、退避、熔断                | 通过              | 队列策略/适配器测试                            |
| 超时           | AbortSignal、任务/队列超时、终态                   | 通过              | scheduler/crawler chain                        |
| 页面结构变化   | 解析失败、样本保存、回放、审批                     | 本地样本通过      | 真实未来结构变化不可预先通过                   |
| 数据解析       | 固定样本和公开页面适配                             | 通过已知样本      | 第三方真实登录页阻塞                           |
| 去重           | 任务/证据/核心投影唯一键与幂等                     | 通过              | migrations/integration                         |
| 数据清洗       | 核心 collection projection                         | 通过本地链        | 全平台异常字段集合未穷尽                       |
| 数据入库       | MySQL 5.7 事务、证据和投影                         | 通过本地真实链    | 生产 DB 故障阻塞                               |
| 状态更新       | queued/leased/running/succeeded/failed/dead-letter | 通过              | collection tests/pages                         |
| 暂停/恢复/取消 | 浏览器作业和任务动作                               | 本地通过          | 真实第三方执行中动作部分阻塞                   |
| 失败重跑       | 单条/批量 replay，保留尝试历史                     | 通过              | collection pages                               |
| 部分成功       | 子查询/尝试/证据逐项状态                           | 通过合同          | 真实多来源部分成功需外部账号                   |
| 日志           | request/trace、队列、运行、业务对象链接            | 通过              | logs/topology pages                            |
| 进度           | 作业/尝试/事件和浏览器运行进度                     | 通过              | browser-runtime page                           |
| 告警           | 站内通知、来源健康、死信                           | 站内通过          | 邮件告警阻塞                                   |
| 资源释放       | 浏览器/租约/Abort/Worker shutdown                  | 自动测试通过      | 长时间内存稳定性需 soak                        |
| 服务重启恢复   | lease expiry、recover-expired、completion spool    | 本地合同/回归通过 | 真实第三方任务跨重启全周期阻塞                 |

## 3. 实际结论

- `npm run verify:crawler-chain` 已验证 Node/Fastify ↔ Python ↔ Chromium 的本地真实链及 Python 测试；它证明运行桥接，不证明 Amazon/1688 实网登录成功。
- 1688 验收页正确保持禁用/阻塞语义，直到真实登录档案、验证码处置、固定样本、解析、入库、暂停恢复、失败重跑和重启恢复都有日志证据。
- Amazon、供应链等爬虫代码和队列已启用为可运行能力，但没有真实第三方账号时不能把完整生命周期标为通过。

## 4. 问题

### CRAWL-001（P1）真实 Amazon/1688 生命周期被外部环境阻塞

- 模块：来源采集；类型：外部依赖。
- 复现：进入来源验收页，缺少已批准真实登录档案/验证码处置证据时运行门禁不满足。
- 预期：真实测试账号完成创建→领取→登录→解析→清洗→入库→展示→暂停恢复→重试→重启恢复。
- 实际：本地运行桥和固定样本通过，真实登录/风控阶段无可验证证据。
- 证据：`docs/audits/platform-admin-provider-1688-acceptance.md`、collection/browser-runtime 审计。
- 涉及文件：crawler、provider adapters、worker；接口：provider/collection/internal crawler；数据：凭证、任务、证据、投影。
- 影响：真实商业来源启用；严重度：P1。
- 建议：仅使用本地/测试账号，在隔离档案中执行报告 09 的爬虫 E2E；验证码转人工，不尝试绕过。
- 验收：每个目标来源各有完整 run_id、request_id/trace_id、固定样本哈希、入库记录、页面截图和重启恢复日志。
