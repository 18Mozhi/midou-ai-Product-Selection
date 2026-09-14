# P34 分页边界焦点实施与审核

日期：2026-09-14。局部实现与定向验证通过；两张手机末页焦点组合已获批准，其余图待审，未提交、未部署，不代表P34整页或全73页完成。

## 模板键盘交互接续（2026-09-14，待视觉审核）

本轮只新增永久验证入口、辅助函数和三项回归测试，产品Vue、C样式、后端、API、权限、环境配置及依赖均未改变。fixing-accessibility技能要求检验真实键盘焦点；沿用仓库Playwright实际App驱动，原466项检查和原夹具仍执行，不通过替换业务脚本伪造结果。没有发现本批需要修改产品的缺陷。

- 最小验证：手机baseline/review两组184项通过，无截图。
- 完整验证：baseline390/760与review390/760/761/840/841/1440，共8组844项通过。包括原生Tab抵达下一条模板和技术入口、Enter/Space选择及展开/收起、焦点在截图定位前位于视口且未被覆盖、可见焦点轮廓、折叠时隐藏ID、标题/选中条目/技术ID对应。
- C跨页状态：选择第二页新模板后提示消失；返回第一页保留该模板ID且显示提示；再回第二页提示消失且原条目仍选中。选择和翻页不增加API请求。
- 128个本地拦截GET，零业务写请求；未触及真实后端或客户数据。C壳层包含既有审核变换，子组件脚本保持当前原文。不是完整读屏、真实权限、全站或生产验收。
- 新包仅保存三种新增场景在六个审核宽度下的18图，不重复保存已有82图；183份登记来源与18张PNG哈希全部核对一致。所有截图均固定1000px高，不声称跨页图展示了全部详情。
- 收尾验证：新增3项与既有App3项、分页49项、查询9项合计64项全通过；verify:docs（73路由/60受保护路由/6角色/153必需文档）、verify:runtime-docs及新增脚本格式检查通过。未改产品/样式，未重复构建或运行全站套件。四个测试端口63093/63105/63347/63368均无监听，测试驱动进程为零，暂存区为空。

使用：`node scripts/verify-ui-phase2-org-approvals-template-keyboard.mjs --smoke`运行手机两组；无参数运行完整八组且不写图片。`--capture`只允许独占创建不存在的`output/playwright/p34-template-keyboard-c-r1`，现已有正式包，不可覆盖。没有生产配置或重启要求。

手机审核图片（仅技术详情展开/蓝色键盘焦点，以及跨页浅蓝提示与当前模板身份）：

| 图 | SHA256 |
| --- | --- |
| [技术详情Space展开](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-template-keyboard-c-r1/390-template-technical-space.png) | bdacd42dbef5cca378e3093f7abf773114881a464159ac52f9e674f7febd4d4f |
| [技术详情Enter展开](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-template-keyboard-c-r1/390-template-technical-enter.png) | bcc0ecaca061c6143d0e77b963272c5dac3baa5e99bb90b092c3e60d0a3a9053 |
| [跨页保留详情](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-template-keyboard-c-r1/390-template-cross-page-retained.png) | 64b8252f573b98d172281bad800d3c567ba57faa13f34e3ea30fc9207a9532b0 |

[18图与完整检查清单](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-template-keyboard-c-r1/evidence.json)。其他宽度按同场景文件名前缀760/761/840/841/1440查阅。上轮三张模板详情/首版/无差异仍待答，本轮不替其批准，不包含图中分页、导航、业务跳转入口或整页批准。

18图与清单是正式审核交付物，保留；本轮无一次性脚本/临时日志，测试浏览器和服务已关闭。既有p34-pagination-focus-r1/r2仍受此前删除策略限制，未重试。新增验证依赖多份未提交的既有辅助文件；跨页提交归属仍待确认，不单独提交一个无法由当前HEAD运行的入口，commit hash不适用。未部署，全73页实施目标未完成。

## 最新批准：完整App图中的审批记录区域

