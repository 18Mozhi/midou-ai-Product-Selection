# F04 组织治理八页事实与交互合同

F04b后续：AuditedReasonDialog局部Tab循环修复后，仅刷新该共享文件hash，旧hash在e414e0e。m06-01新增UI2-SM01撤销邀请/资源授权两变体各五项，覆盖三取消路径返焦、草稿重开、两种提交可用态边界和单次版本化提交；不改组织规则或注销其他OG/RP缺口。范围及终态见共享入口合同第11节和PROGRESS。

日期2026-09-08；起点main/9828743，产品源fa09f39；计划修订33fe9c2后继续本批收尾。P29/P30/P32–P37八份规格；P31权限页继续复用原规格与合同，不重写为新成果。状态：规格及局部测试交付，正式方向、完整动作分母、全新图、真实后端/生产和用户签收仍待完成。规格累计40/73不是40页已重设计。

依据AGENTS→Feature Map organizationAdmin→蓝图4.1→route-catalog/NavigationShell的路由和reset_on_scope缓存→真实组件→organization-admin-routes/service/MySQL仓储及audit链。计划矩阵描述不覆盖真实合同。数据库/权限/接口/业务规则不在本次修改范围。

## 1. 局部候选逐项归属

文件简称均位于apps/web/src/components：C=OrganizationAdminCenter.vue；M=OrganizationMemberPanel.vue；W=OrganizationWorkspacePanel.vue；T=OrganizationTeamPanel.vue；A=OrganizationApprovalPanel.vue；D=OrganizationDataPanel.vue；K=OrganizationTokenPanel.vue；U=OrganizationAuditPanel.vue。完整候选ID为文件路径#sig；每个sig在下表出现一次，同行逗号表示同一业务动作的多个源码入口，不以渲染记录数扩张分母。

八文件共108候选：105控件/事件、3弹窗调用候选（父层AuditedReasonDialog组件调用及两处askAuditedReason）。本地没有新原生dialog定义，复用共享AuditedReasonDialog/useAuditedReason/useModalDialog。54处v-model另列输入表，扫描候选不包含所有无显式事件的字段。P31的父转发只标复用，不再次计为新动作。全站G0仍未冻结。

