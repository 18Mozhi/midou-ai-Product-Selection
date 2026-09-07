# B3a · 链路日志、备份恢复与发布事实合同

2026-09-08，起点main/5695ae7。覆盖[P62](page-specs/P62.md)、[P64](page-specs/P64.md)、[P65](page-specs/P65.md)。本批仅事实规格及备份有效期标题修复，不是正式新设计或生产签收；F00-1.18-r1仍待用户意见。

## 1. 真实操作与计划纠偏

| 页 | 当前实际能力 | 不存在或不能推断 |
| --- | --- | --- |
| P62 | query/source检索最新200条三运行面脱敏事件、链分组/详情、异常真实ID跳转、带原因CSV | 无时间范围/分页/日志删除/任务重放；链只含当前截断窗口；下载不是DOM快照 |
| P64 | 刷新恢复事实、资产详情/列展示、到期提示、技术披露/复制 | 无备份/恢复/演练执行或确认窗；同机恢复不保护整机/磁盘/机房 |
| P65 | 读取当前版本与相关历史观察门、门指标详情/列设置、请求编号、超管API证据跳转 | 无发布/停止/回滚/审批按钮；历史双槽任务不是当前单后端部署方式 |

PAGES初始方向是目标草案。三页均preserve缓存、platform_admin壳层，目录operate/superadmin与API会话platform:operate分别验证。不能将静态route声明、过去verified或读取成功当作最低角色、全图或当前生产通过。

## 2. 数据与副作用合同

日志GET将URL source映射为management的status，源SQL分别读平台审计、Worker事件、Crawler运行；最多200并按occurred_at/id倒序，再前端按trace分组/组内时间正序。summary就是这200条内的计数，无全量COUNT。Crawler事件时间是started_at，不是推测结束；task/provider跳转必须来自返回字段。实际SQL不把metadata/payload/stderr整体返回，但可返回已有错误代码，不能凭元数据限制宣称完整内容脱敏已实测。

导出原因窗提交2字以上，服务校验2–300字；POST要求同源、会话operate、Idempotency-Key，query/source/reason签名。仓储先读数据再GET_LOCK(5秒)并开启事务，匹配幂等重放返回已存集合，不同签名409；首次审计platform.logs.export并保存返回。相同key并发串行不等于不同key或跨标签页去重。CSV12列按真实route固定，BOM、引号转义和前导=+-@保护，不宣称所有表格软件/空白变体的完整防注入已验。浏览器createObjectURL下载后revoke；文件生成与后端审计成功不等于用户已保存文件。

备份仓储最近20条runs，最新backup聚合资产；读+platform.backup_recovery.read同事务。service最新backup/drill、RPO/RTO、隔离/加密/完整性/权限/审计链/哈希条件构成状态，副本需最新run及策略区域；不是所有历史备份列表。发布仓储最近10条release及关联gates，同事务审计platform.release_rollout.read；service按运行SHA挑证据，身份和来源策略、门状态/样本/阈值/时长及新鲜度共同判定。两页GET不是数据库零写入，不执行备份/发布本体。

P64/P65浏览器15秒单飞，服务读取14秒可取消；429/5xx/timeout保留已读快照，401/403清除。P62虽然也15秒单飞，却没有同样的权限失败清除分支。三者缓存离开均不能以unmount取消代码代替deactivated证明。本批只读合同核对，未做生产故障注入。

## 3. 全部共享入口及模态

| 消费者 | 具体变体 | 尚需验收 |
| --- | --- | --- |
| P62 ResponsiveFilterDrawer | 草稿两字段、打开/关闭/遮罩/Escape/Tab、form提交时关闭 | 不提交关闭时草稿与URL不同、禁用时键盘提交、缓存离开与焦点 |
| P62 AuditedReasonDialog/useAuditedReason | 导出原因初值、至少2字、顶部/底部/Escape取消、确认后关闭再请求 | 300字上限/字段报错、重复ask、关闭重开、离开后异步下载和手动重试key |
| ResponsiveDataView | P62每条链事件、P64资产、P65 canary门 | 详情开/关/遮罩/Escape/返回已有，完整Tab圈定未实现；数据刷新移除选中行及缓存仍待验 |
| TableViewControls | 上述每个桌面表格的列显隐、首个可见列冻结、密度 | 仅本地展示，至少留一列；不增加服务过滤、字段删除或权限 |
| TechnicalDetails | P64/P65失败告警/页脚请求编号的展开及复制 | Clipboard拒绝当前无catch；复制状态/1500ms计时与离开/更新需验 |
| 原生details | 三页技术ID/代码；P62trace、请求；P65门 | 非执行窗，键盘披露/完整长值/中文辅助说明待完整图和运行验收 |

