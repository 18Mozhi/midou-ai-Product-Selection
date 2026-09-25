# B1b · 来源频道、1688启用检查与凭证合同

2026-09-09 P50首轮设计补充：[CREDENTIAL-ASSETS-C-r1](design/credential-assets-direction-c/README.md)，58场景双端149PNG（116主图＋33连续长窗局部，含2工具图），六任务变体对应原五模态定义。实际源脚本惰性验证精确写体、三读原子快照和三导入方式部分成功，复现迟到合成文件/助手回填关窗、旧失败清新输入；代次/锁定/未知结果/窗内反馈与焦点保护仅原型。更正下方旧描述：资产/轮换窗已有message，缺失的是档案引用窗；19个源指纹未改。SC50-02–06、到期UTC/本地/null语义、真实Vue/API/权限/加密/MySQL/扩展/自动重放与全主题生命周期、具体图批准仍待办；下一P51。

2026-09-09 P49首轮设计补充：[1688-ACCEPTANCE-C-r1](design/1688-acceptance-direction-c/README.md)，67场景双端134图（含2工具图），零模态。真实Vue脚本惰性验证复现提交成功覆盖随后检查失败，双消息及焦点/展开保护仅原型；24组合只执行源仓储方法、以合成SQL行输入，不等于SQL/真实解析/权限证明。原夹具12/3/1保留，不冒称当前只开一个详情的执行计划结果；source_status=enabled与overall=setup_required可共存，原“保持停用”文案不能代表副作用；分页不足代码not_observed与蓝图“未演练”的文字差异未擅改。19源指纹不变，SC49/具体图、真实Vue/KeepAlive/API/MySQL/隔离浏览器/审批与主题密度仍待验，下一P50。

2026-09-09 P48首轮设计补充：[SOURCE-CHANNELS-C-r1](design/source-channels-direction-c/README.md)，81场景双端162主图＋39连续局部，共201PNG（含2工具图）。实际源脚本/服务惰性检查复现配置二次PUT表单漂移、旧保存关闭新窗、重读失败被成功覆盖；提交快照/归属/未知结果与失败留窗为待审提案，未改下面19个源指纹。原夹具146项及独立烟测、历史、矩阵、1688审批结果分开；没有对应来源结果则明确缺失，合成结果非真实烟测/写入。P49/P50设计、具体审图及SC48/PR-G01/真实Vue/API/MySQL/权限/完整生命周期主题密度继续待办。下文“正式设计图待交”为该合同初稿历史状态，不能代替当前审核状态。

日期：2026-09-08；事实起点main/b52fb56，收尾起点main/4a5725b。对应[P48](page-specs/P48.md)、[P49](page-specs/P49.md)、[P50](page-specs/P50.md)。这是源码合同、一个已复现恢复提示修复与局部Vue回归，不是三页正式重设计、完整无障碍、真实后端、生产或用户审核通过。

## 1. 范围、权限与证据层级

P48 /platform-admin/providers/sources，P49 /platform-admin/providers/sources/1688-acceptance，P50 /platform-admin/credentials，均从ProviderRuntimeSurface分发。目录中P48列platform:operate/platform:superadmin，P49/P50为platform:superadmin；后端分别以provider:configure、collection:replay、platform:superadmin、key_rotation:manage核验。不能由可见菜单推断写权限，也不能把蓝图职责直接改成当前路由权限。

ProviderRuntimeSurface五个RouterLink已随[来源定义合同](provider-definition-contract-review.md)记录；最后两个用platform:superadmin显隐。共享ConfirmDialog、UiStatePanel以及ResponsiveDataView的详情/桌面工具另属共享消费者；本表只统计七个局部Vue，不把共用控件重算成全站新增动作。[异常与确认合同](state-recovery-contract-review.md)只证明已有调用范围，不能代替本页全部变体验收。

| 别名 | 源文件（首轮快照）                                                                                           | 候选数 / v-model数 |
| ---- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| S    | [ProviderSourceCenter.vue](../../apps/web/src/components/ProviderSourceCenter.vue)                           | 21 / 7             |
| A    | [Alibaba1688AcceptanceCenter.vue](../../apps/web/src/components/Alibaba1688AcceptanceCenter.vue)             | 12 / 3             |
| C    | [CredentialAssetCenter.vue](../../apps/web/src/components/CredentialAssetCenter.vue)                         | 33 / 14            |
| F    | [ProviderSourceConfigurationDialog.vue](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue) | 14 / 0             |
| P    | [ProviderParserSampleDialog.vue](../../apps/web/src/components/ProviderParserSampleDialog.vue)               | 7 / 0              |
| R    | [ProviderParserSampleReview.vue](../../apps/web/src/components/ProviderParserSampleReview.vue)               | 2 / 1              |
| M    | [ProviderCompatibilityMatrixDialog.vue](../../apps/web/src/components/ProviderCompatibilityMatrixDialog.vue) | 3 / 0              |

共92个源码候选：控件、事件、弹窗定义/调用可能来自同一节点，不等于92个业务按钮。局部role=dialog定义7个（F2、P1、M1、C3），C资产窗有创建/轮换两变体；另有共享撤销alertdialog、兼容矩阵移动详情。P49没有业务模态。25个v-model源码位置，F另有6个value+input/change转发输入，C文件输入另记事件；不是25个全部业务字段。

上表及第2节的候选数、签名和行号是2026-09-08首轮源码快照，不代表当前仓库分母。P50 2026-09-24当前源码重对账见第8节；未重对账的其余文件不从旧快照推断当前完整度。

本批未改变路由、API、权限、SQL或任何来源启用规则。PR-G01来源准入/烟测规则冲突延续前合同独立待决，不借界面重构选择规则。当前API档案POST没有与资产写入同样的显式no-store响应设置，故不声称所有凭证相关响应均已逐项验证缓存安全；本轮不改API。

## 2. 逐候选对应

签名取现有scanSource；同文件同签名按源码顺序编号。行号仅辅助，源码哈希与签名对应共同用于发现漂移，不能只替换哈希冒充复测。

