# M07-06 真实选品生产验收与回滚

## 宝塔对象与配置

在当前惠州单机的宝塔计划任务中创建或更新有限任务 `product-scout-selection-acceptance`，工作目录指向当前发布目录。候选版本启用前，先由宝塔有限发布任务按顺序应用 `0028_selection_journeys_m07_06.up.sql`、`0029_collection_task_evidence_links_m07_06.up.sql` 和 `0059_selection_journey_candidates.up.sql` 并登记 `schema_migrations`；随后执行：

```text
node scripts/run-baota-selection-acceptance.mjs --production
```

任务超时 240 秒、只允许手工或发布后单次执行，不设置常驻循环。`SELECTION_ACCEPTANCE_EMAIL` 与 `SELECTION_ACCEPTANCE_PASSWORD` 只放宝塔受限任务环境；账号必须是普通 `member`、不启用 MFA、没有平台角色。输入与证据路径按 `config/env.example` 设置，`SELECTION_ACCEPTANCE_DEADLINE_MS=180000` 不得调整。配置变更在启动读取；修改后通过宝塔重启 Node API，有限任务本身直接重新执行。

若惠州出口不能直连 Google News，只在 ScoutOps Node API、Node Worker 和来源启用有限任务的宝塔受限环境配置四个 `PROVIDER_PROXY_*` 变量。不得设置系统或其他项目的 `HTTP_PROXY`/`HTTPS_PROXY`；普通 member 验收任务不读取或回显代理凭证。代理连接超时可在 100–10000 ms 内调整，但 Provider 健康门仍固定 10000 ms，M07-06 终态仍固定 180000 ms。

## 执行与判定

1. 先在宝塔确认 Node API、Node Worker、Python Crawler、MySQL、Redis 和网站均健康，当前版本 `/api/v1/health/version` 与发布 commit 一致。
2. 确认 `google_news_search` 已由平台来源所有者复核并启用；普通成员不进入 Provider 配置页。
3. 运行有限任务。它在每次新登录后先读取该专用账号唯一的有效组织和默认工作区，通过 `/auth/context` 绑定本次会话，再验证账号仅具备 `task:create`、`opportunity:read`、`opportunity:decide` 等成员权限，不具备 `provider:configure`、`collection:replay` 或 `platform:*`；缺少、多个或无有效工作区时直接阻断。
4. 任务必须在 3000 ms 内返回 202，15000 ms 内读取到已接收/运行/终态，180000 ms 内得到 `result_ready`、`succeeded_empty`、`blocked` 或 `failed`，随后写入人工决策并查看原始证据或明确空/受阻任务证据。
5. 复制 mode 0600 的 `SELECTION_ACCEPTANCE_EVIDENCE_FILE` 到同 commit 验收工作区，执行 `node scripts/verify-selection-acceptance-production.mjs --production`，再执行 `npm run verify:module -- M07-06`。

任一阈值、权限、来源、证据或决策失败都返回非零；`blocked` 不能当作模块通过。业务终态 `blocked` 可以作为真实旅程的受控结果，但生产证据和模块门仍必须完整通过。

## 2026-08-13 生产验收证据

构建 `eabce9a0bbad5b711de9f7f36e2f02db0737d25b` 由宝塔有限任务以专用普通 `member` 完成真实 `google_news_search` 旅程：创建 API 116 ms、已接收状态可见 204 ms、`result_ready` 终态 4,399 ms，固定 3 秒/15 秒/180 秒门均未放宽；成员随后保存 `observe` 决策并查看原始证据。mode 0600 生产证据捕获于 `2026-08-13T10:40:37.496Z`，SHA-256 为 `e7685a91f01ef3115f4aaac7e09a266dbc169a3ac43241a2af45ff583a4cf567`。

同提交 `npm run verify:module -- M07-06` 的 11/11 命令通过，覆盖构建、7 个定向测试、真实 MySQL 5.7、生产证据验证、Linux Chromium 与中文字体预检、桌面/390px Playwright 和文档门；run_id/trace_id 为 `e2e2654a-6364-4cc6-a7b1-4997dfd3d39f`。该结果完成 M07-06 模块签发，但仍不能代替 P07 阶段门，也不形成容量声明。

## 日志与排查

在宝塔计划任务日志按 `request_id`/`trace_id` 关联 Node API、Worker 和 Crawler。不要打印账号密码、会话 Cookie、Token、Provider 凭证或原始响应正文。优先检查：来源是否 enabled、Worker 是否领取任务、`collection_task_events` 的状态、当前任务在 `collection_task_evidence_links` 是否存在关联、对应 `raw_evidence` 是否有效、趋势投影是否产生主题，以及决策权限是否有效。任务报告结果数大于零但关联数为零属于持久化失败，不得换关键词、放宽 180 秒门或把它判为空结果。若 `evidence.linked` 出现 `content_changed=true`，核对两个 SHA-256、规范 URL、Parser/Adapter/Schema 和规范载荷；仅未消费的 RSS 包装变化允许复用旧不可变证据。规范事实变化仍必须得到单条 `evidence_dedupe_conflict`，不得覆盖旧证据；Worker 应继续处理其他独立记录，有可用记录时以 `completed_with_warnings / partial` 终止，不得把该冲突作为网络错误重试整个来源。回滚本修复只需切回上一 Worker 构建并由宝塔重启 Node Worker，不需要迁移或删除关联、事件、Outbox、证据。

代理异常先检查 OpenClash 监听、Basic 认证以及 API/Worker 是否通过宝塔重启读取新配置；只记录 CONNECT 状态、耗时和错误码，不记录代理用户名或密码。

## 回滚

1. 在网站导航隐藏 `/opportunities/start` 或通过宝塔切回上一已验证同机版本；通过宝塔重启网站与 Node API。
2. 停止新的 M07-06 有限任务，不停止或删除既有采集任务、审计、Outbox 和原始证据。
3. 如必须回滚迁移，先导出 `selection_journeys`、决策、事件、Outbox、操作记录和 `collection_task_evidence_links`。切回旧版本前先停止新决策写入；切回后执行 `0059_selection_journey_candidates.down.sql` 会移除决策中的候选引用。继续撤销时再执行 `0029_collection_task_evidence_links_m07_06.down.sql`；只有完整撤销 M07-06 时才执行 `0028_selection_journeys_m07_06.down.sql`。删除关联会丢失候选选择或重复任务关联审计，没有导出不得执行。
4. 回滚后复核既有 `/opportunities`、采集任务和 Provider 配置未变化；所有生产操作仍只通过宝塔。
5. 如回滚项目代理，先禁用 `google_news_search`，删除 ScoutOps 宝塔对象中的四个 `PROVIDER_PROXY_*` 变量并重启 API/Worker；禁止影响系统或其他项目网络设置。

当前恢复边界仍是惠州单机内的应用/逻辑数据回滚；不使用备用服务器，不声明整机、磁盘、机房、多节点或 10,000 用户能力。
