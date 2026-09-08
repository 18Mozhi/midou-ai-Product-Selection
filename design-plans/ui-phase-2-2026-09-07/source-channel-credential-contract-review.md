# B1b · 来源频道、1688启用检查与凭证合同

2026-09-09 P49首轮设计补充：[1688-ACCEPTANCE-C-r1](design/1688-acceptance-direction-c/README.md)，67场景双端134图（含2工具图），零模态。真实Vue脚本惰性验证复现提交成功覆盖随后检查失败，双消息及焦点/展开保护仅原型；24组合只执行源仓储方法、以合成SQL行输入，不等于SQL/真实解析/权限证明。原夹具12/3/1保留，不冒称当前只开一个详情的执行计划结果；source_status=enabled与overall=setup_required可共存，原“保持停用”文案不能代表副作用；分页不足代码not_observed与蓝图“未演练”的文字差异未擅改。19源指纹不变，SC49/具体图、真实Vue/KeepAlive/API/MySQL/隔离浏览器/审批与主题密度仍待验，下一P50。

2026-09-09 P48首轮设计补充：[SOURCE-CHANNELS-C-r1](design/source-channels-direction-c/README.md)，81场景双端162主图＋39连续局部，共201PNG（含2工具图）。实际源脚本/服务惰性检查复现配置二次PUT表单漂移、旧保存关闭新窗、重读失败被成功覆盖；提交快照/归属/未知结果与失败留窗为待审提案，未改下面19个源指纹。原夹具146项及独立烟测、历史、矩阵、1688审批结果分开；没有对应来源结果则明确缺失，合成结果非真实烟测/写入。P49/P50设计、具体审图及SC48/PR-G01/真实Vue/API/MySQL/权限/完整生命周期主题密度继续待办。下文“正式设计图待交”为该合同初稿历史状态，不能代替当前审核状态。

日期：2026-09-08；事实起点main/b52fb56，收尾起点main/4a5725b。对应[P48](page-specs/P48.md)、[P49](page-specs/P49.md)、[P50](page-specs/P50.md)。这是源码合同、一个已复现恢复提示修复与局部Vue回归，不是三页正式重设计、完整无障碍、真实后端、生产或用户审核通过。

## 1. 范围、权限与证据层级

P48 /platform-admin/providers/sources，P49 /platform-admin/providers/sources/1688-acceptance，P50 /platform-admin/credentials，均从ProviderRuntimeSurface分发。目录中P48列platform:operate/platform:superadmin，P49/P50为platform:superadmin；后端分别以provider:configure、collection:replay、platform:superadmin、key_rotation:manage核验。不能由可见菜单推断写权限，也不能把蓝图职责直接改成当前路由权限。

ProviderRuntimeSurface五个RouterLink已随[来源定义合同](provider-definition-contract-review.md)记录；最后两个用platform:superadmin显隐。共享ConfirmDialog、UiStatePanel以及ResponsiveDataView的详情/桌面工具另属共享消费者；本表只统计七个局部Vue，不把共用控件重算成全站新增动作。[异常与确认合同](state-recovery-contract-review.md)只证明已有调用范围，不能代替本页全部变体验收。

| 别名 | 当前源码 | 候选数 / v-model数 |
| --- | --- | --- |
| S | [ProviderSourceCenter.vue](../../apps/web/src/components/ProviderSourceCenter.vue) | 21 / 7 |
| A | [Alibaba1688AcceptanceCenter.vue](../../apps/web/src/components/Alibaba1688AcceptanceCenter.vue) | 12 / 3 |
| C | [CredentialAssetCenter.vue](../../apps/web/src/components/CredentialAssetCenter.vue) | 33 / 14 |
| F | [ProviderSourceConfigurationDialog.vue](../../apps/web/src/components/ProviderSourceConfigurationDialog.vue) | 14 / 0 |
| P | [ProviderParserSampleDialog.vue](../../apps/web/src/components/ProviderParserSampleDialog.vue) | 7 / 0 |
| R | [ProviderParserSampleReview.vue](../../apps/web/src/components/ProviderParserSampleReview.vue) | 2 / 1 |
| M | [ProviderCompatibilityMatrixDialog.vue](../../apps/web/src/components/ProviderCompatibilityMatrixDialog.vue) | 3 / 0 |

