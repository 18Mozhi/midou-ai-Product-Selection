# M03-04 Playwright Crawler 运维手册

## 宝塔配置

生产中只保留一个名为“ai选品”的统一 Node 后端宝塔项目，不再创建独立 Python Crawler、Node Worker、候选后端、systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。统一后端按需拉起仓库内的 Python/Playwright 子执行器；子执行器读取 `PLAYWRIGHT_NODE_BINARY` 和 `PLAYWRIGHT_RUNNER_PATH`，任务结束即退出，不能成为面板外常驻服务。

在宝塔受限环境按 `config/env.example` 配置：

- `PLAYWRIGHT_HEADLESS`：生产应为 `true`。
- navigation/action timeout：页面导航和单动作上限。
- max pages/scrolls/details：单次执行动作上限；调大前先核对来源合同、并发和站点限制。
- profile archive/extracted/files：加密档案解包资源上限。
- Node binary、runner path、runner timeout：Python 到 Node 的固定桥接边界。

配置在统一后端启动时读取。修改后只需在宝塔重启“ai选品”项目。不要把密钥、Cookie 或档案内容写入日志或文档。

## 发布与验证

1. 备份 MySQL，并确认没有本模块 running 租约。
2. 执行 `0016d_playwright_crawler_m03_04.up.sql`，必须使用 `product_scout` 业务账号且确认 MySQL 5.7/utf8mb4。
3. 在发布目录复用锁文件安装依赖，安装项目固定的 Playwright Chromium；不得在请求处理中下载浏览器。
4. 构建后运行 `npm run verify:module -- M03-04`。其中包含真实本地 Chromium、MySQL 5.7 独占租约、Python bridge、桌面和 390px 视觉验收。
5. 由宝塔重启唯一的“ai选品”后端，在 `/platform-admin/collection` 确认档案、活动租约和最近运行可读。

## 故障处理

- `blocked_login` / `blocked_captcha` / `blocked_robots`：停止自动重试，平台管理员核对合法账户、档案与来源政策；不得自动绕过。
- `rate_limited`：遵守 Retry-After 与 M03-05 的后续重试策略；本模块只记录受阻结果。
- `timeout` / `dependency_failed`：在宝塔“ai选品”日志中检查子执行器、Node runner 路径和 Chromium 安装，使用 request_id/trace_id 关联。
- `crawler_profile_lease_conflict`：等待有效租约结束。只有 `expires_at` 已过期时才在监控页输入“确认回收”。
- `crawler_lease_invalid`：立即停止对应执行，不得用新令牌补写旧运行。

## 回滚与清理

回滚前从宝塔停止“ai选品”统一后端，确认或回收所有过期租约并备份。执行 down migration 后回退代码/config，再从宝塔启动旧版本。临时档案默认位于 `CREDENTIAL_TEMP_ROOT`；异常残留只能在确认路径属于该根目录、没有活跃 Chromium 后清理，不能递归删除宽泛目录。
