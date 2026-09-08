# F04a 源码与合同静态对账报告

日期：2026-09-08；第1–5节保留main/edb3056核对、01adf4d交付的初始快照和输入hash；第6–8节保留后续映射及首次生命周期修复快照；第9节是当前发现层焦点修复后的源对账。状态：全部当前源候选已有支持的稳定引用，但动态实例、业务语义与完整运行验证仍待收口，G0未冻结；正式方向、全站新图、Vue重构、真实验收、部署和用户签收未完成。静态身份、历史记录、运行证据和审核分别保留，不通过工具自动批准设计。

## 1. 已实际执行的范围

读取26份合同Markdown及source-scope-review.json，共27份输入；重新解析apps/web/src内164个Vue/TS文件，发现1478个控件/事件/弹窗定义或调用候选。路由目录与PAGES及73份page-specs逐项核对无问题。本次未扫描后端合同是否实现，也未遍历浏览器动态状态。

当前Web源指纹（LF归一、有序文件/哈希对）：`f173913e0fa181d21bc82b3f7adbef060b01133941c0d4295dd1ef06dd05a3df`。该指纹只用于本检查器的Web源码对账，不等同baseline.json的全局指纹；不能相互替换。

| 计数 | 结果与含义 |
| --- | --- |
| 全部表格/JSON引用 | 1468，保留每次引用，不是动作总数 |
| 非历史引用 | 1439：1343个源身份仍可对应、96个只有行号而未绑定 |
| 历史引用 | 29：13仍可对应、5行号移动、11旧身份不再存在；全部保留，不抵扣当前覆盖 |
| 非历史引用对应的唯一候选 | 1305；多处引用同一候选只算一次，不代表业务去重完成 |
| 缺少非历史稳定引用的候选 | 173；不代表无文档、无测试、不可达或可删除 |
| 重复引用候选 | 26；共享调用和多版本记录可以合法重复，不自动当业务冲突 |
| 表格源码hash | 157匹配、3漂移、119不在Web扫描范围；比较均LF归一，不证明原始字节或后端当前状态 |
| 页面 | 73路由/73规格，矩阵与链接检查问题0；不代表73页正式设计通过 |

此前草稿误把状态表P49当成P组件49行，已限制行号式识别必须处于“组件行”表格。历史表/旧列只在原文有明确说明的章节按显式配置分类；其他引用标unclassified，不默认解释为当前获审声明。

## 2. 已解释的历史差异

- selection-journey-contract-review第2节明确保留修复前快照，第8节表格分当前键/N03旧键。十条原表与五条旧列合计15条历史引用；五个旧身份在两处出现共10次“不再存在”，另五条仅行号变化。新表当前十项仍单独对应；不能把这10次计为10个新缺陷。
- state-recovery-contract-review第1–5节明确为修复前记录。第2节14条引用标历史，其中ConfirmDialog旧遮罩身份不再存在；第6/7节解释修复。后续文字不是本工具支持的表格映射，所以UiStateShowcase/NotFound仍有当前稳定登记缺口，不等于这些页未做过验证。
- platform-account-detail-contract-review第5节两处漂移为PlatformAccountCenter和use-platform-user-detail的H02历史hash；文中明确后续写入修复以W05全族合同为准。第三处漂移是上述ConfirmDialog旧hash。三处均为历史快照，不更新旧hash掩盖版本差异。

全局baseline仍绑定4b835881c081af808713c76af323d866993f44c9，当前有16个已登记Web文件内容不同。本轮不重生成baseline/actions/dialogs/coverage/review-data，不更新旧图hash或批准数。后续只在实际重新溯源/采证后刷新受影响记录。

## 3. 173个稳定映射待补项

