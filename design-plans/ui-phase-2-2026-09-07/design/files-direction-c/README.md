# P69 文件存储 · FILES-C-r1

具体稿待审核；选择C方向不等于批准本页。这里是离线合成设计，不是生产截图。

[打开交互稿](index.html) · [来源与验证](evidence.json)

## 设计与全部控件

frontend-design技能将旧指标卡/状态已核对徽标改为目录双口径清单：蓝色运行范围、白色文件系统与资产索引对照，右侧独立抽样和同机恢复。核心色为蓝#1748a0、纸白#ffffff、正文#182d4a、边线#dce4ee、预警#875300、阻断#b02d3c；微软雅黑正文16px，辅助至少13px，数字对齐，控件44px。手机按目录→样本→恢复纵向展开，无自动动画。

只保留刷新、首次/旧快照重试、过期登录、三个请求ID详情及模拟复制。无业务模态、抽屉、文件列表、下载、删除、备份/恢复执行或配置输入。三个原生progress是只读水位；无效容量/负比例用文字保留原值而不显示误导条。审核选择器不是产品功能。

## 源事实和未覆盖事项

42数据集包含41组实际源probe/evaluator/service的合成输入输出及独立原始E2E。两/零目录、可用但不可写、共享/备用、verified且年龄null和长数字属于评估或布局边界，不冒充正常生产探针输出。三根access/statfs替身和内存SHA256流不触碰真实文件或SQL。

文件系统used=total-available，不是目录递归体积；同盘可能同值，不能相加。索引与盘量分开，temp固定0/不建立持久索引，不说明没有临时文件。无有效容量时10000是约定值；available>total可使源比例为负，而used_bytes被归0，新稿不伪装有效水位。容量判门使用最高水位，DTO未返回运行阈值或每根严重级别，条只代表读数。

样本证据优先按updated_at/id，剩余才取有hash的有效导出；不是随机覆盖。零样本仍可能ready，不能显示100%通过；缺失包括无效路径/读取失败。当前GET不返回分类样本数或配置上限，不固定写成20个。恢复最近20条及同备份evidence/export加密完整副本、隔离/权限/审计/证据；过期在File为warning，不照搬MySQL。未来年龄归0，两位小数可与过期状态并存；probe状态与运行policy都参与。

固定public_access_enabled=false/shared_storage_enabled=false/backup_server_used=false不得覆盖相应finding。路径包含检查不等于Nginx alias、ACL、符号链接或真实公网扫描。历史manifest只列两个根，不作为当前第三根生产验收；此稿不修改历史manifest或生产证据。

## 验证与使用

五组源隔离证据：probe惰性SQL/access/statfs与内存SHA256、边界路径/证据优先样本/取消；恢复与evaluator/service判门及DTO；Vue单飞/15秒/null/清除或保留/空错误ID/卸载及源目录名称/百分比；service信号与仓储三插入惰性提交/回滚；真实route handler惰性权限顺序、14秒race/abort、依赖503与finish清理。八个相关B3b历史hash保持。

不证明实库SQL、事务/审计、运行中SQL即时取消、真实权限/磁盘/恢复、Vue挂载/保活、系统剪贴板、全部主题密度或生产可用。复制只是原型模拟，recovering只是旧前端枚举。

复验：`node scripts/verify-ui-phase2-files-c.mjs`；有意重出正式图才加`--capture`。正式PNG/数据/证据/永久脚本保留，无一次性临时文件或常驻服务；浏览器finally关闭。没有生产Vue/API/OpenAPI/配置/环境/数据库/依赖/Worker/Python/权限变更，不部署、不清理、不恢复，不需重启。

请审核布局、单位、无效水位/零样本表达及控件。批准后才进入真实Vue；全73页实现、部署和签收仍待完成。

