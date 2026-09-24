# P52 · 采集总览 / COLLECTION-OVERVIEW-C-r1

状态：C方向首轮具体稿的视觉已按用户 2026-09-24 全局授权通过；视觉基线main/6acb73fe，2026-09-12按main/298952a7后的当前生产读取、写入及焦点语义重采来源桥接与证据。图稿仍不执行真实重放，不代表接口或部署验收。

[离线交互原型](index.html) · [验证证据](evidence.json) · [事实规格](../../page-specs/P52.md)

## 设计与使用

frontend-design指导“异常研判工作台”：蓝色观测范围/分区导航，白色根因→尝试→死信与恢复，平台来源健康独立，任务/质量按各自口径陈列。手机范围弹窗、来源详情、尝试详情、批量确认四变体；原生展开不是业务模态。保留来源六列、尝试五列及各自列设置/冻结/密度，不把全部数据压成同权卡片。

沿用C蓝#254a9c、白#ffffff、底#edf1f6、正文#202c3d、辅助#58677b、风险#8c3c32；中文系统字体，标题25–32px、控件16px、说明≥13px、44px热区。基础CSS复用P50并纳入指纹，不修改P50。请审根因优先的顺序、范围提示、手机详情、批量目标/原因/结果的可读性。

打开index.html，底部审核工具切场景并显式模拟响应；按钮只记录意图，不访问HTTP。启动/切场景重置URL；初始深链重载、VueRouter历史及KeepAlive不在本原型证明内。

## 真实合同与提案边界

原E2E数据为一个正常来源、运行中2/死信1、质量警告3、一条尝试/死信。独立14来源夹具仅最后一个blocked，真实源排序将其前置；独立批量夹具有2组织2工作区，但继承单条分页元数据；分页夹具总数66/58却只返回1条。本稿同时展示返回条数与原元数据，绝不宣称已返回50条。合成0/8/9、健康/分类/长内容/20上限与第二页状态明确非真实服务端数据。

| 操作 | 合同 / 图稿 |
| --- | --- |
| 范围 | 组织/工作区trim UUID校验；来源ID来自选项；24h/7d/30d/all。输入不发请求，应用重置两页码；原query重建不保留未知项，root_cause=1例外 |
| 统计 | sources仅provider筛，完整source_options独立；任务updated_at、尝试created_at、死信created_at、质量updated_at分别窗口过滤。精确error_code只下钻尝试/死信；根因忽略当前error_code |
| 根因 | 显示源函数错误名及网络/登录/验证码/解析/其他分类，操作仍用原始码；原始码在技术展开。再次选中或清除撤销过滤，不推断同类码 |
| 记录 | 来源异常优先，默认8条展开全部；来源与尝试移动命名详情、技术信息和焦点返回。时间缺失沿用源when的“未检查”，不把它改写为执行事实 |
| 分页 | 两组独立游标、精确服务端meta和响应条数。默认50来自现有服务配置，原型不新增参数或上限；合成完成只展示意图，不模拟真实SQL聚合 |
| 批量 | 仅当前开放项，最多20；原因trim≥2、原始≤500。destructive调用确实需影响勾选和“确认重放”，不能沿用P51无勾选结论 |
| 写入 | 串行POST单任务replay，body仅reason，key为dead-batch:batchId:task_id；独立事务、部分成功不回滚、不覆盖旧任务。成功=创建新任务，不代表执行成功 |
| 链接 | 共享采集3导航、响应6管理链接和每个单任务详情均记录精确路径；不直接访问管理服务 |
| 状态 | 首次/空/失权/限流/受阻，刷新快照保留；读失败与批结果并列。旧观测时间不改为当前时间，错误不是零值 |

源函数惰性桥接现验证：新范围覆盖等待中的旧读取且旧完成不提交；仅尝试响应保留为ready；卸载后的迟到成功不改快照；批量第二条继续使用预览时固定原因，部分成功、明确失败、结果未知和核对读取失败分开。来源展开/批原因字段语义及调用方焦点由真实Vue双端E2E另证；静态原型中的布局与视觉仍待用户审核，不把重采来源桥接冒充新业务授权或生产通过。

## 验证层级与剩余事项

永久脚本AST提取夹具、实际Vue和状态标签，惰性ref/computed与受控Promise验证排序/影响/20项边界、10读取错误路径/15秒abort回调、读取代次与URL字段、精确串行POST/独立幂等键及冻结原因；实际service验证范围/窗口/页码/错误码，实际仓储filter构造验证时间/错误作用域。不挂载Vue、不运行SQL/真实时钟或审计写入。

`node scripts/verify-ui-phase2-collection-overview-c.mjs --capture`生成正式图/证据；无参数复验源/图指纹、31合同源、精确清单/图册链接和交互。复用现有依赖，无安装或配置改动。桌面1440/手机390及六额外断点、CSS zoom2、键盘/焦点、四模态、两表格、范围/根因/分页/批量意图均为静态提案验证；不冒充浏览器菜单200%缩放、读屏或全主题验收。

生产Vue的同路由历史、读取/写入KeepAlive归属、attempts-only、批量冻结及本页焦点消费者已有本地双端E2E；这不替代CL-G01–07其余项、真实API/MySQL/Redis/权限/审计/幂等/Worker、三主题两密度和全73页实现部署签收。暂未改变COLLECTION_CONSOLE_RECENT_LIMIT、权限或生产运行，无需重启。全部图/原型/数据/脚本为正式交付，验证浏览器finally关闭，不留临时服务。

