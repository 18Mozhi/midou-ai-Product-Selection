# M03-04 Playwright Crawler 运维手册

## 宝塔配置

生产中保留现有 Node API 与 Python Crawler 两个宝塔项目，不创建 systemd、独立 PM2、宿主机 crontab 或屏外 Docker 服务。Python Crawler 读取 `PLAYWRIGHT_NODE_BINARY` 和 `PLAYWRIGHT_RUNNER_PATH`，由固定 runner 启动同仓库 Chromium 执行器。

在宝塔受限环境按 `config/env.example` 配置：

- `PLAYWRIGHT_HEADLESS`：生产应为 `true`。
- navigation/action timeout：页面导航和单动作上限。
- max pages/scrolls/details：单次执行动作上限；调大前先核对来源合同、并发和站点限制。
- profile archive/extracted/files：加密档案解包资源上限。
- Node binary、runner path、runner timeout：Python 到 Node 的固定桥接边界。

配置在进程启动时读取。修改后必须在宝塔依次重启 Python Crawler；若 Node API 的监控或服务配置也变更，再重启 Node API。不要把密钥、Cookie 或档案内容写入日志或文档。

## 发布与验证

1. 备份 MySQL，并确认没有本模块 running 租约。
2. 执行 `0016d_playwright_crawler_m03_04.up.sql`，必须使用 `product_scout` 业务账号且确认 MySQL 5.7/utf8mb4。
3. 在发布目录复用锁文件安装依赖，安装项目固定的 Playwright Chromium；不得在请求处理中下载浏览器。
4. 构建后运行 `npm run verify:module -- M03-04`。其中包含真实本地 Chromium、MySQL 5.7 独占租约、Python bridge、桌面和 390px 视觉验收。
5. 由宝塔重启 Python Crawler 和 Node API，在 `/platform-admin/collection` 确认档案、活动租约和最近运行可读。

## 故障处理

- `blocked_login` / `blocked_captcha` / `blocked_robots`：停止自动重试，平台管理员核对合法账户、档案与来源政策；不得自动绕过。
- `rate_limited`：遵守 Retry-After 与 M03-05 的后续重试策略；本模块只记录受阻结果。
- `timeout` / `dependency_failed`：在宝塔检查 Python Crawler 日志、Node runner 路径、Chromium 安装和资源上限，使用 request_id/trace_id 关联。
- `crawler_profile_lease_conflict`：等待有效租约结束。只有 `expires_at` 已过期时才在监控页输入“确认回收”。
- `crawler_lease_invalid`：立即停止对应执行，不得用新令牌补写旧运行。

## 回滚与清理

回滚前停止 Python Crawler，确认或回收所有过期租约并备份。执行 down migration 后回退代码/config，再从宝塔启动旧版本。临时档案默认位于 `CREDENTIAL_TEMP_ROOT`；异常残留只能在确认路径属于该根目录、没有活跃 Chromium 后清理，不能递归删除宽泛目录。