用户回复“审批记录组合通过，继续其他状态”。仅批准 output/playwright/p34-pagination-app-c-r3 中以下两图的蓝色工作区说明、白底字段、技术详情及桌面双列间距/手机单列排列：

| 文件                                    | SHA256                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| 390-requests-pagination-first-focus.png | 8ffdc03db8bb19a9e54225a1534d289b1333d4230ba9b7cce11e2fa6af1bd02f |
| 1440-request-technical.png              | 06750f17f0015f8803b1493a9e6e9ca16a63804a89617face5b88a8de5535811 |

不包含图中导航、整页、完整读屏、真实审批或生产验收，也不把本次卡片批准扩展成首页分页的单独签收。旧手机末页焦点批准保持原范围，采集manifest仍保持原pending。下方“新卡片待答”是收答前的历史记录，以本节为准。

## 完整App续接：可见焦点与C记录卡片r3

### 本次待审：手机模板详情与版本边界

2026-09-14继续审核现有App-r3，不重新生成或覆盖图片。重新核对181份登记来源和82张PNG，均与证据清单一致；8组466项是该包已有的浏览器结果，本次未重复运行。实际组件依据总纲的只读模板治理合同，以from_version和changes区分首版与无差异，未修改版本计算、数据、权限或审批动作。frontend-design技能仅用于核对已选C方向的信息层级和视觉一致性。

以下三图仅提交蓝色模板身份区、四项版本摘要、版本结果区及折叠的技术详情入口的视觉组合审核，尚未收到本批批准：

| 手机图片（目录为output/playwright/p34-pagination-app-c-r3） | SHA256 |
| --- | --- |
| 390-template-detail.png | cd4fb1c8050509a59eac16ce7682e2cd0363f8e2d47fab346a5b6b23cd90fad2 |
| 390-first-version.png | 416ae9129c69baffaa10a294692b55922343669d30972ad440fd18176e32f453 |
| 390-unchanged-version.png | 25370a2f4d6ba23057f009811f761eb552b951c676d7f4beb8d6fcb06254b2f8 |

范围不含图中分页、导航、底部业务入口、技术详情展开态、桌面排列、混合差异/跨页详情、完整读屏或真实审批/生产验收。图片来自当前实际Vue加C审核样式和本地样例，并非真实客户数据。本次仅补审核记录，不改产品代码或配置，未启动服务、未产生临时文件、未部署；该文档与跨页既有修改仍未确认提交归属，不混合提交。

本节为最新结果，下方子组件240项/13来源/32图是上一轮局部记录，不当作当前完整App证据。

完整App先运行原驱动：8组224项通过；新增“截图定位之前，焦点须在视口内且不被遮挡”检查后，390px原页面从短末页返回长首页失败。原同步回焦保留了DOM焦点，但列表增高把页码推到视口外。产品turnPage现于nextTick后复查同一状态节点的连接、inert和焦点所有权；只有越界或中心被遮挡时，使用瞬时居中滚入视口。已经可见则不滚动，焦点转移/节点移除/不可交互则不干预。没有改变页码、查询、筛选、选中模板、数据、权限或API。

新的原生Enter/Space/Tab测试先检查实际可见性和中心命中，再执行截图定位，避免用截图滚动掩盖故障。原驱动整体SHA固定为01db5a52a7073d15d9964b0fad8b451f9da44bf1725a51bfea84e3d677666907，新增入口通过精确锚点增加检查并重定向独立输出；原驱动、原断言和请求夹具不修改。C预览明确比较完整当前子组件script；仍包含既有壳层审核变换，不能说壳层未经变换。

实际截图还暴露C审批记录的橙色说明、纸色字段背景及双列贴合。仅在既有C预览选择器内增加蓝色来源说明、白底透明字段、去旧边线、允许换行和24px列间距；不修改生产默认外观、已批手机筛选/空态、状态文本或技术字段。r1为焦点接续但尚有旧色的对照图，r2去旧色但列间距待修，r3是本批最终稿；两份早期完整图包作为设计前后对照保留，不能当当前来源证明。

