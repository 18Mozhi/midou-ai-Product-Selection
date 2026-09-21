# C 导航壳 · 三壳层访问状态 r1

2026-09-13；`main / af239b08`，开始时 503 项既有变更、暂存区为空。本批只新增
实际 Vue 审核变换、局部 CSS、运行器、永久测试及交付记录。全 73 页目标未缩减。
上一批平台壳层 r2 及 P47 读取失败仍待具体审核，本批不代替这些决定。

## 审核图及范围

[84 张新旧状态图](../../output/playwright/shell-access-vue-c-r1/index.html) ·
[机器证据](../../output/playwright/shell-access-vue-c-r1/evidence.json)

实际 App、Router、NavigationShell，成员 `/home`、组织 `/org-admin`、平台
`/platform-admin` 三条真实路由，在 390/1440 宽度运行。30 张原界面错误对照、30 张
新错误状态、6 张首次加载、6 张权限诊断展开、12 张限流/受阻重查中，共 84 张。
原平台 r1/r2 图、源码及全部审批未改；没有复用旧截图冒充本批生成。

| 状态 | 新标题 | 原动作保持 |
| --- | --- | --- |
| 核验中 | 正在确认工作台访问权限 | 不显示重查按钮，不显示授权菜单 |
| 401 | 请重新登录 | `/login`，不承诺未实现的自动返回 |
| 403 | 当前暂时无法进入这个工作台 | `/home`；原请求/链路编号按需展开 |
| 409 | 先选择组织与工作区 | `/select-context` |
| 429 | 请稍等片刻再试 | 原 `load` 重新检查 |
| 503 | 暂时无法读取工作台 | 原 `load` 重新检查 |

延续 frontend-design 的蓝白 C 方向：白色状态面板、短标题、16px 说明、辅助提示、
可折叠诊断和至少44px主动作。fixing-accessibility 用于原生链接/按钮、键盘触发和
重查焦点。保持服务端 actionHint 原文，不编造响应成功、权限恢复或健康结论。

## 代码与行为边界

`previewShellAccess` 在上一批 `previewShellVue` 输出上只改六组标题/说明、一个状态
标题 tabindex、一个点击包装器。逆向去除这些明确增量后，完整 script/template
严格等于上一批预览。生产 NavigationShell 未接入本批文件，原请求、HTTP分类、
sequence/AbortController、授权菜单计算、路由与权限条件保持。

重查包装器仅在触发按钮自己持焦时，将焦点同步移到同一区域的现有 h1，再调用
原 `load` 一次。加载时按钮移除，标题继续存在；持续错误仍保留标题焦点。
其他控件持焦、非按钮、缺少标题都不抢焦，仍调用原读取一次。未实现或声称重查
成功后焦点链、完整读屏、跨壳层读取竞争或全部菜单动作的验收。

CSS 只匹配审核 body 和非 ready 壳层；不会改变上次 ready 图的实际源码或选择器。
顶部主题/个人入口保留原事件和条件，本批未覆盖它们的弹窗、保存和真实可用性。

## 样例与验证

403 响应从现有 M02-03 E2E 的 JSON.stringify 对象经 TypeScript AST 精确提取，
保留 `m02-03-forbidden`、`m02-03-trace` 及原 action_hint。其他四类使用显式 HTTP
状态加空编号对象，验证当前 api-client 的无细节回退，不伪称真实后端错误样例。
`/auth/session-status` 只在本机返回 authenticated，以便进入被测壳层。
成员/组织的主题偏好 GET 显式返回500，保留当前默认外观；这不是主题同步验收。

1. 最小 3 项编译/精确变换/边界单测通过；双端平台 403/429 预检 4组80检查通过。
2. 增加焦点包装器四种输入条件测试，通过后继续完整回放。
3. 正式捕获：两版本 × 两宽度 × 三壳层 × 五 HTTP 分支 = **60组966检查**。
   初次加载与显式重查由本地响应闸控制，不更改浏览器时钟或生产重试延迟。
4. 429/503 保持原三次 GET 尝试；显式重查再三次。401/403/409 只初次一次。
   **重查再次返回同一错误，不是成功恢复。** 登录/工作区/返回链接仅核对 href，
   没有登录、选择工作区或目标页端到端证据；原路径可能仍被权限拒绝。
5. 各状态无授权菜单泄漏；加载无重查按钮；重查清除旧诊断，不能双击提交；标题、
   原编号、折叠披露、首屏位置、横向溢出、触控和字体检查通过。无写请求/请求体、
   意外外网或浏览器运行错误。源指纹163个，包含递归导入CSS；所有84 PNG保留尺寸与SHA。
6. 已目检手机成员拒绝、桌面组织受阻、手机平台重查中；仅确认可展示，不自动批准。
7. 最终关联单测18/18：本批5项、上一平台r2的4项、既有M02-03的9项；核对全部163
   原始源指纹、84PNG及完整矩阵，同时确认上一平台r2的177来源/18图仍一致。
   `verify:docs`（73路由、153必需文件）、`verify:runtime-docs`、相关格式及diff空白
   检查通过。未重新运行全库，不根据本轮结果推算全库状态。

## 使用与交付门

```powershell
node --test tests/unit/ui-phase2-shell-access-preview.test.mjs
node scripts/verify-ui-phase2-shell-access-c.mjs --smoke
node scripts/verify-ui-phase2-shell-access-c.mjs
```

`--smoke` 为双端平台 403/429；无参数为完整不出图回放。`--capture` 的 r1 已存在，
独占目录创建会拒绝覆盖；修改设计后必须另建版本。可编辑
`scripts/lib/ui-phase2-shell-access-preview.mjs` 和
`implementation/shell-access-c-preview.css` 调整本提案，不能修改旧图/旧批准补一致。

本批没有生产 Vue、API/OpenAPI、配置/环境变量、依赖、数据库、鉴权或后端/Worker/
Python 契约改动，无生产重启要求。全库最新完整记录仍是
`P47-PAGINATION-FOCUS-UNIT-RESULT.json` 的1478项、1309过/169失败；本轮不据局部
结果推算全库，不提交、不部署，commit hash 不适用。

所有新脚本、测试、图和记录为永久交付；无额外临时草稿。Chromium/Vite 在 finally
关闭，预检51277、完整51381/51662均已结束。历史清理受阻目录未操作：
`output/playwright/p47-c-e2e-temp`、
`C:/Users/23136/AppData/Local/Temp/scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`。
具体状态组合待审核；成员/组织 ready 实际装配、AccountShell、全部主题/发现交互、
真实登录与授权恢复及全73页实施验收继续开放。