共92个源码候选：控件、事件、弹窗定义/调用可能来自同一节点，不等于92个业务按钮。局部role=dialog定义7个（F2、P1、M1、C3），C资产窗有创建/轮换两变体；另有共享撤销alertdialog、兼容矩阵移动详情。P49没有业务模态。25个v-model源码位置，F另有6个value+input/change转发输入，C文件输入另记事件；不是25个全部业务字段。

本批未改变路由、API、权限、SQL或任何来源启用规则。PR-G01来源准入/烟测规则冲突延续前合同独立待决，不借界面重构选择规则。当前API档案POST没有与资产写入同样的显式no-store响应设置，故不声称所有凭证相关响应均已逐项验证缓存安全；本轮不改API。

## 2. 逐候选对应

签名取现有scanSource；同文件同签名按源码顺序编号。行号仅辅助，源码哈希与签名对应共同用于发现漂移，不能只替换哈希冒充复测。

| 位置键（别名:签名.同签名序号） | 类型 / 行 | 语义归属 |
| --- | --- | --- |
| S:9287eb0473b9ee05.1 | control / 606 | SC48-LOAD / 刷新目录 |
| S:436e3971cada0a0b.1 | control / 609 | SC48-DEFINE / 跳来源定义 |
| S:93ca4e5e94727229.1 | form-event / 638 | SC48-FILTER / 阻止原生表单提交 |
| S:66725db5db9a8fe8.1 | control / 688 | SC48-FILTER / 重置七条件 |
| S:25214adce9760897.1 | control / 706 | SC48-LOAD / 空目录重读 |
| S:825fda3d056d6a41.1 | control / 740 | SC48-LINK / HTTPS外链 |
| S:cd642bd4e8591939.1 | control / 790 | SC48-PROBE / testSource匿名烟测 |
| S:c45fa10015518a56.1 | control / 801 | SC48-CONFIG / beginEdit |
| S:ba6b745768e7ce7a.1 | control / 803 | SC48-COMPAT / loadCompatibility |
| S:d76e5df18057ffbc.1 | control / 812 | SC48-VERSIONS / loadConfigurationVersions |
| S:7f3b2921d6d294b5.1 | control / 818 | SC48-LOGIN / 指定来源登录深链 |
| S:33df1c327ad3e80c.1 | control / 822 | SC48-SAMPLES / loadParserSamples |
| S:b9ce58d9e8408695.1 | control / 828 | SC48-ACCEPT / 1688检查链接 |
| S:d08df5663e79fcd3.1 | control / 841 | SC48-PAGE / 上页 |
| S:326dc9fb6fb8f079.1 | control / 847 | SC48-PAGE / 下页 |
| S:b33f05a20390eaad.1 | event-binding / 852 | SC48-CONFIG/VERSIONS / 子窗事件与表单更新 |
| S:6fc08db08d269bea.1 | dialog-component-call / 852 | SC48-CONFIG/VERSIONS / 两窗调用 |
| S:aed401fdf4d5bd52.1 | event-binding / 869 | SC48-SAMPLES / 关闭、创建、回放、审批事件 |
| S:f00736f4664ddd07.1 | dialog-component-call / 869 | SC48-SAMPLES / 样本窗调用 |
| S:f28e29bf843d5823.1 | event-binding / 884 | SC48-COMPAT / 关闭事件 |
| S:ad3654482438f488.1 | dialog-component-call / 884 | SC48-COMPAT / 矩阵窗调用 |
| A:617a39a925d1099c.1 | control / 300 | SC49-LOAD / 主刷新 |
| A:ff6d5fbc586803ed.1 | control / 323 | SC49-TECH / 故障详情 |
| A:5587941412d5210f.1 | control / 327 | SC49-AUTH / 登录链接 |
| A:441fd57e4a421b3a.1 | control / 328 | SC49-AUTH / 平台返回 |
| A:4f98bc142c69e6f8.1 | control / 329 | SC49-LOAD / 失败重试 |
| A:22178a46f3a78fe1.1 | form-event / 422 | SC49-RUN / 提交表单 |
| A:479ca2276748fa81.1 | event-binding / 425 | SC49-SCOPE / 组织变化读工作区 |
| A:4d5599c177edbee1.1 | control / 466 | SC49-RUN / 发起验收运行 |
| A:e036d6046f6ca06e.1 | control / 474 | SC49-TASK / 展开task_id |
| A:b3ddac540b01d0e1.1 | control / 490 | SC49-LOGIN / 凭证深链 |
| A:1f17b9f55d6b83f1.1 | control / 491 | SC49-SAMPLE / 来源过滤深链 |
| A:1c008f867673db60.1 | control / 516 | SC49-TECH / 技术详情 |
| C:62c28f83dd77541b.1 | control / 526 | SC50-LOAD / 刷新 |
| C:889e842f4791c19d.1 | control / 531 | SC50-HELPER / 下载ZIP |
| C:faa93a858a84ea60.1 | control / 536 | SC50-LOGIN / 打开导入 |
| C:09c5f70e0bef7952.1 | control / 537 | SC50-PROFILE / 打开关联 |
| C:84ead7c893248e2c.1 | control / 538 | SC50-ASSET / 新建资产 |
| C:d2b72f6631a5008b.1 | event-binding / 551 | SC50-LOAD / UiStatePanel主操作 |
| C:ad87a22b7d7dedf7.1 | control / 577 | SC50-ASSET / 空态创建 |
| C:7afaae6e4a36e2ab.1 | control / 626 | SC50-ROTATE / 更新资产 |
| C:0126143cd8671c5f.1 | control / 628 | SC50-REVOKE / 设置撤销目标 |
| C:1c008f867673db60.1 | control / 742 | SC50-COMPAT / 来源技术详情 |
| C:c7363e018ea03291.1 | event-binding / 751 | SC50-CLOSE / 遮罩与Escape |
| C:da4ba31460b3f422.1 | dialog-definition / 757 | SC50-ASSET/ROTATE / 共用模态定义 |
| C:6a716a16299f1b20.1 | form-event / 757 | SC50-ASSET/ROTATE / Tab与saveAsset |
| C:51909c47b8cea5e6.1 | control / 776 | SC50-CLOSE / 资产右上关闭 |
| C:c19154c59d261941.1 | control / 829 | SC50-CLOSE / 资产取消 |
| C:25e471a00cbed149.1 | control / 832 | SC50-ASSET/ROTATE / 提交 |
| C:921f04fe23cc343e.1 | dialog-definition / 837 | SC50-PROFILE / 模态定义 |
| C:8f5cb9232f6e0ceb.1 | form-event / 837 | SC50-PROFILE / Tab与saveProfile |
| C:c3ca275e26012f78.1 | control / 852 | SC50-CLOSE / 档案右上关闭 |
| C:15bb54ff377e917e.1 | event-binding / 863 | SC50-PROFILE / 所选资产推导provider_id |
| C:c19154c59d261941.2 | control / 894 | SC50-CLOSE / 档案取消 |
| C:91ffac2d135459f2.1 | control / 897 | SC50-PROFILE / 保存引用 |
| C:178c3ac2db1eee78.1 | dialog-definition / 900 | SC50-LOGIN / 模态定义 |
| C:7a6f1edcd253a703.1 | form-event / 900 | SC50-LOGIN / Tab与saveLogin |
| C:9cbbc1a74784bca7.1 | control / 915 | SC50-CLOSE / 登录右上关闭 |
| C:cc887cde3ae93a26.1 | event-binding / 938 | SC50-LOGIN / 方式变更清文件名和载荷 |
| C:45a446ab198a1b4a.1 | event-binding / 951 | SC50-FILE / 异步文件读取 |
| C:656bff1ad830e5ab.1 | control / 974 | SC50-EXTERNAL / 打开来源登录页 |
| C:cccafd19b3cf9803.1 | control / 977 | SC50-BRIDGE / 请求助手Cookie |
| C:5f400eb4ffa0ae12.1 | control / 988 | SC50-CLOSE / 登录取消 |
| C:acee62f093368cd2.1 | control / 989 | SC50-LOGIN / 加密保存并启用档案 |
| C:08ecc5f8d7a27905.1 | event-binding / 996 | SC50-REVOKE / 共享确认取消与提交事件 |
| C:4b5b10b71f689dc3.1 | dialog-component-call / 996 | SC50-REVOKE / ConfirmDialog调用 |
| F:d30e612863853f7f.1 | dialog-definition / 58 | SC48-CONFIG / 编辑窗定义 |
| F:dafd8d98d9967009.1 | form-event / 65 | SC48-CONFIG / emit保存 |
| F:f133c5386c615a0f.1 | control / 71 | SC48-CONFIG / 右上关闭 |
| F:53bc5a81c5404ca3.1 | event-binding / 74 | SC48-CONFIG / 频率输入转发 |
| F:644185cc90b9b1b9.1 | event-binding / 85 | SC48-CONFIG / 超时输入转发 |
| F:46ef6e2130d8850e.1 | event-binding / 94 | SC48-CONFIG / 重试输入转发 |
| F:030a52b2f32d4077.1 | event-binding / 104 | SC48-CONFIG / 状态变更转发 |
| F:05c6bb7562e70a90.1 | event-binding / 143 | SC48-CONFIG / 原因输入转发 |
| F:978645864f7d95c4.1 | control / 152 | SC48-CONFIG / 取消 |
| F:899501ffcfbb32fc.1 | control / 153 | SC48-CONFIG / 保存或烟测启用 |
| F:0af3a3a9da1e07ad.1 | dialog-definition / 159 | SC48-VERSIONS / 历史窗定义 |
| F:5bfd25c03d15e894.1 | control / 172 | SC48-VERSIONS / 关闭历史 |
| F:f260a9d94fdf3534.1 | event-binding / 176 | SC48-VERSIONS / 回滚原因转发 |
| F:449abb271a921473.1 | control / 196 | SC48-VERSIONS / 回滚选定版本 |
| P:288313c7a451cdfc.1 | dialog-definition / 63 | SC48-SAMPLES / 样本窗定义 |
| P:6fc72afafe0d64c5.1 | control / 70 | SC48-SAMPLES / 关闭 |
| P:ea471875b272e83e.1 | control / 85 | SC48-SAMPLES / 固定候选作业 |
| P:1c008f867673db60.1 | control / 93 | SC48-SAMPLES / 候选技术详情 |
| P:5bb4cd974747c57f.1 | event-binding / 111 | SC48-SAMPLES / 转发review决策与原因 |
| P:9fe911ce0f68afbf.1 | control / 118 | SC48-SAMPLES / 回放样本 |
| P:1c008f867673db60.2 | control / 126 | SC48-SAMPLES / 样本技术详情 |
| R:915c93b75eb41a91.1 | control / 38 | SC48-SAMPLES / approved审批 |
| R:35b9cb8eaccc4d26.1 | control / 45 | SC48-SAMPLES / rejected驳回 |
| M:190aaa5dd734c333.1 | dialog-definition / 26 | SC48-COMPAT / 矩阵窗定义 |
| M:f0685e36cb38e6c1.1 | control / 34 | SC48-COMPAT / 关闭 |
| M:1c008f867673db60.1 | control / 69 | SC48-COMPAT / 完整指纹详情 |