| 位置键（别名:签名.同签名序号） | 类型 / 行                   | 语义归属                                  |
| ------------------------------ | --------------------------- | ----------------------------------------- |
| S:9287eb0473b9ee05.1           | control / 606               | SC48-LOAD / 刷新目录                      |
| S:436e3971cada0a0b.1           | control / 609               | SC48-DEFINE / 跳来源定义                  |
| S:93ca4e5e94727229.1           | form-event / 638            | SC48-FILTER / 阻止原生表单提交            |
| S:66725db5db9a8fe8.1           | control / 688               | SC48-FILTER / 重置七条件                  |
| S:25214adce9760897.1           | control / 706               | SC48-LOAD / 空目录重读                    |
| S:825fda3d056d6a41.1           | control / 740               | SC48-LINK / HTTPS外链                     |
| S:cd642bd4e8591939.1           | control / 790               | SC48-PROBE / testSource匿名烟测           |
| S:c45fa10015518a56.1           | control / 801               | SC48-CONFIG / beginEdit                   |
| S:ba6b745768e7ce7a.1           | control / 803               | SC48-COMPAT / loadCompatibility           |
| S:d76e5df18057ffbc.1           | control / 812               | SC48-VERSIONS / loadConfigurationVersions |
| S:7f3b2921d6d294b5.1           | control / 818               | SC48-LOGIN / 指定来源登录深链             |
| S:33df1c327ad3e80c.1           | control / 822               | SC48-SAMPLES / loadParserSamples          |
| S:b9ce58d9e8408695.1           | control / 828               | SC48-ACCEPT / 1688检查链接                |
| S:d08df5663e79fcd3.1           | control / 841               | SC48-PAGE / 上页                          |
| S:326dc9fb6fb8f079.1           | control / 847               | SC48-PAGE / 下页                          |
| S:b33f05a20390eaad.1           | event-binding / 852         | SC48-CONFIG/VERSIONS / 子窗事件与表单更新 |
| S:6fc08db08d269bea.1           | dialog-component-call / 852 | SC48-CONFIG/VERSIONS / 两窗调用           |
| S:aed401fdf4d5bd52.1           | event-binding / 869         | SC48-SAMPLES / 关闭、创建、回放、审批事件 |
| S:f00736f4664ddd07.1           | dialog-component-call / 869 | SC48-SAMPLES / 样本窗调用                 |
| S:f28e29bf843d5823.1           | event-binding / 884         | SC48-COMPAT / 关闭事件                    |
| S:ad3654482438f488.1           | dialog-component-call / 884 | SC48-COMPAT / 矩阵窗调用                  |
| A:617a39a925d1099c.1           | control / 300               | SC49-LOAD / 主刷新                        |
| A:ff6d5fbc586803ed.1           | control / 323               | SC49-TECH / 故障详情                      |
| A:5587941412d5210f.1           | control / 327               | SC49-AUTH / 登录链接                      |
| A:441fd57e4a421b3a.1           | control / 328               | SC49-AUTH / 平台返回                      |
| A:4f98bc142c69e6f8.1           | control / 329               | SC49-LOAD / 失败重试                      |
| A:22178a46f3a78fe1.1           | form-event / 422            | SC49-RUN / 提交表单                       |
| A:479ca2276748fa81.1           | event-binding / 425         | SC49-SCOPE / 组织变化读工作区             |
| A:4d5599c177edbee1.1           | control / 466               | SC49-RUN / 发起验收运行                   |
| A:e036d6046f6ca06e.1           | control / 474               | SC49-TASK / 展开task_id                   |
| A:b3ddac540b01d0e1.1           | control / 490               | SC49-LOGIN / 凭证深链                     |
| A:1f17b9f55d6b83f1.1           | control / 491               | SC49-SAMPLE / 来源过滤深链                |
| A:1c008f867673db60.1           | control / 516               | SC49-TECH / 技术详情                      |
| C:62c28f83dd77541b.1           | control / 526               | SC50-LOAD / 刷新                          |
| C:889e842f4791c19d.1           | control / 531               | SC50-HELPER / 下载ZIP                     |
| C:faa93a858a84ea60.1           | control / 536               | SC50-LOGIN / 打开导入                     |
| C:09c5f70e0bef7952.1           | control / 537               | SC50-PROFILE / 打开关联                   |
| C:84ead7c893248e2c.1           | control / 538               | SC50-ASSET / 新建资产                     |
| C:d2b72f6631a5008b.1           | event-binding / 551         | SC50-LOAD / UiStatePanel主操作            |
| C:ad87a22b7d7dedf7.1           | control / 577               | SC50-ASSET / 空态创建                     |
| C:7afaae6e4a36e2ab.1           | control / 626               | SC50-ROTATE / 更新资产                    |
| C:0126143cd8671c5f.1           | control / 628               | SC50-REVOKE / 设置撤销目标                |
| C:1c008f867673db60.1           | control / 742               | SC50-COMPAT / 来源技术详情                |
| C:c7363e018ea03291.1           | event-binding / 751         | SC50-CLOSE / 遮罩与Escape                 |
| C:da4ba31460b3f422.1           | dialog-definition / 757     | SC50-ASSET/ROTATE / 共用模态定义          |
| C:6a716a16299f1b20.1           | form-event / 757            | SC50-ASSET/ROTATE / Tab与saveAsset        |
| C:51909c47b8cea5e6.1           | control / 776               | SC50-CLOSE / 资产右上关闭                 |
| C:c19154c59d261941.1           | control / 829               | SC50-CLOSE / 资产取消                     |
| C:25e471a00cbed149.1           | control / 832               | SC50-ASSET/ROTATE / 提交                  |
| C:921f04fe23cc343e.1           | dialog-definition / 837     | SC50-PROFILE / 模态定义                   |
| C:8f5cb9232f6e0ceb.1           | form-event / 837            | SC50-PROFILE / Tab与saveProfile           |
| C:c3ca275e26012f78.1           | control / 852               | SC50-CLOSE / 档案右上关闭                 |
| C:15bb54ff377e917e.1           | event-binding / 863         | SC50-PROFILE / 所选资产推导provider_id    |
| C:c19154c59d261941.2           | control / 894               | SC50-CLOSE / 档案取消                     |
| C:91ffac2d135459f2.1           | control / 897               | SC50-PROFILE / 保存引用                   |
| C:178c3ac2db1eee78.1           | dialog-definition / 900     | SC50-LOGIN / 模态定义                     |
| C:7a6f1edcd253a703.1           | form-event / 900            | SC50-LOGIN / Tab与saveLogin               |
| C:9cbbc1a74784bca7.1           | control / 915               | SC50-CLOSE / 登录右上关闭                 |
| C:cc887cde3ae93a26.1           | event-binding / 938         | SC50-LOGIN / 方式变更清文件名和载荷       |
| C:45a446ab198a1b4a.1           | event-binding / 951         | SC50-FILE / 异步文件读取                  |
| C:656bff1ad830e5ab.1           | control / 974               | SC50-EXTERNAL / 打开来源登录页            |
| C:cccafd19b3cf9803.1           | control / 977               | SC50-BRIDGE / 请求助手Cookie              |
| C:5f400eb4ffa0ae12.1           | control / 988               | SC50-CLOSE / 登录取消                     |
| C:acee62f093368cd2.1           | control / 989               | SC50-LOGIN / 加密保存并启用档案           |
| C:08ecc5f8d7a27905.1           | event-binding / 996         | SC50-REVOKE / 共享确认取消与提交事件      |
| C:4b5b10b71f689dc3.1           | dialog-component-call / 996 | SC50-REVOKE / ConfirmDialog调用           |
| F:d30e612863853f7f.1           | dialog-definition / 58      | SC48-CONFIG / 编辑窗定义                  |
| F:dafd8d98d9967009.1           | form-event / 65             | SC48-CONFIG / emit保存                    |
| F:f133c5386c615a0f.1           | control / 71                | SC48-CONFIG / 右上关闭                    |
| F:53bc5a81c5404ca3.1           | event-binding / 74          | SC48-CONFIG / 频率输入转发                |
| F:644185cc90b9b1b9.1           | event-binding / 85          | SC48-CONFIG / 超时输入转发                |
| F:46ef6e2130d8850e.1           | event-binding / 94          | SC48-CONFIG / 重试输入转发                |
| F:030a52b2f32d4077.1           | event-binding / 104         | SC48-CONFIG / 状态变更转发                |
| F:05c6bb7562e70a90.1           | event-binding / 143         | SC48-CONFIG / 原因输入转发                |
| F:978645864f7d95c4.1           | control / 152               | SC48-CONFIG / 取消                        |
| F:899501ffcfbb32fc.1           | control / 153               | SC48-CONFIG / 保存或烟测启用              |
| F:0af3a3a9da1e07ad.1           | dialog-definition / 159     | SC48-VERSIONS / 历史窗定义                |
| F:5bfd25c03d15e894.1           | control / 172               | SC48-VERSIONS / 关闭历史                  |
| F:f260a9d94fdf3534.1           | event-binding / 176         | SC48-VERSIONS / 回滚原因转发              |
| F:449abb271a921473.1           | control / 196               | SC48-VERSIONS / 回滚选定版本              |
| P:288313c7a451cdfc.1           | dialog-definition / 63      | SC48-SAMPLES / 样本窗定义                 |
| P:6fc72afafe0d64c5.1           | control / 70                | SC48-SAMPLES / 关闭                       |
| P:ea471875b272e83e.1           | control / 85                | SC48-SAMPLES / 固定候选作业               |
| P:1c008f867673db60.1           | control / 93                | SC48-SAMPLES / 候选技术详情               |
| P:5bb4cd974747c57f.1           | event-binding / 111         | SC48-SAMPLES / 转发review决策与原因       |
| P:9fe911ce0f68afbf.1           | control / 118               | SC48-SAMPLES / 回放样本                   |
| P:1c008f867673db60.2           | control / 126               | SC48-SAMPLES / 样本技术详情               |
| R:915c93b75eb41a91.1           | control / 38                | SC48-SAMPLES / approved审批               |
| R:35b9cb8eaccc4d26.1           | control / 45                | SC48-SAMPLES / rejected驳回               |
| M:190aaa5dd734c333.1           | dialog-definition / 26      | SC48-COMPAT / 矩阵窗定义                  |
| M:f0685e36cb38e6c1.1           | control / 34                | SC48-COMPAT / 关闭                        |
| M:1c008f867673db60.1           | control / 69                | SC48-COMPAT / 技术详情折叠（当前为读取失败追踪） |

## 3. 输入、字段与约束

| 文件 | v-model表达式（源码位置，不是模式展开后的字段实例）                                                                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S    | query、category、availability、market、language、accessMode、sort                                                                                                                                                                                                             |
| A    | selectedOrganizationId、selectedWorkspaceId、acceptanceQuery                                                                                                                                                                                                                  |
| C    | assetForm.provider_id、assetForm.name、assetForm.kind、assetForm.encoding、assetForm.value、assetForm.expires_at、profileForm.credential_asset_id、profileForm.code、profileForm.name、profileForm.locale、profileForm.timezone、profileForm.status、loginProvider、loginMode |
| F    | 无                                                                                                                                                                                                                                                                            |
| P    | 无                                                                                                                                                                                                                                                                            |
| R    | reason                                                                                                                                                                                                                                                                        |
| M    | 无                                                                                                                                                                                                                                                                            |

