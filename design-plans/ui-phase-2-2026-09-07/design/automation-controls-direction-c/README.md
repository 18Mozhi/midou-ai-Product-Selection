# P27 自动化规则 · 逐按钮状态 C r2

AUTOMATION-CONTROLS-C-r2 / 2026-09-10 / **独立图稿待用户审核，未接入真实Vue或生产**。

[双端图册](gallery.html) · [交互稿](index.html) · [原P27完整页面/弹窗122图](../automation-direction-c/README.md) · [精确状态指纹](evidence.json) · [动作登记](../../action-reviews/P27.json)

## 设计与范围

延续已选C方向的蓝色规则目录、白色工作面与当/且/则流程，复用原AUTOMATION-C-r1的完整HTML结构、CSS、数据和controller。仅本包技术详情summary改16px，避免将可操作入口当13px辅助文字；父图与真实Vue未改。没有回到旧卡片墙或纸色主题。

r1的14个代表控件62场景/124图保留；r2增加10个扩展变体42场景/84图，合计104场景×双端208PNG。新增状态包含默认、悬停、Tab焦点、按下；恢复和编辑保存另有在途禁用图。新增在途图以busy引用并同时验证disabled，不额外复制相同图。基础68条代表引用及10个源无呈现槽/6导航槽不变，新增42条变体引用不增加业务动作。

本轮已补恢复、编辑保存、竞品与驳回模板、其余五类错误重载、编辑窗口取消。未补范围为完整数据/角色/主题/密度/错误×在途组合、10字段全态、目录定位/分区跳转/额外关闭等提案新增控件、最终Vue同状态对照。0代表槽未映射仍不等于整页完成。

## 业务和状态边界

- AR-PREVIEW虽POST但只读；与AR-SAVE/AR-STATUS两个写入语义组分开。创建与编辑、暂停与恢复各自沿用原body/版本/原因，不改API或Worker。
- 创建、详情、编辑、暂停四个全局busy控件用原pause_busy场景；预览用preview_busy；保存用create_busy。不是凭空设disabled属性，也不改变源码忙碌范围。
- 保存期间预览仍可用；预览期间保存仍可用。取消、模板、技术折叠、错误重读没有busy禁用呈现。原型保存/启停有函数防重入，真实源码缺少同等早退，旧回执/读取归属仍未修；本包不宣称这些行为已一致。
- 默认与在途图的准备仅切换已有隔离场景。真实hover/Tab/按下过程中，完整原型state（含规则、编辑草稿、详情、路径、请求意图）必须不变；禁止强制点击或人为成功更新。只读预览样本17命中/旧样本/列表终态差异沿用父图；不是生产事实。
- 没有新增图像生成服务、依赖、配置、网络请求或持久化。设计技能指导技术入口字号和可读性，不修改审批、权限或全站风格批准。

## 双端逐态图

