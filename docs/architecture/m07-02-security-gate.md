# M07-02 安全门禁

## 范围与失败条件

本模块把依赖漏洞、受版本控制的秘密文件、高置信秘密签名、浏览器危险 DOM、敏感 Web Storage、新窗口 opener、SQL 模板插值、CSRF 同源合同、Webhook SSRF、上传入口、越权、日志脱敏和宝塔 Nginx 安全响应头冻结为机器可读策略。任一发现、扫描器异常、依赖审计异常或真实权限链失败均返回非零，并输出同值 `run_id` / `trace_id` 的脱敏 JSON 报告。

本模块不新增数据库表、迁移、生产 API、用户页面、权限、事件或常驻服务。数据库迁移、领域持久化、前端布局/交互和异步队列因此不适用；门禁只在本地、CI 或宝塔受限发布任务中有限执行，报告写入已忽略的 `.artifacts/verification`。现有 MySQL 5.7 权限与安全运营真实链路分别由 `verify-rbac-live` 和 `verify-security-operations-live` 重跑。

## 边界

- Vue 页面禁止 `v-html`、`innerHTML`、动态代码执行和敏感本地存储；唯一允许的 `localStorage` 用途是 `apps/web/src/design/theme.ts` 读写经过枚举校验的非敏感主题 ID，门禁同时锁定文件、调用次数和 `themeStorageKey` 参数。新窗口链接必须同时声明 `noopener noreferrer`。
- Cookie 会话继续以 HttpOnly、SameSite=Strict 为主，写请求由后端同源校验和既有权限服务最终裁决；前端隐藏不构成授权。
- SQL 必须使用参数占位；门禁阻断传给 query/execute 的模板插值。
- Webhook 发送前重新解析 DNS、拒绝私网/回环/链路本地地址，并把 HTTPS 请求固定到已验证地址，防止 DNS 重绑定。
- 未注册 multipart 或自定义上传解析器，因此上传攻击面当前为明确不存在；未来新增时必须先扩展策略和故障测试。
- Nginx 模板设置 CSP、frame 防护、nosniff、Referrer-Policy、Permissions-Policy 和关闭版本暴露。未获得生产 TLS 全链路证据前不声明 HSTS。

## 数据、API、审计与配置

策略对象由 `verification/security-gate.json` 版本化；执行器为 `scripts/verify-security-gate.mjs`。OpenAPI 只登记非运行时命令，不虚构 HTTP 路由。无新增环境变量，沿用 `VERIFY_COMMAND_TIMEOUT_MS` 和 `VERIFY_REPORT_DIR`。报告只保留文件、类别和代码，不输出匹配到的秘密值；授权和安全运营真实链路继续写既有审计记录并自行清理测试数据。