## 4. 修复、实测及保留缺口

BR64有效期标题此前固定90，接口已有policy.maximum_drill_age_days。UI2-OP64以30天夹具在旧UI找不到对应标题失败；改为直接呈现返回值后，读取30→刷新120、旧值消失、无演练仍未知、确切两GET通过。没有改配置默认90、允许1–365范围、到期算法或任何发布资格。蓝图发布门仍要求90天内恢复演练；测试120天不授权生产放宽。

最小1项通过14.3秒后，完整备份页桌面5项/390移动5项，共10项32.1秒通过。现有部分用例会主动切390，不应称全部步骤均在桌面宽度执行。测试使用受控响应；模块单测覆盖合成AES-GCM自检、路由注入和伪仓储，不是生产解密/隔离库恢复。最终门禁和清理以PROGRESS为准。

| ID | 证据与未完成事项 | 后续动作/边界 |
| --- | --- | --- |
| OP-G01 日志读取范围 | 单飞早退、watch跨路径、URL已变/旧items保留、导出取当前URL | 延迟读取/失败/返回对照，先复现；不能让旧链暗示新筛选已完成 |
| OP-G02 日志权限与初次失败 | catch不清401/403快照，首次timeout仍说保留旧日志 | 受控认证失效验证，遵循既有权限合同，不扩角色权限 |
| OP-G03 导出与原因 | ask期间未exporting、无300上限、关闭先于POST、无取消/持久重试键 | 校验非法输入/取消/重复/写后失败/迟到下载；隔离CSV，不真实导出 |
| OP-G04 备份边界值 | floor年龄与ceil剩余天数、Number(null)、最近20次run截断 | 逐值合同测试；涉及verified/发布时间规则变更前确认，不借标题修复改判定 |
| OP-G05 发布真实性 | 缺失来源字段回退SHA、十字符无完整展示、环形只看status、历史流程用现在时 | 正式结构需当前与历史分区，合成缺证据/缺来源测试；不启用双槽 |
| OP-G06 共享交互 | 详情无完整焦点圈定、技术复制拒绝、缓存中的drawer | 逐消费者键盘/错误/异步/主题/密度/缩放矩阵，不能以aria-modal声明通过 |
| OP-G07 运维文档范围 | 旧备份runbook/脚本约束仍有/www/backup/product-scout，当前AGENTS固定项目backups根 | 不搬目录、不迁移数据/配置，不按旧路径执行；发布前依据当前固定根核实实际对象并确认迁移 |
| OP-G08 全阶段交付 | 三份事实规格新增后67/73，F00未审、分母未冻，真实权限/生产/全正式图未验 | 不把候选计数、已存在的旧证据或小修复等同全站重构完成 |

## 5. 精确源码候选与字段

三个页面局部33候选（18/7/8），五共享组件22候选，共55个源码位置；4处v-model包括日志两字段、共享原因和密度，不是全站业务动作分母。重复桌面/移动、form/submit、脚本ask/组件调用保留身份，人工语义归属如下；三页运行时实例数量随日志链数与列表变化，不能固定宣称55个按钮或某个固定弹窗数量。

