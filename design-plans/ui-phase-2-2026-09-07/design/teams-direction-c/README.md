# P33 团队 · TEAMS-C-r1

状态：C方向独立审核稿，具体页面尚未获审；不是实际Vue实现、生产验证或部署报告。

[打开交互原型](index.html)。直接打开即可，无需服务；顶部“审核场景”切换48场景，操作仅记录请求意图，不连接后端。

## 设计与复核

frontend-design指导重排为蓝色页内目录、白色团队目录、所选团队协作关系及独立四字段编辑区。负责人/流程键与成员操作分开，摘要降为辅助行，不绘制接口没有提供的组织树或团队成员名单。桌面与手机、移除原因窗已目检；手机筛选默认收起，选择团队或新建直接聚焦对应内容，返回目录可达。

延续C色板#254a9c、#193b80、#202c3d、#58677b、#edf1f6、#dbe1e9与白色；Microsoft YaHei UI / Microsoft YaHei，左对齐，辅助至少13px、控件16px和44px热区。无旧暖色、衬线、渐变或统计卡墙，短按钮反馈尊重reduced-motion。目录使用li内原生button，不用role=listitem覆盖按钮语义。

## 每项控件及合同

| 控件 | 范围与行为 |
| --- | --- |
| 全部/正常/归档 | 当前已加载数组status筛选，变更回第一页；归档团队的成员动作仍允许 |
| 搜索 | name、lead_email、default_workflow_key，trim且忽略大小写，不请求API |
| 排序 | 名称升序、成员数降序、更新时间降序；后两项同值按名称 |
| 重置/清除筛选 | 清关键词、状态all、名称排序、第一页；不清所选团队 |
| 团队选择 | 筛选或跨页仍保留全量数组内选择；选中项消失回退首active→首项→空 |
| 上一页/下一页 | 本地8条分页，结果缩减夹紧页码，不是服务端分页 |
| 新建团队/空态创建 | 内联form并聚焦名称；首次空列表自动展开，不新增业务弹窗 |
| 名称 | 必填、trim、最多120字符；空白就近报错 |
| 负责人 | 可选当前组织active成员，包括账号锁定者；空值由服务转null |
| 默认流程键 | 可选自由文本，trim、最多80字符；不虚构流程枚举或存在性验证 |
| 创建原因 | 必填、trim、最多500字符 |
| 创建并写入审计 | POST /org/admin/teams，精确name/lead_membership_id/default_workflow_key/reason四字段 |
| 取消创建 | 清空四字段并收起；busy期间不可取消，空目录取消后可再打开 |
| 当前组织成员 | 仅membership.status=active；选项不代表已属于所选团队 |
| 分配/移除成员 | 未选择先本地提示；否则先原因窗。memberBusy从等待原因开始 |
| 原因确认 | POST /org/admin/teams/:id/members，精确action/membership_id/reason；没有expected_version |
| 原因输入 | 默认动作文字、至少2字；提案上限500，生产共享原因窗仍无该上限 |
| 原因取消/关闭/Escape | 零提交并返回触发按钮；Tab首尾循环包含确认不可用情形 |
| 原因确认后失败 | 沿源先关窗再写入，错误在页面；重开默认原因，不承诺恢复旧原因 |
| 技术详情 | 折叠ID，状态/负责人/流程键/数量/版本/时间作为事实呈现 |
| 查看组织成员/工作区边界 | /org-admin/members、/org-admin/workspaces，只预览导航意图 |
| 刷新/重新加载 | GET /org/admin/summary、/org/admin/teams、/org/admin/members；不假装已读取新事实 |
| 蓝色目录/返回目录 | 当前页锚点与焦点，不替代全局导航 |
| 审核场景 | 非业务演示工具与意图日志，不进入生产 |

团队读写仍要求team:manage，成员选项membership:read，父摘要organization:manage；按钮可见不代表后端授权。没有编辑负责人/流程、归档团队、删除团队、批量关系操作或新增API。移除成员只是删除团队关系，不删除账号，也不会清空team.lead_membership_id；创建指定负责人时后端同时建立其团队关系。

## 事实、复现与提案边界

- AST提取原m06-01的单条teams、独立十条teamRows及三条members。单条团队与摘要24不一致，保持差异，不拼成同一数据库快照。十条9活动/1归档，成员关系合计13、负责人5、流程键4。
- 返回只有团队成员数量，没有成员名单。跨团队合计不是组织去重人数；未配置负责人/流程、缺失计数与已知0分开，缺失计数不当0是待审提案。
- 源筛选/排序/选中/草稿仅ref，不写URL或持久化；选择团队清成员及反馈，重载不恢复。创建失败保留，成功或取消清空，busy防重复。
- OG-G02实际源函数在惰性绑定下复现：成员写入等待中切团队，未重新选成员时成功反馈访问undefined抛错；重新选人则会把旧请求误标为新团队/新成员。父请求体本身仍是提交时旧目标。未修生产代码。
- 原型用提交快照绑定反馈：当前目标相同则局部反馈，已切换则全局明确原目标，不向新目标成员区写成功、不抢焦点。场景token隔离演示迟到结果，不证明真实Vue、跨组织、权限或全部异步生命周期安全。
- hold/complete只是显式合成响应。写入确认后没有真实重读就不新增列表、不改数量。创建结果未知/写后读取失败保留当前草稿并暂禁重复；取消重开、刷新及跨范围保护未证明，不能当成完整幂等方案。
- 源方法/computed、显式调用watch回调及真实服务字段验证器是离线合同证据，不是挂载Vue、真实HTTP、MySQL事务、权限、审计或生产验证。仓库SQL仅阅读。

