# P35 等值颜色令牌迁移

2026-09-11，main/c380b995起点；保留前轮P36/P37/P38工作。当前P34手机模板筛选已真实实施，不重复修改。P35颜色门不涉及未明确业务规则：按可逆局部技术调整规则实施，解除此前多余的授权阻塞；不把未答问题当用户批准。

## 变更与不变

`apps/web/src/design/export-detail-tokens.css`定义14个局部角色，仅匹配`html #app [data-export-detail-c] .org-data-export-list`，由原详情CSS本地@import按组件加载，原CSS仍只在760px以下使用。所有色值原样保留，四个原内部变量保留别名；没有全局主题默认值或依赖变化。

OrganizationDataPanel.vue逐字不变。CSS去掉唯一新增import并精确展开变量后，与c380b995原文件逐字一致；改字号、间距、颜色或选择器不能通过此证明。主题测试仅允许新token文件在精确选择器声明受限前缀变量，普通CSS继续禁止硬编码颜色，不豁免原失败文件。

## 当前证明

[144组检查/4图清单](../../output/playwright/p35-export-token-equivalence/evidence.json)：140次像素比较=390/760/761/1440 × 正常、null/0夹具、未知、排队、等待重试、成功、失败 × 折叠、展开、键盘焦点、悬停、按下。真实当前Vue与同一Vue内联迁移前CSS分别渲染，整个数据子面板像素逐字节一致，桌面亦保持。

[390正常](../../output/playwright/p35-export-token-equivalence/390-normal-open.png)、[390尚未生成](../../output/playwright/p35-export-token-equivalence/390-zero-open.png)、[760正常](../../output/playwright/p35-export-token-equivalence/760-normal-open.png)、[760尚未生成](../../output/playwright/p35-export-token-equivalence/760-zero-open.png)。zero夹具含null和0，整面板比较覆盖两者；局部图仅首条“尚未生成”，不冒称0行图。

```powershell
node --test tests/unit/theme-and-icon-completion.test.mjs tests/unit/ui-phase2-export-detail-tokens.test.mjs
node scripts/verify-ui-phase2-export-detail-tokens.mjs
```

默认校验当前源和既有4图、不重拍；`--smoke`手机两场景、不写文件；明确更新当前证明才用`--capture`。现有合成样例与本地Vite，禁止API与外部请求，不证明真实导出、数据库、权限、原生缩放或生产。没有新业务CLI/config/env参数。

首次宿主虚拟CSS路径失败，未得到有效对比；改为只在基线虚拟SFC内联旧CSS后，11组手机最小检查及144组完整检查通过。当前SFC及CSS仍是真实加载。主题5项、迁移3项、第二阶段UI569项及Web类型/构建通过。

## 旧证据保留

旧24实图与P35/P36/P37清单保持本轮前字节。它们是迁移前捕获，原CSS hash为b258adf5…，不宣称当前文件原始hash相同。受影响历史测试仅用`capturedExportDetailHash`对这一文件做精确逆向并校验原hash；其他文件逐字校验。新144组证明另绑当前CSS、token文件及验证器原始hash，和历史层分开。

旧独立浏览器脚本若因CSS来源hash拒绝重跑，是捕获时来源漂移的失败关闭；不改旧脚本或旧hash来冒充新捕获。本次当前重跑入口是新验证器。旧读取/复制行为证据仅在业务源码未改且等值CSS证明成立的范围内复用；后续真实布局/行为变化须重新生成对应当前证据。

P37两种来源关联命令无参数校验仍通过，旧journal不改，新P35证明不纳入早先分页关联重写。具体视觉审批不变，整页和全73页完成仍未成立。

## 运行收尾

4PNG和evidence共5个永久文件保留在`output/playwright/p35-export-token-equivalence/`。未创建临时文件、日志或下载；验证浏览器和服务finally关闭，保留正常Web构建输出。端口5173/55862/56047关闭状态在最终收尾检查核对。

没有API/OpenAPI、数据库、权限、后端/Worker/Python/env/依赖变化；相关生产契约不适用。没有部署或生产重启，未来仍走本地构建及宝塔流程。提交及完整验证状态见本次最终记录，不以此技术门替代视觉批准或生产验收。

最终验证：完整单元测试822/822通过，Web类型/构建、73路由/153必需文档、运行说明及代码格式门通过。主图审计102包/15069PNG零源或图漂移；P38补充链接最初误入主图包解析，已用独立补充报告入口纠正并复验，16补充图仍独立验证。来源关联两命令无参数检查通过。端口5173/55862/56047已确认无监听，git diff --check通过，无新增临时产物。构建保留项目正常dist与浏览器助手zip。

本次提交包含同一目标此前待提交的P36手机筛选/查询恢复、P37复制/分页归属及P38局部图稿，均已在各自报告中界定验证和未完成范围；不把提交视为全套C或生产完成。旧批次中的“P35门待答/未提交”是当时状态，以本节和最终Git结果为当前交接。