## 3. 输入、字段与约束

| 文件 | v-model表达式（源码位置，不是模式展开后的字段实例） |
| --- | --- |
| S | query、category、availability、market、language、accessMode、sort |
| A | selectedOrganizationId、selectedWorkspaceId、acceptanceQuery |
| C | assetForm.provider_id、assetForm.name、assetForm.kind、assetForm.encoding、assetForm.value、assetForm.expires_at、profileForm.credential_asset_id、profileForm.code、profileForm.name、profileForm.locale、profileForm.timezone、profileForm.status、loginProvider、loginMode |
| F | 无 |
| P | 无 |
| R | reason |
| M | 无 |


| 输入组 | 当前约束、转换和持久化边界 |
| --- | --- |
| P48七条件 | query/category/availability/market/language/accessMode/sort；仅本地过滤、排序，URL用q/access_mode等既有键；query不是外部采集请求 |
| F六转发 | form.schedule_minutes、form.timeout_ms、form.retry_limit、form.status、form.reason、rollbackReason；前三Number转换，范围分别1–10080、1000–120000、0–10整数；原因2–500；服务端校验版本正整数 |
| P49范围 | 组织与成员均active，工作区active，默认工作区若有效优先否则首个；三绑定为内存，query.trim提交且maxlength200；提交/读范围时选择器禁用，不假设可达快速二次选择 |
| P50资产 | 创建provider_id/name/kind/secret_payload/expires_at；kind为api_key/account_secret/cookie_bundle/private_key/browser_profile，encoding utf8/base64；名称2–160，秘密非空且服务端最大8,000,000字符；到期可空，否则未来 |
| P50轮换 | 仅secret_payload、expected_version、expires_at；后端拒绝已撤销资产；null到期会回退旧值，不等于清除到期 |
| P50引用 | 所选asset推导provider_id，固定chromium；code为2–80位小写字母数字下划线、名称2–160、locale格式、timezone非空且≤80字符；默认disabled/en-US/America/Los_Angeles |
| P50登录 | 来源对象与cookie_file/browser/archive方式；文件扩展和2,000,000/6,000,000字节限制只是前端入口校验，Cookie还需服务端规范化、目标域校验；不把文件名或字节数当登录成功 |
| 样本复核R | 原因trim后至少2字符，输入maxlength1000；can_review与reviewing控制可见/禁用，提交approved/rejected；服务器第二人、版本及不可变决定校验不可替代 |
| 共享撤销 | 影响签认及确认文字属于ConfirmDialog输入，不计入局部25位置；父级发送版本和现有固定reason |

