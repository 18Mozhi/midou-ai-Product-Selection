# P34 审批模板 · ORG-APPROVALS-C-r1

状态：C方向独立审核稿，具体页面尚未获审；不是实际Vue实现、生产验证或部署报告。

[打开交互原型](index.html)，无需启动服务。顶部“审核场景”可切换45场景；刷新仅记录读取意图，导航仅展示目标，无真实API。

## 设计与复核

frontend-design指导重排蓝色双视图目录，审批记录使用连续白色阅读面，模板目录与节点前后差异并列；差异是主要视觉信息，版本号、修订号、节点数各有独立含义。手机按目录→详情阅读，选择后焦点进入详情，“返回模板目录”可达；五筛选默认收纳，不新增全屏筛选窗。前后值逐行显示，不只用颜色或删除线表达差异。

延续C的#254a9c蓝、#193b80深蓝、#202c3d正文、#58677b辅助、#edf1f6底色、#dbe1e9分隔及白色；Microsoft YaHei UI / Microsoft YaHei，左对齐，正文16px、辅助至少13px、44px热区。按钮短反馈遵循reduced-motion，不保留旧暖色/衬线/统计卡墙。初验发现输入继承13px标签字号，已修为16px；目检后把模板状态统计保留为一行，清筛选展开手机输入区，分页标题可接收焦点。

## 逐项控件、数据与边界

| 控件或信息 | 真实合同及提案行为 |
| --- | --- |
| 审批记录/模板版本 | 切换只读视图，保留各自五项筛选和分页，不新增请求 |
| 全量审批/四状态 | summary各状态总和；全量汇总不是当前列表条数 |
| 已返回模板/模板状态 | 只统计返回templates，不当作全组织未返回模板总数 |
| 审批搜索 | 标题、可见模板名称、工作区名称；trim且忽略大小写 |
| 模板搜索 | 名称、工作区名称；不按节点名或隐藏ID扩大搜索 |
| 审批状态 | all/pending/approved/rejected/cancelled；未知状态文字保留 |
| 模板状态 | all/published/draft/archived；归档仍可只读查看差异 |
| 工作区 | 来源是templates.workspace_name去重，不是workspace_id；同名工作区不能在本页区分 |
| 资源类型 | all/task/opportunity_decision，标签业务任务/机会决策，未知类型保留 |
| 审批排序 | created_desc/created_asc/title_asc/status_asc；状态按中文标签排序 |
| 模板排序 | name_asc/updated_desc/nodes_desc/workspace_asc；updated_desc实际是current_version降序，不是时间 |
| 重置/空态清筛选 | 当前视图恢复默认值与第一页，另一视图条件保留；原型展开输入并定位焦点 |
| 审批上一页/下一页 | 当前数组本地8条一页，接口最多最近100条；没有额外分页API |
| 模板上一页/下一页 | 当前数组本地6条一页；翻页不自动改变详情 |
| 模板选择 | selectedTemplate在filteredTemplates查找；过滤掉所选后取筛选首项，不是全量保留规则 |
| 跨页详情 | 明示当前详情不在此页目录；手机选择后直接进入详情、可返回目录 |
| 当前阶段 | 使用审批current_node_ordinal，不能以当前模板node_count推断历史审批的完整进度 |
| 模板/工作区不可见 | 显示模板已不可见/未知工作区，不从业务ID猜测名称 |
| 当前版本/修订/节点数 | 分别current_version/revision/node_count，不互换、不生成当前完整节点配置 |
| 版本对比范围 | 当前版本与最近的低于当前版本的持久化版本，不保证连续版本号 |
| 首版 | from_version为空时说明无前版，不称所有节点新增 |
| 无差异 | 有前版且changes为空，明确节点配置未变化 |
| 节点变化 | 按ordinal身份，而非名称；change_count是变化节点数，不是字段数 |
| 新增/移除 | 只显示返回节点名称和ordinal；接口fields为空，不编造审批人/SLA配置 |
| 字段对照 | 名称、审批人、处理时限（分钟）、超时接收人，前后值明确；0不当未设置 |
| 技术详情 | 审批记录ID、资源ID、模板ID折叠，不作主识别文字 |
| 刷新/重新加载 | GET /org/admin/summary与/org/admin/approvals；演示保留事实，不假称已更新 |
| 前往审批工作台 | /tasks/approvals；不自动切换工作区，不带不存在的某审批深链 |
| 查看组织审计 | /org-admin/audit；不代替读取审计证据 |
| 审核场景 | 非业务场景与意图日志，只用于此独立稿 |

审批读取仍需要opportunity:approve，父摘要另外要求organization:manage。服务透传到当前组织仓库查询；前端菜单不是权限边界。没有创建、编辑、发布、回退、批准、拒绝或保存按钮；**零业务弹窗**，不为了出图添加弹窗。

## URL与事实验证范围

- 13个查询键：approval_view，以及approval_request_和approval_template_各自query/status/workspace/resource/sort/page。初读字符串截200字符，页码必须正安全整数，非法选项回默认；默认值从URL移除，保留无关query。
- 筛选和排序改动回第一页，数组缩减夹紧页码。选中模板ID不写URL；刷新页面不承诺恢复该选择。原型测试了两视图条件序列化和reload读取。
- 真实Vue的watch是refs→router.replace，没有反向route.query监听。惰性执行中修改route.query不会恢复section，不能把“URL可重载”宣称为完整前进/后退、多实例或KeepAlive恢复。
- 原始夹具10条审批、2模板；阶段序号有大于当前模板节点数的记录，保持原样，不修造历史事实。合成8模板分页、未知值、长字段、汇总130/列表10、故障及额外diff明确标记，非生产数据。
- 永久数据助手用TypeScript AST提取原夹具并执行真实子Vue的computed/函数、显式调用watch回调；验证8/6分页、筛选、版本排序和URL读写。它不是挂载Vue响应性测试。
- 真实仓库templateVersionDiff方法离线执行，验证最近低版本（排除未来版本）、ordinal匹配、四字段变更、新增/移除、首版和无差异，含SLA为0。不执行SQL；MySQL行归属、JOIN、真实历史版本和权限仍须后端验收。
- 原型不存cookie/localStorage/sessionStorage，不发送HTTP，不模拟写入成功。读取失败保留事实是设计场景，不证明真实异步返回归属或权限切换安全。