<!-- GALLERY:START -->
正式PNG：138张；66场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 三目录与三个样本的源返回 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| 仅两目录（评估边界） (root-count) | [主图](1440-root-count.png) | [主图](390-root-count.png) |
| 未返回目录（评估边界） (roots-empty) | [主图](1440-roots-empty.png) | [主图](390-roots-empty.png) |
| 可用但不可写（评估边界） (not-writable) | [主图](1440-not-writable.png) | [主图](390-not-writable.png) |
| 目录落在静态根内 (public-exposed) | [主图](1440-public-exposed.png) | [主图](390-public-exposed.png) |
| 非预期共享（评估边界） (shared-boundary) | [主图](1440-shared-boundary.png) | [主图](390-shared-boundary.png) |
| 非预期备用机（评估边界） (backup-boundary) | [主图](1440-backup-boundary.png) | [主图](390-backup-boundary.png) |
| 75%预警边界 (capacity-warning) | [主图](1440-capacity-warning.png) | [主图](390-capacity-warning.png) |
| 90%停止边界 (capacity-stop) | [主图](1440-capacity-stop.png) | [主图](390-capacity-stop.png) |
| 加密副本条件未满足 (recovery-unencrypted) | [主图](1440-recovery-unencrypted.png) | [主图](390-recovery-unencrypted.png) |
| 隔离恢复条件未满足 (recovery-unisolated) | [主图](1440-recovery-unisolated.png) | [主图](390-recovery-unisolated.png) |
| 容量0但可用（评估边界） (capacity-unknown) | [主图](1440-capacity-unknown.png) | [主图](390-capacity-unknown.png) |
| 导出根访问失败 (root-access-failed) | [主图](1440-root-access-failed.png) | [主图](390-root-access-failed.png) · [近图](390-root-access-failed-detail.png) |
| 临时根容量读取失败 (root-stat-failed) | [主图](1440-root-stat-failed.png) | [主图](390-root-stat-failed.png) |
| 三个根访问均失败 (all-roots-failed) | [主图](1440-all-roots-failed.png) | [主图](390-all-roots-failed.png) |
| 同盘相同水位不相加 (same-filesystem) | [主图](1440-same-filesystem.png) | [主图](390-same-filesystem.png) |
| 文件系统真实零用量 (measured-zero) | [主图](1440-measured-zero.png) | [主图](390-measured-zero.png) |
| 可用空间负值导致比例封顶 (over-capacity) | [主图](1440-over-capacity.png) | [主图](390-over-capacity.png) |
| 可用空间超过总量（源负比例） (negative-ratio) | [主图](1440-negative-ratio.png) | [主图](390-negative-ratio.png) · [近图](390-negative-ratio-detail.png) |
| 活动索引非零但本次样本为空 (no-samples) | [主图](1440-no-samples.png) | [主图](390-no-samples.png) · [近图](390-no-samples-detail.png) |
| 无活动资产与样本 (no-assets) | [主图](1440-no-assets.png) | [主图](390-no-assets.png) |
| 证据占满抽样名额 (evidence-first) | [主图](1440-evidence-first.png) | [主图](390-evidence-first.png) |
| 仅一个配置样本 (one-sample) | [主图](1440-one-sample.png) | [主图](390-one-sample.png) |
| 所有样本校验不一致 (all-mismatch) | [主图](1440-all-mismatch.png) | [主图](390-all-mismatch.png) |
| 所有样本读取失败 (all-missing) | [主图](1440-all-missing.png) | [主图](390-all-missing.png) · [近图](390-all-missing-detail.png) |
| 证据逃逸与导出片段非法 (invalid-paths) | [主图](1440-invalid-paths.png) | [主图](390-invalid-paths.png) |
| 没有恢复记录 (recovery-empty) | [主图](1440-recovery-empty.png) | [主图](390-recovery-empty.png) |
| 恢复历史查询失败 (recovery-history-failed) | [主图](1440-recovery-history-failed.png) | [主图](390-recovery-history-failed.png) |
| 恢复资产查询失败 (recovery-assets-failed) | [主图](1440-recovery-assets-failed.png) | [主图](390-recovery-assets-failed.png) |
| 缺少导出恢复副本 (recovery-asset-missing) | [主图](1440-recovery-asset-missing.png) | [主图](390-recovery-asset-missing.png) |
| 演练未隔离 (drill-not-isolated) | [主图](1440-drill-not-isolated.png) | [主图](390-drill-not-isolated.png) |
| 略超90天但返回取整90 (drill-stale) | [主图](1440-drill-stale.png) | [主图](390-drill-stale.png) |
| 恰好90天 (drill-boundary) | [主图](1440-drill-boundary.png) | [主图](390-drill-boundary.png) |
| 演练没有完成时间 (drill-null) | [主图](1440-drill-null.png) | [主图](390-drill-null.png) |
| 未来演练年龄归零 (drill-future) | [主图](1440-drill-future.png) | [主图](390-drill-future.png) |
| 实际路径包含检查命中 (public-probe) | [主图](1440-public-probe.png) | [主图](390-public-probe.png) |
| 最近20条只有演练 (twenty-drills) | [主图](1440-twenty-drills.png) | [主图](390-twenty-drills.png) |
| verified但年龄null（评估边界） (verified-null-age) | [主图](1440-verified-null-age.png) | [主图](390-verified-null-age.png) |
| 60天运行policy (stricter-policy) | [主图](1440-stricter-policy.png) | [主图](390-stricter-policy.png) |
| 放宽policy不覆盖probe的stale (relaxed-policy) | [主图](1440-relaxed-policy.png) | [主图](390-relaxed-policy.png) |
| 长数值布局压力（非生产） (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 独立原始E2E夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 空响应 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次15秒超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次依赖失败 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 仅UI恢复文案 (recovering) | [主图](1440-recovering.png) | [主图](390-recovering.png) |
| 旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 旧快照读取超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 旧快照限流 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 旧快照依赖失败 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 无请求ID异常 (generic-error) | [主图](1440-generic-error.png) | [主图](390-generic-error.png) |
| 成功请求ID披露 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) · [近图](390-request-detail-detail.png) |
| 首次错误ID披露 (failure-detail) | [主图](1440-failure-detail.png) | [主图](390-failure-detail.png) |
| 旧快照错误ID披露 (refresh-detail) | [主图](1440-refresh-detail.png) | [主图](390-refresh-detail.png) · [近图](390-refresh-detail-detail.png) |
| 模拟复制成功 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 成功ID复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次错误ID复制拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 旧快照错误ID复制拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 刷新键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核场景选择器 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
<!-- GALLERY:END -->
