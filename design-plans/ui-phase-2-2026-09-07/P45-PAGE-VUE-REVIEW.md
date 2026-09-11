# P45 平台角色权限比较 · 实际Vue页面审核

2026-09-11，P45-PERMISSION-PAGE-VUE-PREVIEW-r1，基于main/42909c61当前源码。此前PERMISSION-C-r1为离线设计，本批首次以当前P45父组件与比较组件组合回放；仅审核宿主替换模板布局和叠加独立CSS，没有修改生产脚本、控件、接口或部署。

## 正式图册与设计范围

[92图入口](../../output/playwright/p45-permission-page-vue-preview/index.html) · [桌面整体](../../output/playwright/p45-permission-page-vue-preview/1440-default.png) · [手机整体](../../output/playwright/p45-permission-page-vue-preview/390-default.png) / [手机首屏](../../output/playwright/p45-permission-page-vue-preview/390-default-top.png) · [单角色重置等待](../../output/playwright/p45-permission-page-vue-preview/390-single-reset-pending.png) / [读取后恢复](../../output/playwright/p45-permission-page-vue-preview/390-single-reset-recovered.png)

按frontend-design技能落实C方向：浅灰蓝页面底、去卡片化的全目录事实、蓝色角色上下文和白色逐项比较。桌面左角色右结果，760px及以下纵向，1100px及以下搜索与分组单列。当前原角色名称、职责说明和各自总权限数完整常显；早期手机说明折叠仍是提案，本次没有添加details或隐藏职责。首屏与完整页面分别出图，不以局部截图代替整页。

PlatformAccountCenter.vue完整原样挂载，initialTab=admins、routePath=/platform-admin/permissions来自真实路由状态映射；只有PlatformRoleComparison.vue的两个完整模板块移动到上下文区，现有表达式、指令、控件属性及script逐项相等。没有角色编辑、保存、原因窗或分页；原生select不是新增业务弹窗。旧P44源码、审核材料和局部批准保持，不能转作P45批准。

## 场景、请求与行为证据

390/760/761/1440，每宽度23图：初读等待、默认整页/首屏、键盘角色焦点、同角色无差异/显示全部、超级与运营全部/仅差异、编码搜索、安全分组、组合无结果、URL重载恢复、刷新等待、刷新500/403/401、首次失败/重试成功、空目录、单角色、单角色重置等待/恢复、长内容。

344项浏览器检查，40项当前源码LF指纹、一份审核变换指纹、92PNG指纹及精确库存。既有E2E的platformRoles初始化值按AST抽取：3角色、全目录能力去重7；默认运营/安全并集6；同角色仅差异0/全部3；超级对运营全部7/差异4；大小写不敏感编码搜索及安全分组各2，组合查询1。单角色取既有超级角色；长名称/职责为明确重复变体，没有新增接口字段或权限枚举。

五条件真实VueRouter写入left_role/right_role/show_all/capability_query/capability_group；保留keep=p45，刷新重载后五控件与结果一致，重置清除自有键且保留keep。仅更改角色或show_all仍不能启用重置，这是原disabled条件，不默认为已优化。

本次捕获四宽度分别30/30/29/30个拦截GET，共119，全部只访问/api/v1/platform/roles，没有账号接口、写入或意外外网。URL变化可能触发父query/status数组watch再次load；single-flight及异步合并使总数不应被当成固定产品契约。每宽度供给500两次、401/403各一次，目录刷新失败仍保留6行旧结果与原成功时间，原提示明确保留旧矩阵。此处仅记录当前代码，不宣称401/403后继续展示已经获得安全批准。

单角色重置曾在离线样例中表现为缺失固定默认角色；本次实际Vue等待图验证同一现象，但释放重读响应后原roles watcher恢复超级角色。说明必须区分“请求等待时缺失”与“新角色数组返回后的回退”；本批没有改变业务规则，也没有将暂时的0权限表述为真实权限被撤销。

## 验证与运行方式

```powershell
node scripts/verify-ui-phase2-permission-page-preview.mjs
node --test tests/unit/ui-phase2-permission-page-preview.test.mjs
```

默认只复验；显式--capture才写本批正式图册/清单。此开关仅为本地审核工具参数，不是生产配置，不需.env。复用已有依赖、随机回环端口、关闭后端代理并拒绝未登记API；finally关闭浏览器/Vite。最小4项永久合同已通过，包含完整原脚本/模板绑定一致、锚点漂移失败关闭、源图指纹和原行为边界。

首次截图回放在760px键盘焦点处读到当前文字色而非白色，验证器已改为有界等待同一原生控件同时具有activeElement、focus-visible及3px白轮廓，再做原严格断言；完整四宽度92图回放通过，没有放宽颜色标准或改动生产焦点。失败回放的同名图已被最终完整清单覆盖，没有遗留失败包。

实际模板/CSS已由Vite编译并在浏览器检查，页面无横向溢出、无业务弹窗、无浏览器异常。生产构建输入未改变，不重复既有生产构建。生产API/OpenAPI、环境变量、依赖、数据库、权限、后端/Python/插件及部署脚本均未改，因此运行契约配套不适用；未部署，无生产重启要求。

完整相关UI/平台账号/响应式合同835项通过，失败0。73路由/60受保护/6角色和153文件文档门禁、格式及diff空白检查通过。64109、64233、64347已查无监听，当前验证器进程无残留。

## 待审核与清理

本次桌面整体及手机首屏布局待用户审核，不将此前P44已批目录/资料/控件/结果外推。其余状态、新焦点、全部断点/主题/密度、辅助技术、真实API/MySQL/权限、完整App/导航/前进后退/KeepAlive仍未验收；73页设计实施与宝塔交付继续。

92PNG、HTML图册、JSON证据是正式交付保留；无一次性测试文件或新依赖。临时审核进程在回放结束关闭，提交前复核端口与工作树，历史交付文件不删除。