| 输入组    | 当前约束、转换和持久化边界                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P48七条件 | query/category/availability/market/language/accessMode/sort；仅本地过滤、排序，URL用q/access_mode等既有键；query不是外部采集请求                                                                                    |
| F六转发   | form.schedule_minutes、form.timeout_ms、form.retry_limit、form.status、form.reason、rollbackReason；前三Number转换，范围分别1–10080、1000–120000、0–10整数；原因2–500；服务端校验版本正整数                         |
| P49范围   | 组织与成员均active，工作区active，默认工作区若有效优先否则首个；三绑定为内存，query.trim提交且maxlength200；提交/读范围时选择器禁用，不假设可达快速二次选择                                                         |
| P50资产   | 创建provider_id/name/kind/secret_payload/expires_at；kind为api_key/account_secret/cookie_bundle/private_key/browser_profile，encoding utf8/base64；名称2–160，秘密非空且服务端最大8,000,000字符；到期可空，否则未来 |
| P50轮换   | 仅secret_payload、expected_version、expires_at；后端拒绝已撤销资产；null到期会回退旧值，不等于清除到期                                                                                                              |
| P50引用   | 所选asset推导provider_id，固定chromium；code为2–80位小写字母数字下划线、名称2–160、locale格式、timezone非空且≤80字符；默认disabled/en-US/America/Los_Angeles                                                        |
| P50登录   | 来源对象与cookie_file/browser/archive方式；文件扩展和2,000,000/6,000,000字节限制只是前端入口校验，Cookie还需服务端规范化、目标域校验；不把文件名或字节数当登录成功                                                  |
| 样本复核R | 原因trim后至少2字符，输入maxlength1000；can_review与reviewing控制可见/禁用，提交approved/rejected；服务器第二人、版本及不可变决定校验不可替代                                                                       |
| 共享撤销  | 影响签认及确认文字属于ConfirmDialog输入，不计入局部25位置；父级发送版本和现有固定reason                                                                                                                             |

P48默认business保持目录顺序，attention按待设置/automatic停用等级再中文名，recent按最后成功倒序，name按中文名；每页20条后按用途分组，组总数按全过滤集。全局统计不跟过滤变化。amazon_product/1688_search以provisioned.status决定effectiveAvailability，其他用原availability；automatic不等于全目录所有来源都确已启用。并发缺快照时active=0回退不是实测空闲，调度频率派生目标不是实测SLA。

## 4. 动作与副作用合同

所有API路径在下表省略共同前缀/api/v1；写入沿现有client提供Origin和Idempotency-Key，原method/body不变。

| 语义                             | 当前handler / API                                                                      | 结果与失败边界                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| SC48-LOAD/FILTER/PAGE            | load GET /platform/provider-sources；本地筛选、router.replace、changePage              | reset七条件但保留provider_id及其他query；不是成员POST /provider-sources/refresh，不发起外部采集                                                  |
| SC48-PROBE                       | testSource POST /platform/provider-adapters/{id}/health-check                          | 可能外发真实请求并写健康记录；仅已登记、raw automatic且public_page/public_rss入口可见，不能称纯只读                                              |
| SC48-CONFIG                      | save PUT /platform/provider-sources/{id}/configuration                                 | body五项form+expected_version；停用公开来源启用先PUT disabled→POST烟测→ready再PUT新版本；失败可能已保存停用配置，不笼统称没有写入                |
| SC48-VERSIONS                    | GET configuration/versions；POST configuration/rollbacks                               | 校验current_version；target_version/expected_version/reason生成新的当前版本，历史不改；只能rollback_available入口，单行busy不等于全窗互斥        |
| SC48-SAMPLES创建                 | POST /platform/provider-sources/{id}/parser-samples                                    | browser_job_id、由captured_at生成的name；从既有成功登录候选固定快照，服务端校验候选与当前解析合同，不是上传任意文件                              |
| SC48-SAMPLES回放                 | POST parser-samples/{sampleId}/replays，无body                                         | 从已存快照本地重新解析并持久化passed/changed/failed与差异；不是外部浏览器重新采集                                                                |
| SC48-SAMPLES审批                 | POST parser-samples/{sampleId}/reviews                                                 | decision、reason.trim、expected_version=review_version；另一管理员不可变审批；回放passed不代替approved，不自动启用                               |
| SC48-COMPAT                      | loadCompatibility GET /platform/provider-adapters后按id匹配                            | 显示版本和DOM/HTML指纹观测；缺记录/请求失败留窗错误，无采集写入                                                                                  |
| SC48-LINK/LOGIN/ACCEPT           | HTTPS external、指定来源P50、P49                                                       | 前者新页noopener/noreferrer；后两者只是路由，不执行启用；当前无独立provision按钮                                                                 |
| SC49-LOAD/SCOPE                  | GET /platform/provider-sources/1688-acceptance、/org/memberships、/org/{id}/workspaces | 检查与范围读取分开；scopeMessage不是来源门禁结论；API分别验证所需权限                                                                            |
| SC49-RUN                         | scheduleAcceptanceRun POST /platform/provider-sources/{id}/replays                     | organization_id/workspace_id/query.trim/acceptance_run:true；202 scheduled/task_id只是排队，随后只读一次检查；确会安排浏览器执行，非本地样本回放 |
| SC49-LOGIN/SAMPLE                | 指定provider_id的P50 mode=login、P48                                                   | P48仅过滤定位，不自动打开样本窗；task_id当前只在details，没有新造任务直达/停止按钮                                                               |
| SC50-LOAD                        | GET credential-assets/crawler-profiles/credential-provider-options                     | Promise.all全部成功才替换快照，12秒单飞；不调用解密/导出接口                                                                                     |
| SC50-ASSET/ROTATE                | saveAsset POST credential-assets或credential-assets/{id}/rotate                        | 成功刷新；write finally无论成功失败清assetForm.value；轮换还可能恢复登录受阻任务，不是普通元数据编辑                                             |
| SC50-PROFILE                     | saveProfile POST /platform/crawler-profiles                                            | 关联同来源active浏览器类资产；前端候选与该仓储SELECT未按expires_at过滤，和兼容矩阵ready口径不同                                                  |
| SC50-LOGIN                       | saveLogin依次POST资产、POSTactive档案                                                  | 自动引用zh-CN/Asia/Shanghai；第二次失败不撤销资产，清登录载荷并留窗；本批修正提示，见第6节                                                       |
| SC50-REVOKE                      | ConfirmDialog→revoke POST credential-assets/{id}/revoke                                | expected_version及固定reason，保留历史与审计；父saving防重复，不能据此认定跨目标反馈归属已验                                                     |
| SC50-HELPER/EXTERNAL/BRIDGE/FILE | 下载ZIP、window.open、同窗口UUID消息15秒等待、FileReader/file.text                     | 下载/外部页面/读取秘密分别有副作用；本批不安装助手、不读取真实Cookie；UI2-SC50只用内存合成文件                                                   |

验收门事实：有效同来源active资产/档案+最近succeeded或succeeded_empty运行才通过login；captcha由最近成功或阻塞错误判定；parser需active样本approved、最近回放passed且当前parser版本/时间一致。三门全过且来源enabled为production_ready，三门全过但未enabled为ready_for_enable，否则setup_required。coverage_matrix读取最新浏览器job的搜索、详情、翻页覆盖，是单独观测，不直接参与overall计算。不能用“已提交”“兼容”“来源已启用”三种状态互相替代。

## 5. 弹窗、状态与连续性

| 页面/模态         | 当前状态、关闭与反馈                                                                                                                                                           | 尚未证明                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| P48目录           | 有items时刷新失败仍保留，包括401/403；每次load独立controller，无单飞/代次/卸载清理                                                                                             | 会话清空策略、重入与KeepAlive归属                                                    |
| F配置/历史        | 编辑五字段；历史读取无有效版本或失败关闭窗；父级message承担写入反馈                                                                                                            | 首焦点、Tab循环、Escape、关闭返回、字段错误可感知；保存期间更改来源/输入与烟测中间态 |
| P/R样本           | 读取失败关闭；每行创建/回放/审批busy；批准/驳回按钮同一原因输入                                                                                                                | 行间并发、关窗/换来源后回调归属；审批失败与回放各结果图                              |
| M矩阵             | 打开/loading/有数据/缺记录/请求错误；保留窗内错误                                                                                                                              | 全键盘、缺观察值、长指纹滚动与焦点返回                                               |
| P49               | 主读单飞12秒，卸载abort，无onDeactivated；有旧data失败仍ready并提示；范围读独立                                                                                                | 提交成功notice可能覆盖随后读取失败、范围离开/返回归属；没有轮询完成保障              |
| C资产/引用/login  | 三表单保留局部Tab循环，四类编辑窗改用原生dialog顶层模态与共享useModalDialog；Escape/遮罩/成功和取消返焦已验；closeEditor清两秘密字段；资产/轮换/引用窗均已有message和requestId | CSS隐藏控件未从焦点列表排除；字段错误关联、主题/缩放和其他反馈可感知性仍待验         |
| C异步材料         | 模式变更清载荷/文件名，来源变更不清；文件/助手回调无editor代次                                                                                                                 | 关闭、来源/方式切换、缓存离开后迟到材料及写入归属；不读取真实材料复现                |
| 共享撤销/兼容详情 | 撤销alertdialog要求签认和确认文字；ResponsiveDataView只用于兼容矩阵，资产是卡片                                                                                                | 各调用路径及后台反馈、全主题/缩放/键盘仍要独立验收                                   |