| 文件 | sig（逗号分隔） | 语义归属 |
| --- | --- | --- |
| C | b11692c0597885e3.1 | OG-REFRESH |
| C | 97ed4772fb320d6c.1 | OG-RETRY |
| C | d6b520278ab3dd57.1,5878e30377f290ae.1 | OG-PROFILE-SAVE |
| C | 1cbd108c64b5230c.1 | OG-PROFILE-LOGO浏览器有效性 |
| C | 6a563eeaa67fea90.1 | P30全部成员事件父转发，复用M语义 |
| C | b09d7923228aabe6.1 | P31资源授权父转发，复用已有合同 |
| C | 56b1761955b256ef.1 | D-OG-REASON提交/取消父转发 |
| C | f3515ca45998a840.1 | D-OG-REASON组件调用 |
| C | 7a51bff83af3db69.1 | D-OG-REASON通用成员/邀请/工作区/团队及P31调用 |
| C | e828f4ab0fdb0415.1 | D-OG-REASON令牌轮换/撤销调用 |
| M | 3faa2495a550b3c6.1,0589c9bc31734883.1 | OG-M-INVITE |
| M | 171dd535ef8757aa.1,5fa949f2fa7f314d.1 | OG-M-INVITATION-TAB |
| M | 4f34de62fea95c43.1 | OG-M-INVITATION-REVOKE |
| M | a8d9441ebc6a59ed.1,b937a80e03f88040.1,375006d73f4accaa.1,beaf3d0c1db3450f.1,f3b2f3f668cdb561.1,9472331a8a7f9e19.1 | OG-M-FILTER搜索/状态/角色/团队/排序/重置 |
| M | 1c008f867673db60.1 | OG-TECH |
| M | 8583e0c13eca946e.1 | OG-M-ROLE-SELECT |
| M | 4842f2b67c787729.1 | OG-M-ROLE-ASSIGN |
| M | 01c67ff42b0489fa.1 | OG-M-STATE禁用/恢复 |
| M | bc843bc08e306aa8.1,de6415e79bea088d.1 | OG-M-PAGE |
| W | ee38194d65edc8d9.1,ea9b5ddcd4502f15.1 | OG-W-OPEN头部/空态 |
| W | 7c1ff142d1b797a2.1,bae4e728dfc90592.1 | OG-W-CREATE |
| W | 617ab4a17066056a.1 | OG-W-CANCEL |
| W | 9aeabb6f832c875d.1,18ece981bcb15fca.1,56fb9bb2ac849bf0.1,66725db5db9a8fe8.1,009754681935b22a.1 | OG-W-FILTER状态/重置/清除 |
| W | b4c1c37e889b3212.1 | OG-W-SELECT |
| W | 3619d28a163df5ce.1,d56d9b5edd39513e.1 | OG-W-PAGE |
| W | 08f874283aa537b7.1 | OG-W-STATE归档/恢复 |
| W | 8300243a415c8c66.1,01af8fcac461a03d.1 | OG-W-LINK团队/概览 |
| W | 1c008f867673db60.1 | OG-TECH |
| T | dea8d744b50ed1f0.1,9f5ea38e58a26f78.1 | OG-T-OPEN头部/空态 |
| T | 1ea0ce8ecc982edd.1,bae4e728dfc90592.1 | OG-T-CREATE |
| T | 617ab4a17066056a.1 | OG-T-CANCEL |
| T | cde0a7cecbbc9a09.1,18ece981bcb15fca.1,56fb9bb2ac849bf0.1,66725db5db9a8fe8.1,83a359c9f404cb11.1 | OG-T-FILTER状态/重置/清除 |
| T | 95629c96c6d7c41b.1 | OG-T-SELECT |
| T | 3619d28a163df5ce.1,d56d9b5edd39513e.1 | OG-T-PAGE |
| T | 9fbd42d272c62579.1,917ad4e4a5730305.1 | OG-T-MEMBER分配/移除 |
| T | 76054446429e86da.1,2db399169624cf8a.1 | OG-T-LINK成员/工作区 |
| T | 1c008f867673db60.1 | OG-TECH |
| A | 00f81ad5e8a2f732.1,86f59f25b64551b6.1 | OG-A-VIEW |
| A | f376017b5e1818c0.1,184674807c82ee93.1,3169b6613d3ce948.1 | OG-A-REQUEST-FILTER重置/分页 |
| A | 2a3781fdd41e7df6.1,0b242741fe22e1a9.1,0ab42724896b9cf9.1 | OG-A-TEMPLATE-FILTER重置/分页 |
| A | f6777d94811ef9af.1 | OG-A-SELECT |
| A | 1c008f867673db60.1,1c008f867673db60.2 | OG-TECH审批/模板 |
| A | cb237b82e3d08902.1,a8c2e662cd00ee63.1 | OG-A-LINK审批/审计 |
| D | cd1df6927d5a68fd.1 | OG-D-REPORT |
| D | 874d2aeb7a9f46f2.1,26b1ac38e04c362f.1 | OG-D-VIEW |
| D | 3638b3e1e1d8cad7.1 | OG-D-W-FILTER重置 |
| D | a3740ac6cf7e5072.1,595d56ce2159fb14.1 | OG-D-W-PAGE |
| D | 000799abd17373dd.1 | OG-D-E-FILTER重置 |
| D | ad756c5bd12f75ea.1,17620112cb625463.1 | OG-D-E-PAGE |
| D | 1c008f867673db60.1 | OG-TECH |
| K | 6d8d1a59210a6ea0.1 | OG-K-COPY |
| K | b3a4e8d62ca470a9.1 | OG-K-DISMISS |
| K | ed5969fa99d64044.1,073eb5c8ded40aa0.1 | OG-K-CREATE |
| K | ab0838b07b48fd2a.1 | OG-K-SCOPE四种 |
| K | ee181e5ac85b01ec.1 | OG-K-TTL四快捷 |
| K | 66725db5db9a8fe8.1 | OG-K-FILTER重置 |
| K | 00a635020f530ba8.1 | OG-K-ROTATE |
| K | 5b6c117ef94cbbb0.1 | OG-K-REVOKE |
| K | d27cb4f69e0d30d7.1,169268616bd2a69a.1 | OG-K-PAGE |
| K | 1c008f867673db60.1 | OG-TECH |
| U | 632bdb5521e9f9f3.1,34561042e3eccaf3.1 | OG-AUD-FILTER |
| U | 1f900020f4fabd5a.1 | OG-AUD-ADVANCED |
| U | 8b5af20889c64af3.1 | OG-AUD-RESET |
| U | b521afa3371906f1.1 | OG-AUD-SYSTEM |
| U | 82a3e8539a9df6fc.1 | OG-AUD-SELECT |
| U | 7e32b2d5625cbb6d.1 | OG-AUD-MORE |
| U | 8c33330215c9d2a4.1,84cc90836d3f1955.1 | OG-AUD-COPY请求/追踪 |
| U | 1c008f867673db60.1 | OG-TECH |

