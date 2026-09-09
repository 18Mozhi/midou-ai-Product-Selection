# B2c · 商业配额、安全中心与开放平台合同

2026-09-09 P60新图补交：[OPEN-PLATFORM-C-r1](design/open-platform-direction-c/README.md)。三个工作区、独立范围快照、九类填写/确认、四类一次性密钥响应及202/读写结果分开。七组源隔离检查复现组织/URL归属、首超时、写成功遮盖读取失败及密钥残留；保护仅为待审原型。10个相关历史来源哈希保持原值，不替换下方联合表或宣称全联合合同未变；原E2E及模块测试另绑定当前来源，不冒称重跑原套件。无真实密钥配置、HTTP、SQL、审计或外发。具体稿审核、真实Vue/加密/权限/外部投递/全主题生命周期与全站部署签收待办。下方“P60正式图待交”为原批次历史描述；下一W07 P63。

2026-09-09 P59新图补交：[SECURITY-C-r1](design/security-direction-c/README.md)，84场景177PNG；C方向已选、具体稿未审。四视图/五集合、全平台摘要与查询记录、凭证/令牌独立分页及完整移动详情分开。七组源隔离检查复现快速分类切换丢请求、旧响应归属、卸载迟到更新及首超时误称保留；快照与模态保护只在原型。10个P59相关历史来源哈希保持，不替换下方联合表，也不宣称P58/P60整体合同未变。原GET自身读取审计边界保留，本批不调用生产接口、不新增撤销/轮换处置。真实Vue/SQL/权限/审计/全主题生命周期、具体稿与全站部署验收待办；下一P60。下方“P59未新增设计验收/正式图待交”为原批次历史描述。

2026-09-09 P58新图补交：[COMMERCIAL-C-r1](design/commercial-direction-c/README.md)，81场景192PNG；C方向已选、具体稿未审。七组惰性源执行复现CS-G01范围混用、CS-G02分页外/未来/截零预览及CS-G03旧成功关新窗/掩盖读失败；CS-G06保留服务/表单原因差异。浏览器发现原code pattern未转义连字符在HTML v模式报错，等价修正仅在原型。相关7个历史来源哈希保持原值，不替换下方联合表；P59/P60未新增设计验收。本包不改产品代码，精确影响算法、真实SQL/审计/权限/完整模态生命周期、具体稿审批及部署仍待办。下方日期/“正式图待交”描述原合同批次，不覆盖本次补图状态。

2026-09-08；起点main/75cb243。覆盖[P58](page-specs/P58.md)、[P59](page-specs/P59.md)、[P60](page-specs/P60.md)。本批交付事实合同和安全页成功空态修复，不代表正式新风格、全按钮/弹窗运行时通过、生产或用户签收。F00-1.18-r1仍待用户具体意见。

## 1. 数据生产者与范围

| 页 | 实际链 | 核心区别 |
| --- | --- | --- |
| P58 | CommercialOperationsCenter→commercial-routes/service→mysql-commercial-repository | 方案summary全局；目录过滤分页；组织分配、明确周期COUNT、当前有效调整与组织历史调整页独立。是配额管理，无计费业务 |
| P59 | SecurityOperationsCenter→security-operations-routes/service→mysql-security-operations-repository | 只读处置面，GET自身仍写读取记录/审计；summary不代表历史集合总数；只返回当前view，凭证/令牌双集合 |
| P60 | OpenPlatformCenter→open-platform-routes/service→mysql-open-platform-repository；投递由webhook-delivery-worker | 一次GET读三个集合，摘要仅组织过滤，列表独立过滤；密钥首次响应与幂等重放不同；202不等于外部完成 |

三路由均preserve缓存；P58/P59目录含各自能力和superadmin声明，实际API分别检查platform:operate/platform:secure；P60检查platform_token:manage。只读DOM或超管导航通过不能替代最小角色权限证明。API前缀为/api/v1，页面client使用相对业务路径。

## 2. 写入与显示合同