### apps/web/src/components/PlatformLogCenter.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| a4a224d771806ee7.1 | 265 | control | LG62-EXPORT 导出原因入口 |
| a73ee10987ddca35.1 | 268 | control | LG62-LOAD 刷新 |
| e4314256fea2aeac.1 | 274 | dialog-component-call | LG62-FILTER 移动筛选消费者 |
| ef169b3c5b08be4e.1 | 275 | form-event | LG62-APPLY 查询form |
| d2bd484790411f68.1 | 294 | control | LG62-RESET 重置 |
| 280c88beee4f3de8.1 | 297 | control | LG62-APPLY 同form提交 |
| fc60d9191880683a.1 | 317 | control | LG62-LOAD 重新加载 |
| d7ff6351cbc06807.1 | 352 | control | LG62-TRACE 展开完整链编号 |
| af1fa7b422aa7bcd.1 | 401 | control | LG62-TASK 桌面异常任务跳转 |
| c4b53a994d00ca34.1 | 404 | control | LG62-PROVIDER 桌面异常来源跳转 |
| 5d0b99550cb761b8.1 | 413 | control | LG62-IDS 桌面记录编号 |
| 1b10ffebcf6798fe.1 | 459 | control | LG62-TASK 移动异常任务跳转 |
| ec46ae5cddba062a.1 | 460 | control | LG62-PROVIDER 移动异常来源跳转 |
| 1c008f867673db60.1 | 464 | control | LG62-IDS 移动技术展开 |
| 1f77079e4af40f1a.1 | 476 | control | LG62-REQUEST 查询编号 |
| 30a784886ed82e8b.1 | 481 | event-binding | LG62-REASON 提交/取消转发 |
| 1bfd5d9fa0fdcd5e.1 | 481 | dialog-component-call | LG62-REASON 原因组件调用 |
| 5d23ad02d6538b9c.1 | 193 | dialog-script-call | LG62-EXPORT 同一原因窗的脚本请求 |

| v-model | 属性行 | 元素 |
| --- | --- | --- |
| query | 279 | input |
| source | 286 | select |

### apps/web/src/components/BackupRecoveryCenter.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| de2ebca33ff1e487.1 | 150 | control | BR64-LOAD 刷新 |
| 21c66441891be768.1 | 165 | control | BR64-RETRY 快照告警 |
| 5587941412d5210f.1 | 178 | control | BR64-LOGIN 过期登录 |
| 227b66d9ec4e0216.1 | 179 | control | BR64-RETRY 首次错误 |
| 1c008f867673db60.1 | 263 | control | BR64-TECH 桌面资产 |
| 1c008f867673db60.2 | 316 | control | BR64-TECH 移动资产 |
| 1c008f867673db60.3 | 398 | control | BR64-TECH 阻断代码 |

### apps/web/src/components/ReleaseRolloutCenter.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| f801437d922c379b.1 | 154 | control | RL65-LOAD 刷新 |
| 7e7fceb8ddc95b63.1 | 157 | control | RL65-COVERAGE 超管查看接口证据 |
| 21c66441891be768.1 | 175 | control | RL65-RETRY 快照告警 |
| 5587941412d5210f.1 | 187 | control | RL65-LOGIN 过期登录 |
| 227b66d9ec4e0216.1 | 188 | control | RL65-RETRY 首次错误 |
| 1c008f867673db60.1 | 334 | control | RL65-TECH 桌面门指标 |
| 1c008f867673db60.2 | 391 | control | RL65-TECH 移动门指标 |
| 1c008f867673db60.3 | 441 | control | RL65-TECH 阻断代码 |

### apps/web/src/components/AuditedReasonDialog.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| f5d988e572723a07.1 | 38 | dialog-definition | LG62-REASON 原生dialog定义 |
| a3b55671f26dcb41.1 | 38 | event-binding | LG62-REASON Escape转发 |
| 86c4d6d0ad7b5fb8.1 | 44 | form-event | LG62-REASON 表单提交 |
| f850a4abcc7ccc3a.1 | 50 | control | LG62-REASON 顶部取消 |
| 8724bc1f65aaf63a.1 | 66 | control | LG62-REASON 底部取消 |
| e7e63c4215a43738.1 | 67 | control | LG62-REASON 同form确认 |

| v-model | 属性行 | 元素 |
| --- | --- | --- |
| reason | 57 | textarea |

### apps/web/src/components/ResponsiveFilterDrawer.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| 28fb788b88500472.1 | 71 | event-binding | LG62-FILTER 外层键盘 |
| beb5f8d5846aa028.1 | 76 | control | LG62-FILTER 打开筛选 |
| e03968eb8d9e92a8.1 | 89 | event-binding | LG62-FILTER portal键盘 |
| 483082db5a776bf3.1 | 99 | control | LG62-FILTER 遮罩取消 |
| df1390feb7424a07.1 | 117 | control | LG62-FILTER 顶部关闭 |
| cd956325fcd081da.1 | 121 | event-binding | LG62-FILTER form提交捕获关闭 |

