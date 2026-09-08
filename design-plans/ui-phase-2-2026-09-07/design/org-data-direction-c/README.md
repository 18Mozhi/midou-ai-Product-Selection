# P35 组织数据 · ORG-DATA-C-r1

状态：C方向独立审核稿，具体页面尚未获审；不是实际Vue实现、生产验证或部署报告。

[打开交互原型](index.html)。直接打开，无需服务；顶部“审核场景”可切换47场景，刷新只记录读取意图，不连接API。

## 设计与复核

frontend-design指导重排为蓝色双视图目录、白色工作区事实表与独立导出履历；观测时间与读取动作在标题旁，汇总压成一行组，质量边界与报表入口置于阅读面下方。区别不是更换颜色，而是让“比较数量”和“查看履历”各自围绕一项阅读任务。手机工作区数字逐项带标签，导出行数紧邻状态，不把成功履历绘成下载按钮。

C色板#254a9c蓝、#193b80深蓝、#202c3d正文、#58677b辅助、#edf1f6底色、#dbe1e9分隔及白色；Microsoft YaHei UI / Microsoft YaHei，左对齐，数字等宽显示；控件16px/44px、辅助至少13px。无旧暖色/衬线/统计卡墙，短按钮反馈尊重reduced-motion。桌面表格与手机零/null场景已目检，之后缩小桌面行距并保留手机正常/归档计数。

## 逐项控件和事实范围

| 控件或数据 | 实际范围及设计行为 |
| --- | --- |
| 工作区比较/导出履历 | 两个只读视图，各自条件与分页保留，不发额外请求 |
| 观测时间 | observed_at原值格式化；刷新演示不假更新，缺失明确未返回时间 |
| 工作区/正常/归档 | comparisons已返回数组长度及status计数，不按筛选重新计算顶部汇总 |
| 热点/机会/未删除任务 | 按源count规则对comparisons求和；tasks数据库排除deleted_at非空 |
| 导出全量/最近导出 | comparisons.exports合计与exports.length分开；后者接口最多100条 |
| 搜索工作区 | 只按名称，trim并忽略大小写，不扩展到ID或业务内容 |
| 工作区状态 | all/active/archived；未知状态保留原文字 |
| 工作区排序 | name_asc、total_desc、trends_desc、opportunities_desc、tasks_desc、exports_desc；数值同值按中文名称 |
| 合计 | 四类记录相加仅用于排序，不是质量评分、健康度或业务优先级 |
| 搜索导出 | 工作区名、中文类型、中文状态；不按技术ID搜索 |
| 导出工作区 | exports.workspace_name去重，空值显示未命名；按名字筛选，不是工作区ID |
| 报表类型 | all/opportunity/trend/team；机会/热点/团队报表，未知保留 |
| 生成状态 | all/queued/leased/retry_scheduled/succeeded/dead_letter/expired；不自行增加重试动作 |
| 导出排序 | created_desc/created_asc/updated_desc/rows_desc/workspace_asc；实际已加载数组排序 |
| 重置筛选/清除筛选 | 当前视图恢复默认并回第一页；原型同时展开输入区、定位焦点，另一视图不清空 |
| 上一页/下一页 | 工作区8行、导出10条；缩页夹紧，本地分页，没有服务端游标 |
| 工作区表格 | 桌面原生table、列标题与行标题；手机逐工作区字段布局，保留表格角色与数字标签 |
| 导出行数 | null显示尚未生成，已知0显示0行；不是同一种业务事实 |
| 履历时间 | created_at和updated_at独立显示，缺失不编造ETA、耗时或生成进度 |
| 技术详情 | 折叠导出记录ID，不请求文件、秘密或业务明细 |
| 刷新数据/重新加载 | GET /org/admin/summary及/org/admin/data，只记意图；保留当前事实和观测时间 |
| 前往报表工作台 | /reports，不附文件URL，不自动生成/下载，不切换会话工作区 |
| 审核场景 | 非业务工具与意图日志，不进入生产 |

读取要求report:read，父摘要另外要求organization:manage，当前会话组织范围不变。没有创建、下载、删除、清洗、修复、阈值编辑、质量评分或本地弹窗；零业务弹窗不是遗漏。

## 数据、URL与验证边界

- AST提取原m06-01的12工作区/23导出，合计热点390、机会210、未删除任务150、导出54。正常11/归档1；全量54不等于最近列表23。
- 原observed_at早于部分履历时间，保留原差异，不冒充一致实时快照。UI2-OG03两条null/0夹具独立呈现，不与23条拼接；长名称、未知值、缺失值和故障标明合成。
- 源count把有限正数保留，其余回退0；time无效值也回退0用于排序。本稿的缺失/非法工作区计数显示数据不全，合计沿源回退且有提示，属于待审防误读提案，不更改后端数值或证明未知值为零。
- URL共11键：org_data_view、org_data_workspace_的query/status/sort/page、org_data_export_的query/workspace/type/status/sort/page。初始文本截200、页码正安全整数、非法选项回默认；默认值从URL移除并保留无关query。
- 筛选改变回第一页，缩减夹紧页码。原型验证两视图条件序列化与reload读取；源watch只refs→router.replace，修改route.query不反向恢复ref，完整前进/后退、多标签或KeepAlive恢复未证明。
- 源函数/computed与显式watch回调离线执行，11种排序完整ID序列作为原型比对依据，不只是数量相等。不是挂载Vue响应性或生产验收。
- 仓库真实data方法以惰性query返回执行，检查当前组织参数、任务未删除条件、导出最近100限制及数字/null映射；不运行SQL，不证明数据库实有行数、跨组织权限或查询性能。
- 原型HTTP、cookies、localStorage、sessionStorage为0；成功状态来源于夹具，不是实际报表生成结果。

