# P71 容量边界 · CAPACITY-C-r1

具体稿待审核；C方向选择不等于本页批准。离线合成，不发送HTTP或执行测量、签认、恢复。

[打开交互稿](index.html) · [来源与验证](evidence.json)

## 设计与操作

frontend-design技能将容量工作页重排为蓝色运行范围、白色返回声明与停止事实双列；处置依据就近解释当前评价，性能参考表/恢复签认分区，资源只显示绝对值。颜色#1748a0、#ffffff、#182d4a、#dce4ee、#875300、#b02d3c；正文微软雅黑16px、技术标识Consolas，辅助至少13px，控件16px/44px。无自动动画；手机表格逐指标保留记录值和合同参考标签。

保留刷新、首次/旧快照两处核验、签认入口、确认/取消/确认词、finding原生披露与两处共享请求详情/模拟复制。没有筛选、分页、阈值编辑、压测或恢复执行按钮。新增降载动作原生展开为展示既有DTO字段，不执行建议。确认窗无勾选框和新原因输入，固定body沿真实Vue；预览不是服务器绑定观测ID。

## 事实与待审边界

38数据集来自37组合成源输出与独立历史E2E。真实repository读取最新production_benchmark，没有build/signature筛选；service按policy评价，GET另记api_view和审计。图不伪造构建签章。档位5/10的下一档失败、20上限、指标预警和阻断分别呈现；warning不必有下一档失败，blocked不必是5档未通过。异常7/21档仍保留源评价并明确不属于合同档位，不擅自修复算法或扩大声明。

参考停止条件来自现有manifest；运行policy未随DTO返回，参考300/600/1%/60/85%/1024/4096不冒充本次读取的阈值。自定义policy案例保留服务ready即使读350超过参考300。旧8192/262144封顶显示不是主机总量，改绝对数；负值不隐去，null数值已被repository转0不能在浏览器还原未知。图不将0写作100%健康。

签认service只校验kind、reason和最新snapshot两标志，未执行完整评价；陈旧/性能受阻但标志为真仍可进仓储。事务重放或另选最新已核验行，插入签认、操作及审计，不执行恢复/压测、不改测量记录；未绑定预览或构建身份。新稿说明边界，不以“同提交已证明”包装现有实现。实际关联规则仍需SC-G05决策与后续真实验证。

Vue脚本隔离复现GET/POST交叉、成功后读取单飞早退、请求ID被后读覆盖、generic/timeout沿旧ID；POST所有失败保留同key，成功换key，401403清数据。新稿提出统一忙碌锁、请求ID归属与持续独立操作反馈、未知结果不冒充未写入；只在原型，不宣称修复真实Vue。没有保活/卸载/跨会话的完整证明。

## 验证与使用

五组来源检查：实际evaluator/service边界；惰性repository UTC/stop/null转换；实际签认service与repository/recordView惰性事务、重放和失败回滚；实际Vue脚本GET/POST/固定body/key/交叉/文字差异；静态路由与共享确认/详情绑定。七相关B3c历史hash不变。隔离替身不证明SQL/锁/并发/权限/真实审计/幂等持久化/恢复、挂载Vue/保活、共享剪贴板或生产。

复验 `node scripts/verify-ui-phase2-capacity-c.mjs`；有意重新出正式图才加`--capture`。PNG/数据/证据/两个永久验证脚本保留；无一次性临时文件、常驻服务，验证浏览器finally关闭。无生产Vue/API/OpenAPI/环境/配置/数据库/依赖/Worker/Python/权限变更，不部署、不重启。

请审核返回声明、性能参考、恢复签认及失败反馈。全73页真实实现、部署和用户签收仍未完成；下一步盘点全站图稿与审核缺口，不将首轮图齐全当作全站实现完成。

