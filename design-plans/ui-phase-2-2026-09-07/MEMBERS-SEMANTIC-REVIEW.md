# P30 成员与邀请 · 源码、按钮、字段与原因窗对应

2026-09-10字段细化：[十字段164图](design/members-fields-direction-c/README.md)，74代表状态、8表单组合双端；3邀请模型/6受控输入/共享reason绑定精确selector/state，13容器变体共21图引用。新子稿共享reason不采用旧未批准500上限，按真实Vue只校验trim至少2字并记录独立离线意图；服务结果未验证。邀请原因500、合法批项不被错误标记整批阻断、在途编辑不改已固定批次等以真实函数测试证明。24定向通过；全组合/原生选项弹层/生命周期/具体批准未完成，旧94+444图和生产不变。下文旧稿限制及仅源注册描述保留历史，不当最新字段规则。

2026-09-10按钮细化增量：[444张控件与反馈图](design/members-controls-direction-c/README.md)。19代表动作84状态、22附加变体92状态、10纯提案40状态，216状态双端432图另加12反馈图；原94图不变。精确代表槽由114待映射变为84有图/30待映射，不用附加变体抵扣或假造native select/共享窗busy。六项新永久测试与原11项通过；增加明显焦点/危险操作反馈/16px错误及忙碌说明仅限独立提案。源refreshing与写busy分离、共享reason无上限等差异明确保留，具体审核、字段组合、真实C实施和未决邀请中断策略仍待。下文“本批未改图片/114待映射”为之前源注册批记录，不作为当前图数量。

2026-09-10；从干净 main/95b9ee47 继续。先读 AGENTS → Feature Map organizationAdmin → 蓝图 M06-01 → 真实父子组件、共享原因与服务写链；使用 ui-skills-root/frontend-design 保持 C 方向，但不扩大 P16 布局批准。缺失 ui-skills CLI 不安装，复用本地技能与已有 Playwright 验证器。

[现有94张审核图](design/members-direction-c/README.md) · [机器登记](action-reviews/P30.json) · [事实规格](page-specs/P30.md)

本批建立精确来源关系和防遗漏检查，没有改布局、图片或生产代码。原型仍是待审稿，不是实际 Vue/API/数据库/邮件投递证据。

## 范围与数量

父组件11个源位置、成员子组件17个，共28个本地位置，明确归入23组：19个页面动作（包含本地输入/确认）、1个父事件接线、3个其他路由排除；其中4组业务写动作。每条成员渲染同一个按钮不会增加源码分母。

五筛选、重置、两个邀请页签和前后分页分别登记。父组件13个事件精确连接15个目标动作；页签和分页各一条事件分向两个按钮，技术详情是原生details，不经父转发。

全站核对从30页到31页；父源码此前已在P29登记，因此全站独立源位置仅增加17，不能重复增加28。

## 操作合同

| 操作 | 实际行为与需保持的边界 |
| --- | --- |
| 刷新 / 重载 | summary与members两GET；刷新禁用条件为loading/refreshing，重载无禁用绑定；不能把重读当恢复权限 |
| 创建邀请 | 三字段内联form和按钮同一提交；逐邮箱POST，格式/长度校验、trim小写去重，原因1–500；待投递不等于已发邮件 |
| 邀请页签 | pending_delivery/pending_acceptance且未到期为待接受；expired/revoked或已到期为失效，保留原status标签；非服务端分页 |
| 搜索 / 状态 / 角色 / 团队 / 排序 | 仅已加载items，父ref修改后page=1；有效状态先成员关系再账号锁定；不扩张筛选字段或请求 |
| 重置 | 清五筛选及页码，不清邀请Tab、草稿和单行角色选择 |
| 前 / 后页 | 本地10条一页，边界禁用；无新URL、服务器分页或跨组织数据 |
| 行角色选择 | 仅更新memberRoles[id]；busy时select仍可用；load只缺键初始化，可能与后来服务事实不一致 |
| 分配角色 | 先读取role_code再等待原因；后来修改选择不改变本次role_code；POST既有/:id/roles，替换已有角色，不是累加授权 |
| 禁用 / 恢复 | 按membership.status选择disable/restore，不用账号状态决定动作；恢复关系不解锁账号；自身/最后管理员由后端检查 |
| 撤销邀请 | 仅待接受页签呈现，busy禁用；POST既有invitations/:id/actions，action=revoke |
| 技术详情 | 当前子Vue只折叠成员ID；原型另外展示version/joined_at属于设计提案，不是新增实际接口 |