| 当前文件 | 候选数 | 下一步与既有依据 |
| --- | --- | --- |
| apps/web/src/components/DiscoveryOverlay.vue | 9 | 逐项追共享入口、动态菜单及真实可见条件，不从标签推断业务 |
| apps/web/src/components/NavigationShell.vue | 32 | 逐项追共享入口、动态菜单及真实可见条件，不从标签推断业务 |
| apps/web/src/components/NotFoundPage.vue | 3 | 保留原历史表，补当前显式映射并核对DEV/fallback生产边界 |
| apps/web/src/components/OrganizationRolePanel.vue | 19 | P31已有完整语义规格；补19个源码位置与父调用方映射 |
| apps/web/src/components/ScoreRuleConsole.vue | 28 | 复用scoring-contract-review的25条行号记录，补稳定签名及定义 |
| apps/web/src/components/TaskBatchActions.vue | 13 | 复用task-contract-review的语义记录，核对现源后补签名与4个定义/调用关系 |
| apps/web/src/components/TaskDetailPanel.vue | 27 | 复用task-contract-review的语义记录，核对现源后补签名与4个定义/调用关系 |
| apps/web/src/components/TaskListPanel.vue | 14 | 复用task-contract-review的语义记录，核对现源后补签名与4个定义/调用关系 |
| apps/web/src/components/TaskWorkspace.vue | 21 | 复用task-contract-review的语义记录，核对现源后补签名与4个定义/调用关系 |
| apps/web/src/components/UiStateShowcase.vue | 6 | 保留原历史表，补当前显式映射并核对DEV/fallback生产边界 |
| apps/web/src/use-modal-dialog.ts | 1 | 共享工具定义，不当成一个业务弹窗；归属到真实调用方 |

任务四文件共75个候选，评分28个；已有71+25=96条行号式记录无法安全自动绑定。同一行可包含多个候选，不能按最近行号或全局相同标签猜测；应核对真实handler、当前签名及归属。P31仅有叙述规格、本文扫描的组织合同刻意不重复其局部动作，故19个缺的是机器对应，不是可以直接判为无业务复核。

这些数值只在本报告Web源指纹及输入hash下有效。全部待补项的精确candidateId、文件、行、类型与标签可用下面--json读取unreferenced；它们还必须进入F04b角色/状态/运行时验证，不能仅补齐ID就宣称G0或业务门通过。

## 4. 命令、输入及退出语义

在仓库根目录运行：

```text
node scripts/audit-ui-phase2-contracts.mjs
node scripts/audit-ui-phase2-contracts.mjs --json
node --test tests/unit/ui-phase2-contract-audit.test.mjs tests/unit/ui-phase2-inventory.test.mjs
```

无参数打印摘要，--json将完整引用、源声明、重复引用、未映射候选、页面问题和历史baseline差异输出到stdout。工具没有写文件、联网、审批或部署模式；其他参数/多余参数直接拒绝。无需环境变量或依赖安装，无服务启动及重启要求。

退出0表示本次扫描成功且页面结构检查无误，**不表示G0通过**；identity-not-found、hash-drift和unreferenced属于诊断结果，不自动视作当前产品缺陷。页面矩阵/规格/链接问题返回非零，源码解析或输入错误也失败关闭。若需要保留JSON，应明确作为交付物或登记临时路径，本批只在内存检查，未生成临时JSON。

输入只包括支持格式的Markdown表格和source-scope JSON。文件简称来自各合同显式对照，不做全局同签名替换；行号式表、当前/旧签名列、章节内签名均有测试。正文中的签名、内联hash、全部v-model、动态实例、完整权限/状态及业务去重不由此解析器证明。新增格式先增加测试与明确映射，不悄悄扩大自动猜测规则。输入文件清单如下（hash为LF归一）：

