# P62 链路日志 · LOGS-C-r1

C方向已选，具体稿待审。原E2E夹具和明确合成事件；不读取生产日志，不发请求、写审计、导出文件或打开关联目标。

## 设计范围

依据frontend-design技能，选择蓝色链索引与白色事件工作区。链之间只做本地切换，选择后按时间正序阅读该链；把原先纵向堆叠的逐链宽表拆成索引与当前事件阅读面，不创造完整链耗时、全量计数、时间查询或分页。蓝#102A63、操作蓝#1748B5、白#FFFFFF、底#F3F6FA、墨#17253C、警示#9A5800；微软雅黑/苹方16正文、13辅助、44px热区，时间与事件左对齐，颜色不独自表达异常，无自动播放效果。

保留全部七列、每链独立列设置/首个可见列冻结/密度；列设置是原生details，不新增业务弹窗。手机按链选择后阅读事件卡，完整详情窗保留时间、运行面、事件、状态、资源、异常入口和技术编号。trace缺失时明确来源+ID仅本地键，不能冒充真实trace。只有异常且返回task/provider ID时显示准确关联入口；本稿点击只呈现审核工具意图。

| 控件/状态 | 图稿范围 | 保留边界 |
| --- | --- | --- |
| 刷新/重新加载 | 首读、在途、失败、401/403/限流/超时、保留恢复 | 无新请求超时配置 |
| query/source、检索/重置 | 桌面与手机全屏筛选、草稿/120字/零匹配 | URL source映射GET status，三个运行面；无分页 |
| 链选择、trace/请求/事件编号 | 原三事件双链、缺trace、长字段、200条/末项 | 分组只包含本次返回窗口，不是真实完整链 |
| 列设置、冻结、密度 | 七列最少留一、每链独立设置 | 不影响后端筛选或固定12列CSV |
| 手机事件详情 | API/Worker/Crawler及异常关联入口 | 不猜任务/来源，不进入目标系统 |
| 导出原因/取消/提交 | 2–300字、冻结范围、在途/失败/未知/响应 | 原业务仅一原因窗，无额外强制影响勾选 |

## 真实依据与提案边界

七组隔离检查执行真实Vue computed/load/export、service、repository和CSV route handler；原E2E三事件/两链原样保留，另11事件、无trace、长字段、200条窗口是合成。SQL适配器只记录查询/参数，不执行MySQL：三表联合、降序200、三运行面计数、Crawler started_at和真实关联；特别注意Crawler筛选不搜索关联task/provider/name，不能扩写成通用全字段搜索。

源函数复现15秒/单飞跳过新URL读取、旧记录与新草稿错配、ready时403仍保留、首次超时误称保留、导出原因等待中范围漂移、双POST与卸载后迟到下载。原始useAuditedReason后一次ask会取消前一次，此处双POST复现的是先后提交后的重入，不宣称两个原因窗并存。原型采用独立草稿/已读快照、迟到ID保护、冻结导出目标、原因300字/错误关联及窗内焦点，这些均仅待审提案，未修复真实Vue生命周期。

导出后台先重新查询再锁和事务，幂等重放可返回先前保存集合；不是当前DOM固定快照。隔离仓储只验证锁/审计/重放/冲突/释放意图，未写真实审计。实际route固定12列、BOM、CRLF、双引号转义、首字符=+-@保护；空白前缀不在当前保护范围，不宣称所有表格软件完整防注入已验。原测试仅三列CSV响应不是生产12列证明。本原型没有真实文件下载，成功只说模拟收到响应，不证明用户保存；结果未知不自动重试，原客户端每次独立POST生成新键。

## 审核与运行

