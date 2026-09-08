# P37 组织审计 · ORG-AUDIT-C-r1

状态：2026-09-09，C方向独立审核稿，具体页面尚未获审；不是实际Vue实现、生产权限验证或部署报告。

[打开交互原型](index.html)。直接打开，无需服务；顶部“审核场景”切换50场景，所有GET只记意图。合成响应只读取本地夹具，复制走内存适配器，不使用系统剪贴板。

## 设计与目检修订

frontend-design指导重构为“蓝色精确条件区＋白色时间线／记录阅读区”。服务端查询与当前已加载搜索完全分区；时间线控制高度、可滚动，记录详情不做弹窗。状态汇总压为一行，显示已加载而非全库；请求ID和追踪ID的复制按钮明确指名字段。手机精确条件折叠，选中记录聚焦详情，返回时间线按钮回到列表标题，不新增业务路由。

沿用户C色板：#254a9c蓝、#193b80深蓝、#202c3d正文、#58677b辅助、#edf1f6底色、#dbe1e9分隔与白色；Microsoft YaHei UI / Microsoft YaHei。控件16px/44px、辅助至少13px，左对齐，数值等宽，短按钮反馈尊重reduced-motion；没有旧AUDIT LEDGER暖色账页或大统计卡墙。

已目检桌面全页及手机普通、高级筛选、范围错误。发现蓝侧区的通用段落样式覆盖了浅红错误块文字，已限定错误颜色为深红，并增加计算样式断言。metadata未返回场景补出原null与源算法{}之间的差异。新增双端详情和高级条件局部图，避免长页缩小后无法审阅字段。

首次加载、服务/网络/超时、无权和登录失效状态只保留阅读恢复入口，不展示可操作筛选、旧详情或占位计数；后台刷新失败则保留上次事实。两种情况分别验证，不把读取失败画成空数据。

## 每项控件及读写边界

| 控件或数据 | 真实范围与原型行为 |
| --- | --- |
| 已加载／成功／失败／已阻止 | 只统计返回数组；首批50为17/17/16，不是全库或需要处理的任务数量 |
| 精确操作代码 | action，最多128字符，trim；不是中文动作模糊搜索 |
| 执行结果 | outcome为空或succeeded/failed/blocked |
| 精确对象类型 | resource_type，最多80字符，trim |
| 高级追踪与时间 | 原生details；移动另有精确条件整体折叠，不是模态窗 |
| 请求ID／追踪ID条件 | request_id/trace_id，最多128字符，trim精确匹配 |
| 开始／结束 | occurred_from/occurred_to，datetime-local转ISO；开始晚于结束就近报错、聚焦开始字段，零请求 |
| 应用筛选 | GET /organizations/:organizationId/audit-events?limit=50加七条件；替换第一页，不写业务事实 |
| 重置全部筛选 | 清空页内搜索、七精确条件与选中值，再记录第一页GET，不只清当前输入 |
| 仅搜索已加载记录 | 最多160字符，按动作中英文、对象类型中英文、结果中文、request_id或trace_id；不检索actor/resource ID或metadata |
| 清空页内搜索 | 只清本地搜索并恢复可见记录；不发送GET |
| 系统连接记录 | realtime.connected默认折叠、计数保留；展开/收起不删事件，有页内搜索或已读精确action时直接显示 |
| 记录选择 | 原生li内button，aria-pressed；详情是aside，不是dialog。键盘Enter选择后聚焦详情标题 |
| 加载更多 | nextCursor续取50条；页内搜索非空（包括纯空格）时隐藏，成功后追加；游标不写入URL |
| 刷新第一页／重新加载 | 只读取当前组织审计接口，不请求/org/admin/summary或成员数据，不访问平台审计接口 |
| 脱敏上下文 | 按源敏感键名递归处理，数组100项、深度超过8层截断；上下文滚动，不撑宽 |
| 复制请求ID／复制追踪ID | 明确字段，演示成功/拒绝；未知或未返回ID禁用是提案，不调用OS剪贴板 |
| 技术详情 | 折叠事件ID、对象ID、操作者、工作区及schema版本；缺失分别沿源未记录／系统／组织级 |
| 返回时间线 | 仅手机页内焦点定位，不发请求或改会话 |
| 审核场景与意图日志 | 非业务工具，未放进生产 |

零业务弹窗；没有编辑、删除、导出、下载、任务重放、创建审计或其他POST。需要当前组织audit:read，不把隐藏按钮当授权边界，真实鉴权仍另验。

