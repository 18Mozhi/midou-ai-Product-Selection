# 组织概览 · 首次读取与访问状态 r1

2026-09-13。待审核，本轮不扩大组织概览r2、刷新r1或任何已有局部批准。

## 交付和真实依据

[54张图册](../../output/playwright/org-read-state-vue-c-r1/index.html) / [机器证据](../../output/playwright/org-read-state-vue-c-r1/evidence.json)。32组、584项页面检查、178来源SHA，296 GET，无请求体、写入、意外网络或运行异常。

实际 App/Router/NavigationShell/OrganizationAdminCenter；依据总纲4.1、Feature Map M02-03/M06-01、组件 load/applyFailure/readView 和 api-client 的真实错误分类/自动重试。数据精确复用 M06-01 组织 guard/profile/summary/workspaces 测试样例，不叠加角色能力。

| 场景 | 手机展开区域 | 范围 |
| --- | --- | --- |
| 登录失效401 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-401-390-trace.png) | 首次及已有数据后 |
| 无法查看403 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-403-390-trace.png) | 首次及已有数据后 |
| 版本变化409 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-409-390-trace.png) | 首次 |
| 请求频繁429 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-429-390-trace.png) | 首次 |
| 后台暂不可用500 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-500-390-trace.png) | 首次 |
| 数据暂不可用503 | [查看](../../output/playwright/org-read-state-vue-c-r1/review-initial-503-390-trace.png) | 首次 |

每个场景覆盖390/1440和上一刷新提案/本批提案两模式。图册中的 baseline 是**上一 C 刷新审核稿**，不是线上页或未经变换的生产源码。54图组成：新稿16场景各错误全页、展开状态区、重读等待三张共48；首次加载2张；旧稿已有数据后401/403残留反例4张。

## 发现与修正

- 旧 C 标题取 data.name 而未检查页面状态；401/403后实际表单/概要已撤下，但旧名称与更新时间仍显示。旧稿4组反例均记录name=true/time=true，本批所有错误均false；未修改旧包，不再把旧包当作覆盖访问失效状态的证据。
- 本批标题与时间仅在ready时读取既有事实。当前组织导航仍来自独立成功的导航样例；本测试不是导航权限被撤销或服务端权限完整验收。
- 初次读取采用白色状态区，明确等待，不用0个指标冒充真实空数据。错误仅展示一块白色区域，移除重复外层notice；正文使用原API客户端消息，403标题温和调整为“当前无法查看组织资料”。
- 错误编号仍是原requestId，放入原生details。标题和44px按钮、蓝色键盘焦点统一为C方向。
- 原“重新加载”按钮消失前，仅在它自己拥有焦点时把焦点交给持续存在的页面标题；原load()仍执行一次，未添加请求或改变原参数。

新helper在上一刷新变换上追加8处唯一锚点替换。逆向逐字回到上一稿；删除新增reload焦点函数后script逐字相等，Vue编译通过。已有刷新包装函数、读写/版本/审计/权限逻辑均未修改。

## 验证边界

- 最小定向3项：精确逆向/锚点漂移拒绝/Vue编译、焦点所属×连接×inert 8组合、ready事实与审核CSS边界通过。
- smoke：首次403及已有数据后403，双端4组90检查。捕获32组584检查；当前54PNG与178来源完整验证通过。
- 原自动重试保留：429/503各3次，401/403/409/500各1次；重读成功各一次summary读取。没有调整429延迟/服务端限流配置。
- 401/403为组织summary拒绝，但并发profile/workspaces按旧样例成功，专门检查部分响应不应重新泄露旧事实；不是实际服务端权限验证。错误只有状态和原request/trace结构，没有伪造专用业务error字段；正文出现通用失败回退是明确测试条件。
- 恢复仅由本地拦截再次返回原数据；不代表真实重新登录、角色恢复、服务器恢复或保存成功。主题偏好继续本地500回退，不是主题同步证据。
- 人工查看首次等待、六类手机展开区域、桌面权限撤下；不代表全站读屏验收、全部断点/主题、网络断连、超时、乱序竞态、其他组织路由或生产验收。
- 本轮不重跑全库或推算全库失败数。上一1499/1352/147仍是历史快照，完整73页和发布门未完成。
- 最终本批4项、刷新4项、组织r2 3项、平台壳4项、成员/P16 4项、访问状态5项、M02-03 9项，共33/33通过。原组织r2与刷新r1来源/图证仍通过。路由73、文档153必需文件、runtime-docs、Prettier和定向diff检查通过。

## 使用与收尾

`node scripts/verify-ui-phase2-org-read-state-vue-c.mjs --smoke` 四组无图；无参数32组无图。`--capture` 独占r1目录，已存在则拒绝覆盖；修改需新版本。

本轮只追加审核helper/CSS/驱动/永久测试和图稿文档。原组织r2/刷新r1的脚本、CSS、图片与manifest保持不变；生产Vue/API/OpenAPI/env/数据库/依赖/权限无修改，无生产重启或部署。

frontend-design用于蓝白状态结构与温和标题，fixing-accessibility用于原生details、状态语义与重读焦点；复用项目现有Playwright/Vite，不安装依赖。

本轮无一次性临时文件，54图为永久审核交付；Vite/Chromium finally关闭，端口61332、61528、61665最终监听数量为0。

旧清理受阻目录仍保留，本轮不绕过删除限制：

- `D:\项目工程文件\vue\curson\工具\智能选品\output\playwright\p47-c-e2e-temp`
- `C:\Users\23136\AppData\Local\Temp\scoutops-p44-p46-replay-37f4e02d2ecd4dc5bf27ef9bffe270dd`

起点main/af239b08b69f7d97cd0372f9840a70009eeef0c7，533条已有改动。混合工作区与全库门未解除，不暂存其他修改，不提交部署；commit hash不适用。草稿覆盖策略与此前布局/刷新状态提问仍待用户决定，本批未实施新策略。
