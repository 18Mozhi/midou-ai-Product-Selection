# P32 工作区 · WORKSPACES-C-r1

状态：C方向独立审核稿，具体页面未获审；不是实际Vue实现、生产验证或部署完成报告。

[打开交互原型](index.html)。可直接打开，无需服务。顶部“审核场景”可切换46场景和查看请求意图，不连接后端。

## 设计与复核

frontend-design指导重排：蓝色页内目录、单一白色治理阅读面；左侧筛选/工作区选择，右侧当前事实、状态影响与操作。五张统计卡压为辅助摘要。新建仍为内联三字段表单，放在右侧专用编辑区，不新增创建弹窗。手机按目录→详情阅读，选择/新建会直接聚焦内容，返回目录可达。

色板：#254a9c蓝、#193b80深蓝、#202c3d正文、#58677b辅助、#edf1f6底色、#dbe1e9分隔，白色内容；Microsoft YaHei UI / Microsoft YaHei，左对齐。辅助至少13px、控件16px、44px热区，按钮反馈遵循reduced-motion。目检后缩小目录行间距并去除手机重复说明，不使用旧卡墙/暖色/衬线。

工作区行使用li内原生button，不再用role=listitem覆盖按钮语义。两种原因窗保留目标名称、版本和影响，固定头尾操作；原型输入上限500对齐服务，生产共享窗仍无该上限。

## 逐项控件及合同

| 控件 | 实际范围 |
| --- | --- |
| 全部/正常/归档 | 当前加载数组的status筛选与总数，修改后回第一页 |
| 搜索 | 名称或英文标识，trim并忽略大小写；不跨组织、不请求API |
| 排序 | 名称、明确范围成员降序、更新时间降序；后两项同值按名称 |
| 重置/清除筛选 | 清关键词、状态all、名称排序、第一页，不清所选工作区 |
| 目录选择 | 当前选择保留在全量已加载数组；筛选无结果或跨页不自动取消详情 |
| 上一页/下一页 | 本地8条一页，结果缩减夹紧页码，非服务端分页 |
| 新建工作区/空态创建 | 打开内联form，聚焦名称；空列表首次返回自动展开 |
| 名称 | 必填1–120字符，提交trim，空白名称就近报错 |
| 英文标识 | 必填1–63位小写字母、数字、连字符且首尾非连字符；UI拒绝大写/空格，服务实际会trim转小写，差异保留 |
| 创建原因 | 必填1–500字符，随本次POST提交，不新增审批 |
| 创建并写入审计 | POST /org/admin/workspaces，精确name/slug/reason；无organization_id、status、member_count等额外字段 |
| 取消创建 | 清空草稿并收起，创建busy期间禁用；空目录取消后仍可再次打开 |
| 归档/恢复 | 先原因窗，确认后POST /org/admin/workspaces/:id/actions，精确action/expected_version/reason |
| 默认不可归档 | active且为组织默认项时禁用，并解释先去组织资料更换；后端默认保护不被替代 |
| 原因确认/取消/关闭/Escape | 默认原动作文字；至少2字，提案最多500；取消零提交并回触发按钮，键盘首尾循环 |
| 原因确认后的失败 | 延续源先关窗再写入，错误在父页面；重开为默认原因，不承诺恢复上次输入 |
| 管理团队与成员 | 真实目标/org-admin/teams；本稿只预览导航意图，不冒充P33已完成 |
| 修改默认工作区 | 真实目标/org-admin；不在本页切换会话工作区或写默认值 |
| 技术详情 | 折叠ID、英文标识；版本和时间作为治理事实可见 |
| 刷新/重新加载 | GET /org/admin/summary及/org/admin/workspaces；默认只记录读取意图，事实与草稿不假刷新 |
| 蓝色目录/返回目录 | 当前页锚点与焦点，不代替整个组织后台导航 |
| 审核场景 | 非业务状态切换及意图日志；不进入生产 |

所有工作区读写仍要求workspace:manage，父摘要另要求organization:manage；菜单或按钮可见不是后端授权。仅创建/归档/恢复，无编辑、删除、批量归档、复制工作区、直接成员分配或切换会话写入。

## 事实与提案的区分

- AST直接提取原m06-01的单条workspaces及独立十条workspaceRows，两组不拼为同一数据库快照。单条列表1与摘要8不一致，时间缺失显示暂无记录；十条治理数据9活动/1归档，明确范围分配合计55。
- 范围计数来自membership_data_scopes按工作区COUNT DISTINCT membership_id，跨工作区合计不是组织去重人数，也不等于会话可访问人数。真实SQL仅源码读取，非本批数据库执行结果。
- 缺失member_count源摘要按0回退；本稿显示数据不全而非已知零，是待审保护。缺失默认记录与未配置默认的合成场景区分，不改持久化默认设置。
- 源选中对象被移除时回退默认项→第一项→空；筛选空仍保留所选详情。页码缩减夹紧，所有筛选/选中/草稿只在ref，不写URL和持久化；重新加载不恢复。
- 创建在源中失败保留，成功或取消清空；busy防重复和禁止取消。原型就近字段错误/反馈焦点属于提案，没有改父页面处理。
- 默认操作仅记录意图，不创建/归档/恢复真实记录。hold/complete是显式合成响应：创建已确认后清表单，但没有实际重读列表就不补造记录；状态已确认仍显示旧事实直到真实读取。
- 创建结果未知/写后重读失败保留当前草稿并暂禁提交；这是当前演示表单保护，不宣称取消重开、跨组织、浏览器刷新或所有迟到结果已安全。场景代次token仅隔离审核样例迟到控制，不是实际Vue运行保证。
- 原因窗成功/失败均沿源先关闭；版本冲突、自身权限变化、默认项竞争、事务幂等及审计仍由后端核验。本稿不证明这些真实结果。

