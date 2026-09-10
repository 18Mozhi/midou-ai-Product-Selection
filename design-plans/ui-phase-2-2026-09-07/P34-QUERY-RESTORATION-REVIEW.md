# P34 审批模板 · URL 历史恢复修复

2026-09-10，基线 main/8e117f80。仅修复真实 OrganizationApprovalPanel 的查询同步，不实施尚未批准的 C 视觉；template、样式、只读业务和版本差异算法保持不变。

## 原因与改动

原组件只在创建时读取13个查询键，之后仅由本地ref调用router.replace。现有组织后台E2E标题虽含“恢复URL状态”，实际只测试reload，未测试同一实例内的前进/后退。新增真实Vue响应性测试先复现5项失败，再修复并通过全部7项。

新增route.query反向监听，复用原有选项、200字符初读规则、正整数页码规则。恢复时把两组筛选和页码作为同一批处理，暂时跳过本地筛选回第一页和URL序列化，防止刚恢复的页码被清掉。用户随后编辑筛选仍按原规则回第一页。

本地写入URL使用内容指纹和请求代次标记，自己的旧replace回执不会重新水合字段、覆盖后来输入或把手输长文本截成200字。默认值删除、无关query保留、使用replace而非每次输入push等原合同不变。不同route.path既不反向恢复该面板，也不接收该面板滞后的序列化写入。

没有新增查询键、接口、权限、数据结构或依赖；没有新增选择模板ID的URL持久化。外部非法查询仍按原读取规则回默认，不在水合时擅自改写来访URL。原页数随返回数组变化的夹紧规则保持。

## 验证证据

- `tests/unit/ui-phase2-org-approvals-query.test.mjs`：执行真实SFC脚本，使用Vue真实ref/computed/watch/effectScope/nextTick。7项覆盖两视图恢复、筛选与页码批处理、非法值、旧replace回执、手输长文本、跨路由及停止作用域。不是DOM挂载证据。
- `scripts/verify-ui-phase2-org-approvals-query.mjs`：隔离宿主挂载真实子Vue与真实Vue Router/createWebHistory。38项双端检查、8张真实子组件截图，验证同一uid下浏览器Back/Forward、外部查询、刷新、局部编辑、卸载与横向溢出；零API/外部HTTP及浏览器错误。
- [真实Vue证据清单](../../output/playwright/p34-query-restoration/evidence.json)。数据来自原组织夹具，并明确增加6个合成模板用于第二页；不声称父页面加载、真实SQL、权限、生产或全页C验收。
- [手机模板恢复图](../../output/playwright/p34-query-restoration/templates-restored-390.png) · [桌面返回记录图](../../output/playwright/p34-query-restoration/back-requests-1440.png)。这是原有页面视觉下的局部功能证明，不是新C设计稿。
- 原90张C图稿由原验证器重验并更新来源记录，数据事实/离线renderer/布局未变。原数据助手只显式执行回调，不再保留“没有反向监听”的错误现状断言。

首轮浏览器宿主在router初始化完成前挂载导致默认页不匹配，已调整隔离宿主为install→isReady→mount后通过；没有据此改变生产初始化顺序。

截图目检后补入真实令牌/全局样式与原theme-main容器。单独放置org-admin-center时原手机负边距溢出，恢复其实际父容器后双端通过；没有修改产品CSS，也未把该宿主差异当生产缺陷修复。

## 使用与部署边界

无需新配置。访问原 `/org-admin/approvals` 查询链接，使用浏览器前进/后退即可恢复记录/模板两组状态。单纯改变本地筛选仍替换当前历史条目，不新增每次按键的历史记录。

```powershell
node --test tests/unit/ui-phase2-org-approvals-query.test.mjs
node scripts/verify-ui-phase2-org-approvals-query.mjs --smoke
node scripts/verify-ui-phase2-org-approvals-query.mjs
```

`--capture`重建8张永久子组件验证图；无参数先检查源图哈希再重放双端。宿主使用探测到的空闲本机端口，严格绑定127.0.0.1，finally关闭浏览器和Vite；不新增常驻服务。

本批未部署。后续须按既有宝塔部署流程交付前端构建；不能把该修复称为已在线生效。无需新增环境变量或运行参数；实际部署器的Node停止/迁移检查/恢复门仍遵守现有发布约束。完整C样式、逐控件图、全父级生命周期、多实例/KeepAlive及真实后端验收仍未完成。

最终验证：687/687完整单测通过；原组织后台筛选/分页/reload用例桌面、手机各1通过（隔离HTTP，并非真实后端）；前端类型检查/构建、资源预算、静态检查、文档及审核入口门通过。8张实图与证据为永久交付，测试临时文件/下载/进程已清理，构建输出与依赖缓存保留。