| 动作族 | 已有接口/输入 | 不得混淆 |
| --- | --- | --- |
| CO58-CREATE/SAVE/ACTIVATE/RETIRE | POST plans；PATCH plans/{id}，code仅创建、name/description/quotas/status/expected_version/reason按接口分别传 | 创建只draft；快捷启用/退役入口不是服务全状态限制；编辑仍可选三状态 |
| CO58-ASSIGN/SUSPEND/RESUME/END | POST assignments；POST assignments/{id}/actions | 同一组织分配更新会变active；只有active/suspended可做相应状态动作，不新增自动收费/强制限流 |
| CO58-ADJUST/REVOKE | POST adjustments，organization/assignment/quota/delta/effective/expires/reason；POST adjustments/{id}/revoke带version/reason | 调整创建要求同组织未结束分配；撤销active指记录状态，不一定当前时间仍有效；历史分页不能推导全部有效额度 |
| SO59-LOAD/FILTER/PAGE | 仅GET security/operations与路由/详情本地动作 | API仍事务写security_operations_views及platform.security.operations.read；没有安全处置按钮 |
| OP60-NEW/CLIENT-ROTATE/REVOKE | POST clients；POST clients/{id}/actions | scope只有status:read；轮换创建新Client id并将旧对象rotated；首次密钥之后的幂等响应不含secret |
| OP60-HOOK-STATUS/ROTATE | POST webhooks；PATCH webhooks/{id}；POST webhooks/{id}/rotate | 本页PATCH只切状态并保留旧name/url/events，不是完整编辑界面；轮换同端点版本 |
| OP60-HOOK-TEST/REPLAY | POST webhooks/{id}/test；POST deliveries/{id}/replay →202 | 测试要求端点active；replay要求原投递succeeded/dead_letter，创建新投递，原记录/事件保留 |
| OP60-SECRET | Clipboard复制或本地清除secret | 不创建新后端读取密钥接口；关闭展示与撤销凭证不同，复制成功不是外部认证通过 |

配额写入有版本/原因/显式保留幂等键；开放平台UI请求由api-client自动生成键，重新确认调用会新建键。两者不能笼统宣称“所有手动重试复用原键”。UI单飞不代替服务幂等，写成功后读失败不可诱导用户再次创建。Web-only改动不需要新迁移，也不能绕过既有部署器的迁移/停启预检。

## 3. 全部局部模态及共享消费者

| 消费者 | 实际变体与字段 | 验证边界 |
| --- | --- | --- |
| P58原生创建dialog | 7个绑定，创建/关闭/取消/Escape | 直接POST草稿，无第二确认；失败notice在父页；顶部关闭与Escape提交时仍可用，需专门验错误可达/迟到归属 |
| P58原生编辑dialog | 7个绑定，保存进入影响确认，取消/Escape | 从编辑到确认的焦点、取消后草稿合同与版本冲突待验 |
| P58原生影响dialog | 方案保存/启用/退役、分配/调整、暂停/恢复/结束、人工调整/撤销 | 无额外原因输入；三种原生dialog通过useModalDialog，不等于所有动态变体已测 |
| P59 ResponsiveDataView×5 | 事件、会话、凭证、组织令牌、审计的移动详情 | 开/关、遮罩、Escape及归还焦点；共享组件未实现完整Tab圈定，不能仅凭aria-modal称通过 |
| P60 ResponsiveDataView×3 | Client、Webhook、投递的移动详情及其行动作 | 详情叠确认的两层焦点/关闭、刷新后selectedKey归属待验 |
| P59/P60 TableViewControls×8 | 桌面列设置、checkbox至少留一列、冻结首个可见列、标准/紧凑 | 只变展示，不裁剪服务字段；P58是自有table，不伪造同组件入口 |
| P60 ConfirmDialog | 两创建、Client轮换/撤销、Webhook启停/测试/轮换、重放 | alertdialog；初焦点取消、Tab循环、Escape/遮罩取消；只有Client撤销带destructive勾选，无typed短语 |
| P58/P59 TechnicalDetails；三页原生summary | 请求/标识披露 | 不是密钥查看；源位置候选与不同业务消费者分别归属 |