| 输入文件 | SHA-256 | 引用数 |
| --- | --- | --- |
| account-home-contract-review.md | f2170e9d6453332df800a4292c0f60f60964aa5d753bd1f6510d20c2aa35e635 | 51 |
| approval-notification-contract-review.md | 20cf9e03e9341f09246a522052704177a28555426dd737e52ecdf58851f59026 | 65 |
| automation-report-contract-review.md | f4f2d8b792181927ffa4d1548599a3a57f7d17c5e15847a85e1b5ce6de42272e | 33 |
| collection-runtime-contract-review.md | afc04b5872594be785540dec87cf78a1bd85d6e063e779c4c8250f7f8fc4f2a9 | 66 |
| commercial-security-open-platform-contract-review.md | f307b5c8e09613919e5ff325574761159e1d9d584c45db2a8637aef806cd1475 | 108 |
| competitor-contract-review.md | dc09dd79de038281f0dd143e1193f137e15bd35dd6416ef627b147a498f25519 | 39 |
| content-notification-evidence-contract-review.md | 9a0d8c18d5ad30e4bbfada9979a003f671fdfb28d372ee99bb868d7dcaa9a100 | 63 |
| data-governance-contract-review.md | e2a179a4da5f918abc95b249e74fc9d8672b6cdf585e9393699f77a6f345f4db | 66 |
| identity-onboarding-contract-review.md | 5ac68a4b12a31c45c97a103338ee6be97b7bdecc8f81eb5199f5dd470cbc34ab | 38 |
| log-backup-release-contract-review.md | 20490d0bc418269216c976bb0ef14ad03e70a96bb219d713c75d7d0b5349f4a9 | 55 |
| opportunity-candidate-map.md | 17744f8b5cc5d1d1290f538bb4f7d87dc429cf454d55f81640850c5e31da1083 | 112 |
| opportunity-contract-review.md | 7a64c7b92c82e34242b2e9b5d198661589155f9b981076436de23e80b0f4e760 | 0 |
| organization-governance-contract-review.md | ba2e19a51353eaaacdedb5fe6d8410ce32bebb161756aecca12844350432f1b7 | 108 |
| platform-account-contract-review.md | 1d54e895b9ee198c286e55d5751272dffca7b5fdef7023b23f6ba82f0b7b89d7 | 95 |
| platform-account-detail-contract-review.md | cbe47a11a113348a4c4ea1fd832fff9256243bea684bd565ae0ac738f17e9691 | 0 |
| platform-user-design-contract.md | 13ee1edd1832fba67626c6287a66124c9e82a9a38a43e2ed531a8cb7aafd2cca | 33 |
| provider-definition-contract-review.md | bc1b4913ac38f6dae9349e20d024c954df8207a21187c430f955871bc7ffb971 | 51 |
| runtime-resilience-contract-review.md | ce3cdbd7c5cfbbb9742669505f453096c24d5034da94e08f3b6677d9e41d9432 | 25 |
| scheduler-capacity-contract-review.md | b9979a7fd81a2d449ac87e1fee19784c47d0ac59e531396b294d7fa227273667 | 30 |
| scoring-contract-review.md | 29173894d58fca6a91b955a7c98e5f13534d9d80dee8bc2754d7da5fe0dba389 | 25 |
| selection-journey-contract-review.md | e7e30ff1183efaefbb67ffc64423f3c96dc4c12089dcfb7843b2c7e3c96832b1 | 25 |
| source-channel-credential-contract-review.md | 4b2604132079893ed4b2a7fa63e1a8aee5d08a059426b6272ca91a70022ca7bd | 92 |
| sourcing-cost-contract-review.md | fd1b93dc6825f0b746bbd85d7499d77042f173b163898c8835f70c2b38a91f64 | 84 |
| state-recovery-contract-review.md | b19787b81698e038be0bfce422bb624bf4c50d86e4d3db74a0083f3adf032e71 | 14 |
| task-contract-review.md | 8508892a70054106917e2eadcd046328e1d4568a21f3dea36d1e6da972f39898 | 71 |
| trend-contract-review.md | b62264846fc3f64ba5bf3ec011888d353d425f109a4ca45d5b558a55552f832b | 65 |
| source-scope-review.json | 86bc709d10fd9b28a7cf87ae5b21b73e3ac1ec0ff6c9dc60fd8cec027d66d3a9 | 54 |

## 5. 验证和交付边界

新增17项检查器测试与既有11项清单测试合计28项通过，0失败：格式绑定、未知别名、同一行改动作、重复序号消失、源hash漂移、历史章节/旧列、页面ID误识别、严格路径、缺规格/坏链接、真实仓库重复执行一致性、六个历史清单/审核输入字节不变及CLI完整JSON/拒绝写参数。所有夹具均在内存，CLI子进程执行后结束。

曾有一项历史测试以“New”作为普通标题，但该标题符合既有组件标题格式，触发组件归属；改用明确的“New snapshot”测试历史范围行为后全部通过，未放宽身份判定。终端工具返回大型JSON时曾截断，不能解析；随后用内存投影读取报告，并通过CLI子进程8MiB缓冲测试确认完整JSON可解析，不创建绕过文件。

