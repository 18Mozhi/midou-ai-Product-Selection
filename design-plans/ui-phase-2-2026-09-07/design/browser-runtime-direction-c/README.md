# P53 浏览器运行 · BROWSER-RUNTIME-C-r1

状态：C 风格首轮具体图稿待用户审核；[读取、回收与焦点归属](../../P53-INTERACTION-OWNERSHIP-IMPLEMENTATION.md)已进入生产 Vue，尚未部署。方向选择不是本稿批准。审图入口：[交互原型](index.html)，证据：[evidence.json](evidence.json)。

## 构图与视觉

蓝色导航与全局风险范围，白色档案占用清单和运行台账。每个档案按身份、占用、绑定凭证期限、历史失败四栏展开，手机改为纵向事实段；运行六列表格改为可点击摘要卡。避免将“启用”“期限有效”“无租约”合成一个健康徽标。

复用 C 已选基础：蓝 #254a9c、白 #ffffff、背景 #edf1f6、正文 #202c3d、次文 #58677b、风险 #8c3c32；中文系统字体。控制文字至少16px、说明至少13px、热区至少44px。标准/紧凑密度及列显隐/首列冻结都在图稿内；暗色主题、高对比主题与真实浏览器200%缩放仍留待实现阶段，CSS zoom 2不冒充浏览器缩放。

## 逐项操作对应

| 源动作 | 新稿位置 / 状态 |
| --- | --- |
| CL-NAV | 蓝色范围带三条真实路由；原型只记录导航意图 |
| CL53-LOAD | 全局刷新、首次失败重试；忙碌禁用、旧数据与观测时间保留 |
| CL53-FILTER | 搜索、七状态、查询、重置；160字符、控制字符拒绝；提交范围与输入分开 |
| CL53-PAGE | 每页25、前后页、空结果；26条合成夹具验证25/1 |
| CL53-DETAIL | 桌面第一列新增详情入口是待审可达性提案；手机卡进入同一只读窗，六技术字段展开 |
| CL53-RENEW | 期限失效档案跳全部 blocked_login 任务，不伪造精确档案关联 |
| CL53-RECOVER | 全局入口→范围确认→仅输入“确认回收”→空对象 POST 意图；无影响勾选、原因或选择ID参数 |
| 共享交互 | 六列显隐至少一列、密度、首列冻结；两弹窗的关闭/取消/Escape/遮罩与焦点返回 |

审核工具只是本地场景/结果切换，不是正式业务功能。所有按钮默认/禁用、悬停/按下/焦点及写入结果图均见下方图册。

看图复核与修正：桌面/手机主图、回收确认和长详情已人工检查；详情按钮修到16px，首次未知统计用破折号，新提交条件与当前快照条件分行说明。手机保持完整事实，页面较长；本轮不擅自折叠业务内容。视觉组织受frontend-design技能约束，仍需用户确认具体稿，不以工具过关代替审美审核。

## 事实与待审提案严格分开

来源是当前 Vue、E2E、service、repository、routes 和共享确认组件。提取源脚本在惰性适配器中执行，不挂载 Vue，不发送 HTTP，不执行 SQL。31份合同源文件LF指纹必须与当前登记一致。原始三档案三运行与补充边界分开标注；原 E2E 只有三条，没有真实25/1分页证据，26条为明确合成夹具。登录期限与服务器时钟/观测时间的差异保留，不做真实登录探测。

源桥接现验证读取快照与代次会隔离迟到响应，回收成功和随后核对失败分开保留，普通传输异常标记结果未知并锁定再次回收。真实 Vue 另有双端 E2E 覆盖同路由历史、KeepAlive、离页写结算和确认底层 `inert`。表格列工具、桌面详情入口和完整视觉结构仍属于待审图稿；原型未知结果没有“强行重试”按钮，须先到正式运维记录核对，不推导服务器未处理。

真实回收以执行时服务端全部过期档案租约为准，与查询、状态、分页无关。只将仍running的对应运行改为timed_out/lease_expired；清理过期档案租约和过期调度租约，写事件并保存幂等结果。recovered是过期档案租约数量，不等于操作系统停止数量。有效租约、历史、档案和凭证不删除。Origin、权限与幂等仍属于现有真实API合同；本原型只记录 method/path/body，不伪造真实鉴权或幂等凭证。

## 验证与剩余事项

复现/校验：仓库根目录运行 `node scripts/verify-ui-phase2-browser-runtime-c.mjs`；主动重新生成正式图用同命令加 `--capture`。复用现有依赖，不启动服务。正式图、源桥接和数据为交付物，不是待清理临时文件。

验证范围：源函数边界断言、离线双视口交互、断点、尺寸、命名/焦点、无网络和无持久化、源与PNG指纹；真实 Vue 的五组新增场景双端10/10、完整本页双端16/16。尚未覆盖真实权限/Origin/幂等、MySQL事务、Python浏览器与进程状态、真实租约回收、屏幕阅读器、完整主题和生产验收。静态原型初始场景固定，不模拟浏览器历史；该项由真实 Router E2E 验证。

本批修改生产 Vue 的读取、回收反馈和焦点归属，不修改 API、环境变量、依赖或数据库；当前未部署，无重启要求。全73页任务仍未完成，下一设计页 P54 数据中心；P53具体视觉仍需用户审核。