### 当前验证

- 49项分页语义/滚动所有权测试＋9项查询＋3项App驱动保护，共61项通过。新增渲染前后焦点转移、inert、移除、可见/越界/遮挡分支。驱动测试最初误扫描了替换字符串，现用AST只检查执行函数，并有提前截图的失败负例。
- 完整App：baseline390/760、review390/760/761/840/841/1440，共8组466项、82图、181份登记来源。审批/模板首页与末页原生回焦、焦点位于视口且中心无遮挡、蓝色计算样式、随后Tab继续翻页、原筛选空态样式签名、模板版本差异和跨页保留、首次500/429恢复及原网络断言均通过。
- 128个本地拦截GET，无业务写请求、意外网络或浏览器错误。此处是实际App与合成数据，不是后端/数据库/真实权限验收；状态图是固定视口，部分详情按原驱动扩高，最高4000px约束保持。
- 修改滚动逻辑后，原子组件四宽双模式240项无截图重放仍通过。build:web含类型检查、252资源预算通过；只改测试/C预览后不重复构建未变产品。
- 最终181份当前登记源、82张PNG完整哈希核对通过。当前来源清单仍不等于全部全站依赖闭包；旧13来源图包、其他历史包的来源衔接及全站门未因此关闭。未运行全站套件，不推断旧失败数量。

### 使用与交付边界

```text
node scripts/verify-ui-phase2-org-approvals-pagination-app.mjs --smoke
node scripts/verify-ui-phase2-org-approvals-pagination-app.mjs
```

--smoke为手机原页面/预览；无参数为上述8组，不写图片；--capture只能独占创建不存在的r3目录，现已有正式包请勿重拍覆盖。新增入口没有生产配置项、依赖或API；OpenAPI、后端和环境文件不适用。没有部署或生产重启，实际焦点修复需随正式前端包发布。跨页源码/既有owner-path改动及C预览尚未确认提交归属，本轮不混合暂存，commit hash不适用。

本轮没有新建一次性临时脚本/日志/截图目录；三个App版本是正式前后对照交付物，均保留。上一轮被策略拒绝删除的p34-pagination-focus-r1/r2仍按下方清单待手动清理，不再次绕过策略。测试浏览器与服务均已关闭。

### 完整App图目录与审核

r3两张审批记录区域已展示：1440-request-technical.png与390-requests-pagination-first-focus.png。请求仅审核蓝色来源说明、白底字段、技术详情及桌面双列/手机单列；新卡片稿待答，原末页小图批准不扩大到此整图。导航、整页、全部弹窗、完整读屏、真实审批与生产均不包含。