P48初始读取URL后主要是本地状态→URL，没有历史URL→过滤器同步watch；reset不清指定provider_id。P50深链只首次onMounted处理，未匹配会回退首个可登录来源。新设计不能把现有未实现的历史同步或安全阻断写成已具备。7个局部dialog定义中F/P/M无完整统一模态生命周期，保留为需实施事项，不凭role属性宣称通过。

## 6. 本批已复现修复与验证范围

UI2-SC50在原产品提示处出现真实断言失败：期望提示“关闭此窗口并刷新数据”，实际却让用户到只读浏览器档案列表选择。修改仅一条恢复提示，指向“关闭窗口→刷新数据→关联运行档案→选择刚保存资产”，明确无需重新导入；不增加自动刷新、事务合并、自动补偿或持久化字段。

永久测试用隔离响应和Buffer合成Cookie文件：资产POST成功、第一次档案POST503、清载荷后导入提交禁用，按提示关闭/刷新/关联，第二次档案POST成功。断言一个资产POST、两个档案POST、幂等键、两种档案默认值及精确payload；不连接真实资产、扩展、MySQL或外部来源。运行结果及清理见[PROGRESS](PROGRESS.md)，测试入口为tests/e2e/m03-02-credential-assets.spec.ts；不把这一个路径扩称全部敏感编辑流程通过。

| 待验ID  | 后续可执行验证及退出标准                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| SC48-01 | 七条件、排序/组总数/分页、provider_id保留与历史返回；URL和结果双断言                                                                      |
| SC48-02 | 配置版本冲突、失败烟测部分已存、二次启用、历史回滚及关闭/输入归属；核对每次精确写入                                                       |
| SC48-03 | 固定候选、passed/changed/failed、双人不可变决定、跨来源/关窗回调；真实后端证据另标                                                        |
| SC48-04 | 兼容矩阵缺记录/失败/旧值、指纹版本；明确纯读取与真实观测区别                                                                              |
| SC48-05 | 四模态完整键盘、错误关联、长文本/缩放/主题/密度与真实权限拒绝                                                                             |
| SC49-01 | 三门与来源状态组合、最新parser和缺证据、coverage矩阵独立；不推导新增门                                                                    |
| SC49-02 | 组织/工作区、精确query与202排队、不自动启用；隔离任务执行结果另验                                                                         |
| SC49-03 | 刷新失败保留、真实401/403、提交后的读失败不掩盖；过期证据可见                                                                             |
| SC49-04 | 读范围/离开/缓存返回、禁用可达性、长中文/键盘与中间断点                                                                                   |
| SC50-01 | UI2-SC50部分保存恢复已作本批定向修复；模块双视口结果按PROGRESS，不代表下列项已验                                                          |
| SC50-02 | 三读部分失败/401/403、创建/轮换/撤销/引用错误必须在当前操作面可感知                                                                       |
| SC50-03 | 文件与助手迟到、切来源/模式、关闭/卸载/KeepAlive及五类弹窗成功/取消焦点返回已由独立批次覆盖；保留跨KeepAlive实例淘汰结算与CSS隐藏控件焦点 |
| SC50-04 | 到期UTC初始化/本地保存、null语义、过期候选、目标域；先确认真实持久化合同再改                                                              |
| SC50-05 | 真实轮换自动重放、事务/幂等/版本/撤销、API与路由六角色边界；仅授权隔离对象                                                                |
| SC50-06 | 全编辑/共享确认/移动详情、长文本、200%缩放、主题密度、44px与秘密不入图                                                                    |

SC50规格中的02–06用例在此细化归属；永久测试只新增SC50-01。未验证事项保持未验，不能用静态映射、HTML研究图或旧模块verified状态抹掉。

## 7. 来源指纹与交付边界

以下19个源文件是本批对应依据，包含7个局部Vue、共享入口/确认、路由目录、API/服务/仓储和两个测试入口。只读校验应逐一计算LF归一SHA，并按七文件重跑scanSource，核对每个签名/序号/类型/行和25个v-model，另外核对F六转发字段。签名数校验不证明语义和运行行为；语义依据见上述handler/API及逐页规格。

| 源文件                                                         | SHA256（UTF-8，CRLF归一为LF）                                    |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| apps/web/src/components/ProviderSourceCenter.vue               | 70fb94b0c529b7a644287e183e7b24909f3dff1ae952360f9b31c78246e382d6 |
| apps/web/src/components/Alibaba1688AcceptanceCenter.vue        | 4cd83fa5b9483996cbe6ada429b48202a7c83796fbf83e774844c938f918ba3f |
| apps/web/src/components/CredentialAssetCenter.vue              | 4c4064c119242a6d7023767f796e70634f71fd0832eca1b2ddd62de56206e1be |
| apps/web/src/components/ProviderSourceConfigurationDialog.vue  | 0786175eeec5c01f9126b3a3bf709805c03110bc15646c2ed205f835cd8d4a01 |
| apps/web/src/components/ProviderParserSampleDialog.vue         | 4f78cca0615cf7ee6eaeff12d0d508ecb5e457eac6600e87ea89c2911fd549b0 |
| apps/web/src/components/ProviderParserSampleReview.vue         | f320cb377f542762b993e7462177fe86aca5adc7d8c4e5d0ec4a2831cc66309a |
| apps/web/src/components/ProviderCompatibilityMatrixDialog.vue  | 409cdda0a6bb75ec297de154713d731671a5dfc4c707d7d04695d139c2881334 |
| apps/web/src/components/ProviderRuntimeSurface.vue             | a00c9a5067e5756da93c4ea7b88d6a42cca963202eda533ab3ce96d16c5856a6 |
| apps/web/src/components/ConfirmDialog.vue                      | 6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b |
| config/route-catalog.json                                      | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| apps/api/src/provider-source-routes.ts                         | b8976fbbf6d8400cd167a26bd2e4a349a4e38dfe2cd4511e778cfad8f657afd9 |
| apps/api/src/provider-source-service.ts                        | d1c7e567f59a5936cb4683f872681c6249839c065d63960f115c61a4610ea053 |
| apps/api/src/mysql-provider-source-sample-repository.ts        | c8e7aecfea77136a5257d16bc3bdb22cc624dcdb7b5377b607547824abd883d1 |
| apps/api/src/mysql-provider-source-sample-review-repository.ts | b14265734d11be0665407fd3119c4a714118f6cb9c083b203f41b7c3d7c2278d |
| apps/api/src/credential-asset-routes.ts                        | 7a860b7279ae3700719f51707762cdb6bc53b82f96dc9a50c1d3f3112be671d3 |
| apps/api/src/credential-asset-service.ts                       | 27c3aa04144be0cc9ffaec7aa8d3dbd39b3adf1128ba98c6abc94c04bbbc4a7d |
| apps/api/src/mysql-credential-asset-repository.ts              | adba8e4d902e6c411633070cd607b86fb50f2a00f8445641cba9990fc64466ed |
| tests/e2e/m03-02-credential-assets.spec.ts                     | 0b735d56167c0c9e86b4bc7a3f3f8e8c3b6bc04106c0286bb9b1d05353c16929 |
| tests/e2e/m03-07-provider-sources.spec.ts                      | 29c1232a33cb260beeee6851f33c4558873d25e47e538d6a2e04c47eaa6ba5fe |

本批三份规格和此合同是永久交付；正式设计/实现图片仍待F00反馈及F05，不产生新的用户通过数。没有新配置、迁移、依赖或生产服务；前端文案需未来按既有发布流程上线，本批不部署、不单独重启任何服务。W06下一事实小批为P51/P52/P53；整体73页、全动作/弹窗、正式图、Vue、真实验收、宝塔与用户签收目标保持未完成。
2026-09-12 P50焦点实施补充：[P50-CREDENTIAL-EDITOR-FOCUS-IMPLEMENTATION](P50-CREDENTIAL-EDITOR-FOCUS-IMPLEMENTATION.md)。创建/轮换、档案引用和网页登录四类生产编辑窗已迁移到原生dialog顶层模态并复用useModalDialog；撤销继续共享ConfirmDialog。五状态四宽度236项检查覆盖初焦点、双向循环、Escape、遮罩和返焦，保存成功返焦另有真实Vue E2E。焦点筛选仍只显式排除hidden属性；CSS隐藏、字段错误关联、主题/缩放和跨KeepAlive实例淘汰仍待验。审核CSS与20图未进入生产，未部署；旧19源指纹是事实规格批历史记录，不表示当前源码哈希。