## 全图册

长弹窗part从顶部连续向下滚动覆盖底部内容，不是新增业务场景。

<!-- GALLERY:START -->
正式PNG：124张。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| default | [主图](1440-default.png) | [主图](390-default.png) |
| loading | [主图](1440-loading.png) | [主图](390-loading.png) |
| empty | [主图](1440-empty.png) | [主图](390-empty.png) |
| expired | [主图](1440-expired.png) | [主图](390-expired.png) |
| forbidden | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| blocked | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| rate_limited | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| refreshing | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| refresh-error | [主图](1440-refresh-error.png) | [主图](390-refresh-error.png) |
| refresh-timeout | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| scope | [主图](1440-scope.png) | [主图](390-scope.png) |
| scope-invalid | [主图](1440-scope-invalid.png) | [主图](390-scope-invalid.png) |
| scope-filled | [主图](1440-scope-filled.png) | [主图](390-scope-filled.png) |
| scope-applied | [主图](1440-scope-applied.png) | [主图](390-scope-applied.png) |
| root-selected | [主图](1440-root-selected.png) | [主图](390-root-selected.png) |
| roots-categories | [主图](1440-roots-categories.png) | [主图](390-roots-categories.png) |
| attempt-only | [主图](1440-attempt-only.png) | [主图](390-attempt-only.png) |
| source-0 | [主图](1440-source-0.png) | [主图](390-source-0.png) |
| source-8 | [主图](1440-source-8.png) | [主图](390-source-8.png) |
| source-9 | [主图](1440-source-9.png) | [主图](390-source-9.png) |
| source-all | [主图](1440-source-all.png) | [主图](390-source-all.png) |
| source-14 | [主图](1440-source-14.png) | [主图](390-source-14.png) |
| source-detail | [主图](1440-source-detail.png) | [主图](390-source-detail.png) |
| source-technical | [主图](1440-source-technical.png) | [主图](390-source-technical.png) |
| attempt-detail | [主图](1440-attempt-detail.png) | [主图](390-attempt-detail.png) |
| attempt-technical | [主图](1440-attempt-technical.png) | [主图](390-attempt-technical.png) |
| paged | [主图](1440-paged.png) | [主图](390-paged.png) |
| attempt-page2 | [主图](1440-attempt-page2.png) | [主图](390-attempt-page2.png) |
| dead-page2 | [主图](1440-dead-page2.png) | [主图](390-dead-page2.png) |
| dead-closed | [主图](1440-dead-closed.png) | [主图](390-dead-closed.png) |
| batch-empty | [主图](1440-batch-empty.png) | [主图](390-batch-empty.png) |
| batch-selected | [主图](1440-batch-selected.png) | [主图](390-batch-selected.png) |
| reason-empty | [主图](1440-reason-empty.png) | [主图](390-reason-empty.png) |
| reason-one | [主图](1440-reason-one.png) | [主图](390-reason-one.png) |
| reason-limit | [主图](1440-reason-limit.png) | [主图](390-reason-limit.png) |
| selection-limit | [主图](1440-selection-limit.png) | [主图](390-selection-limit.png) |
| confirm | [主图](1440-confirm.png) | [主图](390-confirm.png) |
| confirm-ack | [主图](1440-confirm-ack.png) | [主图](390-confirm-ack.png) |
| confirm-typed | [主图](1440-confirm-typed.png) | [主图](390-confirm-typed.png) |
| confirm-long | [主图](1440-confirm-long.png) · [局部1](1440-confirm-long-part1.png) | [主图](390-confirm-long.png) · [局部1](390-confirm-long-part1.png) |
| batch-running | [主图](1440-batch-running.png) | [主图](390-batch-running.png) |
| batch-partial | [主图](1440-batch-partial.png) | [主图](390-batch-partial.png) |
| batch-failed | [主图](1440-batch-failed.png) | [主图](390-batch-failed.png) |
| batch-unknown | [主图](1440-batch-unknown.png) | [主图](390-batch-unknown.png) |
| batch-success | [主图](1440-batch-success.png) | [主图](390-batch-success.png) |
| batch-refresh-error | [主图](1440-batch-refresh-error.png) | [主图](390-batch-refresh-error.png) |
| failures-expanded | [主图](1440-failures-expanded.png) | [主图](390-failures-expanded.png) |
| long-content | [主图](1440-long-content.png) | [主图](390-long-content.png) |
| columns-source | [主图](1440-columns-source.png) | [主图](390-columns-source.png) |
| columns-attempt | [主图](1440-columns-attempt.png) | [主图](390-columns-attempt.png) |
| compact | [主图](1440-compact.png) | [主图](390-compact.png) |
| focus | [主图](1440-focus.png) | [主图](390-focus.png) |
| hover | [主图](1440-hover.png) | [主图](390-hover.png) |
| pressed | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| tools | [主图](1440-tools.png) | [主图](390-tools.png) |
| health-healthy | [主图](1440-health-healthy.png) | [主图](390-health-healthy.png) |
| health-warning | [主图](1440-health-warning.png) | [主图](390-health-warning.png) |
| health-degraded | [主图](1440-health-degraded.png) | [主图](390-health-degraded.png) |
| health-blocked | [主图](1440-health-blocked.png) | [主图](390-health-blocked.png) |
| health-critical | [主图](1440-health-critical.png) | [主图](390-health-critical.png) |
| health-unknown | [主图](1440-health-unknown.png) | [主图](390-health-unknown.png) |
<!-- GALLERY:END -->