## 全部图片

48场景×桌面1440/手机390，共 **96 PNG**，其中2张是非业务审核工具图。普通场景整页，原因窗按视口；hover/pressed/focus由浏览器实际触发。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始团队 | [查看](1440-normal.png) | [查看](390-normal.png) |
| 十条治理夹具 | [查看](1440-catalog.png) | [查看](390-catalog.png) |
| 第二页 | [查看](1440-page_two.png) | [查看](390-page_two.png) |
| 负责人邮箱搜索 | [查看](1440-search_email.png) | [查看](390-search_email.png) |
| 流程键搜索 | [查看](1440-search_workflow.png) | [查看](390-search_workflow.png) |
| 归档团队仍有成员动作 | [查看](1440-archived.png) | [查看](390-archived.png) |
| 筛选空保留选择 | [查看](1440-filter_empty.png) | [查看](390-filter_empty.png) |
| 空团队自动创建 | [查看](1440-empty.png) | [查看](390-empty.png) |
| 无活动成员 | [查看](1440-no_members.png) | [查看](390-no_members.png) |
| 账号锁定但组织关系活动 | [查看](1440-locked_member.png) | [查看](390-locked_member.png) |
| 未选择成员 | [查看](1440-member_missing.png) | [查看](390-member_missing.png) |
| 负责人未设置 | [查看](1440-lead_missing.png) | [查看](390-lead_missing.png) |
| 流程未设置 | [查看](1440-workflow_missing.png) | [查看](390-workflow_missing.png) |
| 长名称邮箱流程键 | [查看](1440-long_content.png) | [查看](390-long_content.png) |
| 零成员关系 | [查看](1440-zero_count.png) | [查看](390-zero_count.png) |
| 缺失关系计数 | [查看](1440-missing_count.png) | [查看](390-missing_count.png) |
| 新建空表单 | [查看](1440-create.png) | [查看](390-create.png) |
| 四字段草稿 | [查看](1440-create_draft.png) | [查看](390-create_draft.png) |
| 可选字段留空 | [查看](1440-create_optional_empty.png) | [查看](390-create_optional_empty.png) |
| 必填字段错误 | [查看](1440-create_required.png) | [查看](390-create_required.png) |
| 长度边界 | [查看](1440-create_long.png) | [查看](390-create_long.png) |
| 创建处理中 | [查看](1440-create_busy.png) | [查看](390-create_busy.png) |
| 创建失败保留草稿 | [查看](1440-create_failure.png) | [查看](390-create_failure.png) |
| 合成创建已确认 | [查看](1440-create_success.png) | [查看](390-create_success.png) |
| 写后读取失败 | [查看](1440-create_read_failed.png) | [查看](390-create_read_failed.png) |
| 写入结果未知 | [查看](1440-create_unknown.png) | [查看](390-create_unknown.png) |
| 分配原因窗 | [查看](1440-reason_assign.png) | [查看](390-reason_assign.png) |
| 移除原因窗 | [查看](1440-reason_remove.png) | [查看](390-reason_remove.png) |
| 原因过短 | [查看](1440-reason_short.png) | [查看](390-reason_short.png) |
| 长原因 | [查看](1440-reason_long.png) | [查看](390-reason_long.png) |
| 关系变更处理中 | [查看](1440-member_busy.png) | [查看](390-member_busy.png) |
| 关系变更失败 | [查看](1440-member_failure.png) | [查看](390-member_failure.png) |
| 合成关系写响应 | [查看](1440-member_success.png) | [查看](390-member_success.png) |
| 切团队后旧请求反馈 | [查看](1440-switched_pending.png) | [查看](390-switched_pending.png) |
| 选择第二团队 | [查看](1440-selected.png) | [查看](390-selected.png) |
| 首次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 服务错误 | [查看](1440-error.png) | [查看](390-error.png) |
| 服务不可用 | [查看](1440-blocked.png) | [查看](390-blocked.png) |
| 登录失效 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 无权访问 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 请求频繁 | [查看](1440-rate_limited.png) | [查看](390-rate_limited.png) |
| 后台刷新 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败保留事实 | [查看](1440-refresh_error.png) | [查看](390-refresh_error.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 创建按钮悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 创建按钮按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 创建按钮焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 非业务审核工具 | [查看](1440-controls.png) | [查看](390-controls.png) |

## 如何验证与调整

在仓库根目录执行 `node scripts/verify-ui-phase2-teams-c.mjs`：先核对源文件、原始数据和PNG哈希，再复验交互。修改原型后执行同命令加 `--capture` 重采，再执行无参数复验。样式在teams.css、交互在teams.js；data.js由真实源夹具派生，不能随意补造业务事实。

验证覆盖两视口48场景、两原因变体、三取消路径/焦点、精确三body、筛选分页/选择保留、创建草稿/忙碌/失败、锁定账号选项、归档团队动作、切团队后的旧结果归属。另测768/1024下目录、长内容、长表单及原因窗。HTTP、浏览器错误与存储均要求0；browser/context在finally关闭，不启动服务。

96PNG、原型四文件、README/evidence与两脚本是永久审核交付，不是临时测试产物。未改生产apps、API/OpenAPI、数据库、权限、env、依赖及部署配置，无重启要求。

## 审核与未覆盖事项

请审核团队目录/协作关系分区、四字段创建区、手机阅读顺序和两种原因窗。C方向选择不等于本稿获批。实际后端负责人关系/同键幂等/移除效果、OG-G01–G06、完整主题密度/角色/200%原生缩放/软键盘/跨范围与迟到生命周期仍待验；全73页真实实现与部署未完成，下一P34只读审批模板。