| 控件与状态 | 1440 | 390 |
| --- | --- | --- |
| 创建规则 · 默认 | [桌面](create-default-1440.png) | [手机](create-default-390.png) |
| 创建规则 · 真实悬停 | [桌面](create-hover-1440.png) | [手机](create-hover-390.png) |
| 创建规则 · Tab焦点 | [桌面](create-focus-1440.png) | [手机](create-focus-390.png) |
| 创建规则 · 按下未释放 | [桌面](create-pressed-1440.png) | [手机](create-pressed-390.png) |
| 创建规则 · 在途禁用 | [桌面](create-pending-1440.png) | [手机](create-pending-390.png) |
| 重新加载 · 默认 | [桌面](reload-default-1440.png) | [手机](reload-default-390.png) |
| 重新加载 · 真实悬停 | [桌面](reload-hover-1440.png) | [手机](reload-hover-390.png) |
| 重新加载 · Tab焦点 | [桌面](reload-focus-1440.png) | [手机](reload-focus-390.png) |
| 重新加载 · 按下未释放 | [桌面](reload-pressed-1440.png) | [手机](reload-pressed-390.png) |
| 查看执行记录 · 默认 | [桌面](detail-default-1440.png) | [手机](detail-default-390.png) |
| 查看执行记录 · 真实悬停 | [桌面](detail-hover-1440.png) | [手机](detail-hover-390.png) |
| 查看执行记录 · Tab焦点 | [桌面](detail-focus-1440.png) | [手机](detail-focus-390.png) |
| 查看执行记录 · 按下未释放 | [桌面](detail-pressed-1440.png) | [手机](detail-pressed-390.png) |
| 查看执行记录 · 在途禁用 | [桌面](detail-pending-1440.png) | [手机](detail-pending-390.png) |
| 编辑规则 · 默认 | [桌面](edit-default-1440.png) | [手机](edit-default-390.png) |
| 编辑规则 · 真实悬停 | [桌面](edit-hover-1440.png) | [手机](edit-hover-390.png) |
| 编辑规则 · Tab焦点 | [桌面](edit-focus-1440.png) | [手机](edit-focus-390.png) |
| 编辑规则 · 按下未释放 | [桌面](edit-pressed-1440.png) | [手机](edit-pressed-390.png) |
| 编辑规则 · 在途禁用 | [桌面](edit-pending-1440.png) | [手机](edit-pending-390.png) |
| 暂停或恢复 · 默认 | [桌面](status-default-1440.png) | [手机](status-default-390.png) |
| 暂停或恢复 · 真实悬停 | [桌面](status-hover-1440.png) | [手机](status-hover-390.png) |
| 暂停或恢复 · Tab焦点 | [桌面](status-focus-1440.png) | [手机](status-focus-390.png) |
| 暂停或恢复 · 按下未释放 | [桌面](status-pressed-1440.png) | [手机](status-pressed-390.png) |
| 暂停或恢复 · 在途禁用 | [桌面](status-pending-1440.png) | [手机](status-pending-390.png) |
| 关闭执行记录 · 默认 | [桌面](detail-close-default-1440.png) | [手机](detail-close-default-390.png) |
| 关闭执行记录 · 真实悬停 | [桌面](detail-close-hover-1440.png) | [手机](detail-close-hover-390.png) |
| 关闭执行记录 · Tab焦点 | [桌面](detail-close-focus-1440.png) | [手机](detail-close-focus-390.png) |
| 关闭执行记录 · 按下未释放 | [桌面](detail-close-pressed-1440.png) | [手机](detail-close-pressed-390.png) |
| 查看关联人工任务 · 默认 | [桌面](task-default-1440.png) | [手机](task-default-390.png) |
| 查看关联人工任务 · 真实悬停 | [桌面](task-hover-1440.png) | [手机](task-hover-390.png) |
| 查看关联人工任务 · Tab焦点 | [桌面](task-focus-1440.png) | [手机](task-focus-390.png) |
| 查看关联人工任务 · 按下未释放 | [桌面](task-pressed-1440.png) | [手机](task-pressed-390.png) |
| 查看触发通知与来源 · 默认 | [桌面](notification-default-1440.png) | [手机](notification-default-390.png) |
| 查看触发通知与来源 · 真实悬停 | [桌面](notification-hover-1440.png) | [手机](notification-hover-390.png) |
| 查看触发通知与来源 · Tab焦点 | [桌面](notification-focus-1440.png) | [手机](notification-focus-390.png) |
| 查看触发通知与来源 · 按下未释放 | [桌面](notification-pressed-1440.png) | [手机](notification-pressed-390.png) |
| 执行技术详情 · 默认 | [桌面](technical-default-1440.png) | [手机](technical-default-390.png) |
| 执行技术详情 · 真实悬停 | [桌面](technical-hover-1440.png) | [手机](technical-hover-390.png) |
| 执行技术详情 · Tab焦点 | [桌面](technical-focus-1440.png) | [手机](technical-focus-390.png) |
| 执行技术详情 · 按下未释放 | [桌面](technical-pressed-1440.png) | [手机](technical-pressed-390.png) |
| 应用业务模板 · 默认 | [桌面](template-default-1440.png) | [手机](template-default-390.png) |
| 应用业务模板 · 真实悬停 | [桌面](template-hover-1440.png) | [手机](template-hover-390.png) |
| 应用业务模板 · Tab焦点 | [桌面](template-focus-1440.png) | [手机](template-focus-390.png) |
| 应用业务模板 · 按下未释放 | [桌面](template-pressed-1440.png) | [手机](template-pressed-390.png) |
| 查看预览样本 · 默认 | [桌面](sample-default-1440.png) | [手机](sample-default-390.png) |
| 查看预览样本 · 真实悬停 | [桌面](sample-hover-1440.png) | [手机](sample-hover-390.png) |
| 查看预览样本 · Tab焦点 | [桌面](sample-focus-1440.png) | [手机](sample-focus-390.png) |
| 查看预览样本 · 按下未释放 | [桌面](sample-pressed-1440.png) | [手机](sample-pressed-390.png) |
| 取消创建或编辑 · 默认 | [桌面](cancel-default-1440.png) | [手机](cancel-default-390.png) |
| 取消创建或编辑 · 真实悬停 | [桌面](cancel-hover-1440.png) | [手机](cancel-hover-390.png) |
| 取消创建或编辑 · Tab焦点 | [桌面](cancel-focus-1440.png) | [手机](cancel-focus-390.png) |
| 取消创建或编辑 · 按下未释放 | [桌面](cancel-pressed-1440.png) | [手机](cancel-pressed-390.png) |
| 只读试运行 · 默认 | [桌面](preview-default-1440.png) | [手机](preview-default-390.png) |
| 只读试运行 · 真实悬停 | [桌面](preview-hover-1440.png) | [手机](preview-hover-390.png) |
| 只读试运行 · Tab焦点 | [桌面](preview-focus-1440.png) | [手机](preview-focus-390.png) |
| 只读试运行 · 按下未释放 | [桌面](preview-pressed-1440.png) | [手机](preview-pressed-390.png) |
| 只读试运行 · 在途禁用 | [桌面](preview-pending-1440.png) | [手机](preview-pending-390.png) |
| 创建并启用或保存修改 · 默认 | [桌面](save-default-1440.png) | [手机](save-default-390.png) |
| 创建并启用或保存修改 · 真实悬停 | [桌面](save-hover-1440.png) | [手机](save-hover-390.png) |
| 创建并启用或保存修改 · Tab焦点 | [桌面](save-focus-1440.png) | [手机](save-focus-390.png) |
| 创建并启用或保存修改 · 按下未释放 | [桌面](save-pressed-1440.png) | [手机](save-pressed-390.png) |
| 创建并启用或保存修改 · 在途禁用 | [桌面](save-pending-1440.png) | [手机](save-pending-390.png) |