P48默认business保持目录顺序，attention按待设置/automatic停用等级再中文名，recent按最后成功倒序，name按中文名；每页20条后按用途分组，组总数按全过滤集。全局统计不跟过滤变化。amazon_product/1688_search以provisioned.status决定effectiveAvailability，其他用原availability；automatic不等于全目录所有来源都确已启用。并发缺快照时active=0回退不是实测空闲，调度频率派生目标不是实测SLA。

## 4. 动作与副作用合同

所有API路径在下表省略共同前缀/api/v1；写入沿现有client提供Origin和Idempotency-Key，原method/body不变。

| 语义 | 当前handler / API | 结果与失败边界 |
| --- | --- | --- |
| SC48-LOAD/FILTER/PAGE | load GET /platform/provider-sources；本地筛选、router.replace、changePage | reset七条件但保留provider_id及其他query；不是成员POST /provider-sources/refresh，不发起外部采集 |
| SC48-PROBE | testSource POST /platform/provider-adapters/{id}/health-check | 可能外发真实请求并写健康记录；仅已登记、raw automatic且public_page/public_rss入口可见，不能称纯只读 |
| SC48-CONFIG | save PUT /platform/provider-sources/{id}/configuration | body五项form+expected_version；停用公开来源启用先PUT disabled→POST烟测→ready再PUT新版本；失败可能已保存停用配置，不笼统称没有写入 |
| SC48-VERSIONS | GET configuration/versions；POST configuration/rollbacks | 校验current_version；target_version/expected_version/reason生成新的当前版本，历史不改；只能rollback_available入口，单行busy不等于全窗互斥 |
| SC48-SAMPLES创建 | POST /platform/provider-sources/{id}/parser-samples | browser_job_id、由captured_at生成的name；从既有成功登录候选固定快照，服务端校验候选与当前解析合同，不是上传任意文件 |
| SC48-SAMPLES回放 | POST parser-samples/{sampleId}/replays，无body | 从已存快照本地重新解析并持久化passed/changed/failed与差异；不是外部浏览器重新采集 |
| SC48-SAMPLES审批 | POST parser-samples/{sampleId}/reviews | decision、reason.trim、expected_version=review_version；另一管理员不可变审批；回放passed不代替approved，不自动启用 |
| SC48-COMPAT | loadCompatibility GET /platform/provider-adapters后按id匹配 | 显示版本和DOM/HTML指纹观测；缺记录/请求失败留窗错误，无采集写入 |
| SC48-LINK/LOGIN/ACCEPT | HTTPS external、指定来源P50、P49 | 前者新页noopener/noreferrer；后两者只是路由，不执行启用；当前无独立provision按钮 |
| SC49-LOAD/SCOPE | GET /platform/provider-sources/1688-acceptance、/org/memberships、/org/{id}/workspaces | 检查与范围读取分开；scopeMessage不是来源门禁结论；API分别验证所需权限 |
| SC49-RUN | scheduleAcceptanceRun POST /platform/provider-sources/{id}/replays | organization_id/workspace_id/query.trim/acceptance_run:true；202 scheduled/task_id只是排队，随后只读一次检查；确会安排浏览器执行，非本地样本回放 |
| SC49-LOGIN/SAMPLE | 指定provider_id的P50 mode=login、P48 | P48仅过滤定位，不自动打开样本窗；task_id当前只在details，没有新造任务直达/停止按钮 |
| SC50-LOAD | GET credential-assets/crawler-profiles/credential-provider-options | Promise.all全部成功才替换快照，12秒单飞；不调用解密/导出接口 |
| SC50-ASSET/ROTATE | saveAsset POST credential-assets或credential-assets/{id}/rotate | 成功刷新；write finally无论成功失败清assetForm.value；轮换还可能恢复登录受阻任务，不是普通元数据编辑 |
| SC50-PROFILE | saveProfile POST /platform/crawler-profiles | 关联同来源active浏览器类资产；前端候选与该仓储SELECT未按expires_at过滤，和兼容矩阵ready口径不同 |
| SC50-LOGIN | saveLogin依次POST资产、POSTactive档案 | 自动引用zh-CN/Asia/Shanghai；第二次失败不撤销资产，清登录载荷并留窗；本批修正提示，见第6节 |
| SC50-REVOKE | ConfirmDialog→revoke POST credential-assets/{id}/revoke | expected_version及固定reason，保留历史与审计；父saving防重复，不能据此认定跨目标反馈归属已验 |
| SC50-HELPER/EXTERNAL/BRIDGE/FILE | 下载ZIP、window.open、同窗口UUID消息15秒等待、FileReader/file.text | 下载/外部页面/读取秘密分别有副作用；本批不安装助手、不读取真实Cookie；UI2-SC50只用内存合成文件 |

