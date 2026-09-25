# P38–P45 当前静态合同接续

2026-09-11。修正独立验证工具把历史快照误作当前源码的缺口。旧 [平台账号合同](platform-account-contract-review.md) 与 [用户设计合同](platform-user-design-contract.md) 原表、图片、批准范围均保留；本文件不是新视觉批准或生产验收。

## 历史源码修订链

下表保留七个源码在2026-09-11接续时的历史修订链，不再把`after`列误作今天的指纹。原始32源表位于`platform-account-contract-review.md`第7节，其排序后的`路径|哈希`清单指纹为`908a9c67180917252ad3a63871a2e337b498bead5e3f4ddd9b9c87d880d7961e`。完整38源的当前值统一以本文末尾的当前指纹表为准。

| 文件 | 历史基线 LF SHA-256 | 2026-09-11接续时 LF SHA-256 | 已有依据 |
| --- | --- | --- | --- |
| apps/web/src/components/PlatformRoleComparison.vue | d97345c58748d4dd480bd80dd0ee7106b411bb1488652a7621a5a3adfc3dd0ba | 53ea620ad7ef16c2e451d83e0be2a141a060a3668c50eb36c852bcabd9125809 | 同角色结果局部C展示class；完整脚本/原模板内容与控件保持 |
| apps/web/src/components/PlatformDashboard.vue | 7935e4cdeca4991615f554ff0c66cf5e623454269fa0771ff06b861f15ca5a95 | b9b433afb9d39cf77aaf7dde1f153a5b689c19734ba32c022831b9587313e498 | ea005452 历史时间窗/在途读取修复；[当前语义合同](platform-overview-semantic-contract-review.md) |
| apps/web/src/components/PlatformAccountCenter.vue | 2b41c1f174bf0a1a67c97e8252e1d805a01c559d7bcb6817da80d7affd4b3474 | b6b04ced8763f8b5f8231dc19c2b7e6617024af2870f82defa6ba25afb042f00 | 组织/创建/改密修复后追加P44手机目录标题与独立样式导入；3ac56e41/ec3f2b65/a1ba7d5a保留为历史图依据 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa | 8669cbd3ecba514b449a3f4ec992e7b17fe45335cb6d2f40a1eae7032affdccf | 焦点/缓存增量后，388b311d/af239b08 增加 governance/content 外观，再作 [原色变量提取](COLOR-ROLES-CLOSURE-REVIEW.md)；展开后严格等于 6d3088d1 中间版 |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 | 5eff0a117552e22bf31a0d3761b0613428c777721b8e230b10e76bab39ee0a5f | 重置焦点后接续 P55/P56 浮层、通知外观与原色变量；[面板关联及减少动态效果首焦点](FILTER-DRAWER-ASSOCIATION-REVIEW.md) |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f | 5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc | 635e5538 增加并返回 discardReturnFocus，仅清空返焦目标；CredentialAssetCenter 已使用，原开关及 cancel 路径不变 |
| apps/web/src/components/NavigationShell.vue | 4490c21cd477e2874dd9f2eb3c0cafafa2e88baf46620d2a0eb31a3f4e53d2bc | 0819cf432ed5432267631555c156d47be7487140b5ae8650adcfb327f68832eb | import.meta.glob 排除 P57 的六个内部组件；仍由父页面导入，不改菜单/路由目录、网络或缓存语义 |

## 候选身份与新增源码

S（ResponsiveDataView）的五个候选读取已有 [动作归属表](responsive-detail-focus-contract-review.md)，不重复维护签名。原表五个历史身份仍严格核对；其中三个新位置接续、两个不变。补充表 b9e635a3 时点之后先增加 P55/P56 外观，再提取颜色。补充表原指纹固定保留；当前原始文件先核对当前哈希，再展开调色板变量，完整文本必须等于中间版 `6d3088d1c82d962e748dec1b68ae9b4dd5eeff6895fa3e42ba84c6f59a01f8ac`，该版为 af239b08 的实际源码。不把中间版误称 b9e635a3，不以逆向文本充当当前文件。

