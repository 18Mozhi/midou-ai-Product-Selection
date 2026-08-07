# M03-04 Playwright Crawler 架构

## 边界

M03-04 只交付 `authenticated_browser` 的底层浏览器执行、档案独占租约与运行监控。真实来源选择器和生产适配器归 M03-07；任务排队、重试、死信、子查询及覆盖率归 M03-05；原始证据和规范化数据归 M03-06。这里不把低层浏览器运行伪装成采集任务完成。

浏览器账户必须是项目依法持有并由平台安全管理员登记的账户。执行器遇到登录页、验证码、robots 限制或 HTTP 429 时返回明确 blocked/rate-limited 状态，不尝试绕过登录、验证码、付费墙或站点限制。

## 数据与租约

- `crawler_profiles` 与 `crawler_profile_leases` 是平台全局资产。同一档案以主键锁和 `SELECT ... FOR UPDATE` 保证仅一个活动租约。
- `crawler_browser_runs` 必须携带 `organization_id`、`workspace_id`、Provider、档案、请求人及 request_id/trace_id；业务范围不从平台档案继承或猜测。
- 数据库只保存带域分离前缀的 SHA-256 租约令牌摘要。令牌只在首次成功获得租约时交给内部 Crawler，幂等重放不再次返回令牌，监控 API 永不返回令牌。
- 心跳和完成必须同时匹配 run、profile 和令牌摘要。到期租约可由显式运维动作回收，对应运行写为 `timed_out / lease_expired`，所有 acquire、heartbeat、release、recover 均落不可变事件。

## 浏览器与档案

`@scoutops/playwright-crawler` 使用 Chromium persistent context。执行计划仅允许 HTTP(S)、明确 origin 白名单和受上限约束的搜索、分页、滚动、详情页动作。M03-07 才能提供真实来源的 URL 和选择器。

浏览器档案秘密是 base64 编码的 `tar.gz` user-data archive，由 M03-02 AES-256-GCM 资产临时物化。解包拒绝绝对路径、目录穿越、反斜杠、链接和未知类型，并限制压缩大小、解压大小及文件数。档案 Buffer、明文压缩包、解压目录和 Chromium context 在成功、受阻、异常与超时路径都由 finally 清理。

Python Crawler 通过 stdin JSON 调用固定 Node runner，参数不经 shell 拼接，stdout 只接收带 correlation 的脱敏结果。生产 Python Crawler 与 Node API 一样只能由宝塔面板管理。

## 权限与响应

平台监控 `GET /api/v1/platform/crawler-runtime` 与过期回收 `POST /api/v1/platform/crawler-runtime/recover-expired` 要求已登录且具备 `collection:replay`。写操作校验同源 Origin 和 Idempotency-Key。响应只含档案元数据、租约时间/实例、范围化运行统计和 correlation，不含凭证明文、密文、临时路径、执行计划或租约令牌。

## 回滚

先在宝塔停止 Python Crawler，再停止 Node API，执行 `0016d_playwright_crawler_m03_04.down.sql`，回退本模块代码和配置后重新构建并由宝塔启动。回滚会删除低层浏览器运行与租约审计表，执行前必须按生产变更流程备份；不得在仍有 running 租约时回滚。