本批不改Vue/CSS、后端/API/OpenAPI、路由、权限、SQL/迁移、配置/.env、依赖、部署器或生产服务；只交检查器、永久测试、报告、Feature Map与进度索引。无运行合同变更，OpenAPI和环境样例不适用。无新增临时文件/图片/测试服务；旧26批材料不动。正式设计方向仍为F00-1.18-r1待审，完整目标继续；下一步按上表补稳定映射并完成F04b，不重写73份规格。

文档门通过73路由/60受保护/6角色及153份必需文件；runtime-docs通过；代码风格门通过changed=3/production=496/repositories=51，三代码文件与Feature Map显式Prettier检查通过。未运行无变化的产品构建、业务E2E或生产验收。默认摘要命令与完整JSON命令均实际运行，后者在CLI永久测试中解析全部1468条记录；测试子进程和风格门均已终态。

## 6. 当前增量：任务与评分稳定映射

从main/01adf4d干净工作树开始，重新读取两份完整合同、当前候选事件/属性及弹窗定义。TaskWorkspace、TaskListPanel、TaskDetailPanel、TaskBatchActions、ScoreRuleConsole五个完整LF归一文件均与原合同引用的e1f7a9272b5017307754fa60aa691a8bb43b8329相同；逐条核对96个原位置的唯一非dialog-definition候选，不使用最近行号或全局标签替换。新表位于各合同第7节，保留原语义和旧位置，另外登记7个dialog定义；同一dialog的cancel事件和定义是不同源码候选，不计为两个业务弹窗。

| 当前统计 | 结果 |
| --- | --- |
| Web源与输入范围 | 164文件、1478候选、27份合同、73路由/规格；Web源指纹与第1节相同 |
| 全部引用 | 1571，其中非历史1446条源身份均对应，历史125条独立保留 |
| 历史125条 | 原29条加任务71/评分25条行号式记录；旧记录未删除，新表保持逐项语义溯源 |
| 当前唯一稳定对应 | 1408，较初始增加103：任务75、评分28 |
| 剩余未映射 | 70：NavigationShell32、DiscoveryOverlay9、OrganizationRolePanel19、NotFoundPage3、UiStateShowcase6、use-modal-dialog1 |
| 重复引用候选 | 26；共享引用仍不自动当业务冲突 |

新增永久回归读取真实当前候选集合，断言两份新表的ID集合完全一致、行号/类型/hash有效、96条历史语义各有唯一原位置对应，且任务/评分范围不再出现在unreferenced中。静态映射有103项不等于103个业务动作通过；评分7/任务13变体、输入实例、焦点、异步竞态、真实后端、权限、全站新风格和用户意见均继续按原合同验收。G0未冻结、审核计数不变。

报告第4节旧输入hash用于保留前批证据，不替换成当前值冒充旧报告重跑；当前两个合同hash可由--json的documents读取，五个源hash在新表明列。没有产品源、生成清单、图、业务接口或环境变更，无部署/重启要求。本轮不重复产品构建和业务E2E，验证命令仍为第4节工具与清单测试；本增量的最终结果记录在PROGRESS。

## 7. F04a快照：共享入口70项归属与F04b待验卡

本次从main/fa63241干净起点沿实际App→NavigationShell→surface/子组件与工具函数核对，不修改产品源码。新增[共享壳层/发现/角色/状态合同](shared-shell-role-state-contract-review.md)，逐项绑定NavigationShell32、DiscoveryOverlay9、OrganizationRolePanel19、NotFoundPage3、UiStateShowcase6、use-modal-dialog1；六文件完整集合共70项，不是70个业务按钮。

| 当前统计 | 结果 |
| --- | --- |
| 扫描范围 | 164 Web Vue/TS文件、1478候选、28份合同输入、73路由/规格且issues=0 |
| 全部引用 | 1641；非历史1516条identity-current，历史125条独立保留 |
| 当前唯一稳定引用 | 1478；此前1408，新增70 |
| 无稳定引用 | 0；只证明支持格式内源身份齐全，不是无业务缺口 |
| 重复引用候选 | 26，不因重复自动判业务冲突 |
| 源与旧证据 | Web源指纹仍f173913e0fa181d21bc82b3f7adbef060b01133941c0d4295dd1ef06dd05a3df；baseline已登记的16个源差异仍保留 |
| 审核门 | G0=in-progress、denominatorFrozen=false、用户批准0；G1–G5不提升 |