## 8. P50 早期当前源码映射（已由第15节替代）

本节是2026-09-24当时的 `CredentialAssetCenter.vue` 身份映射快照，现由第15节的完整32候选当前映射替代。原24个变更身份与另8个有效身份只作为历史来源保留；本节不再用于推断当前行号、签名或行为。来源合同和业务语义未因此改变，也不据静态归档宣称交互或生产验收。

### C

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| C:2810dd41ddee1daa.1 | control / 909 | SC50-LOAD / 刷新数据 |
| C:3dd38f73a19db4fb.1 | control / 919 | SC50-LOGIN / 打开网页登录导入 |
| C:2e0a063790f5638a.1 | control / 920 | SC50-PROFILE / 打开档案关联 |
| C:ead97caf0ed12ed6.1 | control / 921 | SC50-ASSET / 打开新建资产 |
| C:68ab04f336a5aea2.1 | control / 971 | SC50-ASSET / 空态创建 |
| C:391ebd4042d56809.1 | control / 1020 | SC50-ROTATE / 更新凭证资料 |
| C:c0dce8cdd65ebd20.1 | control / 1026 | SC50-REVOKE / 选择撤销目标 |
| C:4992a119c9f2a3c5.1 | dialog-definition / 1149 | SC50-ASSET/ROTATE/PROFILE/LOGIN / 条件共用编辑窗定义 |
| C:08b722979514ecf4.1 | event-binding / 1149 | SC50-CLOSE / 编辑窗取消与遮罩关闭 |
| C:7346da1c6e27ba75.1 | form-event / 1163 | SC50-ASSET/ROTATE / Tab与saveAsset |
| C:9707b61afc89bba7.1 | control / 1179 | SC50-CLOSE / 资产编辑窗关闭 |
| C:6dcca6c17ebcddaf.1 | form-event / 1241 | SC50-PROFILE / Tab与saveProfile |
| C:159072d05198b551.1 | control / 1253 | SC50-CLOSE / 档案编辑窗关闭 |
| C:8ed15facc7f55e8e.1 | form-event / 1305 | SC50-LOGIN / Tab与saveLogin |
| C:868396bd7e29df98.1 | control / 1318 | SC50-CLOSE / 登录导入窗关闭 |
| C:d2a64908945092ff.1 | event-binding / 1546 | SC50-LOGIN / 来源选择及材料上下文重置 |
| C:1430f57a236d6ea1.1 | event-binding / 1558 | SC50-LOGIN / 导入方式切换及材料上下文重置 |
| C:7443d228a98eebd4.1 | event-binding / 1569 | SC50-FILE / 受控文件选择 |
| C:e22b7ca36f2434d7.1 | control / 1593 | SC50-EXTERNAL / 打开来源登录页 |
| C:f176fdb4640192de.1 | control / 1596 | SC50-BRIDGE / 请求助手Cookie |
| C:54e090f9e49dd400.1 | control / 1402 | SC50-CLOSE / 取消登录导入 |
| C:e4a3873e7b511170.1 | control / 1403 | SC50-LOGIN / 分两步加密保存并启用档案 |
| C:23573257838670f1.1 | event-binding / 1425 | SC50-REVOKE / ConfirmDialog取消与确认事件 |
| C:af931088469ec90b.1 | dialog-component-call / 1425 | SC50-REVOKE / ConfirmDialog调用 |


第7节全部旧指纹保留为历史快照；审计器仅用非历史指纹判断当前源码绑定。此项对账不覆盖P50未决真实扩展、后端/RBAC、加密、MySQL、完整交互矩阵与生产验收。

## 9. P48 来源配置弹窗拆分后的当前源码身份复核（2026-09-24）

按当前真实组件树分别核对：`ProviderSourceConfigurationDialog.vue` 是属性/事件中介，编辑表单及其焦点、字段和提交控件位于 `ProviderSourceEditDialog.vue`，版本历史及回滚控件位于 `ProviderSourceVersionHistoryDialog.vue`。将25个候选分别绑定到实际源文件：编辑子窗13项、历史子窗8项、父中介的子组件调用/事件转发4项。父组件继续原样转发既有 props/emits；保存、先停用再烟测启用、回滚和 API/RBAC 所有权均未改变。此为静态源码归属校正，不证明动态状态、权限、真实写入或生产验收通过。

### G

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| apps/web/src/components/ProviderSourceEditDialog.vue#5dde29b862125b0e.1 | dialog-definition / 64 | SC48-CONFIG / 编辑设置弹窗定义及初始焦点 |
| apps/web/src/components/ProviderSourceEditDialog.vue#fd96a0ddfd39623f.1 | event-binding / 64 | SC48-CONFIG / 编辑弹窗键盘焦点事件 |
| apps/web/src/components/ProviderSourceEditDialog.vue#683678bf384a1e42.1 | form-event / 74 | SC48-CONFIG / 表单提交转发既有save |
| apps/web/src/components/ProviderSourceEditDialog.vue#004f04ff66f655ca.1 | control / 94 | SC48-CONFIG / 关闭编辑设置并按阶段通知 |
| apps/web/src/components/ProviderSourceEditDialog.vue#1c008f867673db60.1 | control / 122 | SC48-CONFIG / 处理结果技术详情折叠 |
| apps/web/src/components/ProviderSourceEditDialog.vue#a3dad946584f7803.1 | event-binding / 127 | SC48-CONFIG / schedule_minutes转Number并更新既有表单 |
| apps/web/src/components/ProviderSourceEditDialog.vue#73764f74b8f1a61a.1 | event-binding / 139 | SC48-CONFIG / timeout_ms转Number并更新既有表单 |
| apps/web/src/components/ProviderSourceEditDialog.vue#0d47ebf53fe0590e.1 | event-binding / 151 | SC48-CONFIG / retry_limit转Number并更新既有表单 |
| apps/web/src/components/ProviderSourceEditDialog.vue#c57686ba7c1f6588.1 | event-binding / 164 | SC48-CONFIG / status更新既有表单 |
| apps/web/src/components/ProviderSourceEditDialog.vue#c0923c491565b4ef.1 | event-binding / 205 | SC48-CONFIG / reason更新既有表单 |
| apps/web/src/components/ProviderSourceEditDialog.vue#c74c69289cda1b1c.1 | control / 226 | SC48-CONFIG / 确认结果后关闭并回到目录同步流程 |
| apps/web/src/components/ProviderSourceEditDialog.vue#a8cf70fb83e27873.1 | control / 236 | SC48-CONFIG / 取消或关闭未完成设置 |
| apps/web/src/components/ProviderSourceEditDialog.vue#d166a16792084fe1.1 | control / 237 | SC48-CONFIG / 原保存或烟测提交入口 |

| apps/web/src/components/ProviderSourceEditDialog.vue | 4387b56eb3b8954e8916f7e547ba932a51f6c06bf506db10ccec453fcf3e9296 |

### H

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#22ecf14cfd3d483f.1 | dialog-definition / 76 | SC48-VERSIONS / 配置版本弹窗定义及初始焦点 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#6998c14c2116e210.1 | event-binding / 76 | SC48-VERSIONS / 版本弹窗键盘焦点事件 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#7cef35300d9577fb.1 | control / 96 | SC48-VERSIONS / 关闭版本弹窗 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#1c008f867673db60.1 | control / 128 | SC48-VERSIONS / 处理结果技术详情折叠 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#c73ff040b3307a5d.1 | control / 131 | SC48-VERSIONS / 按既有结果状态重读目录与历史 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#ada59de7960940c4.1 | event-binding / 147 | SC48-VERSIONS / rollbackReason更新既有表单 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#812f9da80a8dbb06.1 | control / 172 | SC48-VERSIONS / 对可回滚版本发既有rollback事件 |
| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue#b7bbd08aecc4de79.1 | control / 193 | SC48-VERSIONS / 关闭版本弹窗 |

| apps/web/src/components/ProviderSourceVersionHistoryDialog.vue | 883969c440b50856fc61c21cbbc68bc3c56762327cacb4496fde410e99d4d581 |

### F

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| F:f8f748c674190729.1 | event-binding / 46 | SC48-CONFIG / 编辑窗的既有 props 与事件回传 |
| F:0e32b5a54eb60075.1 | dialog-component-call / 46 | SC48-CONFIG / 调用专属编辑设置子组件 |
| F:ed9b168dbe1f3587.1 | event-binding / 60 | SC48-VERSIONS / 版本窗的既有 props 与事件回传 |
| F:6b2f9fa5430c552d.1 | dialog-component-call / 60 | SC48-VERSIONS / 调用专属版本历史子组件 |

| apps/web/src/components/ProviderSourceConfigurationDialog.vue | 5fc3235c14ac208b768abc95c60807d8f646037d6ff43265d5e1b3eb7432422f |

