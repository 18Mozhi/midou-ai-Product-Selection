# P72/P73 状态展示与404恢复合同复核

日期：2026-09-07；E02；main/f55942d干净起点。第1–5节为修复前盘点，绑定16f524b与指纹92f0bffbe1a11fcce4d49c6e4fea83acc12eccb5045de9f33d078d34f5bc7504；本批后续复现并修复遮罩焦点问题，最新差异见第6节，不能把旧SHA当当前ConfirmDialog源码。本文是人工语义记录，不覆盖生成器的reviewStatus、不冻结全站分母、不自动认可设计或生产。

## 1. 入口与源码事实

P72=/ui-states为internal，P73为fallback；两者都无shell与会话前置。沿feature-map.commonUiStates→route-catalog→router→App.vue→实际组件追踪。App在DEV允许view query选择内部展示，故开发任意未知路径带view=ui-states可能显示展示页；生产必须另验query不可绕过，不能用DEV结果推断生产。路由过滤、App条件导入、NavigationShell的glob排除以及vite构建剥离是不同防线，不能只验证菜单隐藏。

源码SHA256（原始文件字节）：

| 文件（apps/web/src/components/） | SHA256 |
| --- | --- |
| UiStateShowcase.vue | c4a94d839ff7d4e1e3a10f6458facb150e2b499fbcc84cf411fdd8daecba3e30 |
| UiStatePanel.vue | 8f0c147245627493cf5d235162b9dc00424875d0296e710f180a3365c603c164 |
| ConfirmDialog.vue | fc593274463c1ced2eebe1094402d8b3aef5649d8502b78f04e65fdadb9c1a0f |
| NotFoundPage.vue | 2629b1167336513955c9a1af7459d8e18d357f7e1fb03f240629f97b0501bf7b |

## 2. 源候选到语义动作

candidateId前缀为apps/web/src/components/加文件名及#。共14个控件/事件候选，含P72本地5、P73本地3、共享Panel2/Confirm4；共享候选只审核本页调用语境，不证明其他调用方已通过。选择八态是一个v-for源码位置，不能当一个运行时按钮；确认checkbox与短语input另有两处v-model，不在控件扫描数量内。

| 文件:行 | candidate后缀 | 稳定语义归属 / 真实行为 |
| --- | --- | --- |
| UiStateShowcase.vue:98 | a51b976ddba112e1.1 | ST-HOME，品牌去/home |
| UiStateShowcase.vue:106 | 7f48e1357c8dae41.1 | ST-SELECT.{kind}，八态选择；合法同态不增history |
| UiStateShowcase.vue:117 | 659be34503b475d2.1 | ST-OPEN，本地dialogOpen=true |
| UiStateShowcase.vue:126 | b2a9d9fdd632dd45.1 | ST-PRIMARY.{kind}/ST-SECONDARY.{kind}，按下表 |
| UiStateShowcase.vue:151 | 5cb580b48eea94d3.1 | ST-CANCEL/ST-CONFIRM，关闭；确认额外confirmed=true |
| UiStatePanel.vue:71 | 589e8eedc7c9c864.1 | ST-PRIMARY，非loading发primary |
| UiStatePanel.vue:73 | 3eebdb6b72e10446.1 | ST-SECONDARY，有文案且非loading才显示并发secondary |
| ConfirmDialog.vue:91 | 4505a8c2bbf9389c.1 | ST-CANCEL.backdrop，mousedown.self |
| ConfirmDialog.vue:92 | 30a3b6ddc206839e.1 | ST-FOCUS/TRAP和ST-CANCEL.escape，keydown不是业务提交 |
| ConfirmDialog.vue:123 | d1b7ac74d4f4ffc3.1 | ST-CANCEL.button |
| ConfirmDialog.vue:124 | 3003ba3e33804f38.1 | ST-CONFIRM，canConfirm后允许点击emit |
| NotFoundPage.vue:46 | ad49e2f05ad189d6.1 | NF-BRAND，/home |
| NotFoundPage.vue:78 | 0b84761726a96f8e.1 | NF-RETURN，解析后的recentDestination.fullPath |
| NotFoundPage.vue:81 | 7ed277e44773eac9.1 | NF-HOME，最近目标path非/home时额外显示 |

## 3. 八态及演示弹窗合同

| kind | 主动作 | 次动作 |
| --- | --- | --- |
| loading | 不渲染 | 不渲染 |
| empty | 本地“未执行写入”提示 | 本地“没有真实筛选条件”提示 |
| error | selectState(recovery)，提示未调用业务接口 | selectState(empty)，不是history.back |
| forbidden | /home | 提示申请须由所属业务页发起，不伪造申请成功 |
| expired | /login | 无 |
| blocked | selectState(recovery)，不是实际依赖恢复 | 显示静态影响解释 |
| recovery | selectState(empty)与继续提示 | 无 |
| not_found | 最近路由path等于当前path则empty，否则router.push(recentRoute) | /home |

query.state非法或多值为empty；state切换清空actionResult并保留其他query。watch只看query.state，initialState prop若存在则不接管；路由当前不传此prop。confirmed不会随普通state切换清空，重建组件才重置。current/ref状态与本地导航记忆不是后端持久化状态。