验收门事实：有效同来源active资产/档案+最近succeeded或succeeded_empty运行才通过login；captcha由最近成功或阻塞错误判定；parser需active样本approved、最近回放passed且当前parser版本/时间一致。三门全过且来源enabled为production_ready，三门全过但未enabled为ready_for_enable，否则setup_required。coverage_matrix读取最新浏览器job的搜索、详情、翻页覆盖，是单独观测，不直接参与overall计算。不能用“已提交”“兼容”“来源已启用”三种状态互相替代。

## 5. 弹窗、状态与连续性

| 页面/模态 | 当前状态、关闭与反馈 | 尚未证明 |
| --- | --- | --- |
| P48目录 | 有items时刷新失败仍保留，包括401/403；每次load独立controller，无单飞/代次/卸载清理 | 会话清空策略、重入与KeepAlive归属 |
| F配置/历史 | 编辑五字段；历史读取无有效版本或失败关闭窗；父级message承担写入反馈 | 首焦点、Tab循环、Escape、关闭返回、字段错误可感知；保存期间更改来源/输入与烟测中间态 |
| P/R样本 | 读取失败关闭；每行创建/回放/审批busy；批准/驳回按钮同一原因输入 | 行间并发、关窗/换来源后回调归属；审批失败与回放各结果图 |
| M矩阵 | 打开/loading/有数据/缺记录/请求错误；保留窗内错误 | 全键盘、缺观察值、长指纹滚动与焦点返回 |
| P49 | 主读单飞12秒，卸载abort，无onDeactivated；有旧data失败仍ready并提示；范围读独立 | 提交成功notice可能覆盖随后读取失败、范围离开/返回归属；没有轮询完成保障 |
| C资产/引用/login | 三表单自定义Tab、遮罩/Escape；closeEditor清两秘密字段并归还焦点 | 成功直接editor=null未走closeEditor；CSS隐藏控件未从焦点列表排除；资产/引用窗不渲染login同样的message |
| C异步材料 | 模式变更清载荷/文件名，来源变更不清；文件/助手回调无editor代次 | 关闭、来源/方式切换、缓存离开后迟到材料及写入归属；不读取真实材料复现 |
| 共享撤销/兼容详情 | 撤销alertdialog要求签认和确认文字；ResponsiveDataView只用于兼容矩阵，资产是卡片 | 各调用路径及后台反馈、全主题/缩放/键盘仍要独立验收 |

