# P27 自动化规则 · C 方向 r1 审核包

2026-09-08 / AUTOMATION-C-r1 / **具体图稿待审**。独立设计，不是已部署 Vue；选择C方向不等于具体页面获审，全73页实施、部署与签收继续。

[打开交互稿](index.html) · [源码提取数据与合同](data.js) · [图像及源码指纹](evidence.json)

## 设计与审核重点

采用C方向蓝色目录与白色规则工作面，规则的事件、严重程度、人工后续动作横向成序，手机转为纵向阅读。最近执行与规则启停状态分开；不使用旧卡片墙、等权数字卡或无意义英文装饰。目录只定位本次已读取规则，不新增后端筛选、搜索或分页。

创建/编辑共用宽编辑窗：蓝色分区目录、白色字段组、独立只读预览与保存动作；执行记录为第二种弹窗。十处实际输入（九个form字段＋编辑原因）、三套可编辑模板、任务循环保护、来源链接与执行技术折叠均有稿。没有新增拖拽条件、删除/复制、批量启停、手动运行或重试按钮。

设计令牌：蓝#254a9c、深蓝#193b80、正文#202c3d、次级#58677b、背景#edf1f6、边界#dbe1e9；白工作面。中文无衬线、正文16px、辅助13px、操作至少44px。主要内容左对齐，模态固定标题/关闭及操作栏；手机分区导航换行、字段单列、保存与只读预览分层。减少动态设置关闭入场动画。

目检修订：打开/保存反馈重置长窗滚动位置，让失败可见；空编辑原因不预填；中部补图展示人员/动作完整字段；明确编辑不改变启停状态。技能的设计自检推动了上述布局/阅读改进，没有借机改变业务规则。

## 真实合同与原型边界

- /automations需要team:manage及有效组织/工作区，列表与成员来自已有API。目录数量仅“本次读取”条数，不宣称全平台总量。详情最多最近100条执行，无独立历史分页。
- 原始m05-05夹具：列表latest为dead_letter，独立详情执行为succeeded，时间相同；保留差异，不拼接成连续成功链。原previewResult命中17条但samples为空；空样本不等于零命中。
- 源failureReason仅按action_failed就承诺重试，和最终失败场景冲突。永久助手执行源Worker惰性失败分支并检查claim条件：最终失败不在自动领取范围。新稿仅修正文案，真实Vue/Worker未改。succeeded＋rule_paused_before_execution明确“未产生动作”；不把执行成功当通知送达或任务完成。
- 四触发器、四严重程度、两安全动作、两成员选择均保持。task.created禁止create_task，切换后回到notify_owner并清任务负责人。名称/标题required且最多200，次数整数1–1000、分钟1–1440；默认20/60。编辑原因界面500、后端1000，差异保留。
- 三模板的description实际会随form发送，后端白名单不消费它；不是新增字段或存储列。创建直接active，编辑带expected_version/reason且不改变启停状态；暂停/恢复保留原固定原因，无新增确认窗。
- 预览POST只读，不能与保存副作用混为一谈。统计30天和当前窗口，样本查询不限制30天且最多5条；合成旧样本明确早于30天。展示的预测数只是离线响应样例，不是当前生产命中、实际动作或未来保证。
- 原型默认只记录请求意图，不访问API、不伪造创建成功或规则/版本更新。预览响应、执行状态/100条历史、成员空/失败、长名称和在途/失败均明确为独立夹具或合成情景。
- 修改form、关闭或切换编辑器使旧preview失效；原型支持受控迟到响应检查，没有自动重放。编辑原因不是preview body的一部分，仍沿用表单required限制。创建/编辑在途允许取消/Escape，关闭不等于取消请求，忙碌状态继续保留。
- 原始来源链接的from固定/automations；通知使用notification参数，人工任务只在真实字段类型task且有ID时显示。全部链接仅离线预览，实际目标鉴权未验，不调用真实任务或通知。

## 本批图包