## 全部图片

46场景×桌面1440/手机390，共 **92 PNG**，含2张非业务审核工具图。普通场景整页截图，原因窗按视口截图；悬停/按下/焦点由浏览器实际触发。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 单条原始夹具 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 十条治理夹具 | [查看](1440-catalog.png) | [查看](390-catalog.png) |
| 正常使用筛选 | [查看](1440-active.png) | [查看](390-active.png) |
| 归档筛选 | [查看](1440-archived.png) | [查看](390-archived.png) |
| 名称搜索 | [查看](1440-search.png) | [查看](390-search.png) |
| 筛选空但保留选择 | [查看](1440-filter_empty.png) | [查看](390-filter_empty.png) |
| 空目录自动展开创建 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 第二页 | [查看](1440-page_two.png) | [查看](390-page_two.png) |
| 非默认项 | [查看](1440-selected.png) | [查看](390-selected.png) |
| 归档项 | [查看](1440-restore.png) | [查看](390-restore.png) |
| 默认记录缺失 | [查看](1440-missing_default.png) | [查看](390-missing_default.png) |
| 未设置默认 | [查看](1440-no_default.png) | [查看](390-no_default.png) |
| 长名称 | [查看](1440-long_name.png) | [查看](390-long_name.png) |
| 零分配数 | [查看](1440-zero_count.png) | [查看](390-zero_count.png) |
| 缺失分配数 | [查看](1440-missing_count.png) | [查看](390-missing_count.png) |
| 创建空表单 | [查看](1440-create.png) | [查看](390-create.png) |
| 创建草稿 | [查看](1440-create_draft.png) | [查看](390-create_draft.png) |
| 非法标识 | [查看](1440-create_invalid.png) | [查看](390-create_invalid.png) |
| 必填错误 | [查看](1440-create_required.png) | [查看](390-create_required.png) |
| 长度边界 | [查看](1440-create_long.png) | [查看](390-create_long.png) |
| 创建处理中 | [查看](1440-create_busy.png) | [查看](390-create_busy.png) |
| 标识冲突 | [查看](1440-create_conflict.png) | [查看](390-create_conflict.png) |
| 创建失败 | [查看](1440-create_failure.png) | [查看](390-create_failure.png) |
| 合成创建已确认 | [查看](1440-create_success.png) | [查看](390-create_success.png) |
| 写后读取失败 | [查看](1440-create_read_failed.png) | [查看](390-create_read_failed.png) |
| 写入结果未知 | [查看](1440-create_unknown.png) | [查看](390-create_unknown.png) |
| 归档原因窗 | [查看](1440-reason_archive.png) | [查看](390-reason_archive.png) |
| 恢复原因窗 | [查看](1440-reason_restore.png) | [查看](390-reason_restore.png) |
| 原因过短 | [查看](1440-reason_short.png) | [查看](390-reason_short.png) |
| 长原因 | [查看](1440-reason_long.png) | [查看](390-reason_long.png) |
| 状态处理中 | [查看](1440-action_busy.png) | [查看](390-action_busy.png) |
| 版本冲突 | [查看](1440-action_conflict.png) | [查看](390-action_conflict.png) |
| 后端拒绝默认项归档 | [查看](1440-default_conflict.png) | [查看](390-default_conflict.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 服务不可用 | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权限 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 刷新中 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 键盘焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |

## 复验

仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-workspaces-c.mjs --capture
node scripts/verify-ui-phase2-workspaces-c.mjs
```

capture更新永久图与evidence，无参数检查源/数据/PNG SHA并复跑交互，不重写图。复用现有Playwright与TypeScript，无新增依赖或服务。

永久助手执行实际子组件setup函数/computed并显式调用watch回调，覆盖筛选/8条分页/选中保留与回退、自动创建、名称焦点、trim/body、busy与失败/成功/取消；不是挂载Vue的响应性验收。父实际函数验证三种精确body及原因取消，实际服务验证slug上下界/非法标识/小写归一/原因和动作；不调用真实API或SQL事务。

浏览器双端46场景检查字号/热区、标签关联、无横向溢出、两原因窗/禁用确认/Tab/Escape/关闭/归还焦点，筛选/排序/分页与隐藏选择提示、创建错误/忙碌/失败保留/成功清空/未知保护、准确body、默认保护、空态取消再开、缩页回退、导航意图、草稿不持久化。768/1024仅目录/长名/长表单/两种长短原因布局，不称全断点覆盖。HTTP/console/pageerror为0，cookies/localStorage/sessionStorage空，browser/context finally关闭。

## 剩余及运行交付

具体图稿待审。真实Vue、OG-G01–G06涉及的跨组织/KeepAlive/读写归属/取消重开/默认竞争/SQL事务/幂等/审计、全主题/密度/角色/原生200%/软键盘及生产验收仍未完成；旧设计/实现槽位不按本次图片数自动注销。下一P33团队，全73页重构和部署门保留。

未改生产apps、API/OpenAPI、数据库/迁移、权限、环境/依赖或部署，无重启要求。92PNG、HTML/CSS/JS/data/README/evidence及两脚本为永久审核交付；没有临时脚本、下载、日志或服务遗留，历史材料未动。