## 数据与源函数证据

- AST读取原m06-01的55条事件，首批50、后续5；原事件按分钟倒序。原40条realtime＋10条业务的独立夹具单独展示，不与55条拼成95条。系统事件仍保留原metadata、操作者等来源字段，不臆测重写。
- 长ID、未知动作/对象/结果、嵌套JSON、深度/数组边界、网络错误及迟到状态明确合成；没有读取真实客户审计或密钥。动作unknown保留原代码，结果unknown不计入三种已知结果。
- 原测试路由模拟只处理五个文本条件，不处理时间。原型日期过滤是明确的本地合成响应，检查的是ISO请求语义及夹具范围，不称原E2E已验证SQL时间过滤。
- 实际子Vue的computed/函数与显式watch回调离线执行：六个搜索完整ID序列、计数、系统折叠、选中回退、表单归一化/重置、范围拒绝、URL截断与序列化。不是挂载Vue响应性。
- 源watch在filters变化时覆盖草稿；主要local→router.replace，无反向route.query恢复。初始查询读取160/选中36，七服务端条件来自window.location，游标不存URL；原型验证reload，但完整前进/后退、KeepAlive、多实例未证明。
- 实际父auditPath核对limit50、七字段和cursor；readView审计分支只调auditPath。loadAuditPage的busy重复调用只发一次。实际load中的审计分支跳过summary来自代码核查，不声称本轮挂载验证了审计员真实权限。
- OG-G05：实际copy先等clipboard，再更新copyState；其间choose新记录后旧完成仍写request:copied，已离线复现。本稿用复制序号、页面代次与记录ID保护，不把旧反馈挂到新记录。选择记录只清复制反馈，不使在途读取失效。
- OG-G05：实际loadAuditPage等待追加响应期间，惰性夹具将共享data换为新列表，旧响应会追加到新列表，已复现；未实际执行完整Vue刷新并发。本稿用读取代次与请求ID隔离旧页，受控验证旧响应不会覆盖新pending请求。
- 新查询失败时，源auditFilters已换新值但列表/游标可能仍属旧条件。本稿分别记录已请求条件与已读事实条件，并暂停旧游标，属于待审保护，不修改实际API契约。
- 脱敏执行源函数确认password/secret/token/cookie/authorization/credential/private-key等键、嵌套、数组100和depth>8。普通键里的合成值仍原样可见，绝不宣称通用秘密识别；原null变{}保持并附说明。
- 真实MySqlAuditRepository.list用惰性query响应执行：组织参数分别进入两表、UNION ALL、audit_logs恒succeeded、failed排除日志分支、按occurred_at DESC/id DESC、limit+1与nextCursor、游标缺失拒绝。未执行SQL，不证明真实数据库排序、跨组织权限、性能或审计完整性。
- 服务AuditQueryService和audit-routes的字段、日期、limit、UUID及audit:read规则已读，未更改；本轮原型不能替代这些真实API验证。

## 全部图片

