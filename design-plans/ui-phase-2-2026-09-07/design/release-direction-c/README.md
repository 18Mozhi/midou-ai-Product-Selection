# P65 · 发布证据 · RELEASE-C-r1

状态：C方向首轮具体稿，待用户审核。不是上线页面、实际发布或回滚验收。

[打开离线交互原型](index.html) · [验证证据](evidence.json)

## 设计计划与取舍

选用蓝 #1547ad、白 #ffffff、底 #f2f5f9、正文 #172638、次文 #52647b、警示 #9c3517。中文用 Microsoft YaHei UI，版本值用 Consolas；30/23/18/16/13字级。编号和等宽字体只用于真实版本标识，不给非步骤导航加序号。左对齐版本对照单、完整可换行SHA、同列阈值和实测，避免旧七卡和三绿环把来源/门状态画成全链通过。

```text
蓝色页头：发布证据 / 只读 / 刷新与授权入口
蓝色页内目录：当前版本 | 历史观察 | 阻断说明
白色版本对照：运行身份 | 部署捕获来源与匹配记录
白色历史观察：策略要求 / 六列实测 / 手机只读详情
白色动作记录：迁移与回滚计时 / 最近历史记录
```

与普通卡片控制台比较后，采用两种有事实依据的结构：版本并排对照、指标按阈值逐列阅读。当前固定目录部署与历史5/25/100观察不画成可执行流程。首屏只给当前服务结论和证据对应关系，不使用百分比圆环；手机版本一列阅读全文，指标进入完整详情。

## 事实与权限

46个数据集：真实 ReleaseRolloutService 在惰性合成仓库上的45组输出，另保留原始E2E夹具。固定审核时钟2026-09-09 12:00中国时间。原始夹具同时有verified、rolled_back门、rollback_verified=false，保留其矛盾，不当作有效生产成功链。

运行SHA用于匹配最近10条查询窗口内的release；gates仅属于匹配release。latest_historical_release只是一条最近历史记录，不是整个历史列表，也不能从它推导其门数据。版本字段可能由服务和配置回退到BUILD_SHA；API不返回独立来源凭据，所以全场景提示“返回文本一致不代表独立核验”，不会用缺少阻断码推导同源通过。

required门按首个gate_kind匹配；status=passed还须满足时长、正流量/样本、有限非空指标、错误率严格小于以及其他指标不超过阈值。原型的单门条件函数从现有源码提取，不修改整体state。负指标、错配百分比、全门缺完成时间、未来完成时间仍可能verified；这些作为待核对事实保留，不在UI暗改判定。新鲜度按required中最新有效完成时间计算，不要求每个门都在30分钟内。

状态stopped/rolled_back可仅来自release.status，不等于自动停止/回滚门存在；两个返回布尔事实独立展示。迁移与回滚耗时仅按服务duration_ms，timing_schema=2且区间合法可为0；未知、旧schema和逆序区间不显示0。metadata不下发；不显示路径/密钥，不调用独立签名write-probe POST。

保留platform:operate读取、仅platform:superadmin可见接口覆盖入口。离线链接只记录导航意图，不实际跨页鉴权。真实权限、读取审计、SQL、Vue挂载/保活生命周期与全主题密度组合仍待验。

## 全部操作与模态

- 刷新、首次失败重试、保留快照重试：单飞，记录离线GET意图；429/超时/不可用保留，401/403清除。
- 登录去/login与超管接口覆盖去/platform-admin/api-coverage只记录意图；三段页内目录只滚动和聚焦。
- 六列显示至少一列、首可见列冻结、标准/紧凑密度；没有业务过滤或分页。
- 手机观察门详情是唯一业务模态：指标、样本、时长、时间、技术ID/代码、原始状态和条件是否满足；关闭、遮罩、Escape、Tab循环、返焦。
- 桌面技术信息、完整版本披露、阻断原始建议、两处请求编号；复制版本/请求编号仅为待审模拟，含成功/拒绝反馈，不写系统剪贴板。
- 审核选择器、深色/高对比及hover/focus/pressed是审图工具，不是新增业务功能。

## 验证与部署边界

仓库根目录运行 `node scripts/verify-ui-phase2-release-c.mjs`，重制正式图片加 `--capture`。采用已有Playwright/TypeScript/Prettier，没有新增依赖。6组源检查区分service、Vue、仓库、GET路由的惰性执行，技术复制拒绝，及当前manifest/config/bootstrap静态检查；不执行数据库、鉴权服务器、生产HTTP、写探针、旧runner或部署器。

