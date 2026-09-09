# P70 采集调度 · SCHEDULER-C-r1

具体稿待审核，C方向选择不等于批准本页。仅离线合成设计，不发送HTTP/恢复/健康检查。

[打开交互稿](index.html) · [来源与验证](evidence.json)

## 设计与控件

frontend-design技能将来源处理作为主工作区：蓝色范围条、白色来源清单及独立租约快照，资源/回执与小时桶向下分区。颜色#1748a0、#ffffff、#182d4a、#dce4ee、#875300、#b02d3c；微软雅黑正文16px，技术标识Consolas，辅助至少13px，控件44px，无自动动画。手机每条来源有独立标签，表格有界横向阅读，不截断对象ID。

完整保留刷新/核验、代码搜索、四范围、12分页、来源健康准确链接、两恢复确认/取消/词输入/提交、最近错误、租约技术和三请求详情/模拟复制。两弹窗没有勾选框，沿真实non-destructive canConfirm按trim后确认词判断。确认对象、快照时间及未知/零影响分别显示；有界滚动、初始取消焦点、Escape/Tab圈定、返焦和遮罩取消是原型交付，不等同真实共享组件验证。

## 数据事实与提案边界

36数据集来自35组合成源输出与独立历史E2E。历史E2E没有receipt_spool却为ready，单独保留，不当作现行服务输出。真实仓储九组结果：来源enabled、配置收紧到1、排队在每来源内去重；全来源合计不是全站去重。等待分位来自最多5000条混合子查询中的当前等待值，可含未来0；成功率/耗时只计duration非null的完成样本，不能叫完整24小时等待基线。趋势总量可含未终态运行；活动关联最多100、档案为active而未必占用。

运行数量、资源、回执均按源evaluator。非Linux1/1是开发占位；负载/核数不是CPU利用率。回执缺失/过期/触线和保留期/隔离区分开；pending>0但oldest null显示时间未知，不写无积压。任何到期都不授权删除。源提示仍保留，实际运行服务按当前AGENTS宝塔Node+Python，不执行旧“统一后端内执行器”提示。

回收事务按提交now重新筛过期调度槽位，不改任务状态/档案租约/历史；来源恢复仅该UUID，enabled且open时要求ready健康时间严格晚于opened_at；已关闭recovered=false仍记录操作。图中预览不保证提交结果，健康链接不发起健康检查。

源Vue验证复现：两操作各自防重非全局锁、POST可与GET交叉，后续GET单飞早退及请求ID覆盖；POST401保留已有数据、网络/5xx保留key而4xx清key。新稿提出统一忙碌锁、每对象未知操作key和独立操作结果、POST权限失效清快照；仅提案，尚未实施或改变真实权限/服务规则。成功后读取失败不改写已返回的写入结果；未知不声称未写入，重试仅人工触发。

## 验证与使用

五组来源：真实仓储惰性九查询和分位/桶转换；evaluator/service及Linux/nonLinux惰性HostProbe；实际两恢复repository的重放/零结果/更新/健康边界/审计失败回滚和service UUID/key；Vue脚本GET/POST控制流及原筛选/分页/canConfirm；route/ConfirmDialog静态权限、同源、key、超时和焦点合同。八相关旧B3c hash保持。不证明实SQL隔离/并发/锁、权限/审计/幂等持久化、实际Worker/Python/恢复、Vue挂载/保活、共享剪贴板、全主题密度或生产验收。

复验 `node scripts/verify-ui-phase2-scheduler-c.mjs`；只有有意重出正式图才加`--capture`。正式PNG/数据/证据/两个永久脚本保留；无一次性临时文件、常驻服务，验证浏览器finally关闭。无生产Vue/API/OpenAPI/配置/环境/数据库/Worker/Python/依赖/权限变更，不部署、不执行恢复或清理，无需重启。

请审核来源清单、两个确认流程和独立结果反馈。全73页真实实现、部署及签收尚未完成。