## 4. 本批修复与待关闭项

4个UI2-CS59桌面red用例分别证明：摘要全零时，历史会话、过期凭证、审计三类记录与空态查询工作区被整个隐藏。修复仅将成功响应的页面state设ready，集合继续使用已有inline-empty；删除不可再到达的全页empty分支枚举/标题，没有改API或隐藏错误。原空态用例之前保留了非空集合却摘要清零，现校正为集合和分页全空，不把矛盾夹具当业务事实。

最小4项通过后安全模块桌面6项、390移动6项通过；移动三类历史记录可打开/关闭详情，空事件可切会话、查询无结果、重置恢复。测试模拟API契约、检查确切读取顺序及无该端点写入；不是实时MySQL、全部辅助技术或正式视觉验收。原403/503错误回归保留。过程结果与完整门禁以PROGRESS为准。

| ID | 剩余问题与下一验证 | 状态 |
| --- | --- | --- |
| CS-G01 P58读取归属 | 切组织失败仍保留旧data，而部分标题/写目标取可变organizationId；缓存离开、popstate、迟到请求ID、刷新覆盖分配输入 | 待受控延迟复现，不直接改组织/分配业务 |
| CS-G02 P58影响预览 | 分页外当前方案、未来/过期调整、负调整截零再反推、当前周期/新周期 | 待逐输入比对服务公式；预览不能编影响值 |
| CS-G03 写后读取及模态归属 | P58创建/确认和P60 call在load吞错后写成功提示；关闭再开/切范围后迟到写结果；原因和输入错误在模态外 | 待复现，不能自动重发或取消已发事务 |
| CS-G04 P59路由/缓存 | route.fullPath watcher清loadedOnce但refreshing早退，非本页缓存watch与快速切换；首次超时提示旧快照 | 空态修复未覆盖；需精准请求终态与路由归属测试 |
| CS-G05 P60范围/历史/密钥 | 组织输入与旧结果未分离、URL只replace当前view、无popstate/deactivate；一次性secret跨范围/缓存/迟到响应 | 待合成密钥隔离测试；不使用真实密钥或改变安全规则 |
| CS-G06 输入/状态等价 | P58表单minlength与服务1字符原因差异、P60 UI1000上限与配置上限、投递页原因隐藏、error未关联字段 | 记录差异，业务/配置不确定时先决定，不擅自扩约束 |
| CS-G07 共享无障碍/布局 | 全部原生模态、五+三详情、确认叠层、按钮六态、缩放/键盘、三主题/两密度 | 本批正常开关不能作为完整无障碍验收 |
| CS-G08 真实合同/正式交付 | 64份规格不是64页正式新设计；F00未审、语义分母未冻、真实权限/事务/加密/外发/生产与用户签收 | G0继续中、G1–G5待验；不把本批修复或候选数改成全站通过 |

## 5. 逐候选与字段绑定

三局部Vue共108个控件/事件/dialog定义或调用候选（41/29/38），38处v-model（26/3/9）；P60事件checkbox另列。form和submit按钮、dialog定义和cancel事件、桌面/移动重复入口保留源码身份但不重复计业务动作。共享组件的实际消费者见第3节，扫描不自动识别ResponsiveDataView为dialog，不能由“局部dialog为零”推断P59无弹窗。语义说明为人工核对，位置/哈希校验只是机械证据。

