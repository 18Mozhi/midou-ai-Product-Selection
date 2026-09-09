# P67 Redis运行 · REDIS-C-r1

具体稿待用户审核，选择C不等于批准本稿。仅离线交互图，不是生产截图或配置变更。

[打开交互稿](index.html) · [来源与验证](evidence.json)

## 设计与控件

frontend-design技能用于重排“实测/目标/缺证据”的关系：蓝色横向运行边界、白色观测工作区和右侧目标对照，替代旧四指标卡与双持久化卡。#1748a0蓝、#ffffff白、#182d4a正文、#dce4ee分隔、#875300预警、#b02d3c阻断。微软雅黑正文与Consolas数字，正文16px、辅助至少13px、按钮44px。桌面左侧观测右侧边界，手机顺序为发现→资源→持久化→未覆盖项→采样；不缩小桌面卡片，无装饰动画。

只保留刷新、两种错误重试、登录、三个请求ID详情与模拟复制。没有业务模态、排序/筛选/分页、查键值、清缓存、下载、改配置或恢复入口。审核选择器不属于产品。键盘焦点、悬停、按下、加载、保留/清除快照和复制拒绝均有图。

## 不混淆的事实

37数据集：36组真实probe/evaluator/service或实际采样源函数的合成输入输出，以及独立原始E2E。所有样例明确非生产；扫描键和范围只存在于惰性测试输入，不进入脱敏样例或页面。

- 总体ready/warning/blocked由现有policy判定；局部80%淘汰风险函数直接从Vue提取。总体阈值不在DTO中返回，不能把旧manifest75/90标成实测运行参数。自定义85/95样例可总体ready而局部warning，不改服务规则。
- probe失败时available=false、零计数和10000比例是占位；新稿显示未取得观测并标原始占位，不当成稳定运行0天或实测100%满额。已观测0用量仍正常显示0。无上限和超过上限的服务封顶比例单独解释。
- everysec是部署目标，探针只读五INFO和appendonly/save/maxmemory/maxmemory-policy/maxclients，不读appendfsync/bind/protected-mode或演练。AOF状态可回退最近重写状态，DTO没有分离来源标记；不声明每秒落盘实测、实例拓扑独立探测或恢复成功。
- SCAN最多128去重键/32轮，COUNT32为提示，MEMORY每批16；最多4用途×3资源类。比例分母是成功测得字节，非全库内存或访问频率。全部测量失败仍partial且列表空，文案不能叫“无业务键”；成功测得0字节仍sampled，分母0不画有意义的占比条。未截断不代表所有Redis键均在范围中。

## 验证边界

五组源检查：采样器；探针/判门/服务；Vue脚本/局部风险提取；MySQL仓储惰性事务控制流；route/server/config静态链。测试了边界、失败、128键与32轮、并发上限16、去重/忽略、十二分组脱敏、异常清ID、null→empty、单飞/15秒/保留/401403清空/卸载，以及三SQL插入提交/回滚/释放。历史B3b七个相关hash保持，不改旧整表。

这是源码隔离和离线浏览器证据，不是实际Redis、SQL语法/持久性、权限服务器、Vue挂载/保活、系统剪贴板或生产部署证明。recovering仅旧前端枚举展示，无服务恢复流程；真实GET写观测/查看/平台审计，浏览器取消不保证后台停止。生产Vue/API/OpenAPI/Worker/Python/环境/依赖/数据库和宝塔均未修改；无需重启。

复验：仓库根目录 `node scripts/verify-ui-phase2-redis-c.mjs`。有意更新正式图时才用 `--capture`。正式图片、数据和验证器保留；浏览器finally关闭，无临时服务或一次性文件。

请审核结构、异常含义、采样分母和三个请求信息控件。具体批准后才能迁入Vue；全73页实现/部署/签收未完成。