2026-09-12 增加 Q 的唯一候选接续；Q 原表六项完整保留并固定核对，下面只替换打开按钮，另五项身份不变。当前扫描器实测方向是 **beb5 → 7e0f**；先前 FILTER-DRAWER-ASSOCIATION-REVIEW.md 末段将 actual/expected 的方向误读，此处纠正，不覆盖原历史记录。

| 历史候选 | 当前候选 | 精确增量与语义 |
| --- | --- | --- |
| Q#beb5f8d5846aa028.1 | Q#7e0fa28eaeb1cc09.1 | 同一 triggerButton 的 @click=show，仅增加 :aria-controls=panelId；移除这一属性后必须扫描回历史身份 |

验证器不接受其他 Q 候选替换、重复/缺失登记、无关联的旧身份或任意新签名。原“其余122个候选”是128候选历史快照中的剩余数，不再用作当前页面计数。当前候选由下文三份现行来源合同精确绑定；候选数量不是业务动作分母，也不替代运行时唯一面板/首焦点/全部消费者验收；本次静态登记不提升页面审核。

PlatformAccountCenter 的组织操作、创建归属及P44手机样式四个新增依赖保留；本次把实际导入的共享浮层及 P44 手机调色板两文件加入原始来源检查。P44 两个样式文件的旧指纹分别为 9b74248f/4c668445，本轮接续已有颜色角色提取；布局与已登记区域边界由 [当前图包重放](P44-P46-CURRENT-REPLAY.md) 核对。原32源历史表不改，当前38源是本工具的明确静态范围，不代表全项目源码分母。

| 新增核对文件 | 当前 LF SHA-256 |
| --- | --- |
| apps/web/src/use-platform-organization-actions.ts | 233d53f196475f976422f7e7ee6867eba3550c89118cee142e500db0069391ae |
| apps/web/src/use-user-creation-owner.ts | cda28435c0fc6633efd72a0ba27f204f617c70dc70cbb242da96650571bde39e |
| apps/web/src/components/PlatformAdminComparisonMobile.css | 03de4183b646dcb09140a4b9028c0e3d0a6f1d8b05f2dad43f5d6790e51cf3ae |
| apps/web/src/components/PlatformAdminDirectoryMobile.css | 6a9f05f7690a67746b4ea9dc479ea7d78a43ad2b73707bde6d2dad0c2d0050f3 |
| apps/web/src/design/platform-overlay-tokens.css | 1ac279a72962b120c1f5153a9abb30e258e84be9c1519df1b7944f7190dd69b5 |
| apps/web/src/design/platform-admin-mobile-tokens.css | 3c878a3060007abd8bb51a0bf626833a9e8ac7ab4a62c3fcbcd587e9c52b7e68 |

## 当前38个来源的LF指纹（2026-09-25）