### apps/web/src/components/CommercialOperationsCenter.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| c989a362f5cc118d.1 | 585 | control | CO58-LOAD 刷新 |
| be51bdf2cdf9a55b.1 | 588 | control | CO58-NEW 顶部新建 |
| 493a928ba76cfd75.1 | 590 | form-event | CO58-ORG 读取form |
| ad67cce2619c5349.1 | 598 | control | CO58-ORG 同form提交按钮 |
| b48d0677e26f41b1.1 | 599 | control | CO58-ORG 清除 |
| d776ea6a30d93887.1 | 625 | control | CO58-LOAD 错误重试 |
| 242e3015fcd7a833.1 | 659 | control | CO58-SUSPEND 暂停确认入口 |
| 13e46057d2fb04d8.1 | 676 | control | CO58-RESUME 恢复确认入口 |
| dd38746d8ffdb0c3.1 | 693 | control | CO58-END 结束确认入口 |
| b892a7fa2cef5f0a.1 | 713 | form-event | CO58-ASSIGN 分配/变更form |
| 9e4e87ab21464529.1 | 728 | control | CO58-ASSIGN 同form按钮 |
| ee61aee8d61107d7.1 | 747 | form-event | CO58-ADJUST 调整form |
| 813b6f6555c53581.1 | 770 | control | CO58-ADJUST 同form按钮 |
| f89ab4cc10f2272c.1 | 785 | control | CO58-REVOKE 调整撤销 |
| 30584d1112c65a3f.1 | 807 | control | CO58-ADJ-PAGE 上一页 |
| dcf33a943a6cf78c.1 | 814 | control | CO58-ADJ-PAGE 下一页 |
| 63cd4281b5c9bba9.1 | 834 | control | CO58-NEW 目录重复入口 |
| 6ccee5bf5f08a84f.1 | 836 | form-event | CO58-FILTER 查询form |
| dd360735505349d1.1 | 848 | control | CO58-FILTER 同form按钮 |
| 2f1b49bdefe2e793.1 | 849 | control | CO58-RESET 重置 |
| b9b9138a457290a7.1 | 887 | control | CO58-EDIT 打开编辑 |
| 08f74ebab8ffdc18.1 | 888 | control | CO58-ACTIVATE 启用确认 |
| 3bb72b8a5d05954f.1 | 904 | control | CO58-RETIRE 退役确认 |
| b80d8e0853709211.1 | 939 | control | CO58-PAGE 上一页 |
| 56d050ac5ca9e0cd.1 | 941 | control | CO58-PAGE 下一页 |
| 6d27a406542824e4.1 | 951 | dialog-definition | CO58-CREATE 新建dialog定义 |
| 34969a9757091454.1 | 951 | event-binding | CO58-CREATE Escape转发 |
| 925fc3fffe999c5a.1 | 952 | form-event | CO58-CREATE 创建form |
| 1afdd47b63111a06.1 | 958 | control | CO58-CREATE 顶部关闭 |
| a4c5a912e246ba93.1 | 1006 | control | CO58-CREATE 取消 |
| 2be90b500fbc2735.1 | 1007 | control | CO58-CREATE 同form提交按钮 |
| 2580b7a172938724.1 | 1015 | dialog-definition | CO58-EDIT 编辑dialog定义 |
| fdd65c58da16291a.1 | 1015 | event-binding | CO58-EDIT Escape转发 |
| c272d770b0c006ce.1 | 1016 | form-event | CO58-SAVE 编辑form转影响确认 |
| be9bcd04e462aa25.1 | 1051 | control | CO58-EDIT 取消 |
| 5dc1a96390934ee9.1 | 1052 | control | CO58-SAVE 同form按钮 |
| d3b00b7eb8292418.1 | 1058 | dialog-definition | CO58-CONFIRM 影响dialog定义 |
| 5a1af08abe5636bc.1 | 1058 | event-binding | CO58-CONFIRM Escape转发 |
| 5c175a797dcf657a.1 | 1059 | form-event | CO58-CONFIRM form |
| 53e49d44934e8397.1 | 1079 | control | CO58-CONFIRM 取消 |
| 0406cc973c1194af.1 | 1080 | control | CO58-CONFIRM 执行按钮 |