## 10. P48 来源目录当前源码身份复核（2026-09-24）

P48当前真实目录由 `ProviderSourceCenter.vue` 保持读取、URL筛选、分页、写入及弹窗编排，目录事实与详情交互拆在 `ProviderSourceDirectory.vue`。本节为拆分后P48的当前源位置与既有SC48合同做静态归属；不新增API、业务动作、授权或来源启用规则。ProviderSourceCenter共16个候选，其中15个身份变化；ProviderSourceDirectory有12个候选。详情开合与父子emit属于本地展示/转发，不另算外部或持久化动作。

### S

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| S:8b5b066073993a3a.1 | control / 672 | SC48-LOAD / 刷新来源目录 |
| S:436e3971cada0a0b.1 | control / 675 | SC48-DEFINE / 导航至既有来源规则目录 |
| S:090fa072a224b63e.1 | event-binding / 704 | SC48-FILTER / 七条件、排序与重置事件转发 |
| S:1c008f867673db60.1 | control / 742 | SC48-CONFIG / 配置保存后目录同步失败的技术详情 |
| S:b1a60fde5d6ec9d6.1 | control / 745 | SC48-CONFIG / 保存结果后的目录重读 |
| S:1c008f867673db60.2 | control / 804 | SC48-LOAD / 登录、权限或目录读取失败的技术详情 |
| S:adb5a27ee7e15104.1 | control / 807 | SC48-LOAD/LOGIN / 按当前失败态重新加载或重新登录 |
| S:1c008f867673db60.3 | control / 866 | SC48-LOAD / 目录刷新结果的技术详情 |
| S:22e451664b4ba746.1 | control / 869 | SC48-LOAD / 刷新失败后重新加载 |
| S:52eea605d2c84eb0.1 | event-binding / 879 | SC48-PAGE/PROBE/CONFIG/COMPAT/VERSIONS/LOGIN/SAMPLES / 目录子组件与既有处理函数的事件转发 |
| S:0d05b40ba4543887.1 | event-binding / 902 | SC48-CONFIG/VERSIONS / 配置弹窗属性与既有事件转发 |
| S:7f36e42eb80bca2d.1 | dialog-component-call / 902 | SC48-CONFIG/VERSIONS / 配置与版本弹窗调用 |
| S:aebc04fe71463aa3.1 | event-binding / 930 | SC48-SAMPLES / 样本弹窗读写、复核与恢复事件转发 |
| S:e86a06afbe712ab0.1 | dialog-component-call / 930 | SC48-SAMPLES / 固定样本弹窗调用 |
| S:8665cbf979729f72.1 | event-binding / 951 | SC48-COMPAT / 兼容矩阵关闭事件转发 |
| S:1c8002dd18f07872.1 | dialog-component-call / 951 | SC48-COMPAT / 兼容矩阵弹窗调用 |

### D

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| D:2d157da14935d5c1.1 | control / 110 | 目录本地详情展开；无API或持久化副作用 |
| D:7d1dbd0396d36c73.1 | control / 120 | 目录本地详情收起并返回触发点 |
| D:825fda3d056d6a41.1 | control / 125 | SC48-LINK / 打开HTTPS来源页面 |
| D:2379d17cd7b2d01d.1 | control / 172 | SC48-PROBE / 对符合条件的已登记公开来源发起匿名烟测 |
| D:130f527eb216a92c.1 | control / 184 | SC48-CONFIG / 打开来源采集设置 |
| D:e6b03d1f68d67db6.1 | control / 187 | SC48-COMPAT / 打开解析兼容矩阵 |
| D:7209e2bc02cd1433.1 | control / 197 | SC48-VERSIONS / 打开版本与回滚记录 |
| D:7f3b2921d6d294b5.1 | control / 200 | SC48-LOGIN / 指定来源网页登录凭证深链 |
| D:d0be2fd8fba97ff5.1 | control / 205 | SC48-SAMPLES / 打开1688固定样本回放 |
| D:b9ce58d9e8408695.1 | control / 212 | SC48-ACCEPT / 打开1688登录准备页 |
| D:6f7e71d427cb36b9.1 | control / 227 | SC48-PAGE / 上一页 |
| D:f3f3456654086e7b.1 | control / 239 | SC48-PAGE / 下一页 |

| apps/web/src/components/ProviderSourceCenter.vue | 26b1a0945f40be382a5acf7fc9b1c3e03e8ba019d1688816d16773206d32638a |
| apps/web/src/components/ProviderSourceDirectory.vue | ef10bdd7df7e4887d0c158a0b251caaffe4648afb66895e0c02f6408e10e7c34 |

两文件身份和当前LF归一指纹可由定向审计与单测复验。此处不代表真实API、来源权限、匿名外发烟测、数据库写入或M07-03生产签收通过。

## 12. P48 当前来源筛选控件源码归属（2026-09-24）

`ProviderSourceFilters.vue` 将七个既有筛选/排序值和一个重置意图向父级转发；查询条件只用于本地过滤、排序，不构造外部采集请求。以下是当前组件10个候选的源码身份与位置，不把可见选项扩成来源启用、调度或准入规则。

### apps/web/src/components/ProviderSourceFilters.vue

| 当前签名.序号 | 行 | 类型 | 语义归属 |
| --- | ---: | --- | --- |
| 93ca4e5e94727229.1 | 32 | form-event | SC48-FILTER / 阻止原生表单提交；筛选由受控状态实时转发 |
| 5281327449b79f93.1 | 35 | event-binding | SC48-QUERY / 输入搜索词并转发给父级本地筛选，不是外部采集查询 |
| 75e56e4f7649133c.1 | 44 | control | SC48-FILTER / 展开或收起筛选字段，仅改变当前组件披露状态 |
| e11b831f9f4d2c7d.1 | 60 | event-binding | SC48-CATEGORY / 转发来源业务类型选择 |
| 0f44dd2cc5c4f38d.1 | 75 | event-binding | SC48-AVAILABILITY / 转发目录准备/接入状态筛选值 |
| 6fd1d25947538652.1 | 88 | event-binding | SC48-MARKET / 转发父级提供的市场选项值 |
| cdae0919d938956d.1 | 101 | event-binding | SC48-LANGUAGE / 转发父级提供的语言选项值 |
| a13365beca192210.1 | 114 | event-binding | SC48-ACCESS / 转发五种既有来源接入模式筛选值 |
| 6f2c0ea92fa946fa.1 | 129 | event-binding | SC48-SORT / 转发既有业务顺序、待配置优先、名称或最近成功排序选项 |
| 1c28ad647bfe0100.1 | 140 | control | SC48-RESET / 请求父级按既有默认值重置筛选 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/ProviderSourceFilters.vue | 72ac91e65cb14e0d4cb212582f607d2c8b34786be76c40a8cb7bf60dea2f0855 |

当前映射与第3节本地筛选/排序合同一致；指纹与候选回归只验证源码归属，不验证真实来源、目录响应、浏览器交互、生产权限或M07-03验收。

## 11. P48/P49 样本、兼容与1688页面当前身份复核（2026-09-24）

按已有SC48/SC49语义合同映射来源样本窗、解析兼容矩阵与1688登录验收入口当前变化的源码位置。样本创建、回放、独立审批分别保留原有写入边界；兼容矩阵与登录准备检查的读取追踪不与审批、自动启用或真实外部采集结果合并。每个映射是静态源归属，非真实请求/权限验收。

### P

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| P:8ee37a2198be5237.1 | dialog-definition / 88 | SC48-SAMPLES / 固定样本与独立复核弹窗定义 |
| P:f99085051f5e9a07.1 | event-binding / 88 | SC48-SAMPLES / 弹窗焦点键盘事件 |
| P:2f8ca16ba8121e8d.1 | control / 105 | SC48-SAMPLES / 关闭样本回放弹窗 |
| P:479570dac45574ea.1 | control / 147 | SC48-SAMPLES / 样本读取追踪折叠 |
| P:bff21091a1634b97.1 | control / 150 | SC48-SAMPLES / 仅重读样本目录 |
| P:78c716f6150b4d8d.1 | control / 161 | SC48-SAMPLES / 固定既有合格采集候选 |
| P:d589eec4cb2fcd7b.1 | event-binding / 183 | SC48-SAMPLES / 独立复核子窗决策与原因转发 |
| P:27382a3b9a4eeefc.1 | control / 190 | SC48-SAMPLES / 对固定快照运行差异回放 |
| P:1c008f867673db60.3 | control / 194 | SC48-SAMPLES / 回放结果技术详情折叠 |
| P:1fc800f4950732d7.1 | control / 215 | SC48-SAMPLES / 关闭样本回放弹窗 |

