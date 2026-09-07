# H02：平台账号详情读取生命周期合同

日期：2026-09-08。实施起点main/658d054；接续已有`m06-01-platform-accounts.spec.ts`三例UI2-PA01差异。此记录只覆盖P43/P44共用账号详情的读取生命周期，不是W05八页全部动作盘点或正式设计交付。规格仍40/73，用户设计通过仍0。

## 1. 真实调用链与问题

Feature Map `platformAccountManagement` → route-catalog的platform-account-center → NavigationShell共享缓存键 → PlatformUserRecords/PlatformAdminRecords的open-user → PlatformAccountCenter使用usePlatformUserDetail.openUserDetail → createApiClient → `GET /api/v1/platform/accounts/users/:userId` → PlatformUserDetailDialog。

接口继续要求platform:superadmin，返回账号、组织关系及非秘密会话元数据。前端通过已有API客户端读取；没有新增请求字段、路由、超时、重试或环境变量。概览和角色目录的12秒超时不能当作详情GET已有超时，详情本批未新增超时。

原父组件在请求返回后无条件赋值detail/detailError。子组件的标题、组织关系和会话来自detail，角色与写操作目标使用selected：关闭甲后打开乙时，甲的迟到数据会覆盖乙窗口，而selected仍指乙；同一用户重新打开也会被旧读取覆盖。既有red-detail三个实例分别复现旧成功覆盖、旧错误污染、同用户旧读取覆盖；它们是隔离Vue证据，不是实际误操作或生产事件证明。

## 2. 本次实现与不变量

| 入口/事件 | 必须保持的结果 |
| --- | --- |
| openUserDetail(item) / 当前窗重试 | 建立新sequence，捕获userId与routePath，清空旧详情，显示正在读取；仅同代次、仍打开、selected同ID且路由相同的成功或错误可显示 |
| 关闭按钮或Escape | 增加sequence，关闭窗口、清空detail和详情反馈；不清空被组织及密码窗口共用的selected |
| routePath变化 | 同步失效并关闭账号详情；不使上一用户窗口留在新的账号子路由上 |
| KeepAlive离开 / 卸载 | 失效并关闭；返回后需用户再次打开，不复活旧详情 |
| 请求已发出后失效 | 允许原读取完成，但丢弃其显示结果；不自动重放写入、不更改后台结果 |

保留useModalDialog原生模态、Escape和焦点合同；无障碍技能用于验证实际可访问名称、键盘关闭和弹窗状态，不修改共享焦点工具或宣称全站辅助技术通过。

初版直接在父页加入生命周期后超过既有850行组件边界，未提高阈值或压行；将详情refs、请求归属与关闭钩子作为完整独立职责移入`use-platform-user-detail.ts`。父页833行，辅助模块63行，组件边界测试增加该模块低于100行及实际装配检查。列表刷新、所有写入及共享selected仍在父页，不抽成新的业务服务。

## 3. 永久验证与证据边界

用例位于`tests/e2e/m06-01-platform-accounts.spec.ts`，由现有Playwright配置使用真实Vue和隔离API合同数据执行。桌面使用表格账号详情入口，390移动先打开摘要预览再进入账号详情，不调用内部Vue方法绕过用户入口。

| caseId | 场景与断言 |
| --- | --- |
| UI2-PA01 stale-success | 挂起甲读取→Escape→打开乙→乙成功→释放甲成功；仍显示乙及当前组织，无旧组织、旧错误；两次详情GET、零账号写入 |
| UI2-PA01 stale-error | 同上，但旧读取返回404；当前窗口不出现旧错误；404不触发安全读取重试 |
| UI2-PA01 reopened-same-user | 关闭后重新打开同一ID；旧成功不能替换新一次读取结果，证明仅比较用户ID不足 |
| UI2-PA02 shared-account-route | 从用户页真实导航管理员页后后退，打开挂起详情，再浏览器前进；原窗关闭。释放旧读取并后退，保持关闭，主动重开得到新数据 |
| UI2-PA02 cached-dashboard | 同上，目标为平台概览以触发KeepAlive离开；返回后的同一原生dialog节点仍被复用，且旧读取不能复活 |

PA02核对返回后的DOM元素身份与isConnected来证明缓存复用。首轮曾错误断言概览GET仅一次，实际五次：父组件对route.query生成新数组的watch会在这些导航触发load。两例失败仅在该计数断言，不能误报为详情修复失败或擅自改产品刷新。修正为直接DOM身份检查，不修改原读取行为。PA01/PA02释放迟到响应后等待200ms，避免负断言抢先通过；这不是产品超时或性能指标。

新用例不读取真实密码、Cookie或系统剪贴板，不发送邮件，不执行角色/会话等生产写入。具体命令、通过/失败/跳过数量及临时材料处理记录在PROGRESS；用例存在不等于全部验证已通过。

## 4. 尚未关闭的边界

- PA-D01：本批隔离的是已经发出的详情GET。toggleUser/role/revokeSessions等写后回调仍可能调用openUserDetail，addMembership仍在写后读取selected；需要独立复现写入完成后的窗口归属，不能把当前修复称作所有读写竞态解决。
- PA-D02：概览/角色目录的刷新、URL历史筛选、组织详情依赖最多200条概览记录、未完成密码表单的明文保留、全部原因窗和焦点归还仍待W05完整盘点。现有API没有的分页/保存/组织详情GET不得因旧矩阵文案补造。
- PA-D03：直接卸载钩子已实现，当前端到端覆盖为同一入口换路由与KeepAlive离开/返回；不同壳层销毁、授权撤回、所有错误类别及真实后端拒绝链不由这五例证明。
- PA-D04：本批未改布局/CSS，未生成正式新设计图或更新旧图库指纹；R01仍需按稳定产品提交核对增量。W05八份独立规格、正式设计、完整行为、生产验收及用户签收仍待完成。

## 5. 源码依据（LF SHA-256）

| 文件 | SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformAccountCenter.vue | 06ea539015a4f47b947a05eae41f5c8c7fe635b11992d5d01bc62fccc58970ae |
| apps/web/src/use-platform-user-detail.ts | e874ad5952d02f4d2e47c3a0c6ef94fdd63b1ddb2801fd4475109bd3a1e88da7 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 27a70088acf71a873b9617c658fc4fbef2399b28b2d52b1354337b2a48040b24 |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/components/NavigationShell.vue | 993d7e1a7dc50f7dab6f839428afd3e5d15fac45b0eff9e762392024d47eab92 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/api/src/platform-account-routes.ts | 79c273a1492f2cc157c72d82ac6ab2b8a950ccb789696c2329d7a6206fefe226 |