| v-model字段 | 行 | 元素 |
| --- | --- | --- |
| organizationInput | 593 | input |
| assignment.plan_id | 716 | select |
| assignment.period_start | 723 | input |
| assignment.period_end | 725 | input |
| assignment.reason | 727 | input |
| adjustment.quota_key | 749 | select |
| adjustment.delta_value | 756 | input |
| adjustment.effective_at | 763 | input |
| adjustment.expires_at | 766 | input |
| adjustment.reason | 769 | input |
| query | 838 | input |
| status | 841 | select |
| plan.code | 964 | input |
| plan.name | 969 | input |
| plan.description | 972 | textarea |
| plan.collection_tasks | 981 | input |
| plan.open_api_requests | 989 | input |
| plan.report_exports | 997 | input |
| plan.reason | 1004 | input |
| editingPlan.name | 1018 | input |
| editingPlan.description | 1019 | textarea |
| editingPlan.collection_tasks | 1022 | input |
| editingPlan.open_api_requests | 1029 | input |
| editingPlan.report_exports | 1036 | input |
| editingPlan.status | 1042 | select |
| editingPlan.reason | 1048 | input |

### apps/web/src/components/SecurityOperationsCenter.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 4e1ce57777a6a035.1 | 377 | event-binding | SO59-WINDOW 时间窗change |
| 30a2ab0920048786.1 | 383 | control | SO59-LOAD 刷新 |
| 1c008f867673db60.1 | 393 | control | SO59-TECH 错误请求详情 |
| 282785221153ab14.1 | 396 | control | SO59-LOAD 错误重试 |
| 904af42413d62768.1 | 418 | control | SO59-VIEW 四视图动态路由 |
| 75aeba3a14cd8c5d.1 | 430 | form-event | SO59-FILTER form |
| 36c7b60823abfadf.1 | 449 | control | SO59-FILTER 同form按钮 |
| 19551c617c5e26da.1 | 450 | control | SO59-RESET 重置 |
| 1c008f867673db60.2 | 512 | control | SO59-TECH 事件桌面 |
| 1c008f867673db60.3 | 569 | control | SO59-TECH 事件移动 |
| 530875d018a16137.1 | 600 | control | SO59-PAGE 事件前页 |
| 59622af06082395d.1 | 607 | control | SO59-PAGE 事件后页 |
| 1c008f867673db60.4 | 661 | control | SO59-TECH 会话桌面 |
| 1c008f867673db60.5 | 708 | control | SO59-TECH 会话移动 |
| 530875d018a16137.2 | 727 | control | SO59-PAGE 会话前页 |
| 59622af06082395d.2 | 734 | control | SO59-PAGE 会话后页 |
| 1c008f867673db60.6 | 789 | control | SO59-TECH 凭证桌面 |
| 1c008f867673db60.7 | 847 | control | SO59-TECH 凭证移动 |
| 530875d018a16137.3 | 874 | control | SO59-PAGE 凭证前页 |
| 59622af06082395d.3 | 881 | control | SO59-PAGE 凭证后页 |
| a55873d215f3efac.1 | 889 | control | SO59-MANAGE 凭证管理跳转 |
| 1c008f867673db60.8 | 937 | control | SO59-TECH 令牌桌面 |
| 1c008f867673db60.9 | 987 | control | SO59-TECH 令牌移动 |
| dfefdc60704cd1d6.1 | 1010 | control | SO59-TOKEN-PAGE 前页 |
| 56cd5b08b7c47c21.1 | 1017 | control | SO59-TOKEN-PAGE 后页 |
| 1c008f867673db60.10 | 1070 | control | SO59-TECH 审计桌面 |
| 1c008f867673db60.11 | 1131 | control | SO59-TECH 审计移动 |
| 530875d018a16137.4 | 1166 | control | SO59-PAGE 审计前页 |
| 59622af06082395d.4 | 1173 | control | SO59-PAGE 审计后页 |

| v-model字段 | 行 | 元素 |
| --- | --- | --- |
| windowCode | 377 | select |
| queryInput | 434 | input |
| status | 443 | select |

### apps/web/src/components/OpenPlatformCenter.vue