<!-- GALLERY:START -->
正式PNG：126张；61场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 完整观测与十二类采样 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| Redis正在加载 (loading-probe) | [主图](1440-loading-probe.png) | [主图](390-loading-probe.png) |
| AOF未启用 (aof-disabled) | [主图](1440-aof-disabled.png) | [主图](390-aof-disabled.png) |
| RDB规则为空 (rdb-disabled) | [主图](1440-rdb-disabled.png) | [主图](390-rdb-disabled.png) |
| AOF写入失败 (aof-error) | [主图](1440-aof-error.png) | [主图](390-aof-error.png) |
| RDB保存失败 (rdb-error) | [主图](1440-rdb-error.png) | [主图](390-rdb-error.png) |
| 内存上限未设置 (memory-unbounded) | [主图](1440-memory-unbounded.png) | [主图](390-memory-unbounded.png) |
| 连接上限未设置 (clients-unbounded) | [主图](1440-clients-unbounded.png) | [主图](390-clients-unbounded.png) |
| 非noeviction策略 (policy-invalid) | [主图](1440-policy-invalid.png) | [主图](390-policy-invalid.png) |
| 累计拒绝非零 (rejected) | [主图](1440-rejected.png) | [主图](390-rejected.png) |
| 累计淘汰非零 (evicted) | [主图](1440-evicted.png) | [主图](390-evicted.png) |
| 探针失败占位不等于实测0 (probe-failed) | [主图](1440-probe-failed.png) | [主图](390-probe-failed.png) |
| 内存预警前一个基点 (memory-before) | [主图](1440-memory-before.png) | [主图](390-memory-before.png) |
| 内存预警边界 (memory-warning) | [主图](1440-memory-warning.png) | [主图](390-memory-warning.png) |
| 局部80%提示前 (local-before) | [主图](1440-local-before.png) | [主图](390-local-before.png) |
| 局部80%提示触发 (local-warning) | [主图](1440-local-warning.png) | [主图](390-local-warning.png) |
| 内存停止边界 (memory-stop) | [主图](1440-memory-stop.png) | [主图](390-memory-stop.png) |
| 实际使用超过上限 (memory-over) | [主图](1440-memory-over.png) | [主图](390-memory-over.png) |
| 连接阈值 · 75% (clients-warning) | [主图](1440-clients-warning.png) | [主图](390-clients-warning.png) |
| 连接阈值 · 90% (clients-stop) | [主图](1440-clients-stop.png) | [主图](390-clients-stop.png) |
| 运行policy不同于界面80% (custom-policy) | [主图](1440-custom-policy.png) | [主图](390-custom-policy.png) |
| 已观测真实零用量 (zero-resources) | [主图](1440-zero-resources.png) | [主图](390-zero-resources.png) |
| 不足一天的运行期 (short-uptime) | [主图](1440-short-uptime.png) | [主图](390-short-uptime.png) |
| 采样 · empty (sample-empty) | [主图](1440-sample-empty.png) | [主图](390-sample-empty.png) |
| 采样 · ignored (sample-ignored) | [主图](1440-sample-ignored.png) | [主图](390-sample-ignored.png) |
| 采样 · partial (sample-partial) | [主图](1440-sample-partial.png) | [主图](390-sample-partial.png) |
| 采样 · all-failed (sample-all-failed) | [主图](1440-sample-all-failed.png) | [主图](390-sample-all-failed.png) · [近图](390-sample-all-failed-detail.png) |
| 采样 · zero (sample-zero) | [主图](1440-sample-zero.png) | [主图](390-sample-zero.png) · [近图](390-sample-zero-detail.png) |
| 采样 · scan-failed (sample-scan-failed) | [主图](1440-sample-scan-failed.png) | [主图](390-sample-scan-failed.png) |
| 采样 · truncated (sample-truncated) | [主图](1440-sample-truncated.png) | [主图](390-sample-truncated.png) |
| 采样 · round-limit (sample-round-limit) | [主图](1440-sample-round-limit.png) | [主图](390-sample-round-limit.png) |
| 采样 · dedup (sample-dedup) | [主图](1440-sample-dedup.png) | [主图](390-sample-dedup.png) |
| 采样 · invalid-memory (sample-invalid-memory) | [主图](1440-sample-invalid-memory.png) | [主图](390-sample-invalid-memory.png) |
| 采样 · unsupported (sample-unsupported) | [主图](1440-sample-unsupported.png) | [主图](390-sample-unsupported.png) |
| 兼容缺少采样字段 (sample-missing) | [主图](1440-sample-missing.png) | [主图](390-sample-missing.png) |
| 长策略与错误代码 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 原始历史E2E夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次加载 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 空响应 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次15秒超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次读取失败 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 仅UI恢复文案 · 未发起恢复 (recovering) | [主图](1440-recovering.png) | [主图](390-recovering.png) |
| 旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 旧快照超时保留 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 旧快照限流保留 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 旧快照失败保留 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 异常无请求ID (generic-error) | [主图](1440-generic-error.png) | [主图](390-generic-error.png) |
| 成功请求ID披露 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) · [近图](390-request-detail-detail.png) |
| 首次错误请求ID披露 (failure-detail) | [主图](1440-failure-detail.png) | [主图](390-failure-detail.png) |
| 旧快照失败请求ID披露 (refresh-detail) | [主图](1440-refresh-detail.png) | [主图](390-refresh-detail.png) · [近图](390-refresh-detail-detail.png) |
| 成功请求ID模拟复制 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 成功请求ID复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次错误复制拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 保留快照错误复制拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 刷新键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核工具 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
<!-- GALLERY:END -->