50场景×桌面1440/手机390＝100主图，另4局部图，共 **104 PNG**，含2非业务审核工具图。普通页整页截图；时间线和长JSON为有限高度滚动区，截图只展示可见部分，不表示已删除其余记录。hover/pressed/focus由浏览器实际触发。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始首批50条 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 选中失败记录 | [查看](1440-selected.png) | [查看](390-selected.png) |
| 原始55条已加载 | [查看](1440-loaded_all.png) | [查看](390-loaded_all.png) |
| 已加载失败搜索 | [查看](1440-local_failed.png) | [查看](390-local_failed.png) |
| 已加载追踪搜索 | [查看](1440-local_trace.png) | [查看](390-local_trace.png) |
| 页内无匹配 | [查看](1440-local_empty.png) | [查看](390-local_empty.png) |
| 空格搜索 | [查看](1440-local_space.png) | [查看](390-local_space.png) |
| 精确条件未应用 | [查看](1440-exact_draft.png) | [查看](390-exact_draft.png) |
| 精确条件合成响应 | [查看](1440-exact_applied.png) | [查看](390-exact_applied.png) |
| 高级追踪与时间 | [查看](1440-advanced.png) | [查看](390-advanced.png) |
| 时间范围错误 | [查看](1440-range_error.png) | [查看](390-range_error.png) |
| 查询处理中 | [查看](1440-filter_busy.png) | [查看](390-filter_busy.png) |
| 查询失败保留旧事实 | [查看](1440-filter_failure.png) | [查看](390-filter_failure.png) |
| 精确查询空 | [查看](1440-filter_empty.png) | [查看](390-filter_empty.png) |
| 加载更多处理中 | [查看](1440-more_busy.png) | [查看](390-more_busy.png) |
| 加载更多失败 | [查看](1440-more_failure.png) | [查看](390-more_failure.png) |
| 40连接与10业务独立夹具 | [查看](1440-system_collapsed.png) | [查看](390-system_collapsed.png) |
| 连接记录展开 | [查看](1440-system_expanded.png) | [查看](390-system_expanded.png) |
| 搜索直接展示连接 | [查看](1440-system_search.png) | [查看](390-system_search.png) |
| 精确动作展示连接 | [查看](1440-system_exact.png) | [查看](390-system_exact.png) |
| 只有连接记录 | [查看](1440-system_only.png) | [查看](390-system_only.png) |
| 暂无记录 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 未知动作对象结果 | [查看](1440-unknown.png) | [查看](390-unknown.png) |
| 嵌套键名脱敏 | [查看](1440-metadata_nested.png) | [查看](390-metadata_nested.png) |
| 层级过深截断 | [查看](1440-metadata_deep.png) | [查看](390-metadata_deep.png) |
| 数组100项上限 | [查看](1440-metadata_array.png) | [查看](390-metadata_array.png) |
| 非敏感键值检测边界 | [查看](1440-metadata_limit.png) | [查看](390-metadata_limit.png) |
| 上下文未返回 | [查看](1440-metadata_missing.png) | [查看](390-metadata_missing.png) |
| 长请求与追踪号 | [查看](1440-long_ids.png) | [查看](390-long_ids.png) |
| 请求追踪未返回 | [查看](1440-missing_ids.png) | [查看](390-missing_ids.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 请求ID复制成功 | [查看](1440-request_copied.png) | [查看](390-request_copied.png) |
| 追踪ID复制成功 | [查看](1440-trace_copied.png) | [查看](390-trace_copied.png) |
| 复制被拒绝 | [查看](1440-copy_failed.png) | [查看](390-copy_failed.png) |
| 旧复制结果被隔离 | [查看](1440-late_copy.png) | [查看](390-late_copy.png) |
| 旧页响应被隔离 | [查看](1440-late_page.png) | [查看](390-late_page.png) |
| 审计员只读范围 | [查看](1440-auditor.png) | [查看](390-auditor.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 网络不可用 | [查看](1440-offline.png) | [查看](390-offline.png) |
| 请求超时 | [查看](1440-timeout.png) | [查看](390-timeout.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 后台刷新保留事实 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 后台刷新失败 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 应用按钮悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 应用按钮按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 页内搜索焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |
| 记录详情局部 | [查看](1440-normal-detail.png) | [查看](390-normal-detail.png) |
| 高级筛选局部 | [查看](1440-advanced-detail.png) | [查看](390-advanced-detail.png) |

## 如何使用、调整与验证

直接打开index.html；audit.css调整样式，audit.js调整原型交互，data.js来自原夹具与源验证结果。无需新配置、环境变量、依赖或服务。

运行 `node scripts/verify-ui-phase2-org-audit-c.mjs` 核对源/数据/图片hash后进行双端交互。改稿后加 `--capture` 重采，再无参数复验。现有Playwright复用，无依赖安装。

检查50场景双端及六搜索源ID对照、50→55游标、系统40/10独立夹具、七条件精确参数/ISO范围、URL重载与重置、失败保留旧事实、原生按钮键盘/详情定位、字段复制成功/拒绝/选中与离开、旧页隔离、深层脱敏/100项/普通键边界；768/1024补测五种布局。全程HTTP/console/pageerror/cookies/存储为0，所有browser/context在finally关闭，不操作系统剪贴板。

104PNG、四原型文件、README/evidence及两脚本是永久审核交付。未创建本轮临时脚本、日志、下载或开发服务，不删除旧轮次材料。未改生产apps/API/OpenAPI、数据库/迁移、权限、env、依赖或宝塔部署配置；本轮不部署，无重启要求。

## 待审核与未覆盖

请审核蓝色条件区、白色时间线/详情关系、手机折叠与定位、查询失败范围提示。C方向选择不等于P37具体稿批准。真实Vue/SQL/授权/审计完整性/剪贴板、完整主题/密度/角色/原生200%/软键盘/URL历史和异步生命周期仍待办，OG-G不注销。下一W05 P38平台运行概览；全73页实际实现、部署及用户签收未完成。