已验证61场景130PNG（122双端主图与8连续长窗局部）、131图册链接与来源/图片指纹；七组源隔离断言和12个相关历史合同哈希通过。双端三运行面、草稿与URL/结果范围、迟到ID、200条、每链列/冻结/密度、三类详情/精确链接、三类模态键盘与返焦、原因边界/冻结body/取消不发请求、六断点/CSS200%与字号热区通过。文档/运行文档/静态分析/格式门禁通过，HTTP和浏览器错误均0。人工看图修正桌面误显手机卡片、关闭按钮断字、手机目录与原因说明间距；不把局部原型测试等同真实应用全验。

[打开离线交互原型](index.html)，底部切换场景。筛选、导出在途时使用标明“审核工具”的结果模拟按钮；实际业务请求均未发送。生成/复验：`node scripts/verify-ui-phase2-logs-c.mjs --capture` / `node scripts/verify-ui-phase2-logs-c.mjs`。正式数据/逻辑/图册/证据与两个永久脚本是交付物，不是临时测试文件；浏览器finally关闭，不启动服务。

无生产Vue/API/OpenAPI/env/schema/依赖/权限/Worker/Python变更，不部署、不重启。桌面/手机代表主题和密度、CSS200%不等于全部主题组合、原生缩放、软键盘、辅助技术或KeepAlive/浏览器返回通过。具体稿、OP-G01–03/06、真实CSV/SQL/会话同源幂等/权限/审计/全生命周期与全73页实施部署签收待办；下一P64备份恢复，受当前固定目录约束，不按旧运维路径执行迁移。

