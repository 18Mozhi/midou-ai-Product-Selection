# 本地选品 HTTP 集成覆盖

2026-10-17，本地实现与验证，尚未部署。

## 覆盖范围

`scripts/run-playwright-api-test-server.mjs` 复用实际 Fastify 路由、Argon2 登录、HttpOnly 会话、组织授权、偏好、首页、机会、评分、利润和竞品服务。数据由 `tests/fixtures/selection-http-stack.mjs` 的隔离内存仓库提供，不能写入生产数据库，入口只接受本机回环地址。

新增八个浏览器流程：工作台的新增/合格数量区分、商品图卡身份与事实、实际提交后的服务端筛选、空结果、列表切换、五个独立竞品、观察决策保存并重新打开、页面及业务端点权限拒绝。桌面和 390px 手机共 16 项通过，没有拦截浏览器业务请求；截图为这些实际业务状态，不增加重复健康页截图填充占比。

四项 API 定向检查另覆盖匿名拒绝、缺权限、会话组织范围、跨组织查询不能越权、五个独立竞品、决策版本回读、重复幂等请求、同键改体拒绝与跨来源写入拒绝。

## 发现并修复的产品问题

真实 HTTP 响应已有 `main_asin`，但商品图卡和列表未展示。现按已有字段显示 `ASIN`，无值则不添加标识，不推测、不取其他商品的编号。沿用当前元数据样式；无需增加 API 字段、环境变量或数据库迁移。

## 证据边界

- 内存数据是明确标识的合成验证记录，价格、评价和竞品不是实际爬虫数据。
- 实际 HTTP/认证/授权/业务服务不等于实际 MySQL、Redis、文件存储、Amazon 或 1688。原健康页测试的依赖检查仍是测试替身，不能拿它证明真实依赖可用。
- 保存和重新打开只证明这一隔离进程的仓库回读。进程重启持久性、MySQL 事务与生产权限还由真实栈验收负责。
- 不运行 Worker、不调用模型、不请求外站、不启用生产来源、不增加付费 API，也不证明连续运行或每日百品。

真实性门禁原阈值未改，现统计 55 个截图调用，其中模拟接口文件 27 个，占比 0.4909；三个无拦截 API 测试文件。该门禁只度量覆盖结构，不能代替上述外部验收。

## 执行与运行

执行 `node --test tests/unit/selection-http-stack.test.mjs`；浏览器执行 `node scripts/run-playwright-projects.mjs tests/e2e/m04-10-selection-http.spec.ts`。沿用已有 `PLAYWRIGHT_API_PORT`/`PLAYWRIGHT_WEB_PORT` 与 Chromium 配置，不新增配置项、依赖或生产服务。测试 API 只监听 `127.0.0.1`，每个浏览器项目独立启动与关闭内存数据，不复用生产 API。

该浏览器文件登记在 `verification/release-matrix.json` 的 p04 组，组运行及 `--browser all` 均会包含它；矩阵仍要求与仓库全部浏览器文件一一对应，不豁免新增文件。

本项唯一生产变更是前端 ASIN 显示，更新前端静态包后生效，无新增 Node/Python 重启要求。OpenAPI 中已有 `main_asin`，无需改变 API 合同。全量验证和发布状态见 `selection-release-verification.md`。
