# M03-04 Playwright Crawler 架构

## 边界

`authenticated_browser` 由一条业务关联链执行：Node Worker 仍是 M03-05 `collection_tasks` 的唯一领取者；遇到登录型子查询时写入 `browser_collection_jobs`，Python Crawler 领取该浏览器作业并通过 Node Playwright runner 执行，结果回到同一业务任务和子查询后，再由 Worker 使用 M03-06 持久化证据。低层浏览器运行不能脱离业务作业伪装成采集任务完成。

1688 已登记作业路由、受限导航计划与 `1688-browser-contract-v1` 规范化入口，但真实登录页面的字段提取还没有通过固定样本回放，因此来源继续保持 `setup_required / disabled`。未获得真实样本时不得用推测的字段选择器宣称生产可用。

浏览器账户必须是项目依法持有并由平台安全管理员登记的账户。执行器遇到登录页、验证码、robots 限制或 HTTP 429 时返回明确 blocked/rate-limited 状态，不尝试绕过登录、验证码、付费墙或站点限制。

## 数据与租约

- `browser_collection_jobs` 以 `collection_subquery_id` 唯一关联业务任务；状态、结果、错误、Crawler 实例与租约时间均在 MySQL 5.7 保存。
- 凭证过期或登录失效会创建关联 `collection_task_id` 的 `collection_followup` 续期任务。凭证轮换后，仍处于业务任务执行期的 blocked job 清除旧运行与租约字段并原位回到 `queued`；业务任务已终态时不改写旧作业，而是由 M03-05 克隆任务和子查询自动重放。
- `crawler_profiles` 与 `crawler_profile_leases` 是平台全局资产。同一档案以主键锁和 `SELECT ... FOR UPDATE` 保证仅一个活动租约。
- `crawler_browser_runs` 必须携带 `organization_id`、`workspace_id`、Provider、档案、请求人及 request_id/trace_id；业务范围不从平台档案继承或猜测。
- 数据库只保存带域分离前缀的 SHA-256 租约令牌摘要。令牌只在首次成功获得租约时交给内部 Crawler，幂等重放不再次返回令牌，监控 API 永不返回令牌。
- 心跳和完成必须同时匹配 run、profile 和令牌摘要。到期租约可由显式运维动作回收，对应运行写为 `timed_out / lease_expired`，所有 acquire、heartbeat、release、recover 均落不可变事件。

## 浏览器与档案

`@scoutops/playwright-crawler` 使用 Chromium persistent context。执行计划仅允许 HTTP(S)、明确 origin 白名单和受上限约束的搜索、分页、滚动、详情页动作。M03-07 才能提供真实来源的 URL 和选择器。

浏览器档案秘密是 base64 编码的 `tar.gz` user-data archive，由 M03-02 AES-256-GCM 资产临时物化。解包拒绝绝对路径、目录穿越、反斜杠、链接和未知类型，并限制压缩大小、解压大小及文件数。档案 Buffer、明文压缩包、解压目录和 Chromium context 在成功、受阻、异常与超时路径都由 finally 清理。

Python Crawler 不读取静态执行请求文件。它使用服务 Token 调用 `/internal/crawler-runtime/jobs/acquire`，无任务时得到 204 且不发送空闲心跳；有任务时获得业务关联、代码生成的计划、档案元数据、加密凭证记录和一次性租约。加密凭证与主密钥仅通过 stdin 交给固定 Node runner，runner 在准确临时目录内解密、使用并清理，参数不经 shell 拼接，stdout 只返回带 correlation 的有界结构结果。生产 Python Crawler 与 Node 后端一样只能由宝塔面板管理。

## 权限与响应

平台监控 `GET /api/v1/platform/crawler-runtime` 与过期回收 `POST /api/v1/platform/crawler-runtime/recover-expired` 要求已登录且具备 `collection:replay`。写操作校验同源 Origin 和 Idempotency-Key。平台响应只含档案元数据、租约时间/实例、范围化运行统计和 correlation，不含凭证明文、密文、临时路径、执行计划或租约令牌。只有 Crawler 服务 Token 可以访问 job acquire/heartbeat/complete；内部 acquire 返回密文而非明文，完成结果限制为 2 MB 并同时核对 job、run、profile 和租约摘要。

## 回滚

先在宝塔停止 Python Crawler，再停止统一 Node 后端，确认没有 `browser_collection_jobs.status='leased'`，依次执行 `0049_credential_renewal_auto_replay.down.sql`、`0048_browser_collection_jobs.down.sql`，再按既有流程回退 `0016d_playwright_crawler_m03_04.down.sql`。回滚会删除业务作业关联、低层浏览器运行与租约审计表，执行前必须备份；不得在仍有活动租约时回滚。