弹窗候选：ConfirmDialog.vue:92 #47b44d75a30b19d9.1为定义，UiStateShowcase.vue:151 #2067b78f30a4668d.1为调用，两项归一个ST-DEMO-CONFIRM变体。固定destructive、固定短语确认撤销；acknowledged加trim匹配才启用。开窗清空两个字段并聚焦取消，锁body滚动；Tab循环与Escape取消，点遮罩及取消同样关闭，关闭归还焦点。成功仅更改演示ref，不新增异步接口、真实写入、审计或撤销。此变体无网络处理中/失败态，其他ConfirmDialog业务调用方不能据此豁免。

## 4. 404恢复和显示边界

NotFoundPage只显示route.path（超过96截93加省略号），title保留完整path，query/hash均不作为当前地址文案。返回目标标题来自meta，链接保留fullPath。navigation-memory接受单斜线开头而非//的存储路径；解析未登记路由或抛错改/home。不是完整URL安全认证，不扩大为所有编码/跨标签输入已验。router.afterEach只在非notFound时记忆，未知地址不覆盖最近路由。storage失败由既有读写保护处理；组件不自行读业务接口。

本页不存在确认弹窗、业务错误重试、申请权限或搜索动作。无会话进入404不触发sessionRequired检查，但点击目标后的真实会话/权限仍由目标管理。开发测试API零请求只覆盖停留/本地动作，不覆盖导航离开后的业务链。开发服务器SPA fallback可能返回200，不能据404文案声称HTTP404。未知路径本身可含敏感片段，截图要使用隔离地址，过滤query不等于已完成全部脱敏。

## 5. 验证映射与未覆盖项

永久用例tests/e2e/ui-phase2-state-recovery-contracts.spec.ts：

| caseId | 范围与断言 |
| --- | --- |
| UI2-ST01 | 非法/多值query保持URL但显示empty；保留context，合法同态不增history；aria-pressed与零API |
| UI2-ST02 | loading无动作/aria-busy；expired仅登录按钮；切换与history清除旧提示；零API |
| UI2-ST03 | 默认取消焦点、禁用/启用时双向Tab循环、Escape/取消、重开清表单、归还焦点/滚动、保留当前态、无成功提示/零API |
| UI2-ST04 | 短语单独无效、错误短语无效、trim匹配成功、演示提示、重开重置及遮罩取消；零API |
| UI2-NF01×2 | http外部/协议相对存储回退home；正文不露query或外部地址，未知路径不改原存储，h1焦点、零API |
| UI2-NF02 | storage读写均抛SecurityError时页面和刷新可用、无pageerror/零API |

复用m02-04-not-found六例及m02-04-ui-states中六项非截图用例；本次不更新历史截图基线，两个含toHaveScreenshot的历史用例不在本批执行集合中。实际测试结果另记PROGRESS，不在文件创建时先标通过。

未完成：ST05正式新图/三主题两密度/200%缩放和辅助技术；ST06全部共享调用方及多弹窗叠加；NF03生产实际HTTP响应、DEV query不可绕过及发布bundle；NF04六角色导航目标和跨范围/跨标签最近路由语义。这些保留待验，不修改业务规则或全站计数。构建防线源码单测只能证明源码合同，不能替代当前生产实证。测试及规格不把G0/G1–G5自动改为passed。

## 6. 本批确认遮罩焦点修复

UI2-ST04在旧源码下失败：确认演示后重开、点击遮罩，弹窗关闭但trigger未获焦；同组其他18项通过。原因是mousedown.self先触发cancel，watch关闭后nextTick归还焦点，随后浏览器默认mousedown聚焦又使触发按钮失焦。现在仅添加prevent且保留self在前，阻止遮罩本身的默认聚焦；内层checkbox/input/button不受prevent影响。事件、取消时机、校验、数据和API都未变。最小ST04修复后通过，最终批量测试记录见PROGRESS。

ConfirmDialog当前SHA为6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b；line91为@mousedown.self.prevent。旧候选签名4505a8c2bbf9389c.1须在产品提交后重新生成映射，其语义仍ST-CANCEL.backdrop，不能手改全局指纹充当采证；共享其他三控件位置和dialog定义语义不变。

实际模板调用方为9个组件、11次调用：UiStateShowcase、CredentialAssetCenter、CollectionTaskCenter、CollectionRuntimeCenter、CollectionOperationsConsole、DataQualityCenter（单项/批量）、OpenPlatformCenter、CrawlerSchedulerCenter（租约/来源熔断）、CapacityBoundaryCenter。候选routeIds是13项保守导入归属，不能把它误认成13个直接组件。所有取消监听均清本地确认状态；本次不改它们的提交handler。复用8个业务组件的相关隔离回归，DataQuality批量、来源熔断变体和多弹窗叠加仍未全覆盖，不注销ST06。

同步纠正M02-04架构/运行手册仍要求生产发布内部状态页的过期文字，依据当前route-catalog、App、Vite与PLAN；不新增生产能力。模块修复本身只涉及前端，但统一部署器的停止/重启及既有迁移预检不能省略。正式发布/线上不可达验收留待W09；本批无部署。