候选当前集合从平台账号、用户与共享响应式控件三份合同中按实际扫描状态取`identity-current`/`line-moved`记录，历史身份不冒充现行候选。当前15个Vue文件共118个源码候选、24个v-model；这与原128候选历史快照口径不同，不表示删减业务动作。以下38项包括原32源及六个当前新增依赖，校验器逐项对真实工作树做LF SHA-256核对。

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformDashboard.vue | 902ade12da39276dd7151410ba8bc1058fc4deef3bf941c8c6e502769028391e |
| apps/web/src/components/PlatformAccountCenter.vue | eda65671ef8a8cb49af3de234a552ec96db0571a82b68f39ea533b6b72a27213 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 392654a2d2e17045725a98dcf28d25c7381a024c54ad47063ed6035c9a8f065a |
| apps/web/src/components/PlatformAdminRecords.vue | 74cf97193f666c9a712ab12e69e450c9cf59297a12fe9c9b8e350aa74560b297 |
| apps/web/src/components/OrganizationCreationWizard.vue | 6ec50816ecc69c9b707e5a309ef789129f8fb5f6087bad0c4427709055b03c53 |
| apps/web/src/components/PlatformOrganizationDetailDialog.vue | 99466d18329d4315db351e535f52214ae0c14d9d8cec8fc47307d41b4afb487e |
| apps/web/src/components/PlatformRoleComparison.vue | a043421e37ecc7d82f87854b06874bf4874cf1f3786e8917b9a85b4166268309 |
| apps/web/src/components/PlatformAccountDialogs.vue | 4dcdb542d7f45cc445606a4f704679064d998239c62551d19f696a81be7af4da |
| apps/web/src/components/PlatformUserRecords.vue | a0c8ac35238ff4541ef8f699593d15c8f8ae9c2b85c87c1896f08689d668e228 |
| apps/web/src/components/PlatformUserDetailDialog.vue | 87e0b0906fded03d7c5337dafa5e6bfc801a2367d12deb652cc36f0f88d32d9a |
| apps/web/src/components/PlatformUserMembershipForm.vue | 553a0f8ac7e42ac7665785f8701a64c41dec7469c2380e3dd087a11ad7e6f644 |
| apps/web/src/components/ResponsiveDataView.vue | e848f34bb7500017279b5e39db5b29bad29d222183923cc63ffce164c44b40c7 |
| apps/web/src/components/ResponsiveFilterDrawer.vue | 5eff0a117552e22bf31a0d3761b0613428c777721b8e230b10e76bab39ee0a5f |
| apps/web/src/components/TableViewControls.vue | b02687c66f5705252518e3e87f4f437a33adfd943fdbc032845e68aeba2d652b |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |
| apps/web/src/use-modal-dialog.ts | 5f3488e444f30c86d9f7e7424cc0f5463118fac0d3e78422251167dbd571b2fc |
| apps/web/src/use-platform-user-detail.ts | 8e07ab5f36fb989082d43cda2082e2cafdedadba8ec5c5f5ba3e055859e39e8e |
| apps/web/src/platform-account-types.ts | 7c78cdfd603d8419ee18d7bd5feb12b1d40cbb7bdf102aeaf17a919a7003afe2 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/web/src/components/NavigationShell.vue | da0d7785c445651b0cf2b0f0bcdd457dd9cf24efcadeb2e1efeb322c492411c9 |
| apps/api/src/authorization-routes.ts | f670a9e21650e2fedd3ea691049de840cb2a47c9c6add471c38eb7e71e208975 |
| apps/api/src/platform-account-routes.ts | 79c273a1492f2cc157c72d82ac6ab2b8a950ccb789696c2329d7a6206fefe226 |
| apps/api/src/platform-account-service.ts | 189fb1cbcafdc119da64433ac1acd9735d4f1a296b2a243c250733df2b08966d |
| apps/api/src/mysql-platform-account-repository.ts | 96cc13077b24ba17643adc9b13ca14cd2e71ea49d3e13d3abceb7b86ed7b87c5 |
| apps/api/src/platform-dashboard-routes.ts | 1b84b99708bf4610259b42dd48987831229560cf5653b15b98b3cc1d30284f30 |
| apps/api/src/platform-dashboard-service.ts | 568938e88c90615410a7c43224004930936165e91a4172afafc7ce2ff4d8428e |
| apps/api/src/mysql-platform-dashboard-repository.ts | b290af1c03b2767c79bb565f9ec256550250acc4be0cc787de12b81e9b8dcd28 |
| apps/api/src/mysql-platform-dashboard-scale-metrics.ts | 75f0800028a81a7456578b65699406b8d52593deb89926c4970a4b7bd9679c00 |
| apps/api/src/mysql-platform-dashboard-collection-metrics.ts | dc37e16179b6c8d57d2b6ffcb23fcfce7d44d950bbfc9263104be1d6d74c438d |
| apps/api/src/mysql-platform-dashboard-risk-metrics.ts | e49abd8f317094b4b34b5fb31f8cb47e9d3cc1dc9cffcd945035c8ecd648f094 |
| apps/api/src/mysql-platform-dashboard-storage-metrics.ts | 16b1b6b5e04ae7b3f4438914cd88b7e985d4a836db42c6e6c1855567de0ca808 |
| config/route-catalog.json | eb7071f2a0ced2733110ff51e4852757a8eea5757fe31d399003be5e63e6917b |
| apps/web/src/use-platform-organization-actions.ts | 233d53f196475f976422f7e7ee6867eba3550c89118cee142e500db0069391ae |
| apps/web/src/use-user-creation-owner.ts | cda28435c0fc6633efd72a0ba27f204f617c70dc70cbb242da96650571bde39e |
| apps/web/src/components/PlatformAdminComparisonMobile.css | 03de4183b646dcb09140a4b9028c0e3d0a6f1d8b05f2dad43f5d6790e51cf3ae |
| apps/web/src/components/PlatformAdminDirectoryMobile.css | 6a9f05f7690a67746b4ea9dc479ea7d78a43ad2b73707bde6d2dad0c2d0050f3 |
| apps/web/src/design/platform-overlay-tokens.css | 1ac279a72962b120c1f5153a9abb30e258e84be9c1519df1b7944f7190dd69b5 |
| apps/web/src/design/platform-admin-mobile-tokens.css | 3c878a3060007abd8bb51a0bf626833a9e8ac7ab4a62c3fcbcd587e9c52b7e68 |