15个当前源hash用于漂移检测，19处v-model另册；输入实例与动态角色/模式不能从70项扫描数推断。新永久测试核对六文件精确ID集合、行/类型/hash、同动作多入口归并、八条旧ST/NF语义沿用及全部15文件hash（含API路由辅助文件）；全站新候选若无归属会失败。审批文件按运行前后字节相同验证，不能因未来合法审批而要求其永远为0。检查器自身仍只报告静态结果，绝不写入审批或冻结状态。

F04b优先UI2-DI02/DI04和UI2-SH04：结果/快捷导航缺少显式close、发现请求缺少世代隔离、同一壳层组件切shell时未显式重新读取guard均是源码线索，待真实Vue复现后决定最小修复，不能称已验证故障或已修复。主题保存竞争、授权写后读失败、原生模态21个候选消费者、DEV生产隔离及ST05/ST06/NF03/NF04仍在清单中。完整G0还需动态实例、原候选语义去向及运行范围归并，不以unreferenced=0通过。

验证结果与清理见PROGRESS；新文档hash可由--json的documents读取。第1–6节旧输入hash保留历史，不替换为新hash冒充原证据重采。本批无UI重设计/实现、API或权限改动、部署或重启；正式F00方向待审，全部73页目标不缩减。

## 8. F04b快照：搜索/导航生命周期修复后对账

本批产品工作原起点498607f；b043fd7仅修订计划并保留四个在途文件，接续后核对原diff与测试记录再收尾。两个Vue组件修复、14项永久浏览器用例和共享合同第8节属于本批，不将其当作纯静态文档。Discovery新增三个click改变候选签名，其余38个两组件候选仅行移动；全部41项按当前AST重新绑定，语义ID和原498607f表的历史可追溯性保持。

当前Web源指纹为8e642cadb9f02ec0f0fb18f3148371d1d3a29b98756a2ef09701957af87b6bf1。164源文件、1478候选、28合同、1641引用（1516现行身份、125历史）、唯一稳定引用1478、无引用0、重复候选26；73路由/73规格issues=0。相对历史baseline的Web源差异为18个，而非前批16；不更新历史baseline或截图hash来掩盖变化。当前共享合同第2/3节两份LF源hash及精确集合通过对应单测；原hash及三签名变化见其第8节。

局部浏览器证据为UI2-DI02的导航关闭/同URL键盘、UI2-DI04旧搜索响应归属、UI2-SH04同实例shell重读及返回时的旧平台响应；隔离接口响应不证明真实鉴权或业务写入。14项桌面/移动各验，已有25项导航/发现模块回归分别复用同源码结果；实际命令/结果及临时清理见PROGRESS。本批无API、权限、SQL、环境、依赖或部署器改动，无当前重启或部署。

第1–7节旧输入和源码指纹是历史证据，不覆盖为本次值。G0仍进行中，用户批准不变；剩余角色/模式、焦点/遮罩、共享调用方及正式设计/生产目标继续，不能用1478映射或局部浏览器通过冻结全站行为分母。

## 9. 当前增量：发现弹窗焦点和输入名称

从243941a只修改DiscoveryOverlay的遮罩默认焦点处理、局部Tab循环和搜索框无障碍名称，未改全局模态工具或其他壳层。Discovery九候选中三项签名变化、六项仅行移动，已据AST重绑源集合和完整LF hash；取消/搜索原语义保留，并登记discovery.focus.cycle，旧表由243941a追溯。当前Web指纹4cd7ea35c482fbd76c3efe83bfd6f7635ff07dfe3f228f6a0bcdbed3a2502bc2，不替换第8节历史指纹。

实跑仍164源、28合同、1478候选、1641引用（1516现行、125历史）、唯一稳定引用1478、未引用0、重复26，73路由/规格issues=0。共享源绑定两项定向单测通过；31项检查器/清单及API/组件边界门通过。原五项red在局部修复后通过；新增17项使合同E2E达31项，与原导航/发现25项桌面和移动分别56/56。具体测试范围及限制见共享合同第9节，截图不抵扣正式设计。

历史baseline、图hash、G0冻结状态及用户审批未写入；API/OpenAPI、业务规则、持久化、配置和生产无变更。所有其他消费者、读屏/浏览器、真实角色/范围、完整图包与发布仍须完成；清理结果在PROGRESS单列，不把代码验证通过解释为完整任务已交付。