## 2. 全部本地输入

| 文件 | v-model数量 | 实际绑定与归属 |
| --- | --- | --- |
| C | 6 | form.name/logo_url/timezone/data_retention_days/default_workspace_id/reason，OG-PROFILE-SAVE |
| M | 3 | form.emails/role_code/reason；其余筛选及角色行用显式事件，在候选表中 |
| W | 5 | form.name/slug/reason、query、sort；状态按钮在候选表中 |
| T | 7 | form.name/lead_membership_id/default_workflow_key/reason、query、sort、selectedMembershipId |
| A | 10 | requestQuery/Status/Workspace/Resource/Sort与templateQuery/Status/Workspace/Resource/Sort；大小写按实际变量requestStatus等 |
| D | 8 | workspaceQuery/Status/Sort、exportQuery/Workspace/Type/Status/Sort |
| K | 7 | createForm.name/ttl_days/reason、tokenQuery、statusFilter、scopeFilter、tokenSort；scope由checkbox事件处理 |
| U | 8 | loadedQuery、form.action/outcome/resource_type/request_id/trace_id/occurred_from/occurred_to |

每个字段的长度、取值、默认值、查询存储与状态见对应Pxx第6–8节。表中的首字母省略写法只用于人读，不引入新字段。共享原因输入另在AuditedReasonDialog中，minimumLength默认2、required，没有maxLength；服务器reason上限500。该UI与服务差异列OG-G03，未改变其合同。

## 3. API、读写与确认变体

API省略/api/v1前缀。C统一使用api-client附幂等键、request/trace ID；无caller signal时12秒超时，GET安全重试仍由现有client负责。真正写入由Origin、capability、同组织、原因、版本/幂等及事务审计约束，不以fixture替代。

| 页面 | 请求与权限 | 写入、弹窗与边界 |
| --- | --- | --- |
| P29 | summary/profile organization:manage，workspaces workspace:manage | PATCH profile；内联表单，无保存确认窗 |
| P30 | members membership:read；邀请/状态membership:manage；角色role:manage | POST invitations、invitations/:id/actions、members/:id/actions、members/:id/roles；撤销邀请、禁用、恢复、分配角色四原因变体 |
| P32 | workspaces workspace:manage | POST workspaces与/:id/actions；内联创建，归档/恢复两原因变体；默认项保护 |
| P33 | teams team:manage；members membership:read | POST teams与/:id/members；内联创建，assign/remove两原因变体；成员动作无expected_version |
| P34 | approvals opportunity:approve | 只读，记录最近100、状态全量、模板最近上一版本差异；无本地弹窗 |
| P35 | data report:read | 只读规模/最近100导出元数据；无质量结论/文件URL/本地弹窗 |
| P36 | tokens organization_token:manage | GET先将到期active置expired；POST tokens及/:id/actions；内联创建、轮换/撤销两原因变体。仅合成明文用于本地测试 |
| P37 | organizations/:organizationId/audit-events audit:read | 精确七条件、50游标、只读详情和页内搜索；不请求治理摘要、不写审计事实 |