P48初始读取URL后主要是本地状态→URL，没有历史URL→过滤器同步watch；reset不清指定provider_id。P50深链只首次onMounted处理，未匹配会回退首个可登录来源。新设计不能把现有未实现的历史同步或安全阻断写成已具备。7个局部dialog定义中F/P/M无完整统一模态生命周期，保留为需实施事项，不凭role属性宣称通过。

## 6. 本批已复现修复与验证范围

UI2-SC50在原产品提示处出现真实断言失败：期望提示“关闭此窗口并刷新数据”，实际却让用户到只读浏览器档案列表选择。修改仅一条恢复提示，指向“关闭窗口→刷新数据→关联运行档案→选择刚保存资产”，明确无需重新导入；不增加自动刷新、事务合并、自动补偿或持久化字段。

永久测试用隔离响应和Buffer合成Cookie文件：资产POST成功、第一次档案POST503、清载荷后导入提交禁用，按提示关闭/刷新/关联，第二次档案POST成功。断言一个资产POST、两个档案POST、幂等键、两种档案默认值及精确payload；不连接真实资产、扩展、MySQL或外部来源。运行结果及清理见[PROGRESS](PROGRESS.md)，测试入口为tests/e2e/m03-02-credential-assets.spec.ts；不把这一个路径扩称全部敏感编辑流程通过。