## 运行与失败边界

```powershell
node scripts/verify-ui-phase2-platform-account-contract.mjs
node --test tests/unit/ui-phase2-platform-current-contract.test.mjs
```

无新增参数、依赖、环境变量、业务字段、权限、数据库或部署行为。任一候选缺失/重复、原表篡改、未登记修订、当前源漂移、新增组合函数漂移、当前共享表哈希不一致、页面路由/章节/链接失配均报错。可注入读取器只用于内存负例，不写测试文件、不拿旧Git源码替代当前通过。

此接续解决此前独立检查的历史漂移失败；不豁免测试，也不推定P43等待审组合已通过。视觉回归、真实权限、完整App、全部73页重构与宝塔交付仍按各自证据和用户批准推进。

## 本轮验证与收尾

以下为01af0262时点记录；随后创建归属修复更新当前父指纹并增加第34源，见上表与独立对照报告，不能沿用以下“无需重新构建”到新生产源码。

独立检查8页/128候选/24模型/33当前源通过，新增17项正负测试与750项相关回归全部通过；73路由/153必需文档门禁、格式和diff检查通过。首次负例自身的哈希替换长度不等导致提前失败，已修正为等长变更并完整复测，未改检查预期来放行错误。焦点修复后前端构建结果沿用同一源码版本的已通过记录，后续只改审核文件与工具，不重复构建。

本次准备一并提交此前因旧检查失败积累的同任务改动：共享焦点修复、P43创建/改密/十类原因审核实现、对应永久测试及470张正式PNG（含16张焦点对照）和5组图册/清单。不是470个已验收业务状态。既有102图包15069PNG源/图片漂移为0，新470图由各自独立测试核对，不改旧分母、不覆盖旧图。尚待用户审核及生产核验的项继续保持待定。

未新建临时脚本、截图或后台服务；上述图册为请求的正式交付物保留，已核对此前12个验证端口均无监听。本轮不部署、不重启；Git提交结果以本轮最终回复为准。业务/API/OpenAPI/权限/数据库/环境变量/依赖未改，因此无需后端、Python、插件或部署配置同步。

## 2026-09-25 当前对账续记

上述01af0262及P43批次数字均是当时记录。当前只读工具保留原32源/128候选历史快照，并从平台账号、用户、响应式控件三份现行合同与真实Vue扫描对账：15个Vue文件118个当前候选、24个v-model，连同依赖共38个当前源；当前完整LF指纹见本文表。`node scripts/verify-ui-phase2-platform-account-contract.mjs` 与对应30项正反例通过后，才可据此更新门禁状态。本次不代表P38–P45运行时、真人读屏、真实RBAC/数据库或生产验收。