除P37外父层均附带summary GET，因此不得依据子接口权限推定低权角色必能看到整个页面。P31资源授权及共享原因的额外变体继续原合同，不在本批重复证明。十种本批原因变体共用同一窗：触发→输入首焦点→最少字数→取消/关闭→焦点归还；确认即结束原因收集，异步写入随后在父层busy执行，错误在父notice，不虚构窗内保留失败草稿。每个业务调用方仍需独立验证，不能靠一个窗的测试替代十类。

## 4. 明文生命周期修复及本批测试

UI2-OG01在原代码复现三类：成功后离开并返回缓存页仍显示；POST在离开/返回之后才响应又显示；主动清除后写后刷新结束又显示。前两例曾因导航details定位错误失败，修正测试后才得到secretPanel数量1而非0的产品失败证据，不混算定位失败。

OrganizationAdminCenter新增明文展示代次，在离开KeepAlive、卸载、routePath/organizationId变化或主动清除时失效；写响应只有当前活动tokens页且代次相同才能赋明文。移除刷新之后的第二次赋值，防止清除被覆盖。创建/轮换/撤销请求、事务、重试、后端结果均不取消或重放。不是全组件加载归属重构，不代表其他页缓存和读写竞态已修复。

UI2-OG01三实例同时核对精确创建body/幂等键、单POST、两次GET（初读+写后刷新）证明导航确实复用缓存。OG02验证角色原因取消零写入、初焦点/归还、409后选择保留和精确角色/版本/原因。OG03验证P34首版和无写按钮、P35的null/0行及只读入口；零浏览器POST不证明GET绝无数据库写入。OG04验证轮换与撤销精确版本/目标/原因、取消零写入、复制拒绝反馈及明文清除。实际通过/失败结果只记PROGRESS，不由用例存在认定通过。

移动导航测试必须读取菜单触发按钮的aria-expanded后打开抽屉；闭合导航以translateX(-105%)移出视口，Playwright isVisible仍可为true，不能据此跳过打开动作。修正的是测试助手，不是产品导航；没有force点击、脚本改DOM或直达URL替代真实SPA返回。

## 5. 已知纠偏与未关闭清单

| ID | 当前证据与缺口 | 后续退出条件 |
| --- | --- | --- |
| OG-G01 | 父层只onMounted加载；loadSequence不等于跨缓存/范围全生命周期。成员角色初值仅缺键赋值，后台事实更新可能保留旧选择；A/D/K/U初始URL与local→URL watcher不证明完整后退/多实例 | 各页成功/失败/迟到、返回/刷新/组织切换、完整URL及分页越界受控验证；不以明文局部修复替代 |
| OG-G02 | submit中的load会内部消化错误，随后成功notice可能遮盖刷新失败；写后选中对象/反馈可能使用已变化的团队或成员；批量邀请401/403之后的汇总及未处理邮箱待验 | 明确事务结果与事实刷新分开，准确对象/剩余输入、重复/离开时序及真实后端结果，不改变业务规则 |
| OG-G03 | 原因窗没有500字符上限、确认后先关窗；其他变体焦点循环、字段错误关联、内联取消归还未全验。W/T/U button覆role=listitem需语义复核 | 按调用方全键盘、错误恢复、忙碌关闭/重开、长原因与对象切换逐项证明；共享修复覆盖P31等消费者 |
| OG-G04 | PAGES旧文案含工作区/团队编辑、P34模板编辑、P35数据操作；实际没有这些入口。架构旧排序说明与A实际current_version排序等有差异 | 新图使用实际合同；同步矩阵时按生成器来源影响更新关联证据，不能偷偷补API或只改hash。本批规格作显式纠偏记录 |
| OG-G05 | token复制完成状态、期限临界/过期GET、audit复制归属、深层脱敏、audit刷新与游标并发、同名工作区筛选仍待完整验证 | 固定时钟/网络/权限测试及真实存储/日志核对；非敏感键下的秘密不能凭当前递归键名算法宣布全覆盖 |
| OG-G06 | 全新正式方向未批；八页图、十种原因窗、全部状态与按钮六态、主题密度/断点/200%缩放、真实后端/生产/用户审核未完成 | 方向选定后逐页正式图→Vue→全部合同验证→宝塔同SHA→用户签收；现有P31仍要正式重设计 |