## r2 新增84张扩展图

原r1代表按钮审核意见只适用r1基础部分，不自动批准r2新增变体。恢复busy通过已暂停场景的原型按钮触发现有resume意图，验证原version和固定人工原因；编辑保存核对PATCH/原版本/修改原因；两模板核对原对象字段，五错误重载核对各自read状态。场景准备不发API，伪类操作不得改变完整原型状态。

| 扩展控件与状态 | 1440 | 390 |
| --- | --- | --- |
| 恢复规则 · 默认 | [桌面](resume-default-1440.png) | [手机](resume-default-390.png) |
| 恢复规则 · 悬停 | [桌面](resume-hover-1440.png) | [手机](resume-hover-390.png) |
| 恢复规则 · 键盘焦点 | [桌面](resume-focus-1440.png) | [手机](resume-focus-390.png) |
| 恢复规则 · 按下 | [桌面](resume-pressed-1440.png) | [手机](resume-pressed-390.png) |
| 恢复规则 · 在途禁用 | [桌面](resume-busy-1440.png) | [手机](resume-busy-390.png) |
| 保存修改 · 默认 | [桌面](save-edit-default-1440.png) | [手机](save-edit-default-390.png) |
| 保存修改 · 悬停 | [桌面](save-edit-hover-1440.png) | [手机](save-edit-hover-390.png) |
| 保存修改 · 键盘焦点 | [桌面](save-edit-focus-1440.png) | [手机](save-edit-focus-390.png) |
| 保存修改 · 按下 | [桌面](save-edit-pressed-1440.png) | [手机](save-edit-pressed-390.png) |
| 保存修改 · 在途禁用 | [桌面](save-edit-busy-1440.png) | [手机](save-edit-busy-390.png) |
| 竞品复核模板 · 默认 | [桌面](template-competitor-default-1440.png) | [手机](template-competitor-default-390.png) |
| 竞品复核模板 · 悬停 | [桌面](template-competitor-hover-1440.png) | [手机](template-competitor-hover-390.png) |
| 竞品复核模板 · 键盘焦点 | [桌面](template-competitor-focus-1440.png) | [手机](template-competitor-focus-390.png) |
| 竞品复核模板 · 按下 | [桌面](template-competitor-pressed-1440.png) | [手机](template-competitor-pressed-390.png) |
| 审批驳回模板 · 默认 | [桌面](template-rejected-default-1440.png) | [手机](template-rejected-default-390.png) |
| 审批驳回模板 · 悬停 | [桌面](template-rejected-hover-1440.png) | [手机](template-rejected-hover-390.png) |
| 审批驳回模板 · 键盘焦点 | [桌面](template-rejected-focus-1440.png) | [手机](template-rejected-focus-390.png) |
| 审批驳回模板 · 按下 | [桌面](template-rejected-pressed-1440.png) | [手机](template-rejected-pressed-390.png) |
| 服务受阻重载 · 默认 | [桌面](reload-blocked-default-1440.png) | [手机](reload-blocked-default-390.png) |
| 服务受阻重载 · 悬停 | [桌面](reload-blocked-hover-1440.png) | [手机](reload-blocked-hover-390.png) |
| 服务受阻重载 · 键盘焦点 | [桌面](reload-blocked-focus-1440.png) | [手机](reload-blocked-focus-390.png) |
| 服务受阻重载 · 按下 | [桌面](reload-blocked-pressed-1440.png) | [手机](reload-blocked-pressed-390.png) |
| 登录失效重载 · 默认 | [桌面](reload-expired-default-1440.png) | [手机](reload-expired-default-390.png) |
| 登录失效重载 · 悬停 | [桌面](reload-expired-hover-1440.png) | [手机](reload-expired-hover-390.png) |
| 登录失效重载 · 键盘焦点 | [桌面](reload-expired-focus-1440.png) | [手机](reload-expired-focus-390.png) |
| 登录失效重载 · 按下 | [桌面](reload-expired-pressed-1440.png) | [手机](reload-expired-pressed-390.png) |
| 无权限重载 · 默认 | [桌面](reload-forbidden-default-1440.png) | [手机](reload-forbidden-default-390.png) |
| 无权限重载 · 悬停 | [桌面](reload-forbidden-hover-1440.png) | [手机](reload-forbidden-hover-390.png) |
| 无权限重载 · 键盘焦点 | [桌面](reload-forbidden-focus-1440.png) | [手机](reload-forbidden-focus-390.png) |
| 无权限重载 · 按下 | [桌面](reload-forbidden-pressed-1440.png) | [手机](reload-forbidden-pressed-390.png) |
| 限流重载 · 默认 | [桌面](reload-rate_limited-default-1440.png) | [手机](reload-rate_limited-default-390.png) |
| 限流重载 · 悬停 | [桌面](reload-rate_limited-hover-1440.png) | [手机](reload-rate_limited-hover-390.png) |
| 限流重载 · 键盘焦点 | [桌面](reload-rate_limited-focus-1440.png) | [手机](reload-rate_limited-focus-390.png) |
| 限流重载 · 按下 | [桌面](reload-rate_limited-pressed-1440.png) | [手机](reload-rate_limited-pressed-390.png) |
| 版本冲突重载 · 默认 | [桌面](reload-version_conflict-default-1440.png) | [手机](reload-version_conflict-default-390.png) |
| 版本冲突重载 · 悬停 | [桌面](reload-version_conflict-hover-1440.png) | [手机](reload-version_conflict-hover-390.png) |
| 版本冲突重载 · 键盘焦点 | [桌面](reload-version_conflict-focus-1440.png) | [手机](reload-version_conflict-focus-390.png) |
| 版本冲突重载 · 按下 | [桌面](reload-version_conflict-pressed-1440.png) | [手机](reload-version_conflict-pressed-390.png) |
| 取消编辑 · 默认 | [桌面](cancel-edit-default-1440.png) | [手机](cancel-edit-default-390.png) |
| 取消编辑 · 悬停 | [桌面](cancel-edit-hover-1440.png) | [手机](cancel-edit-hover-390.png) |
| 取消编辑 · 键盘焦点 | [桌面](cancel-edit-focus-1440.png) | [手机](cancel-edit-focus-390.png) |
| 取消编辑 · 按下 | [桌面](cancel-edit-pressed-1440.png) | [手机](cancel-edit-pressed-390.png) |