<!-- GALLERY:START -->
正式PNG：130张；61场景。200条手机窗口只取顶部/尾部代表图，完整记录仍可滚动操作。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 链索引与事件证据 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 原始三事件双链夹具 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 缺失trace逐条分组 (missing) | [主图](1440-missing.png) | [主图](390-missing.png) |
| 200条截断窗口 (large) | [主图](1440-large.png) | [主图](390-large.png) |
| 长链ID、错误码和来源 (long) | [主图](1440-long.png) | [主图](390-long.png) |
| 成功零记录 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次读取 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次15秒超时 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 首次权限拒绝 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次会话过期 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次限流 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 首次依赖错误 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 读取中保留旧范围 (read-pending) | [主图](1440-read-pending.png) | [主图](390-read-pending.png) |
| 失败保留上次范围 (read-error) | [主图](1440-read-error.png) | [主图](390-read-error.png) |
| 权限失败与旧记录边界 (read-forbidden) | [主图](1440-read-forbidden.png) | [主图](390-read-forbidden.png) |
| 手机全屏筛选 (filter-open) | [主图](1440-filter-open.png) | [主图](390-filter-open.png) |
| 草稿未应用 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 120字查询边界 (filter-max) | [主图](1440-filter-max.png) | [主图](390-filter-max.png) |
| 检索零匹配 (no-match) | [主图](1440-no-match.png) | [主图](390-no-match.png) |
| 完整链编号 (trace-open) | [主图](1440-trace-open.png) | [主图](390-trace-open.png) |
| 本次查询与范围 (query-open) | [主图](1440-query-open.png) | [主图](390-query-open.png) |
| 完整事件技术字段 (ids-open) | [主图](1440-ids-open.png) | [主图](390-ids-open.png) · [续图](390-ids-open-part1.png) |
| 七列设置 (columns-open) | [主图](1440-columns-open.png) | [主图](390-columns-open.png) |
| 只保留最后一列 (columns-min) | [主图](1440-columns-min.png) | [主图](390-columns-min.png) |
| 取消首列冻结 (freeze-off) | [主图](1440-freeze-off.png) | [主图](390-freeze-off.png) |
| 紧凑事件表 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 深色代表稿 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比代表稿 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 导出原因与冻结范围 (export-reason) | [主图](1440-export-reason.png) | [主图](390-export-reason.png) |
| 原因不足两字 (export-invalid) | [主图](1440-export-invalid.png) | [主图](390-export-invalid.png) |
| 300字原因 (export-max) | [主图](1440-export-max.png) | [主图](390-export-max.png) |
| 超过300字程序边界 (export-over) | [主图](1440-export-over.png) | [主图](390-export-over.png) |
| 导出在途 (export-pending) | [主图](1440-export-pending.png) | [主图](390-export-pending.png) |
| 收到响应不等于保存 (export-success) | [主图](1440-export-success.png) | [主图](390-export-success.png) |
| 导出失败 (export-error) | [主图](1440-export-error.png) | [主图](390-export-error.png) |
| 导出结果未知 (export-unknown) | [主图](1440-export-unknown.png) | [主图](390-export-unknown.png) |
| 草稿不改变导出范围 (export-draft) | [主图](1440-export-draft.png) | [主图](390-export-draft.png) |
| 关联任务意图 (navigation-task) | [主图](1440-navigation-task.png) | [主图](390-navigation-task.png) |
| 关联来源意图 (navigation-provider) | [主图](1440-navigation-provider.png) | [主图](390-navigation-provider.png) |
| 200条最后事件可达 (large-last) | [主图](1440-large-last.png) | [主图](390-large-last.png) |
| 运行面：API (source-api) | [主图](1440-source-api.png) | [主图](390-source-api.png) |
| 运行面：Worker (source-worker) | [主图](1440-source-worker.png) | [主图](390-source-worker.png) |
| 运行面：爬虫 (source-crawler) | [主图](1440-source-crawler.png) | [主图](390-source-crawler.png) |
| 完整API事件 (detail-api) | [主图](1440-detail-api.png) | [主图](390-detail-api.png) |
| 完整Worker事件 (detail-worker) | [主图](1440-detail-worker.png) | [主图](390-detail-worker.png) |
| 完整爬虫事件 (detail-crawler) | [主图](1440-detail-crawler.png) | [主图](390-detail-crawler.png) |
| API事件技术展开 (detail-tech-api) | [主图](1440-detail-tech-api.png) | [主图](390-detail-tech-api.png) · [续图](390-detail-tech-api-part1.png) |
| Worker事件技术展开 (detail-tech-worker) | [主图](1440-detail-tech-worker.png) | [主图](390-detail-tech-worker.png) · [续图](390-detail-tech-worker-part1.png) |
| 爬虫事件技术展开 (detail-tech-crawler) | [主图](1440-detail-tech-crawler.png) | [主图](390-detail-tech-crawler.png) · [续图](390-detail-tech-crawler-part1.png) |
| 长事件详情与技术正文 (long-detail) | [主图](1440-long-detail.png) · [续图](1440-long-detail-part1.png) | [主图](390-long-detail.png) · [续图](390-long-detail-part1.png) · [续图](390-long-detail-part2.png) · [续图](390-long-detail-part3.png) |
| 事件状态：登录已失效 (status-blocked_login) | [主图](1440-status-blocked_login.png) | [主图](390-status-blocked_login.png) |
| 事件状态：终止失败 (status-failed_terminal) | [主图](1440-status-failed_terminal.png) | [主图](390-status-failed_terminal.png) |
| 事件状态：已超时 (status-timed_out) | [主图](1440-status-timed_out.png) | [主图](390-status-timed_out.png) |
| 事件状态：失败待处理 (status-dead_letter) | [主图](1440-status-dead_letter.png) | [主图](390-status-dead_letter.png) |
| 事件状态：待确认 (status-degraded) | [主图](1440-status-degraded.png) | [主图](390-status-degraded.png) |
| 事件状态：待确认 (status-denied) | [主图](1440-status-denied.png) | [主图](390-status-denied.png) |
| 事件状态：成功 (status-succeeded) | [主图](1440-status-succeeded.png) | [主图](390-status-succeeded.png) |
| 事件状态：待确认 (status-unknown_state) | [主图](1440-status-unknown_state.png) | [主图](390-status-unknown_state.png) |
<!-- GALLERY:END -->