当前生产合同由唯一固定根 `/www/wwwroot/ai选品` 与单宝塔Node后端决定；历史双槽5/25/100和旧服务建议只可读，不是当前发布操作说明。具体审核前不修改生产Vue/API/配置/依赖/数据库/Worker/Python，不发布、回滚、迁移或重启。下一P66服务拓扑；全73页具体批准、实现、验收与部署签收未完成。

## 全场景图册

<!-- GALLERY:START -->
正式PNG：169张；81场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 当前SHA匹配历史门 (verified) | [主图](1440-verified.png) | [主图](390-verified.png) |
| 没有发布记录 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 当前SHA没有匹配证据 (current-missing) | [主图](1440-current-missing.png) | [主图](390-current-missing.png) |
| 最近历史记录不是当前SHA (newest-other) | [主图](1440-newest-other.png) | [主图](390-newest-other.png) |
| 应用版本不同源 (identity-app) | [主图](1440-identity-app.png) | [主图](390-identity-app.png) |
| 配置指纹不同源 (identity-config) | [主图](1440-identity-config.png) | [主图](390-identity-config.png) |
| 迁移不同源 (identity-migration) | [主图](1440-identity-migration.png) | [主图](390-identity-migration.png) |
| 部署捕获SHA不一致 (source-mismatch) | [主图](1440-source-mismatch.png) | [主图](390-source-mismatch.png) |
| 来源SHA缺失回退 (source-fallback) | [主图](1440-source-fallback.png) | [主图](390-source-fallback.png) |
| 服务未传运行SHA回退历史 (missing-current-policy) | [主图](1440-missing-current-policy.png) | [主图](390-missing-current-policy.png) |
| 缺25%观察门 (missing-gate) | [主图](1440-missing-gate.png) | [主图](390-missing-gate.png) |
| 没有匹配门记录 (no-gates) | [主图](1440-no-gates.png) | [主图](390-no-gates.png) |
| 发布状态待观察 (pending) | [主图](1440-pending.png) | [主图](390-pending.png) |
| 门状态待观察 (gate-pending) | [主图](1440-gate-pending.png) | [主图](390-gate-pending.png) |
| 发布failed但无自动停止门 (status-stopped) | [主图](1440-status-stopped.png) | [主图](390-status-stopped.png) |
| 存在自动停止门 (stopped) | [主图](1440-stopped.png) | [主图](390-stopped.png) |
| 发布rolled_back但无回滚门 (status-rollback) | [主图](1440-status-rollback.png) | [主图](390-status-rollback.png) |
| 回滚门与真实计时 (rolled_back) | [主图](1440-rolled_back.png) | [主图](390-rolled_back.png) |
| 身份阻断优先于回滚门 (identity-before-rollback) | [主图](1440-identity-before-rollback.png) | [主图](390-identity-before-rollback.png) |
| 回滚优先于自动停止 (rollback-before-stop) | [主图](1440-rollback-before-stop.png) | [主图](390-rollback-before-stop.png) |
| 错误率等于阈值仍阻断 (error-equal) | [主图](1440-error-equal.png) | [主图](390-error-equal.png) |
| 错误率略低于阈值 (error-under) | [主图](1440-error-under.png) | [主图](390-error-under.png) |
| 读取P95等于阈值 (read-equal) | [主图](1440-read-equal.png) | [主图](390-read-equal.png) |
| 读取P95超过阈值 (read-over) | [主图](1440-read-over.png) | [主图](390-read-over.png) |
| 写入P95超过阈值 (write-over) | [主图](1440-write-over.png) | [主图](390-write-over.png) |
| 异步延迟超过阈值 (lag-over) | [主图](1440-lag-over.png) | [主图](390-lag-over.png) |
| 指标空值不是0 (missing-metric) | [主图](1440-missing-metric.png) | [主图](390-missing-metric.png) |
| 非有限指标 (non-finite) | [主图](1440-non-finite.png) | [主图](390-non-finite.png) |
| 负数指标保留 (negative-metric) | [主图](1440-negative-metric.png) | [主图](390-negative-metric.png) |
| 样本数为0 (zero-samples) | [主图](1440-zero-samples.png) | [主图](390-zero-samples.png) |
| 实际流量为0 (zero-traffic) | [主图](1440-zero-traffic.png) | [主图](390-zero-traffic.png) |
| 流量值不等于门标签 (wrong-traffic) | [主图](1440-wrong-traffic.png) | [主图](390-wrong-traffic.png) |
| 观察时长少1秒 (short-observe) | [主图](1440-short-observe.png) | [主图](390-short-observe.png) |
| 四项指标为0 (all-zero-metrics) | [主图](1440-all-zero-metrics.png) | [主图](390-all-zero-metrics.png) |
| 最新完成证据超过30分钟 (stale) | [主图](1440-stale.png) | [主图](390-stale.png) |
| 恰好达到30分钟 (age-exact) | [主图](1440-age-exact.png) | [主图](390-age-exact.png) |
| 所有门完成时间缺失 (no-finish) | [主图](1440-no-finish.png) | [主图](390-no-finish.png) |
| 门完成时间在未来 (future-finish) | [主图](1440-future-finish.png) | [主图](390-future-finish.png) |
| 重复门首条失败 (duplicate-first-failed) | [主图](1440-duplicate-first-failed.png) | [主图](390-duplicate-first-failed.png) |
| 非策略要求的额外门 (extra-gate) | [主图](1440-extra-gate.png) | [主图](390-extra-gate.png) |
| 迁移耗时0毫秒 (zero-duration) | [主图](1440-zero-duration.png) | [主图](390-zero-duration.png) |
| 旧计时协议不显示0 (legacy-duration) | [主图](1440-legacy-duration.png) | [主图](390-legacy-duration.png) |
| 逆序时间区间未知 (reverse-duration) | [主图](1440-reverse-duration.png) | [主图](390-reverse-duration.png) |
| 不完整时间区间未知 (missing-duration) | [主图](1440-missing-duration.png) | [主图](390-missing-duration.png) |
| 长版本仓库迁移和代码 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 原始E2E部分且矛盾夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 无运维权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 登录已失效 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次限流 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次不可用 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 保留快照刷新中 (refresh-pending) | [主图](1440-refresh-pending.png) | [主图](390-refresh-pending.png) |
| 刷新超时保留 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 刷新限流保留 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 刷新不可用保留 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 刷新无权清快照 (refresh-forbidden) | [主图](1440-refresh-forbidden.png) | [主图](390-refresh-forbidden.png) |
| 刷新过期清快照 (refresh-expired) | [主图](1440-refresh-expired.png) | [主图](390-refresh-expired.png) |
| 超管接口覆盖入口 (superadmin) | [主图](1440-superadmin.png) | [主图](390-superadmin.png) |
| 5%门完整详情 (detail-5) | [主图](1440-detail-5.png) | [主图](390-detail-5.png) · [续图](390-detail-5-part1.png) |
| 25%门完整详情 (detail-25) | [主图](1440-detail-25.png) | [主图](390-detail-25.png) · [续图](390-detail-25-part1.png) |
| 100%门完整详情 (detail-100) | [主图](1440-detail-100.png) | [主图](390-detail-100.png) · [续图](390-detail-100-part1.png) |
| 空指标门详情 (detail-missing) | [主图](1440-detail-missing.png) | [主图](390-detail-missing.png) · [续图](390-detail-missing-part1.png) |
| 长技术代码详情 (detail-long) | [主图](1440-detail-long.png) · [续图](1440-detail-long-part1.png) | [主图](390-detail-long.png) · [续图](390-detail-long-part1.png) · [续图](390-detail-long-part2.png) |
| 桌面门技术展开 (gate-tech) | [主图](1440-gate-tech.png) | [主图](390-gate-tech.png) |
| 服务原始建议展开 (blocker-tech) | [主图](1440-blocker-tech.png) | [主图](390-blocker-tech.png) |
| 完整配置和来源披露 (identity-tech) | [主图](1440-identity-tech.png) | [主图](390-identity-tech.png) |
| 请求编号展开 (request-tech) | [主图](1440-request-tech.png) | [主图](390-request-tech.png) |
| 版本复制成功模拟 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 版本复制拒绝反馈 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 请求复制拒绝反馈 (request-copy-denied) | [主图](1440-request-copy-denied.png) | [主图](390-request-copy-denied.png) |
| 六列设置 (columns-open) | [主图](1440-columns-open.png) | [主图](390-columns-open.png) |
| 只保留一列 (one-column) | [主图](1440-one-column.png) | [主图](390-one-column.png) |
| 取消首列冻结 (unfrozen) | [主图](1440-unfrozen.png) | [主图](390-unfrozen.png) |
| 紧凑指标表 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 深色审图变体 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比审图变体 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核场景工具 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
<!-- GALLERY:END -->