<!-- GALLERY:START -->
正式PNG：197张；92场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 三个来源与混合等待/完成样本 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| Worker为0 (worker-zero) | [主图](1440-worker-zero.png) | [主图](390-worker-zero.png) |
| Crawler为2 (crawler-two) | [主图](1440-crawler-two.png) | [主图](390-crawler-two.png) |
| 全局槽位超限 (global-over) | [主图](1440-global-over.png) | [主图](390-global-over.png) |
| 重复租约 (duplicate) | [主图](1440-duplicate.png) | [主图](390-duplicate.png) |
| 档案独占超限 (profile-over) | [主图](1440-profile-over.png) | [主图](390-profile-over.png) |
| 来源有效并发超限 (provider-over) | [主图](1440-provider-over.png) | [主图](390-provider-over.png) |
| 来源活动超限 (provider-active-over) | [主图](1440-provider-active-over.png) | [主图](390-provider-active-over.png) |
| 来源已熔断 (circuit) | [主图](1440-circuit.png) | [主图](390-circuit.png) |
| 资源观测过期 (resource-stale) | [主图](1440-resource-stale.png) | [主图](390-resource-stale.png) |
| 资源时间在未来 (resource-future) | [主图](1440-resource-future.png) | [主图](390-resource-future.png) |
| 负载85%停止边界 (resource-load-stop) | [主图](1440-resource-load-stop.png) | [主图](390-resource-load-stop.png) |
| 负载76.5%预警边界 (resource-load-warning) | [主图](1440-resource-load-warning.png) | [主图](390-resource-load-warning.png) |
| 内存低于1024MB (resource-memory-stop) | [主图](1440-resource-memory-stop.png) | [主图](390-resource-memory-stop.png) |
| 磁盘接近停止线 (resource-disk-warning) | [主图](1440-resource-disk-warning.png) | [主图](390-resource-disk-warning.png) |
| 没有回执水位 (spool-missing) | [主图](1440-spool-missing.png) | [主图](390-spool-missing.png) |
| 回执观测过期 (spool-stale) | [主图](1440-spool-stale.png) | [主图](390-spool-stale.png) |
| 回执时间在未来 (spool-future) | [主图](1440-spool-future.png) | [主图](390-spool-future.png) |
| 回执盘低于停止线 (spool-disk-stop) | [主图](1440-spool-disk-stop.png) | [主图](390-spool-disk-stop.png) |
| 回执容量触线 (spool-capacity-stop) | [主图](1440-spool-capacity-stop.png) | [主图](390-spool-capacity-stop.png) |
| 回执容量80% (spool-capacity-warning) | [主图](1440-spool-capacity-warning.png) | [主图](390-spool-capacity-warning.png) |
| 达到七天保留期 (spool-retention) | [主图](1440-spool-retention.png) | [主图](390-spool-retention.png) |
| 隔离区有待审阅 (spool-quarantine) | [主图](1440-spool-quarantine.png) | [主图](390-spool-quarantine.png) |
| 没有启用来源 (no-providers) | [主图](1440-no-providers.png) | [主图](390-no-providers.png) |
| 有排队但无完成样本 (no-samples) | [主图](1440-no-samples.png) | [主图](390-no-samples.png) |
| 来源均不需关注 (no-attention) | [主图](1440-no-attention.png) | [主图](390-no-attention.png) |
| 25来源分页 (many) | [主图](1440-many.png) | [主图](390-many.png) |
| 快照中过期槽位为0 (expired-zero) | [主图](1440-expired-zero.png) | [主图](390-expired-zero.png) |
| 过期槽位没有最早时间 (expired-time-unknown) | [主图](1440-expired-time-unknown.png) | [主图](390-expired-time-unknown.png) |
| 有待回写但最老时间null (spool-time-unknown) | [主图](1440-spool-time-unknown.png) | [主图](390-spool-time-unknown.png) · [近图](390-spool-time-unknown-detail.png) |
| 真实零回执 (spool-zero) | [主图](1440-spool-zero.png) | [主图](390-spool-zero.png) |
| 无趋势/关联/档案 (all-empty-lists) | [主图](1440-all-empty-lists.png) | [主图](390-all-empty-lists.png) |
| 源open但失败数未到阈值 (circuit-below-threshold) | [主图](1440-circuit-below-threshold.png) | [主图](390-circuit-below-threshold.png) |
| 长来源与进程标识 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 资源90秒仍有效 (resource-boundary) | [主图](1440-resource-boundary.png) | [主图](390-resource-boundary.png) |
| 历史E2E（无回执字段，非现行服务输出） (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 空响应 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次读取超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次依赖失败 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 旧快照超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 旧快照限流 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 旧快照失败 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 错误无请求ID (generic-error) | [主图](1440-generic-error.png) | [主图](390-generic-error.png) |
| 成功请求详情 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) |
| 首次错误详情 (failure-detail) | [主图](1440-failure-detail.png) | [主图](390-failure-detail.png) |
| 旧快照错误详情 (refresh-detail) | [主图](1440-refresh-detail.png) | [主图](390-refresh-detail.png) |
| 模拟复制成功 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 成功ID复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次错误ID复制拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 旧快照错误ID复制拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 刷新键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核场景选择器 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
| 全部来源 (filter-all) | [主图](1440-filter-all.png) | [主图](390-filter-all.png) |
| 已熔断范围 (filter-open) | [主图](1440-filter-open.png) | [主图](390-filter-open.png) |
| 有排队范围 (filter-queued) | [主图](1440-filter-queued.png) | [主图](390-filter-queued.png) |
| 来源代码搜索 (search-hit) | [主图](1440-search-hit.png) | [主图](390-search-hit.png) |
| 搜索无结果 (search-none) | [主图](1440-search-none.png) | [主图](390-search-none.png) |
| 来源第二页 (page-two) | [主图](1440-page-two.png) | [主图](390-page-two.png) |
| 来源第三页 (page-three) | [主图](1440-page-three.png) | [主图](390-page-three.png) |
| 最近失败展开 (last-error) | [主图](1440-last-error.png) | [主图](390-last-error.png) · [近图](390-last-error-detail.png) |
| 租约技术详情展开 (lease-detail) | [主图](1440-lease-detail.png) | [主图](390-lease-detail.png) · [近图](390-lease-detail-detail.png) |
| 回收影响确认 (expired-confirm) | [主图](1440-expired-confirm.png) | [主图](390-expired-confirm.png) · [近图](390-expired-confirm-detail.png) |
| 回收确认词正确 (expired-typed) | [主图](1440-expired-typed.png) | [主图](390-expired-typed.png) · [近图](390-expired-typed-detail.png) |
| 回收确认词错误 (expired-wrong) | [主图](1440-expired-wrong.png) | [主图](390-expired-wrong.png) · [近图](390-expired-wrong-detail.png) |
| 零过期快照确认 (expired-zero-confirm) | [主图](1440-expired-zero-confirm.png) | [主图](390-expired-zero-confirm.png) · [近图](390-expired-zero-confirm-detail.png) |
| 无快照影响未知确认 (expired-unknown-confirm) | [主图](1440-expired-unknown-confirm.png) | [主图](390-expired-unknown-confirm.png) · [近图](390-expired-unknown-confirm-detail.png) |
| 来源身份确认 (provider-confirm) | [主图](1440-provider-confirm.png) | [主图](390-provider-confirm.png) · [近图](390-provider-confirm-detail.png) |
| 来源确认词正确 (provider-typed) | [主图](1440-provider-typed.png) | [主图](390-provider-typed.png) · [近图](390-provider-typed-detail.png) |
| 来源确认词错误 (provider-wrong) | [主图](1440-provider-wrong.png) | [主图](390-provider-wrong.png) · [近图](390-provider-wrong-detail.png) |
| 长来源身份确认 (provider-long-confirm) | [主图](1440-provider-long-confirm.png) | [主图](390-provider-long-confirm.png) · [近图](390-provider-long-confirm-detail.png) · [底部](390-provider-long-confirm-bottom.png) |
| 回收请求处理中 (expired-pending) | [主图](1440-expired-pending.png) | [主图](390-expired-pending.png) |
| 来源恢复处理中 (provider-pending) | [主图](1440-provider-pending.png) | [主图](390-provider-pending.png) |
| 无快照回收中 (recovering) | [主图](1440-recovering.png) | [主图](390-recovering.png) |
| 回收成功与新读取分离 (expired-success) | [主图](1440-expired-success.png) | [主图](390-expired-success.png) |
| 回收0槽位结果 (expired-zero-result) | [主图](1440-expired-zero-result.png) | [主图](390-expired-zero-result.png) |
| 来源恢复成功 (provider-success) | [主图](1440-provider-success.png) | [主图](390-provider-success.png) |
| 来源无需恢复 (provider-zero-result) | [主图](1440-provider-zero-result.png) | [主图](390-provider-zero-result.png) |
| 回收结果未知 (expired-unknown) | [主图](1440-expired-unknown.png) | [主图](390-expired-unknown.png) |
| 来源结果未知 (provider-unknown) | [主图](1440-provider-unknown.png) | [主图](390-provider-unknown.png) |
| 回收请求拒绝 (expired-rejected) | [主图](1440-expired-rejected.png) | [主图](390-expired-rejected.png) |
| 健康证据不足拒绝 (provider-rejected) | [主图](1440-provider-rejected.png) | [主图](390-provider-rejected.png) |
| 回收权限失效 (expired-auth) | [主图](1440-expired-auth.png) | [主图](390-expired-auth.png) |
| 来源恢复权限失效 (provider-auth) | [主图](1440-provider-auth.png) | [主图](390-provider-auth.png) |
| 回收成功随后读取失败 (expired-read-failed) | [主图](1440-expired-read-failed.png) | [主图](390-expired-read-failed.png) |
| 来源恢复成功随后读取失败 (provider-read-failed) | [主图](1440-provider-read-failed.png) | [主图](390-provider-read-failed.png) |
<!-- GALLERY:END -->