四类版本化确认提交为禁用、恢复、角色分配、撤销邀请，均带expected_version/reason及各自action或role_code；创建邀请另有email/role_code/reason，不发额外原因窗。路由权限为membership:read、membership:manage或role:manage，summary另受organization:manage约束；源阅读不替代真实权限/事务测试。

## 输入和窗口不漏项

- 模型扫描9项：父summary专属6项在P30排除，成员可见邀请3项。不能写成P30只有3个可编辑控件。
- 另登记6个value/emit受控输入：搜索、状态、角色筛选、团队、排序、单行角色选择；测试按真实模板一项不漏核对。
- 共享原因另一个字段：required、minimumLength默认2、trim；无maxlength。邀请表单reason已有maxlength500，两者不能混淆。
- 两个本地form位置：父summary表单排除；子邀请form关联8个上下文。父共享原因调用关联4变体。合计13条容器引用不是13个弹窗。
- useAuditedReason新ask会将上一个请求解析为取消；finish先清请求再恢复等待者。确认后先关窗再写入，错误在父页；重开默认原因不是失败草稿恢复。

共享定义及两个组合函数已读并绑定指纹，但不是全部调用方的全局动作登记或完整KeepAlive、跨路由、焦点与迟到回执验收。

## 图稿状态与未决业务规则

原94张图包含四原因窗、整页状态与单个邀请按钮代表状态；目前缺少逐动作精确selector/state登记。本批保留114个未映射代表槽，不从整页图“借”悬停/按下状态，也不把114说成需要114张图。无busy绑定的状态适用性与全部变体仍需逐项细化。

OG-G01单行角色选择陈旧、OG-G02邀请401/403中断丢失未处理尾部与notice覆盖、通用submit吞掉重读失败后显示成功、OG-G03原因窗上限与重开策略仍在。已询问是否保留失败和未处理邮箱并由用户手动再次提交，不自动重试；答复前不实施该业务行为。

角色窗手机图目检与现有原型复验不代表其布局、颜色或按钮已获用户批准。P16仅独立布局批准，不能外推本页。

## 验证与操作交接

```sh
node scripts/build-ui-phase2-members-review.mjs --write
node scripts/build-ui-phase2-members-review.mjs --check
node --test tests/unit/ui-phase2-members-review.test.mjs
node scripts/verify-ui-phase2-members-c.mjs
```

11个永久测试覆盖28位置/23组、13事件逐条接线、9模型与6受控值、4原因变体、遗漏/错处理函数/虚假批准/旧指纹/缺手机图反例、真实源函数的邀请尾部问题、共享原因替换关闭和开窗前角色取值。新增表格回归检查确保多行handler只在Markdown中折叠空白并转义竖线，JSON原始事件不变。它们证明当前语义，不是源缺陷修复。

94PNG源与图指纹只读核对、双端47场景及四原因窗交互通过；HTTP、浏览器错误及storage为0。没有重拍或新增图片。全量门禁结果见PROGRESS，不能用局部检查代替全站完成。

仅审核登记、测试、文档和索引；apps/packages、OpenAPI、env、数据库、权限、配置与依赖均不改，无新增参数、无需重启、未部署，不发真实邀请。审核稿和测试是永久交付；临时浏览器/审核服务/导出由现有验证器finally清理，最终清理结果见PROGRESS。

下一继续P30精确按钮/字段/原因窗状态及P31以后同级核对；全站真实C实现、具体用户审核、宝塔部署与生产验收均未完成。
