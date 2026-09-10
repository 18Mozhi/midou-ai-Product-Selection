# P38 完整壳层：缓存切页遗留详情窗修复

2026-09-11；起点main/3023a030。继续第二阶段完整实施；本批修复真实接入缺陷，不把旧全局样式当作 C 重设计稿或批准。

## 原因与实现

实际 main.ts → router/route-catalog → App → NavigationShell → KeepAlive → PlatformDashboard → ResponsiveDataView 链路中，详情窗 Teleport 到 body。旧实现只在关闭/卸载时释放背景；KeepAlive 停用并不卸载，因此浏览器返回来源频道后旧窗与 #app inert 一起遗留，目标页无法操作。

仅在共享 ResponsiveDataView 增加onDeactivated钩子：清空selectedKey、旧触发器引用，调用既有releaseBackground恢复各元素原始inert并断开监听。未重建/清空页面数据、表格列/冻结/密度或父壳缓存；未加路由专用DOM清理或修改业务操作。

模板/CSS、五个候选签名、20个消费组件源码逐字保持。当前P38/P54来源登记与共享历史合同的精确指纹接续同步，不把共享修复等同全部消费者验收。

## 实际应用证据

[修复前图册](../../output/playwright/p38-shell-lifecycle/baseline/index.html) / [修复后图册](../../output/playwright/p38-shell-lifecycle/current/index.html)。各5张现行样式截图，包括双端正常页、手机开窗和切回来源页。全部HTTP为测试GET，来源目录为空样例；不连接真实服务、数据库或权限系统，不发送写请求。没有重新设计/批准这些旧样式。

四宽度390/760/761/1440，各走来源频道 → 点击真实品牌入口进入概览 → 浏览器返回/前进 → 7d范围选择。实际DOM探针确认概览为同一缓存实例；没有用假父壳或空目标路由替代。导航响应只读取一次，仪表盘24h读取两次、7d一次。

- 旧组件精确回放3023a030：390/760离开及返回均遗留1个可见详情窗、背景inert=true。
- 当前实现：四宽度离开及返回均无旧窗，inert=false。手机可重新打开、Escape关闭并返焦；桌面紧凑密度及未冻结状态跨缓存保持。
- 两端正常页的修复前后PNG逐字节一致；功能差异只在停用清理。两个模式共8组流程、16次离开/返回观察、10张图，另复跑共享组件10组焦点/嵌套确认/原因窗检查。

`verify-ui-phase2-platform-shell-lifecycle.mjs --capture --baseline`只替换确切旧共享组件源码；其他应用文件均按证据中的当前指纹加载。`--capture`生成当前回归图；无参数执行当前行为检查但不改图。基线不是当前验收通过，元数据明确区分回放模式和现行源码指纹。

## 回归与图像边界

新增永久 `responsive-data-view-lifecycle.test.mjs`：实际脚本清理/idempotent/重新打开、原inert保存、监听断开、精确最小diff与20消费者不变、完整应用双模式图证、正常态像素相同。共享和生命周期最小验证5/5通过。

21个直接或经共享验证辅助器间接受影响的HTML提案复跑原验证器；P38实际Vue42图/36组、工具栏18图/20组、入口8图/20组/52次点击、来源组合16图/28组及共享焦点4图/10组重新采集。HTML提案仍不是实际Vue。

上述26个证据集共3511张既有图片，重捕获产生的逐图差异、前后哈希、坐标与数量见[本轮捕获差异](detail-lifecycle-capture-review.json)。尺寸不变，不放宽全局像素容忍或用户批准。旧共享焦点和复制捕获链通过本轮明确的反向哈希接续保留原始含义；新增修复前后10图单独计算。

最终结果：37张有已记录的边缘像素差异，每张最多101像素、最大通道差13；全量单测通过，最终图证同步后23项相关回归再次通过。Web类型/生产构建、前端体积门、153项文档门和格式门通过；主设计审计102包/15069原PNG，来源与图片漂移均为0。动作登记仍39页，不代表完成39页；所有批准与全页完成门保持未通过。

```powershell
node --test tests/unit/responsive-data-view-lifecycle.test.mjs tests/unit/responsive-data-view.test.mjs tests/unit/responsive-data-view-focus.test.mjs
node scripts/verify-ui-phase2-platform-shell-lifecycle.mjs
node scripts/build-ui-phase2-detail-lifecycle-capture-review.mjs
```

## 运维与未完成项

无API/OpenAPI、权限、数据库、配置、依赖、后端/Worker/Python变化；Feature Map仅记录前端生命周期。使用方式不变：手机查看详情、浏览器返回/前进；不新增调节项。

本轮不部署。未来随获审版本本地构建并按固定宝塔命令上传、刷新浏览器；此纯前端变化不需要API/Worker/Python重启，部署器自身停服行为仍服从发布门。所有临时Vite和浏览器在finally关闭。baseline/current共10PNG及4个索引/证据为永久交付。

清理限制：删除初次诊断7个根层暂存文件的命令被执行环境策略拒绝，未尝试绕过；这些文件未提交，不是正式图证。目录为`D:/项目工程文件/vue/curson/工具/智能选品/output/playwright/p38-shell-lifecycle/`，文件分别是`390-ready.png`、`390-preview-open.png`、`390-left-overview.png`、`1440-ready.png`、`1440-left-overview.png`、`evidence.json`、`index.html`。可由用户删除这7个文件；保留其下baseline/current两个正式目录。该清理项尚未完成。

仍待P38各局部C视觉批准、ready刷新401/403旧快照策略、其他来源消费者真实操作/角色/跨页写入交接、全主题与缩放以及全73页生产验收。当前仅覆盖P38到来源频道的真实缓存链，不宣称整个壳层所有路由通过。