| 签名.序号 | 行 | 类型 | 语义/范围 |
| --- | --- | --- | --- |
| 05407b8a7159149a.1 | 478 | form-event | OP60-LOAD 组织读取form |
| 88a9882a80ac28a2.1 | 485 | control | OP60-LOAD 同form按钮 |
| 32b3ac036c571c07.1 | 496 | control | OP60-SECRET 复制 |
| e70a65ac56ee311f.1 | 497 | control | OP60-SECRET 安全保存后清除 |
| 1c008f867673db60.1 | 503 | control | OP60-TECH 请求详情 |
| 5367bd616a3abe62.1 | 529 | control | OP60-LOAD 首读错误重试 |
| c66242089e076803.1 | 534 | control | OP60-VIEW Client |
| 0c7b10d8381ec4f6.1 | 546 | control | OP60-VIEW Webhook |
| c3276c76b4b63985.1 | 555 | control | OP60-VIEW 投递 |
| b70e50f696b891f1.1 | 620 | event-binding | OP60-EVENT 四事件checkbox转发 |
| 7a625f6edefd5043.1 | 637 | control | OP60-NEW 两类创建转确认 |
| a67ea3327ba9afd7.1 | 659 | control | OP60-LOAD 刷新 |
| 1a48a72d882d501b.1 | 663 | form-event | OP60-FILTER form |
| cec60f4bd63b9b5e.1 | 691 | control | OP60-FILTER 同form按钮 |
| 2f1b49bdefe2e793.1 | 692 | control | OP60-RESET 重置 |
| 2c7db35d039ef2f4.1 | 698 | control | OP60-RESET 空态清除 |
| f8b804e268ceefea.1 | 738 | control | OP60-CLIENT-ROTATE 桌面 |
| 1c4ff4af0e8fd8d3.1 | 739 | control | OP60-CLIENT-REVOKE 桌面 |
| 1c008f867673db60.2 | 747 | control | OP60-TECH Client桌面 |
| 1c008f867673db60.3 | 788 | control | OP60-TECH Client移动 |
| 7510ef03037c8a3a.1 | 805 | control | OP60-CLIENT-ROTATE 移动 |
| 1df8fceeaa98b0b3.1 | 806 | control | OP60-CLIENT-REVOKE 移动 |
| dd00f77d258cbab6.1 | 848 | control | OP60-HOOK-STATUS 桌面 |
| 1f4e699773a73075.1 | 850 | control | OP60-HOOK-TEST 桌面 |
| 861b950a0ddc1651.1 | 856 | control | OP60-HOOK-ROTATE 桌面 |
| 1c008f867673db60.4 | 861 | control | OP60-TECH Webhook桌面 |
| 1c008f867673db60.5 | 897 | control | OP60-TECH Webhook移动 |
| 3a8f13d630c643d0.1 | 913 | control | OP60-HOOK-STATUS 移动 |
| aafad6da5f70f220.1 | 915 | control | OP60-HOOK-TEST 移动 |
| 861b950a0ddc1651.2 | 921 | control | OP60-HOOK-ROTATE 移动 |
| 92629450188f4d4f.1 | 963 | control | OP60-REPLAY 桌面 |
| 1c008f867673db60.6 | 973 | control | OP60-TECH 投递桌面 |
| 1c008f867673db60.7 | 1018 | control | OP60-TECH 投递移动 |
| 92629450188f4d4f.2 | 1038 | control | OP60-REPLAY 移动 |
| 5535b1d4b215afda.1 | 1054 | control | OP60-PAGE 上一页 |
| 266a3696f502c16e.1 | 1060 | control | OP60-PAGE 下一页 |
| 7dff4b4ffb8ff617.1 | 1072 | event-binding | OP60-CONFIRM 确认/取消事件转发 |
| 0e765674026efce4.1 | 1072 | dialog-component-call | OP60-CONFIRM 共享组件调用候选 |