52场景×双端=104主图，其中2张为非业务控件状态板；另12张下部、6张人员与动作中部，合计122PNG。无弹窗按整页截图，可能高于1440×1000或390×844的视口；弹窗按视口截取，中/下部为补充证据，不计独立业务页。

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 规则目录 · 原始响应 | [桌面](1440-normal.png) | [手机](390-normal.png) |
| 已暂停规则 · 合成 | [桌面](1440-paused.png) | [手机](390-paused.png) |
| 尚未执行 · 合成 | [桌面](1440-missing_latest.png) | [手机](390-missing_latest.png) |
| 长名与多规则 · 合成 | [桌面](1440-long_rules.png) | [手机](390-long_rules.png) |
| 规则读取中 | [桌面](1440-loading.png) | [手机](390-loading.png) |
| 空规则目录 · 合成 | [桌面](1440-empty.png) | [手机](390-empty.png) |
| 读取失败 | [桌面](1440-error.png) | [手机](390-error.png) |
| 服务受阻 | [桌面](1440-blocked.png) | [手机](390-blocked.png) |
| 无管理权限 | [桌面](1440-forbidden.png) | [手机](390-forbidden.png) |
| 登录失效 | [桌面](1440-expired.png) | [手机](390-expired.png) |
| 读取限流 | [桌面](1440-rate_limited.png) | [手机](390-rate_limited.png) |
| 读取版本冲突 | [桌面](1440-version_conflict.png) | [手机](390-version_conflict.png) |
| 执行记录 · 原始响应 | [桌面](1440-detail.png) | [手机](390-detail.png) |
| 无执行记录 · 合成 | [桌面](1440-executions_empty.png) | [手机](390-executions_empty.png) |
| 执行排队 · 合成 | [桌面](1440-execution_queued.png) | [手机](390-execution_queued.png) |
| 执行处理中 · 合成 | [桌面](1440-execution_leased.png) | [手机](390-execution_leased.png) |
| 等待重试 · 合成 | [桌面](1440-execution_retry.png) | [手机](390-execution_retry.png) |
| 执行完成 · 合成 | [桌面](1440-execution_succeeded.png) | [手机](390-execution_succeeded.png) |
| 执行限流 · 合成 | [桌面](1440-execution_rate.png) | [手机](390-execution_rate.png) |
| 执行失败 · 合成 | [桌面](1440-execution_failed.png) | [手机](390-execution_failed.png) |
| 执行最终失败 · 合成 | [桌面](1440-execution_dead.png) | [手机](390-execution_dead.png) |
| 执行未知状态 · 合成 | [桌面](1440-execution_unknown.png) | [手机](390-execution_unknown.png) |
| 已完成但未产生动作 · 合成 | [桌面](1440-execution_suppressed.png) | [手机](390-execution_suppressed.png) |
| 关联人工任务 · 合成 | [桌面](1440-execution_task.png) | [手机](390-execution_task.png) |
| 执行技术详情 | [桌面](1440-technical.png) | [手机](390-technical.png) |
| 最近100条执行 · 合成 | [桌面](1440-long_history.png) | [手机](390-long_history.png) |
| 创建规则空表单 | [桌面](1440-create.png) | [手机](390-create.png) |
| 审批超时模板 | [桌面](1440-template_overdue.png) | [手机](390-template_overdue.png) |
| 竞品复核模板 | [桌面](1440-template_competitor.png) | [手机](390-template_competitor.png) |
| 审批驳回模板 | [桌面](1440-template_rejected.png) | [手机](390-template_rejected.png) |
| 任务触发循环保护 | [桌面](1440-task_trigger.png) | [手机](390-task_trigger.png) |
| 编辑现有规则 | [桌面](1440-edit.png) | [手机](390-edit.png) |
| 成员目录为空 · 合成 | [桌面](1440-members_empty.png) | [手机](390-members_empty.png) |
| 成员目录读取失败 · 合成 | [桌面](1440-members_error.png) | [手机](390-members_error.png) |
| 必填校验 | [桌面](1440-validation.png) | [手机](390-validation.png) |
| 只读预览 · 原始响应 | [桌面](1440-preview.png) | [手机](390-preview.png) |
| 人工任务预览 · 合成 | [桌面](1440-preview_task.png) | [手机](390-preview_task.png) |
| 零匹配预览 · 合成 | [桌面](1440-preview_empty.png) | [手机](390-preview_empty.png) |
| 历史样本不限定30天 · 合成 | [桌面](1440-preview_samples.png) | [手机](390-preview_samples.png) |
| 试运行处理中 · 合成 | [桌面](1440-preview_busy.png) | [手机](390-preview_busy.png) |
| 试运行失败 · 合成 | [桌面](1440-preview_error.png) | [手机](390-preview_error.png) |
| 修改条件使预览失效 | [桌面](1440-preview_changed.png) | [手机](390-preview_changed.png) |
| 创建提交中 · 合成 | [桌面](1440-create_busy.png) | [手机](390-create_busy.png) |
| 创建失败 · 合成 | [桌面](1440-create_error.png) | [手机](390-create_error.png) |
| 编辑提交中 · 合成 | [桌面](1440-edit_busy.png) | [手机](390-edit_busy.png) |
| 编辑冲突 · 合成 | [桌面](1440-edit_conflict.png) | [手机](390-edit_conflict.png) |
| 暂停提交中 · 合成 | [桌面](1440-pause_busy.png) | [手机](390-pause_busy.png) |
| 暂停失败 · 合成 | [桌面](1440-pause_error.png) | [手机](390-pause_error.png) |
| 恢复失败 · 合成 | [桌面](1440-resume_error.png) | [手机](390-resume_error.png) |
| 控件状态板（非业务页） | [桌面](1440-controls.png) | [手机](390-controls.png) |
| 创建并启用意图 | [桌面](1440-create_intent.png) | [手机](390-create_intent.png) |
| 保存修改意图 | [桌面](1440-edit_intent.png) | [手机](390-edit_intent.png) |
| 创建规则空表单 · 下部 | [桌面](1440-create-bottom.png) | [手机](390-create-bottom.png) |
| 竞品复核模板 · 下部 | [桌面](1440-template_competitor-bottom.png) | [手机](390-template_competitor-bottom.png) |
| 编辑现有规则 · 下部 | [桌面](1440-edit-bottom.png) | [手机](390-edit-bottom.png) |
| 历史样本不限定30天 · 合成 · 下部 | [桌面](1440-preview_samples-bottom.png) | [手机](390-preview_samples-bottom.png) |
| 创建提交中 · 合成 · 下部 | [桌面](1440-create_busy-bottom.png) | [手机](390-create_busy-bottom.png) |
| 最近100条执行 · 合成 · 下部 | [桌面](1440-long_history-bottom.png) | [手机](390-long_history-bottom.png) |
| 创建规则空表单 · 人员与动作 | [桌面](1440-create-actions.png) | [手机](390-create-actions.png) |
| 竞品复核模板 · 人员与动作 | [桌面](1440-template_competitor-actions.png) | [手机](390-template_competitor-actions.png) |
| 编辑现有规则 · 人员与动作 | [桌面](1440-edit-actions.png) | [手机](390-edit-actions.png) |