## 全部图片

47场景×桌面1440/手机390，共 **94 PNG**，含2张非业务审核工具图。均整页截图，hover/pressed/focus由浏览器实际触发。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始工作区比较 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 原始导出履历 | [查看](1440-exports.png) | [查看](390-exports.png) |
| 工作区第二页 | [查看](1440-workspace_page_two.png) | [查看](390-workspace_page_two.png) |
| 名称搜索 | [查看](1440-workspace_search.png) | [查看](390-workspace_search.png) |
| 正常工作区 | [查看](1440-workspace_active.png) | [查看](390-workspace_active.png) |
| 归档工作区 | [查看](1440-workspace_archived.png) | [查看](390-workspace_archived.png) |
| 暂无工作区 | [查看](1440-workspace_empty.png) | [查看](390-workspace_empty.png) |
| 工作区筛选空 | [查看](1440-workspace_filter_empty.png) | [查看](390-workspace_filter_empty.png) |
| 名称排序 | [查看](1440-workspace_name_sort.png) | [查看](390-workspace_name_sort.png) |
| 热点排序 | [查看](1440-workspace_trends_sort.png) | [查看](390-workspace_trends_sort.png) |
| 机会排序 | [查看](1440-workspace_opportunities_sort.png) | [查看](390-workspace_opportunities_sort.png) |
| 任务排序 | [查看](1440-workspace_tasks_sort.png) | [查看](390-workspace_tasks_sort.png) |
| 导出排序 | [查看](1440-workspace_exports_sort.png) | [查看](390-workspace_exports_sort.png) |
| 零记录工作区 | [查看](1440-workspace_zero.png) | [查看](390-workspace_zero.png) |
| 缺失计数不冒充零 | [查看](1440-workspace_missing.png) | [查看](390-workspace_missing.png) |
| 未知工作区状态 | [查看](1440-workspace_unknown.png) | [查看](390-workspace_unknown.png) |
| 导出第二页 | [查看](1440-export_page_two.png) | [查看](390-export_page_two.png) |
| 导出第三页 | [查看](1440-export_page_three.png) | [查看](390-export_page_three.png) |
| 中文状态搜索 | [查看](1440-export_search.png) | [查看](390-export_search.png) |
| 导出工作区筛选 | [查看](1440-export_workspace.png) | [查看](390-export_workspace.png) |
| 报表类型筛选 | [查看](1440-export_type.png) | [查看](390-export_type.png) |
| 等待处理 | [查看](1440-export_queued.png) | [查看](390-export_queued.png) |
| 正在生成 | [查看](1440-export_leased.png) | [查看](390-export_leased.png) |
| 等待重试 | [查看](1440-export_retry_scheduled.png) | [查看](390-export_retry_scheduled.png) |
| 已完成 | [查看](1440-export_succeeded.png) | [查看](390-export_succeeded.png) |
| 多次失败 | [查看](1440-export_dead_letter.png) | [查看](390-export_dead_letter.png) |
| 已过期 | [查看](1440-export_expired.png) | [查看](390-export_expired.png) |
| 暂无导出 | [查看](1440-export_empty.png) | [查看](390-export_empty.png) |
| 导出筛选空 | [查看](1440-export_filter_empty.png) | [查看](390-export_filter_empty.png) |
| 原UI2零行与未生成 | [查看](1440-export_zero_null.png) | [查看](390-export_zero_null.png) |
| 导出行数排序 | [查看](1440-export_rows_sort.png) | [查看](390-export_rows_sort.png) |
| 未知类型与状态 | [查看](1440-export_unknown.png) | [查看](390-export_unknown.png) |
| 导出技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 长工作区名称 | [查看](1440-long_workspace.png) | [查看](390-long_workspace.png) |
| 长导出工作区名 | [查看](1440-long_export.png) | [查看](390-long_export.png) |
| 观测时间未返回 | [查看](1440-missing_time.png) | [查看](390-missing_time.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 后台刷新保留事实 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败保留事实 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 刷新按钮悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 刷新按钮按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 筛选输入焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |

## 如何使用、调整与验证

打开index.html审核；org-data.css调整样式，org-data.js调整交互。data.js来自原夹具与源验证数据，不应补造生产事实。

仓库根目录运行 `node scripts/verify-ui-phase2-org-data-c.mjs`：核对源/数据/图片哈希，再执行双端交互。修改后加 `--capture` 重采，再无参数复验。复用已有Playwright，不新增依赖或服务。

检查覆盖47场景双端、11排序源结果、两组筛选与8/10分页、焦点/键盘技术详情、URL默认移除与reload、全部导出状态、null/0、表格语义、两GET和报表导航意图、无写按钮/文件链接/弹窗；另测768/1024普通表格/履历、长名称和零/null。browser/context在finally关闭。

94PNG、原型四文件、README/evidence及两脚本均为永久交付，不是临时产物。无临时脚本/文件/下载/日志/服务器遗留。生产apps、API/OpenAPI、权限、数据库、env、依赖及部署配置未改，无重启要求。

## 待审核与未覆盖

请审核工作区表格密度、汇总口径、导出行数/状态关系及手机字段布局。C方向选择不等于P35具体稿获批。真实Vue/SQL/权限/审计、完整主题/密度/角色/原生200%/软键盘/范围/异步生命周期与URL历史仍待办；全73页实现部署未完成，下一P36组织令牌。