## 双端正式图册

<!-- GALLERY:START -->
正式PNG：108张；53场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 全局档案与运行 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 首次空数据 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 有档案无运行 (no-runs) | [主图](1440-no-runs.png) | [主图](390-no-runs.png) |
| 有运行无档案 (no-profiles) | [主图](1440-no-profiles.png) | [主图](390-no-profiles.png) |
| 搜索无结果 (no-match) | [主图](1440-no-match.png) | [主图](390-no-match.png) |
| 精确追踪查询 (filtered) | [主图](1440-filtered.png) | [主图](390-filtered.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 旧快照刷新中 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 登录过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 无权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 依赖受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次错误 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 刷新失败保留旧快照 (refresh-error) | [主图](1440-refresh-error.png) | [主图](390-refresh-error.png) |
| 15秒读取超时 (refresh-timeout) | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 有效占用 (lease-active) | [主图](1440-lease-active.png) | [主图](390-lease-active.png) |
| 过期占用 (lease-expired) | [主图](1440-lease-expired.png) | [主图](390-lease-expired.png) |
| 无占用禁止回收 (lease-free) | [主图](1440-lease-free.png) | [主图](390-lease-free.png) |
| 停用且有占用 (profile-disabled) | [主图](1440-profile-disabled.png) | [主图](390-profile-disabled.png) |
| 期限未知 (credential-null) | [主图](1440-credential-null.png) | [主图](390-credential-null.png) |
| 期限不可用 (credential-invalid) | [主图](1440-credential-invalid.png) | [主图](390-credential-invalid.png) |
| 期限到期 (credential-expired) | [主图](1440-credential-expired.png) | [主图](390-credential-expired.png) |
| 一毫秒后到期 (credential-one-ms) | [主图](1440-credential-one-ms.png) | [主图](390-credential-one-ms.png) |
| 七天边界 (credential-seven-days) | [主图](1440-credential-seven-days.png) | [主图](390-credential-seven-days.png) |
| 超过七天 (credential-eight-days) | [主图](1440-credential-eight-days.png) | [主图](390-credential-eight-days.png) |
| 最近失败并非当前故障 (last-failure) | [主图](1440-last-failure.png) | [主图](390-last-failure.png) |
| 长身份与错误 (long-content) | [主图](1440-long-content.png) | [主图](390-long-content.png) |
| 合成26条第一页 (paged) | [主图](1440-paged.png) | [主图](390-paged.png) |
| 合成26条第二页 (page-two) | [主图](1440-page-two.png) | [主图](390-page-two.png) |
| 查询160字符 (query-max) | [主图](1440-query-max.png) | [主图](390-query-max.png) |
| 禁止控制字符 (query-invalid) | [主图](1440-query-invalid.png) | [主图](390-query-invalid.png) |
| 只读运行详情 (detail) | [主图](1440-detail.png) | [主图](390-detail.png) · [局部1](390-detail-part1.png) |
| 完整技术字段 (detail-tech) | [主图](1440-detail-tech.png) | [主图](390-detail-tech.png) · [局部1](390-detail-tech-part1.png) |
| 回收确认未输入 (confirm) | [主图](1440-confirm.png) | [主图](390-confirm.png) |
| 输入不匹配 (confirm-wrong) | [主图](1440-confirm-wrong.png) | [主图](390-confirm-wrong.png) |
| 确认输入已满足 (confirm-typed) | [主图](1440-confirm-typed.png) | [主图](390-confirm-typed.png) |
| 回收提交中 (saving) | [主图](1440-saving.png) | [主图](390-saving.png) |
| 回收零项 (recovery-zero) | [主图](1440-recovery-zero.png) | [主图](390-recovery-zero.png) |
| 回收成功后读取中 (recovery-success) | [主图](1440-recovery-success.png) | [主图](390-recovery-success.png) |
| 回收明确失败 (recovery-error) | [主图](1440-recovery-error.png) | [主图](390-recovery-error.png) |
| 回收结果未知 (recovery-unknown) | [主图](1440-recovery-unknown.png) | [主图](390-recovery-unknown.png) |
| 写成功但刷新失败 (success-refresh-error) | [主图](1440-success-refresh-error.png) | [主图](390-success-refresh-error.png) |
| 紧凑密度 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 列显隐 (columns) | [主图](1440-columns.png) | [主图](390-columns.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 运行中 (status-running) | [主图](1440-status-running.png) | [主图](390-status-running.png) |
| 成功 (status-succeeded) | [主图](1440-status-succeeded.png) | [主图](390-status-succeeded.png) |
| 成功但无结果 (status-succeeded_empty) | [主图](1440-status-succeeded_empty.png) | [主图](390-status-succeeded_empty.png) |
| 已拦截 (status-blocked) | [主图](1440-status-blocked.png) | [主图](390-status-blocked.png) |
| 失败 (status-failed) | [主图](1440-status-failed.png) | [主图](390-status-failed.png) |
| 已超时 (status-timed_out) | [主图](1440-status-timed_out.png) | [主图](390-status-timed_out.png) |
| 已取消 (status-cancelled) | [主图](1440-status-cancelled.png) | [主图](390-status-cancelled.png) |
<!-- GALLERY:END -->