<!-- GALLERY:START -->
正式PNG：175张；82场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 20档规划上限 (ready) | [主图](1440-ready.png) | [主图](390-ready.png) |
| 5档通过/下一档失败 (limited-5) | [主图](1440-limited-5.png) | [主图](390-limited-5.png) |
| 10档通过/下一档失败 (limited-10) | [主图](1440-limited-10.png) | [主图](390-limited-10.png) |
| 未通过5档 (missing) | [主图](1440-missing.png) | [主图](390-missing.png) |
| 观测过期 (stale) | [主图](1440-stale.png) | [主图](390-stale.png) |
| 恰好60分钟 (fresh-boundary) | [主图](1440-fresh-boundary.png) | [主图](390-fresh-boundary.png) |
| 未来观测 (future) | [主图](1440-future.png) | [主图](390-future.png) |
| 读取预警270 (read-warning) | [主图](1440-read-warning.png) | [主图](390-read-warning.png) |
| 读取等于300 (read-boundary) | [主图](1440-read-boundary.png) | [主图](390-read-boundary.png) |
| 读取超过300 (read-stop) | [主图](1440-read-stop.png) | [主图](390-read-stop.png) |
| 写入预警540 (write-warning) | [主图](1440-write-warning.png) | [主图](390-write-warning.png) |
| 写入等于600 (write-boundary) | [主图](1440-write-boundary.png) | [主图](390-write-boundary.png) |
| 写入超过600 (write-stop) | [主图](1440-write-stop.png) | [主图](390-write-stop.png) |
| 错误率0.80% (error-warning) | [主图](1440-error-warning.png) | [主图](390-error-warning.png) |
| 错误率1% (error-stop) | [主图](1440-error-stop.png) | [主图](390-error-stop.png) |
| 异步滞后48秒 (lag-warning) | [主图](1440-lag-warning.png) | [主图](390-lag-warning.png) |
| 异步滞后60秒 (lag-boundary) | [主图](1440-lag-boundary.png) | [主图](390-lag-boundary.png) |
| 异步滞后61秒 (lag-stop) | [主图](1440-lag-stop.png) | [主图](390-lag-stop.png) |
| 归一化负载76.5% (load-warning) | [主图](1440-load-warning.png) | [主图](390-load-warning.png) |
| 归一化负载85% (load-stop) | [主图](1440-load-stop.png) | [主图](390-load-stop.png) |
| 可用内存不足 (memory-stop) | [主图](1440-memory-stop.png) | [主图](390-memory-stop.png) |
| 可用磁盘不足 (disk-stop) | [主图](1440-disk-stop.png) | [主图](390-disk-stop.png) |
| 内存磁盘恰好下限 (resource-boundary) | [主图](1440-resource-boundary.png) | [主图](390-resource-boundary.png) |
| 归档未核验 (archive-missing) | [主图](1440-archive-missing.png) | [主图](390-archive-missing.png) |
| 隔离恢复未核验 (recovery-missing) | [主图](1440-recovery-missing.png) | [主图](390-recovery-missing.png) |
| 两项恢复证据未核验 (both-missing) | [主图](1440-both-missing.png) | [主图](390-both-missing.png) |
| 10档停止事实缺失 (stop-missing) | [主图](1440-stop-missing.png) | [主图](390-stop-missing.png) |
| 下一档与当前档不匹配 (stop-wrong) | [主图](1440-stop-wrong.png) | [主图](390-stop-wrong.png) |
| 20档仍附下一档失败 (ceiling-invalid) | [主图](1440-ceiling-invalid.png) | [主图](390-ceiling-invalid.png) |
| 源评价接受21档异常样本 (over-ceiling) | [主图](1440-over-ceiling.png) | [主图](390-over-ceiling.png) |
| 源评价7档及null下一档边界 (off-stage) | [主图](1440-off-stage.png) | [主图](390-off-stage.png) |
| 负资源保留原值 (negative-resource) | [主图](1440-negative-resource.png) | [主图](390-negative-resource.png) · [近图](390-negative-resource-detail.png) |
| 资源高于旧显示上限 (large-resource) | [主图](1440-large-resource.png) | [主图](390-large-resource.png) |
| 长失败码和处置文本 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 多项阻断与预警 (multiple) | [主图](1440-multiple.png) | [主图](390-multiple.png) |
| 运行策略与合同参考不同 (policy-difference) | [主图](1440-policy-difference.png) | [主图](390-policy-difference.png) · [近图](390-policy-difference-detail.png) |
| 仓储null数值转0 (null-coercion) | [主图](1440-null-coercion.png) | [主图](390-null-coercion.png) |
| 独立历史E2E夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次读取 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 无容量观测 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次依赖失败 (unavailable) | [主图](1440-unavailable.png) | [主图](390-unavailable.png) |
| 保留快照读取中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 保留快照缺新证据 (refresh-empty) | [主图](1440-refresh-empty.png) | [主图](390-refresh-empty.png) |
| 保留快照超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 保留快照限流 (refresh-rate_limited) | [主图](1440-refresh-rate_limited.png) | [主图](390-refresh-rate_limited.png) |
| 保留快照依赖失败 (refresh-unavailable) | [主图](1440-refresh-unavailable.png) | [主图](390-refresh-unavailable.png) |
| 通用失败不沿用旧请求ID (generic-error) | [主图](1440-generic-error.png) | [主图](390-generic-error.png) |
| 快照请求详情 (request-detail) | [主图](1440-request-detail.png) | [主图](390-request-detail.png) |
| 首次失败请求详情 (failure-detail) | [主图](1440-failure-detail.png) | [主图](390-failure-detail.png) |
| 保留失败请求详情 (refresh-detail) | [主图](1440-refresh-detail.png) | [主图](390-refresh-detail.png) |
| 快照模拟复制反馈 (copy-success) | [主图](1440-copy-success.png) | [主图](390-copy-success.png) |
| 快照模拟复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 首次错误模拟复制拒绝 (failure-copy-denied) | [主图](1440-failure-copy-denied.png) | [主图](390-failure-copy-denied.png) |
| 保留错误模拟复制拒绝 (refresh-copy-denied) | [主图](1440-refresh-copy-denied.png) | [主图](390-refresh-copy-denied.png) |
| 处置技术详情 (finding-detail) | [主图](1440-finding-detail.png) | [主图](390-finding-detail.png) · [近图](390-finding-detail-detail.png) |
| 降载动作全文 (degradation-detail) | [主图](1440-degradation-detail.png) | [主图](390-degradation-detail.png) · [近图](390-degradation-detail-detail.png) |
| 刷新键盘聚焦 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 签认确认窗 (confirm) | [主图](1440-confirm.png) | [主图](390-confirm.png) · [近图](390-confirm-detail.png) |
| 确认词正确 (confirm-typed) | [主图](1440-confirm-typed.png) | [主图](390-confirm-typed.png) · [近图](390-confirm-typed-detail.png) |
| 确认词错误 (confirm-wrong) | [主图](1440-confirm-wrong.png) | [主图](390-confirm-wrong.png) · [近图](390-confirm-wrong-detail.png) |
| 无快照签认确认 (confirm-empty) | [主图](1440-confirm-empty.png) | [主图](390-confirm-empty.png) · [近图](390-confirm-empty-detail.png) |
| 恢复标志未核验确认 (confirm-unverified) | [主图](1440-confirm-unverified.png) | [主图](390-confirm-unverified.png) · [近图](390-confirm-unverified-detail.png) |
| 陈旧记录签认确认 (confirm-stale) | [主图](1440-confirm-stale.png) | [主图](390-confirm-stale.png) · [近图](390-confirm-stale-detail.png) |
| 长失败事实页面的签认确认 (confirm-long) | [主图](1440-confirm-long.png) | [主图](390-confirm-long.png) · [近图](390-confirm-long-detail.png) |
| 无快照签认中 (verifying) | [主图](1440-verifying.png) | [主图](390-verifying.png) |
| 旧快照签认中 (attest-pending) | [主图](1440-attest-pending.png) | [主图](390-attest-pending.png) |
| 签认成功与新读取分开 (attest-success) | [主图](1440-attest-success.png) | [主图](390-attest-success.png) |
| 签认被拒绝 (attest-rejected) | [主图](1440-attest-rejected.png) | [主图](390-attest-rejected.png) |
| 签认结果未知 (attest-unknown) | [主图](1440-attest-unknown.png) | [主图](390-attest-unknown.png) |
| 签认401清快照 (attest-expired) | [主图](1440-attest-expired.png) | [主图](390-attest-expired.png) |
| 签认403清快照 (attest-forbidden) | [主图](1440-attest-forbidden.png) | [主图](390-attest-forbidden.png) |
| 无快照操作失败 (attest-empty-failure) | [主图](1440-attest-empty-failure.png) | [主图](390-attest-empty-failure.png) |
| 签认成功随后读取失败 (attest-read-failed) | [主图](1440-attest-read-failed.png) | [主图](390-attest-read-failed.png) |
| 签认成功随后无新证据 (attest-read-empty) | [主图](1440-attest-read-empty.png) | [主图](390-attest-read-empty.png) |
| 签认成功随后401 (attest-read-auth) | [主图](1440-attest-read-auth.png) | [主图](390-attest-read-auth.png) |
| 审核工具展开 (review-tools) | [主图](1440-review-tools.png) | [主图](390-review-tools.png) |
<!-- GALLERY:END -->
