# P64 · 备份与恢复 · BACKUP-RECOVERY-C-r1

状态：C 方向首轮具体稿，待用户审核。不是生产页面，也不是实际备份/恢复验收。

[打开离线交互原型](index.html) · [永久验证证据](evidence.json)

## 设计与审核重点

蓝色侧区负责同机边界和页内导航，白色区按“结论 → 目标与实际 → 演练 → 资产 → 阻断”阅读；不沿用旧英雄卡和四张数字卡。配色以 #1249b8 蓝、#ffffff 白、#f3f6fa 底、#182739 正文、#526278 次文、#a43b12 警示为主。中文系统字体，32/23/18/16/13 字级，数字等宽；以证据完整性为第一原则，不用绿牌代替恢复承诺。

桌面资产七列，手机完整详情；列显示至少一列、首个可见列冻结、标准/紧凑密度保留。原生技术展开、两处请求编号复制、初次读取/保留快照/401与403清除分开。弹窗仅只读资产详情，保留关闭、Escape、遮罩、Tab 循环和返焦；没有备份、恢复、演练、解密、下载或删除执行窗。

## 数据和业务边界

所有正常场景来自现有 BackupRecoveryService 在惰性仓库上的执行，固定审核时钟 2026-09-09 12:00 中国时间。五类资产/十个组为明确合成记录，不是生产覆盖证明。original 单独保留现有 E2E 的部分字段夹具，未补齐为真实成功链。

源函数复现：空/负实际分钟、无演练结束时间仍可能 verified；超过精确到期半天但整天数为90仍 verified；未来结束时间没有被阻断；最近20次运行没有 backup 但最新备份资产查询仍可有数据；仅一种合格恢复对象即可满足副本条件。原型保留服务 state 和原始数值，增加“结论与事实需核对”提示。是否修改这些业务判定仍须确认，未修改生产规则或数据库。

30/120 天为展示场景，不授权变更生产策略或发布资格。实际分钟空值显示“未记录”，零显示0，负值不隐藏；确切到期时间与 floor/ceil 的剩余天数并列。加密和完整性逐条展示，不使用无条件“高强度加密”标题。

## 按钮与交互验收范围

- 顶部刷新 / 首次错误重试 / 保留快照重试：单飞，只记录离线 GET 意图；授权错误清快照。登录链接只记录 `/login` 导航意图。
- 页内三个目录：仅滚动与聚焦；列菜单、冻结、密度：纯展示设置，无请求。
- 手机资产详情 / 技术展开 / 阻断代码 / 请求编号：只读；复制成功与拒绝均为模拟，不操作系统剪贴板。
- 审核场景选择器、深色/高对比、focus/hover/pressed 是审图工具，不新增业务功能或默认主题。

## 复验与剩余事项

仓库根目录执行 `node scripts/verify-ui-phase2-backup-recovery-c.mjs`。需要重新生成正式图时加 `--capture`；先确认当前源文件指纹及相关历史合同一致。验证使用已有 Playwright/TypeScript/Prettier，无新增依赖、测试服务器或生产调用。

证据区分真实源函数的隔离执行、路由静态断言和原型浏览器测试；不替代挂载 Vue、真实 SQL/鉴权/审计、宝塔演练、缓存保活生命周期、全主题密度组合与生产验收。三个源码功能组执行及一个静态路由检查的范围见 evidence.json。

具体稿批准前不替换 Vue、不部署、不迁移、不重启。既有环境/API/OpenAPI/数据库/Worker/Python不变。全部73页具体审核、实现、部署、签收仍未完成；本包之后继续 P65 发布页。

## 全场景图册

