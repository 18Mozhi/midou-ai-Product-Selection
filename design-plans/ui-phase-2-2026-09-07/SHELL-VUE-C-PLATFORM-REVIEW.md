# C 导航壳 · 平台真实 Vue 装配 r2

2026-09-13；起点 `main / af239b08`，497 项既有未提交变更，暂存区为空。
本批新增审核宿主变换、CSS、菜单交互助手、运行器与永久测试；未改生产源码。
完整 73 页重构目标保持开放。P47 两空态批准、原默认布局批准不扩大到本组合。

## 当前可审内容

[18 张 r2 图与入口](../../output/playwright/shell-vue-c-platform-r2/index.html) ·
[机器证据](../../output/playwright/shell-vue-c-platform-r2/evidence.json)

这不是手写业务占位图：实际 App、Router、NavigationShell、ProviderRuntimeSurface、
P47 与 P46 在本地运行。r2 包含现有界面两张对照、390/840/841/1440 的新组合，
以及手机菜单、菜单无匹配、上下文展开。截图明确区分首屏与完整页面。

- 全局横向索引改为蓝色授权侧栏；当前分组默认展开，原名称/分组搜索保持。
- 移除旧大编号和 SIGNAL LEDGER 装饰；当前范围、任务域、角色形成紧凑身份区域。
- 移除壳层中无健康探针依据的固定“已连接 · 可复核”展示，不改变任何业务健康数据。
- P47 原蓝色纵向子目录在本组合内改成横向入口，避免双侧栏；目标与可见权限保持。
  **该子目录布局属于新提案，必须重新批准。** 页内事实、表格、筛选与操作源码未改。
- 手机使用一个原生 dialog 包含唯一导航 DOM；关闭/Escape 回到触发按钮，首尾 Tab
  循环，跨断点退回可见品牌入口。桌面非模态、手机关闭时不进入可见/键盘导航。

使用 frontend-design 的 C 构图与 fixing-accessibility 的可访问名称、原生弹窗和焦点
规则。没有新增字体下载或运行依赖。主题控件保留真实事件，但主题映射/保存/浮层
不在本批验收范围；成员、组织、AccountShell 和壳层全部错误状态仍待独立推进。

## 事实和保护边界

`scripts/lib/ui-phase2-shell-vue-preview.mjs` 仅在 Vite 审核宿主转换 NavigationShell。
单测移除唯一新增 import 和 composable 调用后，完整 script 与生产逐字一致；原
dispatcher、KeepAlive、scope key、navigation load、取消过时读取、权限计算、动作
href/v-if 均保留。所有锚点必须唯一，二次转换或源锚点漂移直接失败。

两组原 E2E 样例经 TypeScript AST 提取：M03-03 navigation/base/items 和 M03-01
definition/blockedDefinition/definitions。未合并或扩大角色能力；目录由真实运行
代码生成，新旧六组全部菜单名称/href 相同。仅允许本机四种 GET；禁止意外外网、
写请求、请求体。真实 RouterLink 从菜单进入 P46，再由子目录回 P47，不靠伪造 URL。
这不是服务端 RBAC、真实来源、探针、数据库、登录与生产验收。

## 发现、修正与证据

1. 初次最小单测发现 style AST 位移不同；比较改为保留全部样式属性/内容、忽略源码
   坐标，未豁免样式改变。3 项源变换/编译/边界测试随后通过。
2. 首次手机回放发现反向 Tab 可离开页面控件循环；新增仅模态边界的首尾保护。
   菜单关闭后读取搜索值改用 DOM 定位，避免可见角色查询造成测试超时。
3. r1 的 6 组 82 检查未捕获根级级联问题：P47 延迟 CSS 覆盖 grid，桌面正文在首屏
   以下、手机额外顶空。**r1 不合格，不可用于批准。**
   [原 18 图与负面证据](../../output/playwright/shell-vue-c-platform-r1/index.html)保持，
   其中源指纹只表示当时捕获版本，不表示当前源。
4. r2 增强审核根选择器限定，并增加正文横向位置、首屏纵向位置及无顶空检查；
   桌面导航持焦转手机时回到可见品牌。最小双端 2 组 38 检查通过后才正式捕获。
5. r2 正式 6 组、88 检查、18 PNG、177 源指纹（含递归 CSS imports）通过。
   目检 1440、841 和 390 首屏确认正文可见与目录装配；手机菜单目检使用 r2 文件。
   不将 r1 自动通过数当作视觉通过，也不据 r2 推算全站已通过。

## 使用与收尾

```powershell
node --test tests/unit/ui-phase2-shell-vue-preview.test.mjs
node scripts/verify-ui-phase2-shell-vue-c.mjs --smoke
node scripts/verify-ui-phase2-shell-vue-c.mjs
```

`--smoke` 不出图，检查 390/1440 审核组合；无参数全量不出图。
`--capture` 已生成 r2，目标目录采用独占创建，再运行会拒绝覆盖。若以后修改设计，
先更新版本与目标路径，再重新捕获，不改旧图源指纹或审批状态。可编辑上述宿主、
`implementation/shell-review-navigation.ts`、`implementation/shell-vue-c-preview.css` 调整提案。

本轮新提案 4 项与既有 M02-03 9 项共 **13 单测通过**；包括实际源/18 PNG 指纹、
六组菜单目标一致、真实 SFC 编译及保持既有服务端合同检查。
`npm run verify:docs`（73 路由、153 必需文件）与 `npm run verify:runtime-docs` 通过；
相关格式检查和 diff 空白检查通过。全库最近完整记录仍为
`P47-PAGINATION-FOCUS-UNIT-RESULT.json`：1478 项中 1309 通过、169 失败；本批没有
重新运行或修复全库，不推算最新总数。全库门未通过，不提交、不部署。

无 API/OpenAPI、配置、环境变量、数据库、权限、依赖或后端/Worker/Python 契约变更，
因此不需要生产重启。177 指纹只覆盖本次实际加载链，不表示全站完整源清单。
新文件和两版图为永久审核/负面证据，不是待清理测试草稿；所有本批 Chromium/Vite
均 finally 关闭，最终捕获端口 49825、49863。旧清理受阻的两目录未操作：
`output/playwright/p47-c-e2e-temp` 与
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。
commit hash 不适用。r2 整体装配仍待用户审核，不代表全局壳层或 P47 全部状态完成。
