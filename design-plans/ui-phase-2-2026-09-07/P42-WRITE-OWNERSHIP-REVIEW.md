# P42 组织操作归属 · 实际代码修复

起点 `main/aa611c40`。上一批已复现的关闭/离页问题，本批进入真实生产源码修复；不是仅审核模板修补，也未部署。刷新失败分层提示仍待用户决定，没有把整页或全73页标为完成。

[修复后28张实际Vue图](../../output/playwright/p42-write-ownership/current/index.html) · [修复前28张回放](../../output/playwright/p42-write-ownership/baseline/index.html) · [原问题基线](P42-WRITE-LIFECYCLE-REVIEW.md)

## 实际改动

`PlatformAccountCenter.vue` 把组织保存/停用/恢复两个动作移入 `use-platform-organization-actions.ts`。父模板、字段约束、用户/角色/密码/创建等其他动作不变。提取用于遵守原850行父组件限制，没有放宽体积门。

专用组合函数捕获操作代次、原组织身份及原路由；关闭、路由/organizationId变化、缓存停用与卸载都使旧操作失效。失效时仅取消仍属于该组织动作的未提交原因，不能误取消已经被用户操作替换的共享原因窗。确认前、成功/失败返回后都检查归属，同组织关闭再开也不能接受旧回执。

父write只对组织调用提供可选内部归属检查：写完已失效时不启动概览重读；已开始重读而后失效时，不接纳迟到数据/错误，也不调用同步详情。原load仍为无参事件入口，内部loadAccounts接收可选检查，避免把刷新按钮的MouseEvent误当检查函数。未提供检查的其他写入及普通刷新保持原读取方式。

不会撤销已经发到服务端的请求，不能承诺关闭即取消保存。关闭后旧回执不自动刷新当前列表；需要查看最新状态时使用原“刷新”操作。三个字段仍可在等待时编辑、关闭仍可用；未新增冻结草稿策略，未修改确认时读取同一表单的既有方式。保存PATCH与状态POST的URL、字段、状态值、幂等键不变；恢复仍是active，停用仍是archived。

## 验证与证据范围

当前和修复前回放均为390/1440、保存/停用、四场景，共各16场景、98检查、28图。当前关闭后成功/失败都不重开或写入隐藏反馈；返回列表撤销原因，不发送写入。修复前同样步骤复现旧问题。当前“写成功、重读失败”场景仍显示旧资料配成功提示，证据明确保留为待解决，不把98检查全部等同于产品验收通过。

15项直接回归执行实际父函数和专用组合函数：旧版重开对照、成功/错误归属、同ID新打开、保留的旧确认回调、其他原因窗不受影响、正常保存/停用/恢复、读取期间失效的成功/失败、其他父函数文本与模板不变。3项新证据检查校验两批精确图片/来源、请求次数及已登记历史修订失败关闭。钩子接线在直接测试覆盖；本批浏览器仍为隔离Vue宿主，不据此宣称完整App/NavigationShell/KeepAlive实际切页已验收。

扩大验证：650项相关UI/前端单测全部通过；原P42正常流程141项浏览器检查在当前代码上再次通过且不重写旧图；build:web包含类型检查并成功构建417模块，文档与格式门通过。父组件831行仍低于850行，专用组合函数101行。

## 历史材料保持原意

原P39–P42视觉图、原28张问题图及其evidence不改写。两个旧提案数据构建器明确回放aa611c40父脚本；它们只提供原夹具/旧惰性诊断，不用作当前修复证明。七组旧预览测试通过精确before/after散列绑定读取历史来源，新回归和新图则直接绑定当前源码。

总设计审计将这三个有明确修订的源绑定标为 `historical-LF-exact-revision-not-current-acceptance`，同时保留真实当前hash；不是任意忽略漂移，也不把旧截图宣称为新运行结果。未知修订会失败关闭。专用组合函数的新当前证据与旧图来源分开检查。

旧 `verify-ui-phase2-organization-write-lifecycle.mjs` 是修复前诊断，不再作为当前校验入口；需回放使用下面的 `--baseline`。旧文档中的命令属于当时时点，不重复生成或覆盖原审核图。

## 使用与复验

```text
node scripts/verify-ui-phase2-organization-write-ownership.mjs
node scripts/verify-ui-phase2-organization-write-ownership.mjs --baseline
node scripts/verify-ui-phase2-organization-write-ownership.mjs --capture
node scripts/verify-ui-phase2-organization-write-ownership.mjs --baseline --capture
node --test tests/unit/platform-organization-action-ownership.test.mjs tests/unit/ui-phase2-organization-write-ownership.test.mjs
npm run build:web
```

默认不改图，capture只写本批current/baseline目录。无新增依赖、环境变量、外部参数或可调配置。API/OpenAPI、Node/Python、MySQL、权限与宝塔对象未变，不需要后端重启。上线需完成其余门并按既有部署流程上传本地构建的前端静态包；本批没有运行部署命令。

图稿/证据/永久测试为交付物；浏览器与Vite均finally关闭，未创建验证后应删除的临时文件。build:web产生项目所需的常规构建输出，不作为一次性垃圾删除；旧P38忽略产物未触碰。

收尾已核对49262、49592、49741、50149、50306、50445均无监听。当前与基线证据按最终验证脚本重新生成，原P39–P42历史PNG与evidence没有改写；本批56图保留在p42-write-ownership/current与baseline作为永久交付物。

## 剩余事项

写成功但刷新失败提示待答；完整应用缓存切页、跨组织导航、多次重叠写入、实际权限/持久化/审计仍需验证。其他账号与创建流程的已记录异步风险未顺手改动。P42具体视觉批准及完整C生产接入、全73页实施和宝塔最终验收仍未完成。