## 全部图片

45场景×桌面1440/手机390，共 **90 PNG**，含2张非业务审核工具图。均整页截图；hover/pressed/focus由浏览器真实触发。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始审批记录 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 原始模板与版本差异 | [查看](1440-templates.png) | [查看](390-templates.png) |
| 审批第二页 | [查看](1440-request_page_two.png) | [查看](390-request_page_two.png) |
| 审批标题搜索 | [查看](1440-request_search.png) | [查看](390-request_search.png) |
| 工作区筛选 | [查看](1440-request_workspace.png) | [查看](390-request_workspace.png) |
| 资源筛选 | [查看](1440-request_resource.png) | [查看](390-request_resource.png) |
| 待处理筛选 | [查看](1440-request_pending.png) | [查看](390-request_pending.png) |
| 已通过筛选 | [查看](1440-request_approved.png) | [查看](390-request_approved.png) |
| 已驳回筛选 | [查看](1440-request_rejected.png) | [查看](390-request_rejected.png) |
| 已取消筛选 | [查看](1440-request_cancelled.png) | [查看](390-request_cancelled.png) |
| 暂无审批记录 | [查看](1440-request_empty.png) | [查看](390-request_empty.png) |
| 审批筛选空 | [查看](1440-request_filter_empty.png) | [查看](390-request_filter_empty.png) |
| 首个持久化版本 | [查看](1440-template_first.png) | [查看](390-template_first.png) |
| 有前版且无差异 | [查看](1440-template_no_diff.png) | [查看](390-template_no_diff.png) |
| 四字段变更及增删 | [查看](1440-template_multi_diff.png) | [查看](390-template_multi_diff.png) |
| 暂无模板 | [查看](1440-template_empty.png) | [查看](390-template_empty.png) |
| 模板筛选空 | [查看](1440-template_filter_empty.png) | [查看](390-template_filter_empty.png) |
| 归档模板 | [查看](1440-template_archived.png) | [查看](390-template_archived.png) |
| 合成八模板目录 | [查看](1440-template_catalog.png) | [查看](390-template_catalog.png) |
| 模板第二页保留详情 | [查看](1440-template_page_two.png) | [查看](390-template_page_two.png) |
| 选中末页模板 | [查看](1440-template_selected.png) | [查看](390-template_selected.png) |
| 模板搜索 | [查看](1440-template_search.png) | [查看](390-template_search.png) |
| 模板工作区筛选 | [查看](1440-template_workspace.png) | [查看](390-template_workspace.png) |
| 模板资源筛选 | [查看](1440-template_resource.png) | [查看](390-template_resource.png) |
| 版本号降序 | [查看](1440-template_version_sort.png) | [查看](390-template_version_sort.png) |
| 未知模板状态 | [查看](1440-template_unknown.png) | [查看](390-template_unknown.png) |
| 审批模板不可见 | [查看](1440-missing_template.png) | [查看](390-missing_template.png) |
| 未知审批状态与资源 | [查看](1440-unknown_request.png) | [查看](390-unknown_request.png) |
| 汇总与列表差异 | [查看](1440-summary_gap.png) | [查看](390-summary_gap.png) |
| 长标题与工作区 | [查看](1440-long_request.png) | [查看](390-long_request.png) |
| 长节点与前后值 | [查看](1440-long_diff.png) | [查看](390-long_diff.png) |
| 零分钟不是未设置 | [查看](1440-zero_sla.png) | [查看](390-zero_sla.png) |
| 审批技术详情 | [查看](1440-technical_request.png) | [查看](390-technical_request.png) |
| 模板技术详情 | [查看](1440-technical_template.png) | [查看](390-technical_template.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 刷新中保留事实 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败保留事实 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 刷新按钮悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 刷新按钮按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 筛选焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |

## 如何使用、调整与验证

直接打开index.html查看。样式在approvals.css，交互在approvals.js；data.js派生自真实夹具，调整合成样例需保留来源说明。

仓库根目录执行 `node scripts/verify-ui-phase2-org-approvals-c.mjs`：核对源、数据与90张图片哈希，再复验双端交互。改动后加 `--capture` 重采，之后再无参数复验。使用项目已有Playwright，不新增依赖或服务。

检查覆盖45场景双端、两组筛选/分页、键盘模板选择/返回、URL默认移除和reload、跨页详情、四字段含零/增删/首版/无变化、技术ID折叠、两GET与导航意图、无写按钮/弹窗；另测768/1024下普通记录、模板、长标题、长差异和多模板目录。所有浏览器context在finally关闭。

90图、原型四文件、README/evidence与两验证脚本均为永久交付，无临时文件、下载、日志或服务器遗留。生产apps/API/OpenAPI/env/依赖/数据库/权限/部署均未改，无重启要求。

## 待审核与未覆盖

请审核双视图导航、记录密度、模板前后对照和手机阅读顺序。C方向选择不等于本稿获批。实际Vue/后端SQL/权限/审计、完整主题/密度/角色/原生200%/软键盘、范围切换与异步生命周期、完整URL历史恢复仍待办；全73页实现与部署未完成，下一P35组织数据。