| v-model字段 | 行 | 元素 |
| --- | --- | --- |
| organizationId | 481 | input |
| form.name | 585 | input |
| form.quota_per_minute | 593 | input |
| form.target_url | 603 | input |
| form.reason | 628 | input |
| currentFilter.query | 666 | input |
| currentFilter.status | 671 | select |
| currentFilter.sort | 678 | select |
| currentFilter.pageSize | 685 | select |

## 6. 来源指纹与证据边界

以下为本批最终文件LF归一SHA-256。只绑定已读代码/测试依据，不替全局baseline或历史图改版本；源码变化后按实际影响重验，不只改哈希。生产配置/真实秘密不进入索引。

| 文件 | SHA-256（LF） |
| --- | --- |

| config/route-catalog.json | d02ade33d087f133ddada8c087085e12c1d321b72f35cd1ef6ffb155076e8150 |
| apps/web/src/components/CommercialOperationsCenter.vue | 4588f387404e14d4ab62ee30b1160d6f38e7978fcc4701a877700ca307be0e33 |
| apps/web/src/components/SecurityOperationsCenter.vue | 1674fd35baca05708781a57093690b77511b7439cfad621c122db5f82bf472f3 |
| apps/web/src/components/OpenPlatformCenter.vue | 5bc93ec6671395ad0e4319b4fb36aca0eba29dceb5d47a777d09fbb9ccd416d5 |
| apps/web/src/components/ResponsiveDataView.vue | 28fa47d1a8beac1666c0cf8be1316484abd39729682a68adb4fed803742f2aaa |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/ConfirmDialog.vue | 6bc5c8473243a8647d901aa0c748640857474f864e7a7636cd10636dbf85db4b |
| apps/web/src/use-modal-dialog.ts | 08bfc1db3703e25927576eacaca733cfb8cc16d4d90e8aa2741a72d138fdf74f |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/api/src/commercial-routes.ts | 0a05af04dc9264c7aad783653e461858b8c6b7e464bfaea903b8f3df018f371b |
| apps/api/src/commercial-service.ts | 14efec9b0a8fe912ad4c19d560c4ef5ab91c124a5d0d452c9e1f2615b940df76 |
| apps/api/src/mysql-commercial-repository.ts | 380ac56755cf6daeb2608d3dceb5c8c5681b18567719ff8a0a8106d6e7173053 |
| apps/api/src/security-operations-routes.ts | 83c73daed98adb472cecbdef5eb7d5051c7c221fbfbc749015ef09743bd261e4 |
| apps/api/src/security-operations-service.ts | a5edfe7d2f291ee0e7d396c8244a6e6e8499cf36c37e92fdb2324010b8a886d6 |
| apps/api/src/mysql-security-operations-repository.ts | 8b18bf3e3fe47914413451a416a146bf68b284af167909f6e26578ba6ab19fb9 |
| apps/api/src/open-platform-routes.ts | d6f26c9f2f14a5271d18fe8fd75944b7d7f5745f9884927105b401c96ef584a3 |
| apps/api/src/open-platform-service.ts | 221f74851fb85ead7bf9dbaa07febf84b9427352a9b50f26395b485b8f589689 |
| apps/api/src/mysql-open-platform-repository.ts | 705eb961c103b25a7a408b9aed615c0ed825dc3c112fe919b7454d017717dc51 |
| apps/worker/src/webhook-delivery-worker.ts | 2aeb4ade86cb30217fad610880931f1167328f81dadf71fae2dcda253ffdcb50 |
| tests/e2e/m06-04-security-operations.spec.ts | 17552a0868d9f7b751afb2da89ca1adfddfa9c19e04f27aefd7af4d5e7610730 |
| tests/m06-04/security-operations.test.mjs | 8b28348ef71999ecbb84c86f84d30f3dd152b4ab0ff5ff5da4a7fcb7c703e24e |

指纹检查只证明本地文件版本一致；接口代码阅读不是实时接口、MySQL事务、外部投递或生产权限验证。正式图和Vue全量新风格对照仍待方向获审后逐页交付。
