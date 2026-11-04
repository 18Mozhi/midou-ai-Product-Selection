# Amazon 详情页就绪判定

## 原因与修改

2026-11-03只读核查发现：10月27日保存的一条竞品详情浏览器结果为
`succeeded_empty`，DOM片段只有配送/图片等内容，没有商品标题或搜索无结果提示。
原片段哈希一致；线上解析器回放为`source_changed`，随后来源自动停用审计吻合。
这证明该详情不满足解析合同，不证明Amazon全站改版或具体加载失败原因。

`packages/playwright-crawler/src/index.ts`在Amazon配送校验后、提取前，
仅对非`/s`的Amazon详情计划等待非空`#productTitle`及计划原item_selector。
等待使用既有actionTimeoutMs；超时保留原`timeout`分类与原重试预算，不新增导航重试。
成功和超时路径均重查既有验证码/登录/robots保护；失败详情不保存成功证据。
合法搜索空结果、身份/哈希校验、真正解析漂移的自动停用机制均不改变。

## 配置与发布边界

没有新增环境变量、HTTP字段、数据库结构、权限或依赖，OpenAPI及.env.example无需改动。
继续使用既有`PLAYWRIGHT_ACTION_TIMEOUT_MS`配置，不靠增加超时、清队列或清熔断恢复。
当前改动不修改来源开关、评分/成本规则、1688客户端或AI节点。

本项为本地代码修复，不表示已部署或生产来源已恢复。正式授权后使用项目既有
`python scripts/deploy-baota.py`完整运行包发布流程，不使用frontend-only/scoring-only。
Node健康检查与Python启动的采集子进程均消费采集包，按既有流程重启宝塔Node/Python项目；
发布前保留用户正在处理的人工接管会话。来源须在真实健康检查通过后经现有审计恢复入口恢复，
不能直接UPDATE来源/熔断表。恢复采集后观察积压下降、情报新增和真实整链结果；
不得用进程健康或本地夹具代替生产验收。

## 验证

`tests/integration/amazon-detail-readiness.test.mjs`用真实Chromium拦截全部网络请求，
覆盖缺标题、延迟标题、正常标题、等待期间出现验证码、搜索空结果；只请求一页，
不用真实账户或外部Amazon请求，浏览器上下文与临时目录均在finally清理。
另运行既有Amazon契约、配送校验、传输、验证码接管和采集回归。
生产仍需独立验证Amazon、1688、原情报支持、详细竞品、评分与真实采购报价。