| 场景         | 390                                                                                                                                 | 760                                                                                                                                 | 761                                                                                                                                 | 840                                                                                                                                 | 841                                                                                                                                 | 1440                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 审批记录默认 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-requests-default.png)                 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-requests-default.png)                 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-requests-default.png)                 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-requests-default.png)                 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-requests-default.png)                 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-requests-default.png)                 |
| 审批技术详情 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-request-technical.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-request-technical.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-request-technical.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-request-technical.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-request-technical.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-request-technical.png)                |
| 审批首页回焦 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-requests-pagination-first-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-requests-pagination-first-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-requests-pagination-first-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-requests-pagination-first-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-requests-pagination-first-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-requests-pagination-first-focus.png)  |
| 审批末页回焦 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-requests-pagination-last-focus.png)   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-requests-pagination-last-focus.png)   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-requests-pagination-last-focus.png)   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-requests-pagination-last-focus.png)   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-requests-pagination-last-focus.png)   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-requests-pagination-last-focus.png)   |
| 模板默认     | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-templates-default.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-templates-default.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-templates-default.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-templates-default.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-templates-default.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-templates-default.png)                |
| 模板详情     | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-template-detail.png)                  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-template-detail.png)                  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-template-detail.png)                  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-template-detail.png)                  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-template-detail.png)                  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-template-detail.png)                  |
| 模板首版     | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-first-version.png)                    | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-first-version.png)                    | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-first-version.png)                    | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-first-version.png)                    | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-first-version.png)                    | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-first-version.png)                    |
| 模板无结果   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-template-empty.png)                   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-template-empty.png)                   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-template-empty.png)                   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-template-empty.png)                   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-template-empty.png)                   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-template-empty.png)                   |
| 节点变更对照 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-mixed-version-diff.png)               | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-mixed-version-diff.png)               | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-mixed-version-diff.png)               | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-mixed-version-diff.png)               | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-mixed-version-diff.png)               | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-mixed-version-diff.png)               |
| 节点无变化   | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-unchanged-version.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-unchanged-version.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-unchanged-version.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-unchanged-version.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-unchanged-version.png)                | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-unchanged-version.png)                |
| 模板首页回焦 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-templates-pagination-first-focus.png) | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-templates-pagination-first-focus.png) | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-templates-pagination-first-focus.png) | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-templates-pagination-first-focus.png) | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-templates-pagination-first-focus.png) | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-templates-pagination-first-focus.png) |
| 模板末页回焦 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-templates-pagination-last-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-templates-pagination-last-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-templates-pagination-last-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-templates-pagination-last-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-templates-pagination-last-focus.png)  | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-templates-pagination-last-focus.png)  |
| 跨页保留详情 | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-cross-page-selection.png)             | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-cross-page-selection.png)             | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/761-cross-page-selection.png)             | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/840-cross-page-selection.png)             | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/841-cross-page-selection.png)             | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/1440-cross-page-selection.png)             |
| 首次500      | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-first-500.png)                        | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-first-500.png)                        | —                                                                                                                                   | —                                                                                                                                   | —                                                                                                                                   | —                                                                                                                                    |
| 首次429      | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/390-first-429.png)                        | [查看](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/760-first-429.png)                        | —                                                                                                                                   | —                                                                                                                                   | —                                                                                                                                   | —                                                                                                                                    |

[当前r3完整证据](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r3/evidence.json)；[旧色r1对照](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r1/390-requests-pagination-first-focus.png)；[列间距修订前r2](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-app-c-r2/1440-request-technical.png)。

## 用户局部批准记录

用户回复“两张分页焦点组合通过，继续其他状态”。仅批准r3的以下两张图中的蓝色页码焦点、可用上一页及灰色禁用下一页组合：

| 文件                          | SHA256                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| review-requests-last-390.png  | 757251ce723819e96d8689029516263a10f0343c066b221f043f2450af602c67 |
| review-templates-last-390.png | 7df0a65b5152bc7780d925efffc945f049483a8ef51304737fb33fd8a50d6967 |

不包含首页、桌面、整页布局、完整读屏、真实权限或生产验收。采集时manifest的pending不回写为全包通过，后续批准以本段为准；其他历史批准保持原范围。

## 改动与事实依据

真实 OrganizationApprovalPanel 的两组分页原来直接执行 page++/page--。新增浏览器验证首先在390px审批末页复现：按钮已禁用，焦点没有留在同一分页区，边界焦点断言失败。

沿用现有P47局部模式，新增 turnPage：只在即将到首/末页、原生按钮实际持有焦点时，先同步聚焦同一footer的常驻页码，再执行原来的加减。两组页码增加 tabindex=-1、status/polite/atomic；不是新增Tab停靠点。其他焦点所有者、非按钮、inert/已移除/不存在的目标不抢焦点。原生禁用条件、8/6条页大小、排序筛选、模板选择、查询恢复与API保持。

原页面使用既有通用焦点配色，仅新增页码:focus-visible；C预览只为该页码补上已有蓝色焦点规则，正常未聚焦布局不改。C模板组合复用既有previewApprovalsVue，验证其完整script与当前产品相同，不将独立子组件宿主冒充完整App或生产页面。

## 验证与限制