| 待验ID | 后续可执行验证及退出标准 |
| --- | --- |
| SC48-01 | 七条件、排序/组总数/分页、provider_id保留与历史返回；URL和结果双断言 |
| SC48-02 | 配置版本冲突、失败烟测部分已存、二次启用、历史回滚及关闭/输入归属；核对每次精确写入 |
| SC48-03 | 固定候选、passed/changed/failed、双人不可变决定、跨来源/关窗回调；真实后端证据另标 |
| SC48-04 | 兼容矩阵缺记录/失败/旧值、指纹版本；明确纯读取与真实观测区别 |
| SC48-05 | 四模态完整键盘、错误关联、长文本/缩放/主题/密度与真实权限拒绝 |
| SC49-01 | 三门与来源状态组合、最新parser和缺证据、coverage矩阵独立；不推导新增门 |
| SC49-02 | 组织/工作区、精确query与202排队、不自动启用；隔离任务执行结果另验 |
| SC49-03 | 刷新失败保留、真实401/403、提交后的读失败不掩盖；过期证据可见 |
| SC49-04 | 读范围/离开/缓存返回、禁用可达性、长中文/键盘与中间断点 |
| SC50-01 | UI2-SC50部分保存恢复已作本批定向修复；模块双视口结果按PROGRESS，不代表下列项已验 |
| SC50-02 | 三读部分失败/401/403、创建/轮换/撤销/引用错误必须在当前操作面可感知 |
| SC50-03 | 文件与助手迟到、切来源/模式、关闭/卸载/KeepAlive、成功与取消焦点返回 |
| SC50-04 | 到期UTC初始化/本地保存、null语义、过期候选、目标域；先确认真实持久化合同再改 |
| SC50-05 | 真实轮换自动重放、事务/幂等/版本/撤销、API与路由六角色边界；仅授权隔离对象 |
| SC50-06 | 全编辑/共享确认/移动详情、长文本、200%缩放、主题密度、44px与秘密不入图 |

