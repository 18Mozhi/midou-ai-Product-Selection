# P27 自动化规则 · 逐按钮状态 C r1

AUTOMATION-CONTROLS-C-r1 / 2026-09-10 / **独立图稿待用户审核，未接入真实Vue或生产**。

[双端图册](gallery.html) · [交互稿](index.html) · [原P27完整页面/弹窗122图](../automation-direction-c/README.md) · [精确状态指纹](evidence.json) · [动作登记](../../action-reviews/P27.json)

## 设计与范围

延续已选C方向的蓝色规则目录、白色工作面与当/且/则流程，复用原AUTOMATION-C-r1的完整HTML结构、CSS、数据和controller。仅本包技术详情summary改16px，避免将可操作入口当13px辅助文字；父图与真实Vue未改。没有回到旧卡片墙或纸色主题。

14个代表控件，每个默认、真实鼠标悬停、Tab焦点、真实按下四态，共56场景；另6个由真实源码声明busy/previewing禁用的代表控件在途场景，共62场景×双端124PNG。在途一图可同时引用disabled/busy，不为数字重复绘图。对应68条动作/状态引用，10个源无呈现槽和6个导航不禁用槽分列。截图是控件所在完整视口，弹窗按目标位置滚动；不是按钮裁片，也不是全部弹窗的纵向全貌。

代表范围：暂停而非恢复；创建提交而非编辑；审批超时模板而非另两模板；通用读取失败而非所有失败原因。完整行/模板/编辑/恢复/错误类型组合、10字段全态、目录定位/分区跳转/额外关闭入口等提案新增控件、三主题密度与最终Vue对照仍待。不能把0未映射代表槽称为整页完成。

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

## 验证与使用

```powershell
node scripts/verify-ui-phase2-automation-controls-c.mjs --smoke
node scripts/verify-ui-phase2-automation-controls-c.mjs --capture
node scripts/verify-ui-phase2-automation-controls-c.mjs
node scripts/verify-ui-phase2-automation-c.mjs
node --test tests/unit/ui-phase2-automation-review.test.mjs
```

smoke检查双端焦点及适用在途40项；capture生成124张永久图、evidence和gallery；无参数校验所有来源/PNG指纹，并重跑124项控制状态、>=44px目标、>=16px控件字体、命中与溢出、状态不变。所有HTTP请求拦截、console/page错误、cookies/localStorage/sessionStorage均为0。浏览器/上下文finally关闭，不启动生产或测试服务，不安装依赖。

首次完整捕获中手机样本链接中心被固定操作栏遮挡；核对后统一将目标滚到可视区域中部，再验证命中点和截图，不使用force，也没有为过测修改业务布局。真实鼠标点击跳转/写入副作用、原型防重入与Vue差异仍以父合同/后续挂载测试为准，不能由伪类图取代。

本包文件为正式审核交付物，不是临时截图。无生产代码改动、部署或重启。具体P27布局/按钮/弹窗批准、共享壳层装配、全部73页与发布验收继续待办。
