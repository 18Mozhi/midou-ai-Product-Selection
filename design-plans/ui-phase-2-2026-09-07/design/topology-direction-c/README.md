# P66 服务拓扑 · TOPOLOGY-C-r1

状态：具体设计稿待用户审核；C方向选择不等于本稿批准。仅离线审核，不是生产截图，不实施或部署。

[打开交互稿](index.html) · [来源与验证证据](evidence.json)

## 设计方案

采用frontend-design技能的蓝色运行上下文＋白色证据工作区。不是旧渐变卡片换色：左侧四段索引，工作区按节点/进程、探测、队列、告警展开。主状态和异常数量并列，不把ready包装成“全部健康”。

六色：#1748a0 导航、#ffffff 工作纸面、#182d4a 正文、#dce4ee 分隔、#875300 警告、#b02d3c 严重。Segoe UI / Microsoft YaHei正文，Consolas代码；正文16px、辅助文字至少13px、按钮至少44px。手机改为两列章节目录和单列证据流；不缩小文字塞桌面表。无自动动画；尊重减少动态效果。

## 行为与逐控件覆盖

刷新/重试同一读取单飞；旧快照失败保留、401/403清空，登录只记录精确/login。403保留源页的重试入口，不增加权限。全部/运行异常队列切换只影响显示，19种策略分别有展开图，未知中文名保留原始队列code。每个进程最近失败、重启时间明细、快照错误、告警/阻断代码均用原生details，无业务弹窗、重启/迁移/修改策略按钮。成功页脚、首次失败、旧快照失败三处请求ID披露和模拟复制分别覆盖。

静态网站→本机API图只表达现有单上游部署合同；MySQL/Redis/Crawler并无该GET逐项健康状态，不能画成绿色在线节点。重启表保留时间、原始累计、增量和重置，不采用样本序号等距曲线。历史最多600条再追加当前进程样本，五分钟桶写入依赖授权查看，不承诺无人查看时连续采样。三端点零样本显示无样本，保留raw0约定解释；P50/P95/P99包含失败与超时。

## 源证据和明确边界

生成器执行真实RuntimeTopologyService/evaluator、健康汇总源函数和Vue脚本，用合成行/惰性依赖，不加载生产配置、不连接数据库、不运行HTTP探测。原始E2E夹具独立保存，摘要/队列不完整或时间矛盾不重算成成功证据。浏览器队列派生/筛选/标签代码由Vue源码提取。

实际验证：90秒含边界、API未来时间与Worker未来时间不同判定、预期节点范围、ready+监督器blocker/严重重启告警、八告警条件、最近一分钟业务失败与等待状态排除、关联先取前四再白名单/本地href校验、重启下降增量0并标重置。公开节点健康与业务健康仅在惰性源码测试比较，页面不多请求接口。

静态仓库/路由断言不证明真实SQL事务、鉴权、审计和取消。真实GET会写查看审计与进程观测；浏览器15秒abort不等于服务停止，路由没有同类页面14秒signal链。Vue原始generic异常保留旧requestId风险已复现；审核稿把模拟失败ID与旧快照分开，只是提案。实际Vue保活生命周期、真实权限、剪贴板、生产同提交证据、全主题/密度未验证。

源判门不改。新中文blocker标签、运行非due辅助文案、无样本表达、重启明细与错误ID归属待具体批准后才迁入Vue。不开新服务、不改Worker并发/优先级/重试/熔断、依赖、API/OpenAPI、配置、数据库或宝塔。无需重启。源历史合同绑定保持原值。

## 复验与审核

仓库根目录运行 `node scripts/verify-ui-phase2-topology-c.mjs`；只有有意更新正式图时使用 `--capture`。正式PNG、数据和证据是交付物，永久保留；验证浏览器finally关闭，无临时服务/一次性文件。确认整体布局、手机阅读顺序、每类详情以及异常表达即可；全73页实施/部署/签收仍未完成。