SC50规格中的02–06用例在此细化归属；永久测试只新增SC50-01。未验证事项保持未验，不能用静态映射、HTML研究图或旧模块verified状态抹掉。

## 7. 来源指纹与交付边界

以下19个源文件是本批对应依据，包含7个局部Vue、共享入口/确认、路由目录、API/服务/仓储和两个测试入口。只读校验应逐一计算LF归一SHA，并按七文件重跑scanSource，核对每个签名/序号/类型/行和25个v-model，另外核对F六转发字段。签名数校验不证明语义和运行行为；语义依据见上述handler/API及逐页规格。

| 源文件 | SHA256（UTF-8，CRLF归一为LF） |
| --- | --- |
| apps/web/src/components/ProviderSourceCenter.vue | 70fb94b0c529b7a644287e183e7b24909f3dff1ae952360f9b31c78246e382d6 |
| apps/web/src/components/Alibaba1688AcceptanceCenter.vue | 4cd83fa5b9483996cbe6ada429b48202a7c83796fbf83e774844c938f918ba3f |
| apps/web/src/components/CredentialAssetCenter.vue | 4c4064c119242a6d7023767f796e70634f71fd0832eca1b2ddd62de56206e1be |
| apps/web/src/components/ProviderSourceConfigurationDialog.vue | 0786175eeec5c01f9126b3a3bf709805c03110bc15646c2ed205f835cd8d4a01 |
| apps/web/src/components/ProviderParserSampleDialog.vue | 4f78cca0615cf7ee6eaeff12d0d508ecb5e457eac6600e87ea89c2911fd549b0 |
| apps/web/src/components/ProviderParserSampleReview.vue | f320cb377f542762b993e7462177fe86aca5adc7d8c4e5d0ec4a2831cc66309a |
| apps/web/src/components/ProviderCompatibilityMatrixDialog.vue | 409cdda0a6bb75ec297de154713d731671a5dfc4c707d7d04695d139c2881334 |
| apps/web/src/components/ProviderRuntimeSurface.vue | a00c9a5067e5756da93c4ea7b88d6a42cca963202eda533ab3ce96d16c5856a6 |
| apps/web/src/components/ConfirmDialog.vue | 6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| apps/api/src/provider-source-routes.ts | b8976fbbf6d8400cd167a26bd2e4a349a4e38dfe2cd4511e778cfad8f657afd9 |
| apps/api/src/provider-source-service.ts | d1c7e567f59a5936cb4683f872681c6249839c065d63960f115c61a4610ea053 |
| apps/api/src/mysql-provider-source-sample-repository.ts | c8e7aecfea77136a5257d16bc3bdb22cc624dcdb7b5377b607547824abd883d1 |
| apps/api/src/mysql-provider-source-sample-review-repository.ts | b14265734d11be0665407fd3119c4a714118f6cb9c083b203f41b7c3d7c2278d |
| apps/api/src/credential-asset-routes.ts | 7a860b7279ae3700719f51707762cdb6bc53b82f96dc9a50c1d3f3112be671d3 |
| apps/api/src/credential-asset-service.ts | 27c3aa04144be0cc9ffaec7aa8d3dbd39b3adf1128ba98c6abc94c04bbbc4a7d |
| apps/api/src/mysql-credential-asset-repository.ts | adba8e4d902e6c411633070cd607b86fb50f2a00f8445641cba9990fc64466ed |
| tests/e2e/m03-02-credential-assets.spec.ts | 0b735d56167c0c9e86b4bc7a3f3f8e8c3b6bc04106c0286bb9b1d05353c16929 |
| tests/e2e/m03-07-provider-sources.spec.ts | 29c1232a33cb260beeee6851f33c4558873d25e47e538d6a2e04c47eaa6ba5fe |

本批三份规格和此合同是永久交付；正式设计/实现图片仍待F00反馈及F05，不产生新的用户通过数。没有新配置、迁移、依赖或生产服务；前端文案需未来按既有发布流程上线，本批不部署、不单独重启任何服务。W06下一事实小批为P51/P52/P53；整体73页、全动作/弹窗、正式图、Vue、真实验收、宝塔与用户签收目标保持未完成。
