# P37 复制反馈归属 · 实际 Vue 局部修复

2026-09-11后续：[分页响应归属修复](P37-PAGINATION-OWNERSHIP-REVIEW.md)另有192项当前父链检查/40图。下文分页未修为本批采集时状态；原16图不动，证据source关联由可逆journal记录。旧copy-bindings无参数保留历史层检查，存在分页journal时禁止其--write；后续关联写入使用refresh-ui-phase2-audit-page-bindings.mjs。

起点 main / c380b995b3a6d55d7f1742dc42baf9479be0e8e7；保留先前 P36/P37 未提交工作。本项只修复已复现的 P37-LATE-COPY，不代表全73页重构完成。

[16张当前实图](../../output/playwright/p37-copy-ownership-vue/index.html) · [62项双端检查](../../output/playwright/p37-copy-ownership-vue/evidence.json) · [旧28张问题图](../../output/playwright/p37-parent-read-vue/index.html)

## 改了什么

实际 OrganizationAuditPanel 增加复制发起代次、记录与路径/活动状态保护。选择其他记录（包括 A→B→A 和重选）、过滤导致详情切换、记录对象替换或当前 ID/组织/请求号/追踪号变化，使旧反馈失效。KeepAlive停用、路径离开、卸载清除反馈；返回后不恢复旧结果。连续复制以最后发起为准，旧成功/失败均不能覆盖新反馈。

保留 navigator.clipboard.writeText(value) 参数、两字段成功/失败文案与模板。新复制先清旧反馈，完成后更新。不添加缺失ID禁用、等待按钮或自动重试，不改变筛选/分页/读取政策。

## 依据与验证

原父子宿主复现：复制request-001，切至request-002，旧完成错误显示“已复制”。7项直接回归以真实Vue reactive/computed/watch执行当前SFC脚本；生命周期在该层显式触发，另用真实挂载补齐证据。

当前浏览器验证不替换SFC：真实父组件/API client与真实子组件在Router/KeepAlive宿主分别覆盖上下文，390/1440双端62检查、16图。父链覆盖迟到结果、连续复制、A→B→A、离页/重挂载；子链覆盖过滤回退、同ID字段变化、列表替换/清空。4次GET均为本地审计样例，复制用内存Promise模拟成功/拒绝，不访问生产或系统剪贴板。图片仍是旧实现外观，不是C视觉重构完成。

3项证据测试固定当前源码/16图、314旧设计图、模板与全部非复制语句不变；28项P37定向单测及Web类型检查通过。首轮最小浏览器检查因宿主在路由就绪前挂载超时，修正宿主等待router.isReady后通过；产品路由未变。

## 历史证据不改写

`scripts/lib/ui-phase2-audit-copy-baseline.mjs` 固定基线commit和三文件前后SHA256，未知变更失败关闭。设计数据继续执行基线函数；原data.js的sourceChecks描述采图时发现，不冒充当前行为。旧父子验证打印historical baseline replay，仅在验证宿主加载原哈希对应子SFC，生产不引用该工具。

旧28图/清单/图册不变。原104、字段38、控件172共314设计图原字节保留；三个清单只增加复制局部来源关联，保存原清单哈希、来源哈希与保留关系，可重建原清单核验。批准状态不变，当前证据另列。

全UI回归发现P36父级预加载了未渲染的Audit子模块，其r2读取清单仍绑定旧哈希，导致553/554通过。仅为该清单增加明确的“未渲染P37导入、复制局部变化”关联并保留原清单哈希/28图，未改P36产品代码、测试断言或行为。随后定向P36测试及原父链复验，避免以删掉依赖检查掩盖来源变化。

P36读取C稿还引用该父级清单，其保留关系一并显式关联并保存旧哈希，50图不变；相关依赖链共5份清单，没有删除哈希检查。P36父链178项和读取C稿442项另行复验，范围不扩展为P36视觉批准。

```powershell
node --test tests/unit/ui-phase2-org-audit-copy.test.mjs tests/unit/ui-phase2-org-audit-copy-evidence.test.mjs
node scripts/verify-ui-phase2-org-audit-copy.mjs --smoke
node scripts/verify-ui-phase2-org-audit-copy.mjs
node scripts/refresh-ui-phase2-audit-copy-bindings.mjs
node scripts/verify-ui-phase2-org-audit-parent-read.mjs
```

最后一条仅回放历史问题；当前修复使用新的copy验证器。更新当前图才用其`--capture`，不得覆盖历史目录。复用现有Playwright/Vite，未安装依赖。

## 未改与交付边界

父级旧分页追加、URL/缓存返回恢复、已应用条件与查询失败区分尚未修复；P37完整C、真实权限/范围切换/OS剪贴板/生产及整页验收未完成。本项不注销跨页OG-G05，P36轮换窗及其他未答视觉仍待审。

无API/OpenAPI、后端、Worker、Python、数据库、权限、依赖、env或部署配置改动，相关消费者无新合同；仅前端显示归属，无可调参数。正式发布需重新构建并部署前端静态包，后台不因此需要重启，本轮未部署。

既有P35直接色值全局门失败且修复授权未答，不重复未变失败测试，不提交/部署混合工作树；commit hash不适用。16 PNG和index/evidence共18文件为永久审核交付，目录`output/playwright/p37-copy-ownership-vue/`。无临时脚本、日志或下载文件；浏览器/隔离服务finally关闭，保留既有依赖缓存。

最终复核：第二阶段UI测试554/554通过；当前复制无参数复验62项、P37原C/字段/控件回放、历史父链116项、P36当前父链178项/读取C稿442项通过。73路由、153文档、运行说明、Web类型及生产前端构建通过。未运行真实后端/生产/OS剪贴板验收，不声称全项目门禁全部绿色。

构建更新项目正常输出 `apps/web/dist/` 与 `apps/web/public/browser-helper/scoutops-browser-helper.zip`，属于项目运行产物，保留不按临时测试文件删除。临时服务端口50603/50715/50742/50765/51207/51442/51556已确认无监听，不终止其他任务进程。