## 交互审核路径

1. 正常目录查看“当/且/则”、负责人、频率和最近执行；查看执行记录、编辑、暂停/恢复是不同动作。
2. 创建空规则，验证必填；试三模板，再把竞品任务模板的触发器换成任务创建，确认动作与任务负责人自动回落。
3. 填写有效负责人后试运行；正常模式只记录意图。审核工具提供原始/空/旧样本/任务预览，修改任一规则字段会清除旧结果。
4. 编辑现有规则时检查版本与修改原因。失败保留输入，顶部提示可见；忙碌取消不撤销在途请求。
5. 查看执行原始事实与合成状态；展开技术详情、核验通知/任务来源预览。历史仅最近100条，没有假造分页。
6. 页底审核工具可切换52场景；该操作重置离线草稿，不是产品功能。请按具体图稿版本提出布局、按钮、弹窗及手机反馈意见。

## 验证与未覆盖事项

永久助手从真实E2E setup提取规则、详情、成员与预览，并在惰性环境执行实际Vue脚本：五类body（四写入＋一只读POST）、模板description、任务循环watch、URL与忙碌关闭。预览六组受控当前/迟到成功与错误、输入/关闭/路由变化检查使用实际函数，watch回调由助手显式调用；不是挂载Vue的响应性验收。

实际服务验证器检查版本/成员格式/循环/限流/空值和编辑原因上限；SQL预览惰性适配器检查成员验证、通知至outbox关联、统计/样本时间窗与任务/通知输出分离。源Worker惰性失败分支验证retry_scheduled和dead_letter；未访问MySQL、写审计、创建任务、执行Worker调度或发送通知。

浏览器检查122图/源码指纹、52场景双端、五body、必填零意图、模板/循环、只读预览失效和迟到丢弃、深链/历史返回、Tab/Escape/返回焦点、忙碌取消、失败保留、真实悬停/按下/焦点、字体/热区/溢出。附加320/768/780/781/1024及390×667的五代表场景。HTTP请求、console/page错误、cookies和local/sessionStorage为0。

```powershell
node scripts/verify-ui-phase2-automation-c.mjs --capture
node scripts/verify-ui-phase2-automation-c.mjs
npm run verify:docs
npm run verify:runtime-docs
npm run verify:static-analysis
npm run format:check
git diff --check
```

capture更新本目录永久图片和evidence；无参数检查源/数据/图哈希并重跑交互。复用现有Playwright，不安装依赖、不启动服务；浏览器与上下文finally关闭。本批122图＋HTML/CSS/JS/data/README/evidence为128份永久图稿文件，另两脚本；没有临时测试材料或服务，旧文件与历史清理受阻材料均不动。

未修改真实Vue/API/OpenAPI/DB/Worker/权限/环境/依赖，不部署、不重启，运行参数不变。AR-G01–G03、真实列表/详情/写后刷新/跨范围缓存生命周期、全部触发×严重程度组合、真实成员隔离/幂等/审计/限流、完整成功与未知结果、三主题/密度/原生200%/屏幕阅读器和生产签收仍未完成。下一W03 P28报表；具体P27稿待用户审核，全73页目标不变。
