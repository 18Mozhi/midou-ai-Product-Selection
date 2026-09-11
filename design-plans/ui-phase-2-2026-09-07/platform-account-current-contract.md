# P38–P45 当前静态合同接续

2026-09-11。修正独立验证工具把历史快照误作当前源码的缺口。旧 [平台账号合同](platform-account-contract-review.md) 与 [用户设计合同](platform-user-design-contract.md) 原表、图片、批准范围均保留；本文件不是新视觉批准或生产验收。

## 四处明确源码修订

历史列必须与原表逐项相等；当前列必须与真实文件的 LF SHA-256 逐项相等。只接续这四个文件，其余原表28个文件仍逐项严格核对；不采用“任意旧哈希也可通过”的宽松回退。

| 文件 | 历史 LF SHA-256 | 当前 LF SHA-256 | 已有依据 |
| --- | --- | --- | --- |
| apps/web/src/components/PlatformDashboard.vue | 7935e4cdeca4991615f554ff0c66cf5e623454269fa0771ff06b861f15ca5a95 | b9b433afb9d39cf77aaf7dde1f153a5b689c19734ba32c022831b9587313e498 | ea005452 历史时间窗/在途读取修复；[当前语义合同](platform-overview-semantic-contract-review.md) |
| apps/web/src/components/PlatformAccountCenter.vue | 2b41c1f174bf0a1a67c97e8252e1d805a01c559d7bcb6817da80d7affd4b3474 | 3ac56e41a5f5b78a4f01d6ee4298dacd0c80f243f414a7a48de8105eb292aa76 | b6da851d 组织操作归属抽取；[修复与回归](P42-WRITE-OWNERSHIP-REVIEW.md) |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa | b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99 | [焦点与缓存停用增量](responsive-detail-focus-contract-review.md) |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 | a566080f7b00f13c8890ea8ef5b002296b39e9b7fe10f324a4fe754226dec011 | [重置禁用焦点修复](FILTER-RESET-FOCUS-REVIEW.md) |

## 候选身份与新增源码

只替换 S（ResponsiveDataView）这一个明确别名的五个候选，读取已有 [当前动作归属表](responsive-detail-focus-contract-review.md)，不重复维护一套新签名。原表五个历史身份仍严格核对；其中三个新位置接续、两个身份不变。其余123个候选和全部24个 v-model 与真实Vue逐项相等。候选身份不能替代交互语义、运行时动作分母、动态弹窗或所有消费组件验收。

PlatformAccountCenter 已抽出组织操作组合函数，因此当前检查增加该真实依赖，不把原32源文件误称完整当前调用链。原32源历史表保留，当前33源是本工具的明确静态核对范围，不代表全项目源码分母。

| 新增核对文件 | 当前 LF SHA-256 |
| --- | --- |
| apps/web/src/use-platform-organization-actions.ts | 3f61de65bc5b71d72998d5d184c079c1508d8d89beeffff002a678c6d7dc88eb |

## 运行与失败边界

```powershell
node scripts/verify-ui-phase2-platform-account-contract.mjs
node --test tests/unit/ui-phase2-platform-current-contract.test.mjs
```

无新增参数、依赖、环境变量、业务字段、权限、数据库或部署行为。任一候选缺失/重复、原表篡改、未登记修订、当前源漂移、新增组合函数漂移、当前共享表哈希不一致、页面路由/章节/链接失配均报错。可注入读取器只用于内存负例，不写测试文件、不拿旧Git源码替代当前通过。

此接续解决此前独立检查的历史漂移失败；不豁免测试，也不推定P43等待审组合已通过。视觉回归、真实权限、完整App、全部73页重构与宝塔交付仍按各自证据和用户批准推进。

## 本轮验证与收尾

独立检查8页/128候选/24模型/33当前源通过，新增17项正负测试与750项相关回归全部通过；73路由/153必需文档门禁、格式和diff检查通过。首次负例自身的哈希替换长度不等导致提前失败，已修正为等长变更并完整复测，未改检查预期来放行错误。焦点修复后前端构建结果沿用同一源码版本的已通过记录，后续只改审核文件与工具，不重复构建。

本次准备一并提交此前因旧检查失败积累的同任务改动：共享焦点修复、P43创建/改密/十类原因审核实现、对应永久测试及470张正式PNG（含16张焦点对照）和5组图册/清单。不是470个已验收业务状态。既有102图包15069PNG源/图片漂移为0，新470图由各自独立测试核对，不改旧分母、不覆盖旧图。尚待用户审核及生产核验的项继续保持待定。

未新建临时脚本、截图或后台服务；上述图册为请求的正式交付物保留，已核对此前12个验证端口均无监听。本轮不部署、不重启；Git提交结果以本轮最终回复为准。业务/API/OpenAPI/权限/数据库/环境变量/依赖未改，因此无需后端、Python、插件或部署配置同步。