### apps/web/src/components/ResponsiveDataView.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| 6da4dad42cb34c8d.1 | 46 | control | 三页移动记录打开（日志每链一个实例） |
| 4fa7deb3456a41ae.1 | 53 | event-binding | 三页移动详情Escape |
| 53d89072117d7eda.1 | 54 | control | 三页移动详情遮罩关闭 |
| e23893d134b1daa1.1 | 60 | dialog-definition | 三页移动详情dialog定义 |
| 847801b2ac6e7a17.1 | 71 | control | 三页移动详情顶部关闭 |

### apps/web/src/components/TableViewControls.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| e2fd0d02cbd9f684.1 | 78 | control | 三页桌面记录列设置 |
| 921f4be18a3fe814.1 | 82 | event-binding | 三页桌面列显隐至少留一 |
| d09cd5524db7bee5.1 | 95 | control | 三页桌面冻结首个可见列 |

| v-model | 属性行 | 元素 |
| --- | --- | --- |
| density | 100 | select |

### apps/web/src/components/TechnicalDetails.vue

| 签名.序号 | 行 | 类型 | 语义/消费者 |
| --- | --- | --- | --- |
| b3ffca8eb967d682.1 | 36 | control | P64/P65请求编号技术展开 |
| c19091da9e2471f1.1 | 43 | control | P64/P65请求编号复制 |

## 6. 来源指纹

下面绑定本批本地最终LF归一文件；部分大型后端文件只核对本合同相关函数，SHA是整文件版本定位，不宣称整库审计。全局baseline/coverage和正式审核状态未改变；文件一致不证明真实数据库或生产已验证。

| 文件 | SHA-256（LF） |
| --- | --- |
| apps/web/src/components/PlatformLogCenter.vue | 4929b467cd1c7922db86e0f191fb922b2dacdbc271aec9b6b4cde3c2842c8e4d |
| apps/web/src/components/BackupRecoveryCenter.vue | 6da8b11e02114158f6189148d4edfb824179446794e4d20b798e5356a030cd02 |
| apps/web/src/components/ReleaseRolloutCenter.vue | 0fcdd0f1eb7e16423188350bbc1dee13fc036d7b51b0ee248a25f2edd54537d1 |
| apps/web/src/components/AuditedReasonDialog.vue | 10f0be448391f280f1d5f4164a9426f0f7c928d00c92128b15c8fdcd275843ee |
| apps/web/src/components/ResponsiveFilterDrawer.vue | daa1cda68e206b85f5cfa687ae9ee70795a20e2a67d79501cc22fbf53c162a39 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/TechnicalDetails.vue | f4a499a068700cb49cb6f7467c6969309636c87a093356b634771b5d1a1aebb0 |
| apps/web/src/use-audited-reason.ts | 113c2329aa046ce187ad1d834d92918391ef9c8ff79ed37c919c87e7e57f6bb8 |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/api/src/platform-dashboard-routes.ts | 1b84b99708bf4610259b42dd48987831229560cf5653b15b98b3cc1d30284f30 |
| apps/api/src/platform-dashboard-service.ts | 568938e88c90615410a7c43224004930936165e91a4172afafc7ce2ff4d8428e |
| apps/api/src/mysql-platform-dashboard-repository.ts | b290af1c03b2767c79bb565f9ec256550250acc4be0cc787de12b81e9b8dcd28 |
| apps/api/src/backup-recovery-routes.ts | d0134f0b1047913af32eba10580392317deed40ef4dbef27d3a7613333b65bc7 |
| apps/api/src/backup-recovery-service.ts | 6b1354e76c6a9f7db0619efc1938585d251eff8bdb4644e90e4a46901b971356 |
| apps/api/src/mysql-backup-recovery-repository.ts | 8abacd005a6e8842002bbc5c57cc5ec56743cefceace63368c57470563915b9c |
| apps/api/src/release-rollout-routes.ts | a7196e454288fed24bf6736ac09bd832fbf7883e02255932230b46a0d2c53dc4 |
| apps/api/src/release-rollout-service.ts | 7a78495796dc7a5c767fa15dabffb02ddbe34c41256bc31e147ec7125c9d0832 |
| apps/api/src/mysql-release-rollout-repository.ts | cea9c4c8637b45de6762b59a24f639291ea52eb4896017bed7d4e1e8b2c52e0e |
| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| packages/config/src/index.ts | 7128cf13c8d183abd5b500e54e296b017fa7e2a9a72a441fbabe15f608546a11 |
| tests/e2e/m07-04-backup-recovery.spec.ts | f9c712921c576a00c0ef4f9f4c24721f06a38d609514ee924557316259f17f53 |