- 新29项永久单测，加原查询9项，共38项通过。涵盖双视图、双方向、边界/中间页/其他焦点/inert/移除/缺失/非按钮与真实Vue编译、原分页边界。
- 原页面四宽度112项通过后，补C组合为8组；最终240项、32张局部图通过。Enter翻页、中间页留焦点、首尾页禁用及页码回焦、随后Tab抵达相反按钮、程序触发不抢焦点、保留无关URL参数、零API/外网请求及零浏览器错误均检查。
- 首次C颜色检查在界面更新过程中读到灰色；保留精确蓝色断言，等待页面帧及有界3000ms的计算样式条件后检查，没有降低颜色标准或注入焦点样式。最终捕获再次执行完整矩阵。
- 既有真实Vue查询恢复手机smoke19项通过；build:web（含类型检查）和252资源预算通过。没有重跑全站单测，不推断既有全站失败数减少。
- 最终图包13份登记源码、32PNG完整SHA核对通过。该清单不是完整App/所有动态依赖的证明；不是逐像素旧版回归、完整读屏或真实权限验收。
- 已有历史图/批准不覆盖。本次产品和C预览CSS变化使登记旧源码的包不再等于当前文件，相关历史来源与当前整页回放仍须衔接；不能把此前通过的来源门视作本次全绿。

## 使用与运行

无参数重放：

```text
node scripts/verify-ui-phase2-org-approvals-pagination-focus.mjs
node scripts/verify-ui-phase2-org-approvals-query.mjs --smoke
```

原--capture只允许创建不存在的r3目录，已存在会拒绝，日常复测不要使用。无新增生产环境变量、配置、依赖、接口、数据库或权限要求，OpenAPI及后端无需修改。当前未部署，不要求生产重启；未来随正式前端包发布。

本轮早期r1原页面图和未通过颜色门的r2局部图仅用于验证。已核对精确路径并尝试收尾删除，但工具策略拒绝，未换工具绕过。以下两个本轮临时目录仍在，需用户手动删除；r3是要求的正式审核交付图，不删除。

- D:\\项目工程文件\\vue\\curson\\工具\\智能选品\\output\\playwright\\p34-pagination-focus-r1
- D:\\项目工程文件\\vue\\curson\\工具\\智能选品\\output\\playwright\\p34-pagination-focus-r2

浏览器/服务由finally关闭；原工作树跨页改动与本组件已有owner-path修复不混合提交，commit hash不适用，提交归属检查点仍待用户确认。

## 审核目录

仅review行是本轮C分页焦点组合；baseline行是实际原页面对照，不是新设计方向。两张手机末页图已获上述局部批准，其他图仍待审。先前P34权限白区批准不扩大，登录失效白区仍待审。

| 组合   | 宽度 | 审批记录                                                                                                                                                                                                                                                         | 模板目录                                                                                                                                                                                                                                                           |
| ------ | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 原页面 |  390 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-first-390.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-last-390.png)   | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-first-390.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-last-390.png)   |
| 原页面 |  760 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-first-760.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-last-760.png)   | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-first-760.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-last-760.png)   |
| 原页面 |  761 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-first-761.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-last-761.png)   | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-first-761.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-last-761.png)   |
| 原页面 | 1440 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-first-1440.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-requests-last-1440.png) | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-first-1440.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/baseline-templates-last-1440.png) |
| C组合  |  390 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-first-390.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-last-390.png)       | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-first-390.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-last-390.png)       |
| C组合  |  760 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-first-760.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-last-760.png)       | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-first-760.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-last-760.png)       |
| C组合  |  761 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-first-761.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-last-761.png)       | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-first-761.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-last-761.png)       |
| C组合  | 1440 | [审批首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-first-1440.png) / [审批末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-requests-last-1440.png)     | [模板首页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-first-1440.png) / [模板末页](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/review-templates-last-1440.png)     |

[完整数据与源码指纹](D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p34-pagination-focus-r3/evidence.json)