### M

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| M:e0fca0e8a134dc18.1 | dialog-definition / 52 | SC48-COMPAT / 页面版本兼容观测弹窗定义 |
| M:4e008aa9606a1b01.1 | event-binding / 52 | SC48-COMPAT / 弹窗焦点键盘事件 |
| M:279ef6005288b890.1 | control / 72 | SC48-COMPAT / 关闭矩阵弹窗 |
| M:de2e72710c0578f2.1 | control / 147 | SC48-COMPAT / 展开完整页面SHA-256指纹 |
| M:3cbfff12b70782af.1 | control / 184 | SC48-COMPAT / 关闭矩阵弹窗 |

### A

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| A:708367f1d5691c04.1 | control / 128 | SC49-LOGIN / 打开本来源凭证导入深链 |
| A:16f98bc87eeb7bf3.1 | control / 129 | SC49-SAMPLE / 打开本来源固定样本入口 |
| A:191135a63725390b.1 | control / 132 | 检查门口径说明折叠；不新增业务动作 |
| A:b39d5c4a0f3599f8.1 | control / 149 | SC49-LOAD / 重新读取登录验收检查 |
| A:71ad1e14ab5adcdd.1 | control / 164 | SC49-TECH / 本次读取追踪折叠 |
| A:a1d4481c811f2e52.1 | control / 183 | SC49-LOAD / 按既有读取流程重试 |
| A:d7d20d959f3300b0.1 | event-binding / 200 | SC49-SCOPE/RUN / 范围、表单与既有验收提交子组件事件转发 |

### E

`ProviderAcceptanceExecution.vue`仅呈现并转发 P49 执行表单，不直接读写 API。组织变化、工作区/关键词受控输入、表单提交与范围重读均由 `Alibaba1688AcceptanceCenter`/既有 composable 接收；两个技术披露只展开当前追踪标识。提交状态为“已确认排队”时也不等于浏览器运行完成；维持第6节与 P49 事实规格的提交/权限/无轮询边界。

| 当前位置键 | 类型 / 行 | 既有语义归属 |
| --- | --- | --- |
| E:9dc337a873726e6c.1 | form-event / 46 | SC49-RUN / 阻止原生表单并转交父级提交意图 |
| E:6b7a113037c90aeb.1 | event-binding / 49 | SC49-SCOPE / 组织选择变化交给父级协调范围 |
| E:df6130602862326a.1 | event-binding / 67 | SC49-SCOPE / 工作区受控选择更新 |
| E:e941099000a6691d.1 | event-binding / 81 | SC49-RUN / 验收关键词受控输入 |
| E:4d5599c177edbee1.1 | control / 92 | SC49-RUN / 发起一次既有受控登录验收提交 |
| E:91f41f7556925861.1 | control / 104 | SC49-SCOPE / 请求父级重新读取组织与工作区范围 |
| E:78c1c9ecc2d9214c.1 | control / 108 | SC49-TRACE / 展开组织范围读取关联编号 |
| E:f617d68579969564.1 | control / 125 | SC49-TRACE / 展开本次提交任务/关联编号 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/ProviderAcceptanceExecution.vue | 8845f961637e96dedb38d9aa362560410eabffea7ab97f80ca64ff9d54fb2422 |

候选映射只证明本子组件当前静态位置与父子意图归属；不替代 P49 GET/POST、服务端 `collection:replay` 权限、幂等键、范围校验或真实浏览器采集验收。

### R

`ProviderParserSampleReview.vue` 的审批通过/驳回仍是既有SC48-SAMPLES动作；其当前源身份在第14节重新登记，避免依赖第2节旧快照。四个文件的当前LF归一指纹单独记录如下。

| apps/web/src/components/Alibaba1688AcceptanceCenter.vue | 8fbcc5c66beb1ecff7488dc7e4c14298e5e3869201b72c5e20f7a9c17991330c |
| apps/web/src/components/ProviderParserSampleDialog.vue | 28095c0a0470cf2ca7a51640879771fe7be0591597f91a4417fbb56b28017fc6 |
| apps/web/src/components/ProviderParserSampleReview.vue | c95c962e4757cf419bbca6c338da3a0c459c7301604c901b3da5e3e0d4c0ceb7 |
| apps/web/src/components/ProviderCompatibilityMatrixDialog.vue | a801a72cdebfcfc1d549263e3307fe923260606b934468a070ebbe2d33504f03 |

## 13. P49 ProviderAcceptanceOperations 当前呈现归属（2026-09-24）

父级 `Alibaba1688AcceptanceCenter` 计算并传入 `credentialsLink` 与 `sampleLink`；本组件分别渲染“配置或续期登录档案”“定位1688固定样本”两个RouterLink，并通过原生`details`展示启用条件与读取追踪。组件不创建凭据、不审批固定样本、不触发验收任务或读取API；上述业务行为仍由目标页面和父级所有者承担。

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/ProviderAcceptanceOperations.vue#b3ddac540b01d0e1.1 | 29 | control | SC49-CURRENT-NAV / 跳转父级提供的登录档案配置/续期目标 |
| apps/web/src/components/ProviderAcceptanceOperations.vue#1f17b9f55d6b83f1.1 | 30 | control | SC49-CURRENT-NAV / 跳转父级提供的固定样本目标 |
| apps/web/src/components/ProviderAcceptanceOperations.vue#3454720e54e9d8c8.1 | 54 | control | SC49-CURRENT-TECH / 展开本地服务端运行与读取追踪信息 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/ProviderAcceptanceOperations.vue | 12724a3fa2359a87e48748313448f7eece817fa3f8d6423f9faf409fd4a99f8f |

## 14. P48/P49 旧快照候选的当前身份补列（2026-09-24）

第2节明确是2026-09-08源码快照；本节把仍在当前源码中的17个位置重新绑定到已有SC48/SC49语义，不把过期签名当作当前证据。只确认静态候选身份，不增加业务动作，也不证明动态交互、真实权限或生产业务验收。

| 当前candidateId | 行 | 类型 | 既有语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/Alibaba1688AcceptanceCenter.vue#ff6d5fbc586803ed.1 | 176 | control | SC49-TECH / 展开本次检查故障编号 |
| apps/web/src/components/Alibaba1688AcceptanceCenter.vue#5587941412d5210f.1 | 180 | control | SC49-AUTH / 检查会话过期时返回登录 |
| apps/web/src/components/Alibaba1688AcceptanceCenter.vue#441fd57e4a421b3a.1 | 181 | control | SC49-AUTH / 无权时返回平台概览 |
| apps/web/src/components/CredentialAssetCenter.vue#889e842f4791c19d.1 | 1003 | control | SC50-BRIDGE / 下载浏览器助手 |
| apps/web/src/components/CredentialAssetCenter.vue#1c008f867673db60.1 | 1229 | control | SC50-TECH / 展开来源代码技术详情 |
| apps/web/src/components/ProviderCompatibilityMatrixDialog.vue#1c008f867673db60.1 | 84 | control | SC48-COMPAT / 展开兼容观测读取失败编号 |
| apps/web/src/components/ProviderParserSampleDialog.vue#1c008f867673db60.1 | 132 | control | SC48-SAMPLES / 展开本次样本操作编号 |
| apps/web/src/components/ProviderParserSampleDialog.vue#1c008f867673db60.2 | 165 | control | SC48-SAMPLES / 展开候选采集解析器版本 |
| apps/web/src/components/ProviderParserSampleReview.vue#915c93b75eb41a91.1 | 47 | control | SC48-SAMPLES / 提交既有审批通过决策 |
| apps/web/src/components/ProviderParserSampleReview.vue#35b9cb8eaccc4d26.1 | 54 | control | SC48-SAMPLES / 提交既有驳回决策 |
| apps/web/src/components/ProviderSourceCenter.vue#436e3971cada0a0b.1 | 675 | control | SC48-DEFINE / 导航至既有来源规则目录 |
来源页面入口身份不证明真实登录、固定样本审批、浏览器采集、来源启用、角色隔离或生产结果。

## 15. P50 当前凭证台账与表单候选补映射（2026-09-25）

本节按当前 `CredentialAssetCenter.vue` 真实模板重建现行源码映射，并承接第8节五个仍有效的控件身份。每个候选都归入既有 SC50 读取、资产、档案、登录、焦点/关闭或撤销语义；复用子表单、原生字段错误反馈与父级事件转发不扩大业务动作分母，不新增路由、API、字段、权限或数据行为。历史扫描行继续作为历史证据；本节位置、类型和当前文件指纹用于全站静态来源覆盖，不等于运行时、读屏器、真实 RBAC、秘密材料或生产验收。