后续直接补W05 P38–P45八份，规格40→48；F00有方向意见时进入F05代表新图→Vue闭环，不等待剩33份全部补完。J07采纳业务决定独立保留。本批不重编PLAN、不生成冒充正式成果的旧风格图、不连接生产或执行真实令牌操作。

## 6. 当前源码指纹

以下为UTF-8、LF标准化SHA-256。局部hash用于发现失效，不代替对应验证；全局baseline仍绑定4b83588及其实际采图来源，不能因本批更改父组件就宣称旧图全部当前有效。稳定提交后按真实影响更新。

| 文件 | LF SHA-256 |
| --- | --- |
| `apps/web/src/components/OrganizationAdminCenter.vue` | `90f52f690e7a86398efbb9cd9225ea98212d4c0f584cb0eb01ff91de8fcebd5c` |
| `apps/web/src/components/OrganizationMemberPanel.vue` | `33448357ad210cccbdcbf50227e476ca07dc09c338235eec561628db357531b7` |
| `apps/web/src/components/OrganizationWorkspacePanel.vue` | `63687f982e54a1e02af06db82a6d053f644458d7d4648e8e0aeaf3225e7226c7` |
| `apps/web/src/components/OrganizationTeamPanel.vue` | `cbd68fbeea765cadc9259b98fcb91e87a122df2e64fe0171d6fe68765ee64174` |
| `apps/web/src/components/OrganizationApprovalPanel.vue` | `9ec2fb2e38b6b9ff11f81c3f314671dedec07667f96d137265c42c1ddf84b032` |
| `apps/web/src/components/OrganizationDataPanel.vue` | `575175d7e1aeabf68a6e742e97aea34fc6876ef5e09219b876f243f77eb42bb2` |
| `apps/web/src/components/OrganizationTokenPanel.vue` | `cd90fc469e663ef0e49bd5371b3c9a91f24d68f6039affb55b8ead8be5540725` |
| `apps/web/src/components/OrganizationAuditPanel.vue` | `b0f7e9452a81914dfa71c3812765f93726804d2ed1e56494e9004314a6f8ac7a` |
| `apps/web/src/components/AuditedReasonDialog.vue` | `270b84d19094e57b101a8e4efb1317b19785c87d30b8b452ee5b78e8f1378d00` |
| `apps/web/src/use-audited-reason.ts` | `113c2329aa046ce187ad1d834d92918391ef9c8ff79ed37c919c87e7e57f6bb8` |
| `apps/web/src/use-modal-dialog.ts` | `08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f` |
| `apps/web/src/api-client.ts` | `953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff` |
| `apps/web/src/organization-admin.css` | `831b6561d1cbc5c46e6b3f9a2092c21685a8d8bcebd436e4c33fa2f3ae1248ee` |
| `apps/web/src/organization-audit.css` | `383780e913c10518651362f14462a651c52b7da030764567fe6033e2fa87d17d` |