## 验证与使用

```powershell
node scripts/verify-ui-phase2-automation-controls-c.mjs --smoke
node scripts/verify-ui-phase2-automation-controls-c.mjs --capture
node scripts/verify-ui-phase2-automation-controls-c.mjs
node scripts/verify-ui-phase2-automation-c.mjs
node --test tests/unit/ui-phase2-automation-review.test.mjs
```

smoke检查双端焦点及适用在途64项；capture生成208张永久图、evidence和gallery；无参数校验所有来源/PNG指纹，并重跑208项控制状态、>=44px目标、>=16px控件字体、命中与溢出、状态不变。所有HTTP请求拦截、console/page错误、cookies/localStorage/sessionStorage均为0。浏览器/上下文finally关闭，不启动生产或测试服务，不安装依赖。

首次完整捕获中手机样本链接中心被固定操作栏遮挡；核对后统一将目标滚到可视区域中部，再验证命中点和截图，不使用force，也没有为过测修改业务布局。真实鼠标点击跳转/写入副作用、原型防重入与Vue差异仍以父合同/后续挂载测试为准，不能由伪类图取代。

本包文件为正式审核交付物，不是临时截图。无生产代码改动、部署或重启。具体P27布局/按钮/弹窗批准、共享壳层装配、全部73页与发布验收继续待办。