| 当前candidateId | 行 | 类型 | 既有语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/CredentialAssetCenter.vue#4cff98e257b4af2d.1 | 998 | control | SC50-LOAD / 按既有读取函数刷新安全资产与运行档案 |
| apps/web/src/components/CredentialAssetCenter.vue#3216d7209881fb86.1 | 1008 | control | SC50-LOGIN / 打开网页登录档案导入窗 |
| apps/web/src/components/CredentialAssetCenter.vue#da51ee773f1eb5e2.1 | 1009 | control | SC50-PROFILE / 打开既有运行档案关联窗 |
| apps/web/src/components/CredentialAssetCenter.vue#07c8680b127235e2.1 | 1010 | control | SC50-ASSET / 打开凭证资产新建窗 |
| apps/web/src/components/CredentialAssetCenter.vue#466d5492514f7a0e.1 | 1034 | event-binding | SC50-LOAD / 读取失败面板的主操作转发到既有读取函数 |
| apps/web/src/components/CredentialAssetCenter.vue#343034ee456c8020.1 | 1060 | control | SC50-ASSET / 空资产状态打开新建窗 |
| apps/web/src/components/CredentialAssetCenter.vue#99e8924082a7d684.1 | 1109 | control | SC50-ROTATE / 将当前资产设为凭证轮换目标 |
| apps/web/src/components/CredentialAssetCenter.vue#a244801ec79346ec.1 | 1115 | control | SC50-REVOKE / 将当前资产设为撤销确认目标 |
| apps/web/src/components/CredentialAssetCenter.vue#f9aa4f7cabe04961.1 | 1238 | dialog-definition | SC50-ASSET/ROTATE/PROFILE/LOGIN / 资产、档案和网页登录共用原生模态容器 |
| apps/web/src/components/CredentialAssetCenter.vue#efc208b3291dd2c0.1 | 1238 | event-binding | SC50-CLOSE / 原生取消与遮罩关闭转发到既有 closeEditor |
| apps/web/src/components/CredentialAssetCenter.vue#fcfad5327d89010f.1 | 1252 | form-event | SC50-ASSET/ROTATE / 字段无效反馈、Tab循环与既有保存提交 |
| apps/web/src/components/CredentialAssetCenter.vue#a75910143d18b017.1 | 1269 | control | SC50-CLOSE / 关闭资产新建或轮换编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#3b5333f821fbebcc.1 | 1282 | event-binding | SC50-ASSET/VALIDATION / 来源选择变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#f0de1dd230399061.1 | 1303 | event-binding | SC50-ASSET/VALIDATION / 资产名称变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#db8f358359d81455.1 | 1339 | event-binding | SC50-ASSET/VALIDATION / 秘密输入变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#2f453887d0cc66db.1 | 1367 | control | SC50-CLOSE / 取消资产新建或轮换编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#584e25b2c7498fe2.1 | 1370 | control | SC50-ASSET/ROTATE / 按原资产表单保存或轮换加密资料 |
| apps/web/src/components/CredentialAssetCenter.vue#49e83794fc69aec5.1 | 1375 | form-event | SC50-PROFILE / 字段无效反馈、Tab循环与既有档案关联提交 |
| apps/web/src/components/CredentialAssetCenter.vue#785d60d74b62708a.1 | 1388 | control | SC50-CLOSE / 关闭运行档案关联编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#56cda485ff9a67e1.1 | 1401 | event-binding | SC50-PROFILE/VALIDATION / 所选加密档案同步既有来源并清理字段错误 |
| apps/web/src/components/CredentialAssetCenter.vue#118e781b0120c4b2.1 | 1427 | event-binding | SC50-PROFILE/VALIDATION / 内部标识变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#2ddf54204f452511.1 | 1444 | event-binding | SC50-PROFILE/VALIDATION / 档案名称变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#6bd7eed22ff8851d.1 | 1460 | event-binding | SC50-PROFILE/VALIDATION / 页面语言变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#7550a9de2696128b.1 | 1476 | event-binding | SC50-PROFILE/VALIDATION / 时区变化后清理该字段的原生错误 |
| apps/web/src/components/CredentialAssetCenter.vue#2f453887d0cc66db.2 | 1502 | control | SC50-CLOSE / 取消运行档案关联编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#98e4c1aff937289a.1 | 1505 | control | SC50-PROFILE / 按原档案表单保存关联 |
| apps/web/src/components/CredentialAssetCenter.vue#92da9f015f800722.1 | 1510 | form-event | SC50-LOGIN / 登录材料窗Tab循环与既有两步保存提交 |
| apps/web/src/components/CredentialAssetCenter.vue#d86a0656a93bd973.1 | 1523 | control | SC50-CLOSE / 关闭网页登录档案导入窗 |
| apps/web/src/components/CredentialAssetCenter.vue#148e132f8526cb9d.1 | 1607 | control | SC50-CLOSE / 取消网页登录档案导入 |
| apps/web/src/components/CredentialAssetCenter.vue#a6de35af2d13a51e.1 | 1608 | control | SC50-LOGIN / 按当前来源、材料与阶段状态提交既有加密导入流程 |
| apps/web/src/components/CredentialAssetCenter.vue#5eca67d4ff8b7b15.1 | 1630 | event-binding | SC50-REVOKE / 取消与确认事件交给父级现有撤销处理函数 |
| apps/web/src/components/CredentialAssetCenter.vue#cb14d6dea1ed210f.1 | 1630 | dialog-component-call | SC50-REVOKE / 调用共享危险确认窗；不另计撤销写动作 |
| apps/web/src/components/CredentialAssetCenter.vue#d2a64908945092ff.1 | 1546 | event-binding | SC50-LOGIN / 来源选择及材料上下文重置 |
| apps/web/src/components/CredentialAssetCenter.vue#1430f57a236d6ea1.1 | 1558 | event-binding | SC50-LOGIN / 导入方式切换及材料上下文重置 |
| apps/web/src/components/CredentialAssetCenter.vue#7443d228a98eebd4.1 | 1569 | event-binding | SC50-FILE / 受控文件选择 |
| apps/web/src/components/CredentialAssetCenter.vue#e22b7ca36f2434d7.1 | 1593 | control | SC50-EXTERNAL / 打开来源登录页 |
| apps/web/src/components/CredentialAssetCenter.vue#f176fdb4640192de.1 | 1596 | control | SC50-BRIDGE / 请求助手Cookie |

以上候选逐项来自当前Vue的真实按钮、原生表单、字段事件和对话框标签；本节与第14节仍有效的其他文件映射共同覆盖当前扫描器识别的全部P50候选。该静态覆盖不提升P50的真实屏幕阅读器、后端权限、加密材料、MySQL或正式生产验收状态。

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/CredentialAssetCenter.vue | d29db14dd716ebdbeee5c3ed43e4db016cb8fa4d43c3dd6f819371593f7ae845 |

## 16. P50 凭证台账被替代的旧身份

第8节较早的映射版本已由第15节完整的32候选映射替代；以下第14节中仍有的五条旧凭证台账身份也归入历史。它们用于追溯、不计当前覆盖；替代关系仅按既有语义标注，不代表凭证读写、秘密材料、权限或生产验收。

| 旧candidateId | 原始语义 | 当前替代身份 |
| --- | --- | --- |
| apps/web/src/components/CredentialAssetCenter.vue#d2b72f6631a5008b.1 | SC50-LOAD 错误状态主操作 | #466d5492514f7a0e.1 读取失败面板主操作转发 |
| apps/web/src/components/CredentialAssetCenter.vue#c19154c59d261941.1 | SC50-CLOSE 取消资产新建或凭证轮换 | #2f453887d0cc66db.1 取消资产编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#25e471a00cbed149.1 | SC50-ASSET/ROTATE 保存或轮换 | #584e25b2c7498fe2.1 资产表单保存 |
| apps/web/src/components/CredentialAssetCenter.vue#15bb54ff377e917e.1 | SC50-PROFILE 选择加密资产并同步来源 | #56cda485ff9a67e1.1 档案与来源同步 |
| apps/web/src/components/CredentialAssetCenter.vue#c19154c59d261941.2 | SC50-CLOSE 取消浏览器档案引用 | #2f453887d0cc66db.2 取消档案关联编辑器 |
| apps/web/src/components/CredentialAssetCenter.vue#91ffac2d135459f2.1 | SC50-PROFILE 按既有表单保存档案引用 | #98e4c1aff937289a.1 按原档案表单保存关联 |

## 17. P49 1688启用检查当前页面动作归组（2026-09-25）

`action-reviews/P49.json` 将当前检查宿主、验收执行表单与下一步/技术详情三个页面局部组件中的21个扫描候选归入既有SC49读取、范围、人工运行、授权失败导航、固定样本/凭证导航及本地披露语义。原生表单与宿主事件接线按既有所有者关系记录；组织变化可触发原范围协调，工作区选择与关键词编辑分别只更新受控值。既有“检查门口径说明”明确是本地details展开，不产生读取或写入。

`tests/unit/ui-phase2-p49-action-map.test.mjs` 校验候选身份、合同键、事件去向及外部运行边界。该静态映射不覆盖共享导航壳与通用移动详情的重复消费者，不代表视觉控件状态、真实组织权限、MySQL、外部浏览器运行终态或M07-03生产验收通过；动作审批保持pending。
