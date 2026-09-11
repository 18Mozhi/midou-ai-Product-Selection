# P46 来源设置 · 实际Vue目录审核

2026-09-11，P46-PROVIDER-PAGE-VUE-PREVIEW-r1，基于main/4ab8631b当前文件。上一轮P45已产生实际提交；本轮推进P46真实Vue目录，不重做旧离线176图，也不把待审稿或相邻页批准当作上线许可。

## 正式图册与设计

[104图入口](../../output/playwright/p46-provider-page-vue-preview/index.html) · [桌面首屏](../../output/playwright/p46-provider-page-vue-preview/1440-default-top.png) / [桌面整页](../../output/playwright/p46-provider-page-vue-preview/1440-default.png) · [手机首屏](../../output/playwright/p46-provider-page-vue-preview/390-default-top.png) / [手机筛选](../../output/playwright/p46-provider-page-vue-preview/390-filters.png) / [手机记录](../../output/playwright/p46-provider-page-vue-preview/390-records.png) · [窄桌面右侧列](../../output/playwright/p46-provider-page-vue-preview/761-table-right.png)

frontend-design技能指导C方向：左侧蓝色来源导航、精简页头与蓝色新建入口、紧凑四项统计、状态口径说明、白色筛选和记录区。1100px以下导航移到顶部；760px以下使用现有移动记录结构，五字段单列，记录以分隔线区分，查看详情仍为原按钮。桌面全部七列、冻结首可见列、列显示与两密度保留；窄桌面通过表格内部横向滚动读取右侧，不让整页横向溢出。

实际ProviderRuntimeSurface挂载ProviderRegistry，capabilities使用明确的超级管理员审核样例；读取导航五个实际链接及当前页标记，不声称目的页面或授权已验收。未挂载完整App/NavigationShell，其他子组件虽被父模块导入，但没有被本次路线激活；源指纹包含导入文件不等于这些页面已验证。

仅独立审核助手对两处静态呈现作调整：空操作表头命名“操作”，UiStatePanel的现有primary=load显示为“重新读取来源”。本调用方没有secondary处理函数，审核CSS隐藏其无效次按钮，避免把“返回工作台/重新登录”等原默认文案误当作真实跳转能力。完整Vue脚本、模型、事件和原DOM除两段精确字符串外逐字一致；未改变请求、权限或共享UiStatePanel生产实现。状态区域同步为蓝灰、左对齐层级，保留原标题/说明/关联编号；没有添加申请权限或登录接口。

## 覆盖及数据事实

390/760各24图、761/1440各28图，共104PNG。共有：初读等待、默认整页/首屏、导航与新建焦点、筛选/记录、第二页、受阻筛选、组合无结果、编码搜索、最近更新/门禁排序、搜索焦点、刷新等待、刷新500/403/401、首次error/forbidden/expired/blocked、空目录、长名称。桌面另有列设置、隐藏首列、紧凑且解除冻结、右侧列。

既有m03-01-provider-registry.spec.ts的definition/blockedDefinition/definitions按AST抽取，保持原25条；全局统计25/1/1/24与筛选数量分别核对，20/5分页逐条名称顺序一致。中文名称排序、同更新时间的稳定排序以及“未进入调度”在“执行受阻”前的实际zh-CN顺序有明确断言，不以主观状态优先级替代原逻辑。仅empty和长名称/负责人为标明的合成变体，不修改E2E原样例。

284项浏览器检查，38项当前源码LF指纹和一份审核变换指纹，104PNG精确库存/尺寸/内容指纹。每宽度18次GET、总72，全部为拦截/api/v1/platform/providers：200九次（含empty/long各一次），401/403/500各两次，429三次。429三次源于现有api-client的安全读取重试，非新策略。所有本地过滤/排序/分页/列设置和移动详情开关阶段合计仍只有初始一次读取，URL始终保留?keep=p46；没有POST/PUT、账号/其他API或意外外网。

初始失败不显示记录，仅显示真实读取动作，点击后读取恢复。刷新401/403/500保留25条旧数据并显示原过期快照提示，这只是当前行为证据，不是批准权限失效后继续展示。没有启动采集、robots检查、条款审批或来源启用。移动只验证原详情打开/关闭与焦点回原记录，未将旧详情样式或全部弹窗生命周期算成本次重设计。

## 复验方式与边界

```powershell
node scripts/verify-ui-phase2-provider-page-preview.mjs
node --test tests/unit/ui-phase2-provider-page-preview.test.mjs
```

默认只验证，显式--capture才重制本批正式图册；这只是本地CLI选项，不是生产开关，不需.env。复用既有依赖，Vite随机回环端口、关闭后端代理、未登记API失败关闭；finally关闭浏览器/Vite。最小4项永久合同通过：精确呈现差异/锚点漂移拒绝、当前源与图册哈希、分页/筛选/错误/控件事实、生产隔离。

首次复用宿主时发现旧组件导入未替换，等待loading失败后已纠正实际ProviderRuntimeSurface入口；后续状态排序断言按真实zh-CN顺序修正。视觉复核降低审核通用控件规则权重，使手机记录分隔样式和蓝色新建不再被通用边框覆盖；截图目标改为顶端对齐，并补窄表格右侧图。旧状态面板色彩层级也仅在本批CSS统一。全部失败/中间同名图由最终四宽度完整回放覆盖，没有保留失败清单或用失败截图签收。

生产代码/路由/API/OpenAPI、数据库、环境配置、依赖、权限、后端/Python/插件与部署脚本均未改，运行契约配套不适用。未部署、无生产重启要求；生产构建输入未变，不重复旧构建，审核组件已由Vite编译并经实际浏览器回放。

最终相关UI/账号/响应式合同839项通过，失败0；73路由/60受保护/6角色、153文件文档门禁、格式和diff空白检查通过。49568、49660、49799、49980、50198端口均无监听，当前验证器进程无残留。

## 待审、剩余工作与清理

本批目录整体、各区域组合与状态均待审，不扩大P44/P45或其他页批准。P46四步23字段编辑长窗、模板/输入边界、真实写入及其窗口归属、编辑转创建字段残留、日期时区、共享原移动详情C设计、完整辅助技术/软键盘/主题密度和App生命周期继续待办；下一批优先P46编辑窗，不以本批目录替代完整页面交付。PR-G01条款准入差异与真实RBAC/MySQL/采集/宝塔/73页验收仍未完成。

104PNG、HTML图册和JSON证据作为正式交付保留，未创建一次性测试脚本/图片或新依赖；中间截图仅覆盖本批同名交付，没有删除历史用户材料。临时服务和浏览器在finally关闭，提交前检查进程/端口与Git状态。