<!-- GALLERY:START -->
正式PNG：123张；61场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 同机恢复证据齐备 (verified) | [主图](1440-verified.png) | [主图](390-verified.png) |
| 原始单资产 E2E 夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 尚无备份记录 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 三项阻断 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 演练91天 (stale) | [主图](1440-stale.png) | [主图](390-stale.png) |
| 没有演练 (no-drill) | [主图](1440-no-drill.png) | [主图](390-no-drill.png) |
| 没有资产 (no-assets) | [主图](1440-no-assets.png) | [主图](390-no-assets.png) |
| RPO超过目标 (rpo-over) | [主图](1440-rpo-over.png) | [主图](390-rpo-over.png) |
| RTO超过目标 (rto-over) | [主图](1440-rto-over.png) | [主图](390-rto-over.png) |
| 实际分钟未记录 (null-measurements) | [主图](1440-null-measurements.png) | [主图](390-null-measurements.png) |
| 负值实际分钟 (negative-measurements) | [主图](1440-negative-measurements.png) | [主图](390-negative-measurements.png) |
| 演练结束时间未记录 (no-finished-at) | [主图](1440-no-finished-at.png) | [主图](390-no-finished-at.png) |
| 精确到期时刻 (due-now) | [主图](1440-due-now.png) | [主图](390-due-now.png) |
| 精确到期后半天 (past-exact-expiry) | [主图](1440-past-exact-expiry.png) | [主图](390-past-exact-expiry.png) |
| 未来结束时间 (future-drill) | [主图](1440-future-drill.png) | [主图](390-future-drill.png) |
| 阻断优先于过期 (blocked-stale) | [主图](1440-blocked-stale.png) | [主图](390-blocked-stale.png) |
| 20次运行窗口缺备份 (window-no-backup) | [主图](1440-window-no-backup.png) | [主图](390-window-no-backup.png) |
| 仅一种恢复对象 (one-recovery-kind) | [主图](1440-one-recovery-kind.png) | [主图](390-one-recovery-kind.png) |
| 加密完整性均未核验 (bad-assets) | [主图](1440-bad-assets.png) | [主图](390-bad-assets.png) |
| 零数量零体积 (zero-size) | [主图](1440-zero-size.png) | [主图](390-zero-size.png) |
| 长区域和技术代码 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 30天策略 (policy-30) | [主图](1440-policy-30.png) | [主图](390-policy-30.png) |
| 120天展示夹具 (policy-120) | [主图](1440-policy-120.png) | [主图](390-policy-120.png) |
| 隔离未核验 (drill-isolated) | [主图](1440-drill-isolated.png) | [主图](390-drill-isolated.png) |
| 演练加密未核验 (drill-encrypted) | [主图](1440-drill-encrypted.png) | [主图](390-drill-encrypted.png) |
| 演练完整性未核验 (drill-integrity_verified) | [主图](1440-drill-integrity_verified.png) | [主图](390-drill-integrity_verified.png) |
| 权限边界未核验 (drill-permission_boundary_verified) | [主图](1440-drill-permission_boundary_verified.png) | [主图](390-drill-permission_boundary_verified.png) |
| 审计链未核验 (drill-audit_chain_verified) | [主图](1440-drill-audit_chain_verified.png) | [主图](390-drill-audit_chain_verified.png) |
| 证据哈希未核验 (drill-evidence_hash_verified) | [主图](1440-drill-evidence_hash_verified.png) | [主图](390-drill-evidence_hash_verified.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次无权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次登录过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次限流 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次不可用 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 保留快照刷新中 (refresh-pending) | [主图](1440-refresh-pending.png) | [主图](390-refresh-pending.png) |
| 刷新超时保留 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 刷新限流保留 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 刷新不可用保留 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 刷新无权清除快照 (refresh-forbidden) | [主图](1440-refresh-forbidden.png) | [主图](390-refresh-forbidden.png) |
| 刷新登录过期清除快照 (refresh-expired) | [主图](1440-refresh-expired.png) | [主图](390-refresh-expired.png) |
| 数据库完整资产详情 (detail-mysql_full) | [主图](1440-detail-mysql_full.png) | [主图](390-detail-mysql_full.png) |
| 增量日志资产详情 (detail-mysql_binlog) | [主图](1440-detail-mysql_binlog.png) | [主图](390-detail-mysql_binlog.png) |
| 采集证据资产详情 (detail-evidence) | [主图](1440-detail-evidence.png) | [主图](390-detail-evidence.png) |
| 导出文件资产详情 (detail-export) | [主图](1440-detail-export.png) | [主图](390-detail-export.png) |
| 非秘密配置资产详情 (detail-config) | [主图](1440-detail-config.png) | [主图](390-detail-config.png) |
| 长字段资产详情 (detail-long) | [主图](1440-detail-long.png) | [主图](390-detail-long.png) · [续图](390-detail-long-part1.png) |
| 资产技术展开 (asset-tech) | [主图](1440-asset-tech.png) | [主图](390-asset-tech.png) |
| 阻断代码展开 (blocker-tech) | [主图](1440-blocker-tech.png) | [主图](390-blocker-tech.png) |
| 请求编号展开 (request-tech) | [主图](1440-request-tech.png) | [主图](390-request-tech.png) |
| 复制被拒绝反馈 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 复制成功模拟反馈 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 七列设置 (columns-open) | [主图](1440-columns-open.png) | [主图](390-columns-open.png) |
| 至少保留一列 (one-column) | [主图](1440-one-column.png) | [主图](390-one-column.png) |
| 取消首列冻结 (unfrozen) | [主图](1440-unfrozen.png) | [主图](390-unfrozen.png) |
| 紧凑密度 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 深色审核变体 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比审核变体 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
<!-- GALLERY:END -->