<!-- GALLERY:START -->
正式PNG：181张；81场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 完整单机证据 · 队列空闲 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| 没有API节点 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 存在其他API但预期节点缺失 (missing) | [主图](1440-missing.png) | [主图](390-missing.png) |
| 预期节点主机不匹配 (host) | [主图](1440-host.png) | [主图](390-host.png) |
| API心跳超过窗口 (node-stale) | [主图](1440-node-stale.png) | [主图](390-node-stale.png) |
| API心跳恰好90秒 (node-boundary) | [主图](1440-node-boundary.png) | [主图](390-node-boundary.png) |
| API未来时间仍通过源判门 (node-future) | [主图](1440-node-future.png) | [主图](390-node-future.png) |
| API状态停止 (stopped) | [主图](1440-stopped.png) | [主图](390-stopped.png) |
| 额外API不变成多节点能力 (extra-node) | [主图](1440-extra-node.png) | [主图](390-extra-node.png) |
| Worker快照缺失 (worker-missing) | [主图](1440-worker-missing.png) | [主图](390-worker-missing.png) |
| Worker心跳过期 · API仍ready (worker-stale) | [主图](1440-worker-stale.png) | [主图](390-worker-stale.png) |
| Worker恰好90秒 (worker-boundary) | [主图](1440-worker-boundary.png) | [主图](390-worker-boundary.png) |
| Worker未来时间判为stale (worker-future) | [主图](1440-worker-future.png) | [主图](390-worker-future.png) |
| Worker已停止 (worker-stopped) | [主图](1440-worker-stopped.png) | [主图](390-worker-stopped.png) |
| 没有监督器快照 (supervisor-missing) | [主图](1440-supervisor-missing.png) | [主图](390-supervisor-missing.png) |
| ready与监督器blocker并存 (supervisor-blocked) | [主图](1440-supervisor-blocked.png) | [主图](390-supervisor-blocked.png) |
| ready与严重重启告警并存 (restart-loop) | [主图](1440-restart-loop.png) | [主图](390-restart-loop.png) |
| 不规则采样与计数重置 (restart-reset) | [主图](1440-restart-reset.png) | [主图](390-restart-reset.png) |
| 三端点零样本 (health-empty) | [主图](1440-health-empty.png) | [主图](390-health-empty.png) |
| 健康摘要读取失败 (health-unavailable) | [主图](1440-health-unavailable.png) | [主图](390-health-unavailable.png) |
| 未配置健康摘要 (health-disabled) | [主图](1440-health-disabled.png) | [主图](390-health-disabled.png) |
| 失败超时也参与分位数 (health-mixed) | [主图](1440-health-mixed.png) | [主图](390-health-mixed.png) |
| 运行但非due不是空闲 (running) | [主图](1440-running.png) | [主图](390-running.png) |
| 背压与老化到顶 (backpressure) | [主图](1440-backpressure.png) | [主图](390-backpressure.png) |
| 疑似卡死 (stuck) | [主图](1440-stuck.png) | [主图](390-stuck.png) |
| 队列熔断 (circuit) | [主图](1440-circuit.png) | [主图](390-circuit.png) |
| 观测发布失败不等于业务失败 (publish-failed) | [主图](1440-publish-failed.png) | [主图](390-publish-failed.png) |
| 一分钟失败与队列时间 (recent-failed) | [主图](1440-recent-failed.png) | [主图](390-recent-failed.png) |
| 精确业务关联 · 一分钟边界 (business) | [主图](1440-business.png) | [主图](390-business.png) |
| 超过一分钟不追加业务告警 (business-old) | [主图](1440-business-old.png) | [主图](390-business-old.png) |
| 等待状态不算失败 · waiting_evidence (waiting_evidence) | [主图](1440-waiting_evidence.png) | [主图](390-waiting_evidence.png) |
| 等待状态不算失败 · waiting_profit (waiting_profit) | [主图](1440-waiting_profit.png) | [主图](390-waiting_profit.png) |
| 关联白名单与前四项限制 (association-invalid) | [主图](1440-association-invalid.png) | [主图](390-association-invalid.png) |
| 长标识与错误文本 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 原始E2E夹具 · 非实时且未重算 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 展开全部19队列 (all) | [主图](1440-all.png) | [主图](390-all.png) |
| 重启时间与差值明细 (restart-detail) | [主图](1440-restart-detail.png) | [主图](390-restart-detail.png) |
| 进程最近失败披露 (process-detail) | [主图](1440-process-detail.png) | [主图](390-process-detail.png) |
| 快照发布错误披露 (snapshot-detail) | [主图](1440-snapshot-detail.png) | [主图](390-snapshot-detail.png) |
| 告警技术与精确业务对象 (alert-detail) | [主图](1440-alert-detail.png) | [主图](390-alert-detail.png) |
| 阻断实际代码披露 (blocker-detail) | [主图](1440-blocker-detail.png) | [主图](390-blocker-detail.png) |
| 成功请求ID披露 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) |
| 请求ID模拟复制成功 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 请求ID模拟复制被拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次读取加载中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 保留旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 首次401登录失效 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403无权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429限流 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次15秒超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次读取不可用 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 旧快照刷新限流 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 旧快照刷新超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 旧快照刷新失败 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 首次错误请求ID (failure-copy) | [主图](1440-failure-copy.png) | [主图](390-failure-copy.png) |
| 保留快照失败请求ID (refresh-copy) | [主图](1440-refresh-copy.png) | [主图](390-refresh-copy.png) |
| 首次错误请求ID复制被拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 保留快照错误请求ID复制被拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 刷新键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核场景选择器 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
| 策略披露 · collection_tasks (policy-0) | [主图](1440-policy-0.png) | [主图](390-policy-0.png) · [详情近图](390-policy-0-detail.png) |
| 策略披露 · auth_delivery (policy-1) | [主图](1440-policy-1.png) | [主图](390-policy-1.png) · [详情近图](390-policy-1-detail.png) |
| 策略披露 · business_task_projection (policy-2) | [主图](1440-policy-2.png) | [主图](390-policy-2.png) · [详情近图](390-policy-2-detail.png) |
| 策略披露 · approval_escalation (policy-3) | [主图](1440-policy-3.png) | [主图](390-policy-3.png) · [详情近图](390-policy-3-detail.png) |
| 策略披露 · notification_outbox (policy-4) | [主图](1440-policy-4.png) | [主图](390-policy-4.png) · [详情近图](390-policy-4-detail.png) |
| 策略披露 · webhook_deliveries (policy-5) | [主图](1440-policy-5.png) | [主图](390-policy-5.png) · [详情近图](390-policy-5-detail.png) |
| 策略披露 · opportunity_refresh (policy-6) | [主图](1440-policy-6.png) | [主图](390-policy-6.png) · [详情近图](390-policy-6-detail.png) |
| 策略披露 · opportunity_scoring (policy-7) | [主图](1440-policy-7.png) | [主图](390-policy-7.png) · [详情近图](390-policy-7-detail.png) |
| 策略披露 · opportunity_profit (policy-8) | [主图](1440-policy-8.png) | [主图](390-policy-8.png) · [详情近图](390-policy-8-detail.png) |
| 策略披露 · competitor_monitor (policy-9) | [主图](1440-policy-9.png) | [主图](390-policy-9.png) · [详情近图](390-policy-9-detail.png) |
| 策略披露 · sourcing_projection (policy-10) | [主图](1440-policy-10.png) | [主图](390-policy-10.png) · [详情近图](390-policy-10-detail.png) |
| 策略披露 · trend_projection (policy-11) | [主图](1440-policy-11.png) | [主图](390-policy-11.png) · [详情近图](390-policy-11-detail.png) |
| 策略披露 · ai_analysis (policy-12) | [主图](1440-policy-12.png) | [主图](390-policy-12.png) · [详情近图](390-policy-12-detail.png) |
| 策略披露 · report_exports (policy-13) | [主图](1440-policy-13.png) | [主图](390-policy-13.png) · [详情近图](390-policy-13-detail.png) |
| 策略披露 · automation_rules (policy-14) | [主图](1440-policy-14.png) | [主图](390-policy-14.png) · [详情近图](390-policy-14-detail.png) |
| 策略披露 · core_collection_projection (policy-15) | [主图](1440-policy-15.png) | [主图](390-policy-15.png) · [详情近图](390-policy-15-detail.png) |
| 策略披露 · automatic_rule_sources (policy-16) | [主图](1440-policy-16.png) | [主图](390-policy-16.png) · [详情近图](390-policy-16-detail.png) |
| 策略披露 · automatic_full_sources (policy-17) | [主图](1440-policy-17.png) | [主图](390-policy-17.png) · [详情近图](390-policy-17-detail.png) |
| 策略披露 · automatic_selection_evaluation (policy-18) | [主图](1440-policy-18.png) | [主图](390-policy-18.png) · [详情近图](390-policy-18-detail.png) |
<!-- GALLERY:END -->
