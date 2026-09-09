# 全站动作与弹窗覆盖对账

基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。

- 当前源候选1478；旧登记1477；新身份16，旧表独有身份15。签名变化不等于增删业务能力。
- 已具体语义对应14页/228源位置/205组；其中路由动作183组，转发/容器关联8组，其余明确排除。其余59页未完成此级映射，不称没有图或没有测试。
- 原覆盖门与用户批准保持；静态合同已有引用，不表示六态或全弹窗已验收。

组数按审阅页累计；共享源在多页重复引用，不代表同数量的全站独立业务动作。

## 逐页缺口

| 页 | 旧静态关联候选（非运行分母） | 语义审阅 | 下一步 |
| --- | --- | --- | --- |
| [P01 正在进入](page-specs/P01.md) | 3 | [1组](action-reviews/P01.json) | 6个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P02 登录](page-specs/P02.md) | 18 | [13组](action-reviews/P02.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P03 注册](page-specs/P03.md) | 18 | [13组](action-reviews/P03.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P04 找回密码](page-specs/P04.md) | 18 | [13组](action-reviews/P04.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P05 验证邮箱](page-specs/P05.md) | 18 | [13组](action-reviews/P05.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P06 重置密码](page-specs/P06.md) | 18 | [13组](action-reviews/P06.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P07 安全设置](page-specs/P07.md) | 18 | [13组](action-reviews/P07.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P08 选择组织与工作区](page-specs/P08.md) | 13 | [11组](action-reviews/P08.json) | 60个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P09 快速引导](page-specs/P09.md) | 6 | [6组](action-reviews/P09.json) | 36个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P10 外观偏好](page-specs/P10.md) | 11 | [11组](action-reviews/P10.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P11 个人中心](page-specs/P11.md) | 20 | [15组](action-reviews/P11.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P12 今日行动](page-specs/P12.md) | 56 | [14组](action-reviews/P12.json) | 84个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P13 今日工作](page-specs/P13.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P14 热点趋势](page-specs/P14.md) | 107 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P15 选品机会](page-specs/P15.md) | 158 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P16 创建选品](page-specs/P16.md) | 46 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P17 评分规则](page-specs/P17.md) | 64 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P18 机会详情](page-specs/P18.md) | 158 | [52组](action-reviews/P18.json) | 258个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P19 竞品监控](page-specs/P19.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P20 竞品监控规则](page-specs/P20.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P21 供应链与利润](page-specs/P21.md) | 90 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P22 费用与利润规则](page-specs/P22.md) | 66 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P23 全部任务](page-specs/P23.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P24 任务详情](page-specs/P24.md) | 111 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P25 审批中心](page-specs/P25.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P26 通知中心](page-specs/P26.md) | 59 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P27 自动化规则](page-specs/P27.md) | 55 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P28 报表与导出](page-specs/P28.md) | 50 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P29 治理概览](page-specs/P29.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P30 成员与邀请](page-specs/P30.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P31 角色与权限](page-specs/P31.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P32 工作区管理](page-specs/P32.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P33 团队管理](page-specs/P33.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P34 审批模板](page-specs/P34.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P35 组织数据](page-specs/P35.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P36 组织令牌](page-specs/P36.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P37 组织审计](page-specs/P37.md) | 167 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P38 平台概览](page-specs/P38.md) | 66 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P39 账号与组织](page-specs/P39.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P40 组织管理](page-specs/P40.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P41 创建组织](page-specs/P41.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P42 组织详情](page-specs/P42.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P43 用户管理](page-specs/P43.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P44 管理员管理](page-specs/P44.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P45 角色权限](page-specs/P45.md) | 142 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P46 来源设置](page-specs/P46.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P47 采集程序](page-specs/P47.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P48 热点来源](page-specs/P48.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P49 1688 启用检查](page-specs/P49.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P50 凭证与档案](page-specs/P50.md) | 181 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P51 采集任务](page-specs/P51.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P52 采集总览](page-specs/P52.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P53 网页登录采集](page-specs/P53.md) | 123 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P54 数据中心](page-specs/P54.md) | 104 | [17组](action-reviews/P54.json) | 21个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P55 质量与规则](page-specs/P55.md) | 71 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P56 内容管理](page-specs/P56.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P57 通知管理](page-specs/P57.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P58 配额管理](page-specs/P58.md) | 79 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P59 安全中心](page-specs/P59.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P60 开放平台](page-specs/P60.md) | 87 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P61 系统状态](page-specs/P61.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P62 链路日志](page-specs/P62.md) | 72 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P63 接口覆盖证据](page-specs/P63.md) | 116 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P64 备份与恢复](page-specs/P64.md) | 53 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P65 发布管理](page-specs/P65.md) | 54 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P66 服务拓扑](page-specs/P66.md) | 49 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P67 Redis 运行](page-specs/P67.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P68 MySQL 运行](page-specs/P68.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P69 文件存储](page-specs/P69.md) | 42 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P70 采集调度](page-specs/P70.md) | 59 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P71 容量边界](page-specs/P71.md) | 50 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P72 界面状态](page-specs/P72.md) | 13 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P73 页面不存在](page-specs/P73.md) | 3 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |

## P11具体结论

AccountShell与PersonalCenter的20个源位置对应15组已有合同ID：14组P11可用语义动作，1组旧局部Tab由accountShell=true排除；含4类写入，表单/按钮不重复计数。五个分区链接保留独立变体，不改路由数。两源没有弹窗，不能为填数量增加确认框。

P11新增personal-composed-direction-c连续五分区提案、资料保存忙碌稿及204张双端图。14组代表控件适用六态均与具体selector/scene绑定；通用样本板不抵扣业务验收。0个未映射代表槽不等于全变体/输入/真实history或写入通过；P18/P54局部源语义见下表，下一核其逐控件/共享消费者、完整采纳成本组合与其余未复核页面（数量见上方动态汇总），未获具体稿批准前不替换生产Vue。

## 使用与证据

- `node scripts/audit-ui-phase2-action-coverage.mjs`只读复验；`--write`只生成本报告和[action-coverage-audit.json](action-coverage-audit.json)。
- 输入沿用历史[actions](actions.json)、[dialogs](dialogs.json)及当前合同扫描；人工映射在action-reviews/Pxx.json，沿用业务合同actionId；转发/排除关系键不算新业务动作，qualified旧键通过完整单元格别名核对。
- [P11映射](action-reviews/P11.json)逐项列原源ID、条件、handler、变体、双端场景与原型验证器、未覆盖项。存在引用不等于测试已通过；当次运行结果见[PROGRESS](PROGRESS.md)。
- 来源漂移、未知候选、漏项/重复映射、无合同ID、缺图/视口、假批准均失败关闭。全局HTML/图像哈希用既有`audit-ui-phase2-design-delivery.mjs`单独复核，不把此处场景存在检查当图片正确性。
- 不改变API/OpenAPI/配置/依赖/数据库/生产，无重启要求；两个报告和验证器为永久交付物，无一次性临时产物。

## P01 局部动作与共享消费者

[逐项机器清单](action-reviews/P01.json)：1个局部源位置 → 1组；0类写入，1组路由动作，0组转发/容器关联不重复计动作。0个本地v-model，0处调用/内嵌容器，0个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有6个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-LANDING-CHECK 重新确定登录落点 / read | 1处；mounted、blocked-retry | [p01-loading · 1440](design/identity-direction-c/1440-p01-loading.png) / [p01-loading · 390](design/identity-direction-c/390-p01-loading.png)、[p01-blocked · 1440](design/identity-direction-c/1440-p01-blocked.png) / [p01-blocked · 390](design/identity-direction-c/390-p01-blocked.png)；其余见JSON | 共享blocked次按钮有emit却无本页监听；不是影响详情。缺失目标/角色/真实会话、导航与重复读取待验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |

### 明确保留的边界

- 仅本页局部源与列明结构已核；全共享消费者/所有状态/主题/真实Vue与用户批准待验。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P02 局部动作与共享消费者

[逐项机器清单](action-reviews/P02.json)：18个局部源位置 → 13组；4类写入，11组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=login；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup。排除：mfa、sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P03 局部动作与共享消费者

[逐项机器清单](action-reviews/P03.json)：18个局部源位置 → 13组；4类写入，11组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=register；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup。排除：mfa、sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P04 局部动作与共享消费者

[逐项机器清单](action-reviews/P04.json)：18个局部源位置 → 13组；4类写入，11组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=forgot；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup。排除：mfa、sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P05 局部动作与共享消费者

[逐项机器清单](action-reviews/P05.json)：18个局部源位置 → 13组；4类写入，11组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=verify；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup。排除：mfa、sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P06 局部动作与共享消费者

[逐项机器清单](action-reviews/P06.json)：18个局部源位置 → 13组；4类写入，11组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=reset；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup。排除：mfa、sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P07 局部动作与共享消费者

[逐项机器清单](action-reviews/P07.json)：18个局部源位置 → 13组；5类写入，12组路由动作，0组转发/容器关联不重复计动作。13个本地v-model，2处调用/内嵌容器，6个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 2处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 1处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 3处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 1处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 2处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 2处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / write | 1处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 1处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 1处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 1处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / navigation | 1处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| LocalIdentity.vue / mfaCode | mfa-challenge：认证器或恢复码6–32；普通form required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / identifier | login：邮箱或用户名2–254，required | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / email | register/forgot：email类型、required、maxlength254 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / password | login/register/reset：12–128、required；reset仍沿用password ref | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / confirmPassword | register：12–128、required；只比较、不发后端 | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/password：种子当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / newPassword | security-setup/password：新长期密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | security-setup/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | security-setup/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/enrollment：当前密码12–128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/confirm：验证码maxlength8，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / currentPassword | mfa/disable：当前密码maxlength128，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |
| LocalIdentity.vue / mfaCode | mfa/disable：验证码或恢复码maxlength32，非form | 共享ref的位置不等于同时可见；原型清空和统一校验/忙碌不是源生命周期修复，字段边界与全部消费者仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LocalIdentity.vue / aside.1 / identity-story-replaced | inline-aside / proposal-shape-differs | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |
| LocalIdentity.vue / form.1 / p02-idle | form-container / matching-inline-form-scene | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p03-idle | form-container / matching-inline-form-scene | [p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p04-idle | form-container / matching-inline-form-scene | [p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p06-idle | form-container / matching-inline-form-scene | [p06-idle · 1440](design/identity-direction-c/1440-p06-idle.png) / [p06-idle · 390](design/identity-direction-c/390-p06-idle.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |
| LocalIdentity.vue / form.1 / p02-challenge | form-container / matching-inline-form-scene | [p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png) | mode图为共享表单消费者参考；不证明当前URL下全连续链或六态 |

### 路径与局部模式

初始mode=mfa；局部模式族：login、register、forgot、verify、reset、mfa-challenge、security-setup、mfa。排除：sessions。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：ID-EMAIL-CONFIRM / onMounted且初始mode=verify且URL token存在；switchMode不调用confirmEmail。不登记为按钮。

### 明确保留的边界

- P02–P07共用18源位置；六份是路由适用性记录，不是108个独立按钮。表单submit组展开五种请求；按路由累计组数不等于全站去重业务分母。
- query的五个公开mode可覆盖路径初始值；局部注册/登录/忘记密码不改URL，注册成功verify与登录结果挑战/首次设置也不改URL。
- 普通mfa管理只在P07初始可达；其余页start/confirm组仅首次设置实例可达，管理实例只作跨路由参考。legacy sessions无公开入口。
- ID-EMAIL-CONFIRM是挂载自动动作，无按钮候选；有token且初始verify才调用，局部切verify不自动确认。单列生命周期，不漏掉也不伪造按钮。
- 六态保守未映射：既有四类代表控件PNG缺逐action selector协议，不全页升格。错误标题、MFA未知状态、统一busy和敏感ref清空只在新稿，实际Vue未修。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P08 局部动作与共享消费者

[逐项机器清单](action-reviews/P08.json)：13个局部源位置 → 11组；2类写入，10组路由动作，0组转发/容器关联不重复计动作。1个本地v-model，1处调用/内嵌容器，1个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有60个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-states | [p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)；其余见JSON | 仍由根入口决定角色落点，未验真实会话。 |
| NONACTION-ACCOUNT 当前账号占位 / excluded | 1处；placeholder | [p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)；其余见JSON | 源视觉上可按但没有账号菜单；新稿非交互呈现是待审，不新增用户菜单。 |
| ID-LOGIN-ROUTE 会话失效重新登录 / navigation | 1处；expired | [p08-expired · 1440](design/identity-direction-c/1440-p08-expired.png) / [p08-expired · 390](design/identity-direction-c/390-p08-expired.png)；其余见JSON | 没有保留return_to到登录的源代码，不能宣称重新登录必回原页。 |
| ID-ORG-RELOAD 返回并重读组织 / read | 3处；error、forbidden、workspace-empty、workspace-back | [p08-error · 1440](design/identity-direction-c/1440-p08-error.png) / [p08-error · 390](design/identity-direction-c/390-p08-error.png)、[p08-forbidden · 1440](design/identity-direction-c/1440-p08-forbidden.png) / [p08-forbidden · 390](design/identity-direction-c/390-p08-forbidden.png)；其余见JSON | 不只是本地返回；未清query，旧工作区/团队ref仍在。选择写入期间返回可打断范围，晚到响应待验。 |
| ID-PERSONAL-PROVISION 创建本人选品空间 / write | 1处；empty-org、provisioning、direct-return | [p08-empty · 1440](design/identity-direction-c/1440-p08-empty.png) / [p08-empty · 390](design/identity-direction-c/390-p08-empty.png)、[p08-provisioning · 1440](design/identity-direction-c/1440-p08-provisioning.png) / [p08-provisioning · 390](design/identity-direction-c/390-p08-provisioning.png)；其余见JSON | 不是创建任意组织；没有handler单飞早退。后端幂等/会话/失败重试/实际导航需隔离验证。 |
| ID-ACCOUNT-ROUTE 进入个人中心 / navigation | 1处；empty-org | [p08-empty · 1440](design/identity-direction-c/1440-p08-empty.png) / [p08-empty · 390](design/identity-direction-c/390-p08-empty.png)；其余见JSON | 不意味着账号或组织权限已验。 |
| ID-MFA-ROUTE 进入MFA管理 / navigation | 1处；empty-org | [p08-empty · 1440](design/identity-direction-c/1440-p08-empty.png) / [p08-empty · 390](design/identity-direction-c/390-p08-empty.png)；其余见JSON | 实际账号级准入与P07重挂载另验。 |
| ID-CONTEXT-CONTINUE 继续引导或返回原页 / navigation | 1处；onboarding、return-to | [p08-selected · 1440](design/identity-direction-c/1440-p08-selected.png) / [p08-selected · 390](design/identity-direction-c/390-p08-selected.png)、[p08-return · 1440](design/identity-direction-c/1440-p08-return.png) / [p08-return · 390](design/identity-direction-c/390-p08-return.png)；其余见JSON | 不能把startsWith检测当完整重定向安全验证；与本人空间直接/home分开。 |
| ID-ORG-CHOOSE 选择组织并读工作区和团队 / read | 1处；organization-row、recent-order、loading | [p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)、[p08-workspaces-loading · 1440](design/identity-direction-c/1440-p08-workspaces-loading.png) / [p08-workspaces-loading · 390](design/identity-direction-c/390-p08-workspaces-loading.png)；其余见JSON | 两个GET一个失败整体错误；已记录最近组织不等于成功选择会话，晚到响应与所有动态行未验。 |
| ID-ORG-CLEAR 清除组织搜索 / local | 1处；no-match | [p08-search-empty · 1440](design/identity-direction-c/1440-p08-search-empty.png) / [p08-search-empty · 390](design/identity-direction-c/390-p08-search-empty.png)、[p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)；其余见JSON | 没有组织与无匹配不是同一状态；不代表全部unicode/排序/搜索输入六态。 |
| ID-WORKSPACE-CHOOSE 设置会话组织工作区 / write | 1处；active、archived、selecting、selected | [p08-workspaces · 1440](design/identity-direction-c/1440-p08-workspaces.png) / [p08-workspaces · 390](design/identity-direction-c/390-p08-workspaces.png)、[p08-selecting · 1440](design/identity-direction-c/1440-p08-selecting.png) / [p08-selecting · 390](design/identity-direction-c/390-p08-selecting.png)；其余见JSON | 不是选组织立即写会话；selecting时返回组织仍可按，两个请求归属与真实事务/权限待验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| TenancyChooser.vue / organizationQuery | 组织名称与slug本地筛选；trim/zh-CN小写，不写GET参数 | 排序、最近组织、各语言/超长/输入六态与真实Vue仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| TenancyChooser.vue / aside.1 / team-summary | inline-aside / proposal-shape-differs | [p08-workspaces · 1440](design/identity-direction-c/1440-p08-workspaces.png) / [p08-workspaces · 390](design/identity-direction-c/390-p08-workspaces.png) | 现有aside内容在新布局中重新分层；不是弹窗匹配/用户批准 |

### 明确保留的边界

- 仅本页局部源与列明结构已核；全共享消费者/所有状态/主题/真实Vue与用户批准待验。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P09 局部动作与共享消费者

[逐项机器清单](action-reviews/P09.json)：6个局部源位置 → 6组；0类写入，6组路由动作，0组转发/容器关联不重复计动作。0个本地v-model，0处调用/内嵌容器，0个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有36个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌回根入口 / navigation | 1处；all-steps | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)；其余见JSON | 不写进度，真实根落点另验。 |
| ID-GUIDE-SKIP 跳过引导 / navigation | 1处；step-1、step-2、step-3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 不是完成标记，不清理服务端状态；所有步骤键盘和返回链待验。 |
| ID-GUIDE-STEP 直接选择三步骤 / local | 1处；1、2、3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)；其余见JSON | 没有URL同步/持久化；初始小数query可导致undefined，未修源组件。 |
| ID-GUIDE-PREVIOUS 上一步 / local | 1处；2-to-1、3-to-2 | [p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)、[p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 首步是隐藏而非disabled；逐状态/焦点/非法初值未全验。 |
| ID-GUIDE-NEXT 下一步 / local | 1处；1-to-2、2-to-3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)；其余见JSON | 末步替换为完成链接，不补造busy请求或保存进度。 |
| ID-GUIDE-FINISH 结束引导返回根入口 / navigation | 1处；step-3 | [p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 只提供跳转，不代表已持久化完成或已验landing。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |

### 明确保留的边界

- 仅本页局部源与列明结构已核；全共享消费者/所有状态/主题/真实Vue与用户批准待验。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P10 局部动作与共享消费者

[逐项机器清单](action-reviews/P10.json)：11个局部源位置 → 11组；1类写入，11组路由动作，0组转发/容器关联不重复计动作。0个本地v-model，2处调用/内嵌容器，2个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| AC-ROOT 品牌返回应用入口 / navigation | 1处；all-states | [default · 1440](design/appearance-direction-c/1440-default.png) / [default · 390](design/appearance-direction-c/390-default.png)；其余见JSON | 最终根落点、登录和最近成员路径另验，不由主题页面图证明。 |
| AC-PROFILE 个人资料入口 / navigation | 1处；all-states | [default · 1440](design/appearance-direction-c/1440-default.png) / [default · 390](design/appearance-direction-c/390-default.png)；其余见JSON | P11账号壳层、未保存预览离开/返回生命周期待验。 |
| AC-MFA 安全设置入口 / navigation | 1处；all-states | [default · 1440](design/appearance-direction-c/1440-default.png) / [default · 390](design/appearance-direction-c/390-default.png)；其余见JSON | P07准入与MFA操作另审，不改身份权限。 |
| TH-ROUTE 当前外观页链接 / navigation | 1处；self-link | [default · 1440](design/appearance-direction-c/1440-default.png) / [default · 390](design/appearance-direction-c/390-default.png)；其余见JSON | 同路径导航不等于重新load；本地预览保持/路由复用待验。 |
| AC-LOGIN 过期重新登录 / navigation | 1处；expired | [expired · 1440](design/appearance-direction-c/1440-expired.png) / [expired · 390](design/appearance-direction-c/390-expired.png)；其余见JSON | 没有本页自动重放PUT或返回参数保证；真实会话与返回状态另验。 |
| AC-CONTEXT 选择偏好工作区 / navigation | 1处；scope、rate-limited、service-blocked、other-conflict | [scope · 1440](design/appearance-direction-c/1440-scope.png) / [scope · 390](design/appearance-direction-c/390-scope.png)、[rate-limited · 1440](design/appearance-direction-c/1440-rate-limited.png) / [rate-limited · 390](design/appearance-direction-c/390-rate-limited.png)；其余见JSON | 图稿只在明确scope错误显示此入口；源误合并不是已修复，不能因429推断没有工作区。 |
| TH-LOAD 读取最新偏好 / read | 1处；mounted、read-error、conflict-refresh、invalid-theme | [loading · 1440](design/appearance-direction-c/1440-loading.png) / [loading · 390](design/appearance-direction-c/390-loading.png)、[read-error · 1440](design/appearance-direction-c/1440-read-error.png) / [read-error · 390](design/appearance-direction-c/390-read-error.png)；其余见JSON | 无scope/代次保护；GET覆盖预览且applyTheme写缓存，不把本次图稿零storage当生产行为。 |
| TH-PREVIEW 预览三种主题 / local | 1处；deep-ocean、aurora-purple、cloud-white | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[aurora-purple-standard · 1440](design/appearance-direction-c/1440-aurora-purple-standard.png) / [aurora-purple-standard · 390](design/appearance-direction-c/390-aurora-purple-standard.png)；其余见JSON | 旧按钮无roving/方向键，图稿新增键盘与busy锁只是提案；三套全站主题消费者/真实缓存未验。 |
| TH-DENSITY 切换当前会话密度 / local | 1处；standard、compact | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[deep-ocean-compact · 1440](design/appearance-direction-c/1440-deep-ocean-compact.png) / [deep-ocean-compact · 390](design/appearance-direction-c/390-deep-ocean-compact.png)；其余见JSON | 没有v-model或density持久化字段。行政壳层compact覆盖和会话返回、主题×密度全控件未验。 |
| TH-RESTORE 撤销主题预览 / local | 1处；dirty、default-fallback、restore-during-save | [dirty · 1440](design/appearance-direction-c/1440-dirty.png) / [dirty · 390](design/appearance-direction-c/390-dirty.png)、[density-only · 1440](design/appearance-direction-c/1440-density-only.png) / [density-only · 390](design/appearance-direction-c/390-density-only.png)；其余见JSON | 保存中撤销竞态源码隔离复现；新稿锁定不同，不以saving图声称源可安全撤销。 |
| TH-SAVE 保存主题偏好 / write | 1处；dirty-save、no-snapshot-version-zero、saving、saved、response-different、conflict、failed | [dirty · 1440](design/appearance-direction-c/1440-dirty.png) / [dirty · 390](design/appearance-direction-c/390-dirty.png)、[saving · 1440](design/appearance-direction-c/1440-saving.png) / [saving · 390](design/appearance-direction-c/390-saving.png)；其余见JSON | 请求不含density；GET验证theme而PUT结果直接赋saved。saved状态不等于预览已同步；真实版本竞争/幂等/审计/SQL与生命周期未验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| ThemeStudio.vue / aside.1 / appearance-navigation | inline-aside / proposal-shape-differs | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[deep-ocean-compact · 1440](design/appearance-direction-c/1440-deep-ocean-compact.png) / [deep-ocean-compact · 390](design/appearance-direction-c/390-deep-ocean-compact.png) | C提案重新构图，静态样例不证明三套真实壳层已一起换肤 |
| ThemeStudio.vue / aside.2 / static-three-shell-preview | inline-aside / proposal-shape-differs | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[deep-ocean-compact · 1440](design/appearance-direction-c/1440-deep-ocean-compact.png) / [deep-ocean-compact · 390](design/appearance-direction-c/390-deep-ocean-compact.png) | C提案重新构图，静态样例不证明三套真实壳层已一起换肤 |

### 明确保留的边界

- 11组/11源位置；3主题+2密度实例不按v-model计数，两个aside不是弹窗。
- 既有86PNG中七类控件图未提供通用逐action selector/state证明，66槽保守未映射，不等于缺66图。
- 源预览缓存/会话密度与服务器版本分域，保存中restore导致saved+dirty已复现未修；新统一busy与错误分类待审。
- role=radio的3主题/2密度是受控按钮而非v-model；全部实例键盘/六态/主题密度组合与真实缓存未验。
- 本页独立ThemeStudio，不拿共享主题浮层的回滚行为、签收或壳层图抵扣整页；无新持久化字段。

## P12 局部动作与共享消费者

[逐项机器清单](action-reviews/P12.json)：20个局部源位置 → 14组；2类写入，14组路由动作，0组转发/容器关联不重复计动作。7个本地v-model，1处调用/内嵌容器，1个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有84个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| HD-LOAD 读取首页与规则 / read | 1处；mounted、error、expired、forbidden、blocked、rule-read-failed、missing-selection | [loading · 1440](design/home-direction-c/1440-loading.png) / [loading · 390](design/home-direction-c/390-loading.png)、[error · 1440](design/home-direction-c/1440-error.png) / [error · 390](design/home-direction-c/390-error.png)；其余见JSON | 所有源primary仍重读、secondary无监听。新稿登录/选择范围等恢复链接和独立规则失败是提案，不按图升格实际链。 |
| HD-RULES 管理或查看规则 / navigation | 3处；header、no-manage、runtime-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[readonly · 1440](design/home-direction-c/1440-readonly.png) / [readonly · 390](design/home-direction-c/390-readonly.png)；其余见JSON | 三入口标签/权限分支分别保留；链接本身不要求trend:manage，不代表实际规则API授权。 |
| HD-OPPORTUNITIES 查看推荐清单与全部计数 / navigation | 2处；header-list、queue-all-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[quiet · 1440](design/home-direction-c/1440-quiet.png) / [quiet · 390](design/home-direction-c/390-quiet.png)；其余见JSON | 不能与子区view=recommended合并目标；recommended_count不由当前返回一条样例反推。 |
| HD-START 创建选品入口 / navigation | 1处；header-primary | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[not-configured · 1440](design/home-direction-c/1440-not-configured.png) / [not-configured · 390](design/home-direction-c/390-not-configured.png)；其余见JSON | 只导航，不在首页创建机会；后续P16权限/表单/完整壳层首屏另验。 |
| HD-RESUME 恢复第一条暂停规则 / write | 1处；first-paused、busy、failed、success-reload | [paused · 1440](design/home-direction-c/1440-paused.png) / [paused · 390](design/home-direction-c/390-paused.png)、[resume-busy · 1440](design/home-direction-c/1440-resume-busy.png) / [resume-busy · 390](design/home-direction-c/390-resume-busy.png)；其余见JSON | 仅第一条、不是批量恢复。handler无setupBusy早退；成功文案不证明采集已运行，写成功后读失败/真实调度另验。 |
| HD-SETUP 展开或收起首次设置 / local | 1处；open、close、reopen | [not-configured · 1440](design/home-direction-c/1440-not-configured.png) / [not-configured · 390](design/home-direction-c/390-not-configured.png)、[setup-closed · 1440](design/home-direction-c/1440-setup-closed.png) / [setup-closed · 390](design/home-direction-c/390-setup-closed.png)；其余见JSON | 原型busy锁是提案。load只在明确not_configured且rules空时自动展开，缺字段仅fallback并不满足该自动展开条件。 |
| HD-CREATE-RULE 提交七字段规则表单 / write | 2处；form-submit、submit-button、ten-markets、empty-keywords、success-read-failure | [setup-edited · 1440](design/home-direction-c/1440-setup-edited.png) / [setup-edited · 390](design/home-direction-c/390-setup-edited.png)、[setup-invalid · 1440](design/home-direction-c/1440-setup-invalid.png) / [setup-invalid · 390](design/home-direction-c/390-setup-invalid.png)；其余见JSON | 关键词保留重复；语言按现有市场映射，渠道in_app、空分类null、默认名称首关键词。不清七输入；读失败不能抹掉写成功事实，真实权限/SQL/调度待验。 |
| HD-RECOMMENDATION 进入推荐条目 / navigation | 1处；each-recommendation、null-score、long-title-reason | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[no-score · 1440](design/home-direction-c/1440-no-score.png) / [no-score · 390](design/home-direction-c/390-no-score.png)；其余见JSON | 按服务返回顺序，前端不重新排序；动态目标和全记录字段/长值/真实对象可达未穷尽。 |
| HD-CANDIDATES 查看规则命中候选 / navigation | 2处；empty-queue-priority、runtime-count | [candidates · 1440](design/home-direction-c/1440-candidates.png) / [candidates · 390](design/home-direction-c/390-candidates.png)、[running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)；其余见JSON | 源按truthy分支不是严格>0校验；空推荐提示与采集入口互斥，计数区域链接不互斥。 |
| HD-EVIDENCE 查看采集中商品 / navigation | 2处；empty-queue-fallback、runtime-count | [collecting · 1440](design/home-direction-c/1440-collecting.png) / [collecting · 390](design/home-direction-c/390-collecting.png)、[running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)；其余见JSON | 不把候选和采集提示同时显示；不把候选总量candidate_count当采集中。真实列表筛选链待验。 |
| HD-WORK-HEALTH 打开本人其他待办和异常 / navigation | 1处；task、approval、health、dynamic-row | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[long-items · 1440](design/home-direction-c/1440-long-items.png) / [long-items · 390](design/home-direction-c/390-long-items.png)；其余见JSON | changes/follows只参与total未逐项显示；不把数据说明total当当前列表行数，也不跨两个数组自行重排优先级。 |
| HD-TRUTH 展开数据说明 / local | 1处；collapsed、expanded | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[truth-open · 1440](design/home-direction-c/1440-truth-open.png) / [truth-open · 390](design/home-direction-c/390-truth-open.png)；其余见JSON | 不是TechnicalDetails复制；真实可见行与总投影不等同，所有主题/长文本/键盘状态待验。 |
| HD-RECOMMENDED-VIEW 按推荐view查看机会 / navigation | 1处；recommended-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[quiet · 1440](design/home-direction-c/1440-quiet.png) / [quiet · 390](design/home-direction-c/390-quiet.png)；其余见JSON | 与顶部无view入口保留不同语义；计数是运行摘要不代表已采纳或当前返回行数。 |
| HD-RUNTIME 展开自动运行详情 / local | 1处；collapsed、expanded、null-timestamps | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[runtime-open · 1440](design/home-direction-c/1440-runtime-open.png) / [runtime-open · 390](design/home-direction-c/390-runtime-open.png)；其余见JSON | 四步骤标记依据不同计数>0，不是每个商品已通过流程的证明；candidate_count与rule_candidate_count字段不能互换。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| HomeDashboard.vue / setupForm.include_keywords | 关键词；required/maxlength500；英文逗号/中文逗号/换行分割，trim去空但保留重复 | 空白关键词、输入长值、Enter与写中改动/离开未全验 |
| HomeDashboard.vue / setupForm.market | 市场10项US/GB/DE/FR/JP/KR/AU/CA/SG/GLOBAL；四特定语言，其余en-US | 非选项运行输入与服务端校验另验，不增市场或语言 |
| HomeDashboard.vue / setupForm.collection_interval_minutes | number修饰；15/60/360/720/1440分钟 | 单位分钟，数字传输与真实调度频率分开验 |
| HomeDashboard.vue / setupForm.recommendation_min_source_count | number修饰；1/2/3独立来源 | 形成候选门槛不等于五项质量门，不直接产生推荐 |
| HomeDashboard.vue / setupForm.negative_keywords | 排除关键词maxlength500，拆分规则同关键词 | 保留重复/原精确目标，字段级错误/长值待验 |
| HomeDashboard.vue / setupForm.category | 分类maxlength80，trim后空为null | 不生成新分类/多选字段 |
| HomeDashboard.vue / setupForm.name | 名称maxlength120，trim空时用首关键词命名 | 来源于当前表单，不推导唯一性；重复提交/版本和错误归属待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| HomeDashboard.vue / form.1 / first-rule-inline | form-container / matching-inline-form-scene | [setup-edited · 1440](design/home-direction-c/1440-setup-edited.png) / [setup-edited · 390](design/home-direction-c/390-setup-edited.png)、[setup-busy · 1440](design/home-direction-c/1440-setup-busy.png) / [setup-busy · 390](design/home-direction-c/390-setup-busy.png)、[setup-failed · 1440](design/home-direction-c/1440-setup-failed.png) / [setup-failed · 390](design/home-direction-c/390-setup-failed.png) | 七字段仅一表单变体；完整壳层/手机键盘/全部状态和权限另验 |

### 明确保留的边界

- 20源位置/14组；顶部/全部无view链接、计数view链接、item.route和首条恢复分开，不将同中文字当相同目标。
- 七字段内联form，无原生弹窗；rules失败不等于无规则。缺automatic_selection显示fallback未配置/0，但load不会因此自动展开；明确not_configured加rules失败才自动展开。
- 既有64图为独立工作面，未组合真实顶/底导航，不能证明实际首条推荐仍在手机首屏；84槽保守未映射。
- /home声明reset_on_scope，父key结合组织/工作区。返回旧缓存key、写入后重读失败和全生命周期仍未真实验收，不把缺watcher直接定性为跨范围泄露。
- NavigationShell实际surfaceProps传capabilities，HomeAutomationOverview接selection；没有把共享导航内部全部控件纳入20个局部候选分母。
- UiStatePanel默认secondary部分状态有标签但本页无监听；过期/无权限新恢复链接为提案，实际调用方未修改。
- 目录/home为reset_on_scope，父key含组织/工作区且KeepAlive最大12。没有本地scope watcher不等于完全无范围隔离；回到已缓存key是否及时刷新及旧请求结果仍须真实Vue验收。

## P18 局部动作与共享消费者

[逐项机器清单](action-reviews/P18.json)：95个局部源位置 → 52组；12类写入，43组路由动作，8组转发/容器关联不重复计动作。34个本地v-model，23处调用/内嵌容器，38个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有258个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OP-AI-QUEUE 生成AI分析 / write | 1处；can-write、readonly、busy、failed | [ai-queue-busy · 1440](design/review-direction-c/1440-ai-queue-busy.png) / [ai-queue-busy · 390](design/review-direction-c/390-ai-queue-busy.png)、[ai-reload-error · 1440](design/review-direction-c/1440-ai-reload-error.png) / [ai-reload-error · 390](design/review-direction-c/390-ai-reload-error.png)；其余见JSON | 排队不代表模型成功；跨ID晚到结果、真实权限与完整生命周期未验。 |
| OP-AI-RETRY 重读AI记录 / read | 1处；error、stale-error、malformed | [ai-error · 1440](design/review-direction-c/1440-ai-error.png) / [ai-error · 390](design/review-direction-c/390-ai-error.png)、[ai-stale-error · 1440](design/review-direction-c/1440-ai-stale-error.png) / [ai-stale-error · 390](design/review-direction-c/390-ai-stale-error.png)；其余见JSON | 失败后旧articles仍渲染；具体恢复策略待审。 |
| OP-AI-REVIEW.approved AI抽检通过 / write | 1处；pending、already-reviewed、replaced-ask | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png)、[approved-failed · 1440](design/review-direction-c/1440-approved-failed.png) / [approved-failed · 390](design/review-direction-c/390-approved-failed.png)；其余见JSON | 源先关原因窗后POST，原型失败保留是改动；不保证重复ask/迟到响应归属。 |
| OP-AI-REVIEW.rejected AI抽检驳回 / write | 1处；pending、rejected、cancel、failure | [rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png)、[review-unknown · 1440](design/review-direction-c/1440-review-unknown.png) / [review-unknown · 390](design/review-direction-c/390-review-unknown.png)；其余见JSON | 未知不等于未写入；真实结果ID/审计及失败恢复未验。 |
| OP-COST-REVIEW-OPEN.rejected 打开驳回复核表单 / local | 1处；own、other、overdue | [rejected-empty · 1440](design/profit-direction-c/1440-rejected-empty.png) / [rejected-empty · 390](design/profit-direction-c/390-rejected-empty.png)、[other-reviewer · 1440](design/profit-direction-c/1440-other-reviewer.png) / [other-reviewer · 390](design/profit-direction-c/390-other-reviewer.png)；其余见JSON | 未因新reviews或can_review变化清review.id，旧表单可能残留。 |
| OP-COST-REVIEW-OPEN.approved 打开通过复核表单 / local | 1处；own、other、overdue | [approved-empty · 1440](design/profit-direction-c/1440-approved-empty.png) / [approved-empty · 390](design/profit-direction-c/390-approved-empty.png)、[permissions-lost · 1440](design/profit-direction-c/1440-permissions-lost.png) / [permissions-lost · 390](design/profit-direction-c/390-permissions-lost.png)；其余见JSON | 未验动态资格变化/忙碌重复打开；不可把已超时直接等同源按钮禁用。 |
| OP-COST-REVIEW-SUBMIT 提交成本复核 / write | 2处；approved、rejected | [approved-edited · 1440](design/profit-direction-c/1440-approved-edited.png) / [approved-edited · 390](design/profit-direction-c/390-approved-edited.png)、[rejected-edited · 1440](design/profit-direction-c/1440-rejected-edited.png) / [rejected-edited · 390](design/profit-direction-c/390-rejected-edited.png)；其余见JSON | 源表单可独立于item.can_review存在；提交函数只查原因不查busy；服务端资格和版本待实库验收。 |
| OP-COST-REVIEW-CANCEL 取消成本复核输入 / local | 1处；approved、rejected | [approved-empty · 1440](design/profit-direction-c/1440-approved-empty.png) / [approved-empty · 390](design/profit-direction-c/390-approved-empty.png)、[rejected-empty · 1440](design/profit-direction-c/1440-rejected-empty.png) / [rejected-empty · 390](design/profit-direction-c/390-rejected-empty.png)；其余见JSON | 内联关闭返焦/新行替换及所有主题待验。 |
| OP-DECISION-ANCHOR 定位重新决策 / navigation | 1处；writable、readonly、not-adoptable | [redecision · 1440](design/opportunity-detail-direction-c/1440-redecision.png) / [redecision · 390](design/opportunity-detail-direction-c/390-redecision.png)、[overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)；其余见JSON | 源可能无锚点；新稿定位不等于源锚点修复。 |
| OP-GATES-DETAILS 展开五项质量门 / local | 1处；all、partial、missing | [gate-summary-pending · 1440](design/opportunity-detail-direction-c/1440-gate-summary-pending.png) / [gate-summary-pending · 390](design/opportunity-detail-direction-c/390-gate-summary-pending.png)、[recommended · 1440](design/opportunity-detail-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-detail-direction-c/390-recommended.png)；其余见JSON | 采纳仍以recommended与all_passed双条件，不能只按5/5条数替代。 |
| OP-DECISION-OPEN.adopt 填写采纳原因 / local | 1处；allowed、hidden、busy | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png)、[missing-cost · 1440](design/opportunity-detail-direction-c/1440-missing-cost.png) / [missing-cost · 390](design/opportunity-detail-direction-c/390-missing-cost.png)；其余见JSON | 同一701组合稿无采纳质量门，尚未串通完整采纳链。 |
| OP-DECISION-OPEN.observe 填写观察原因 / local | 2处；recommended、early | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png)、[observe-dialog · 1440](design/detail-adaptive-direction-c/1440-observe-dialog.png) / [observe-dialog · 390](design/detail-adaptive-direction-c/390-observe-dialog.png)；其余见JSON | 同tick/写入中重开可改action和reason；真实Vue尚未修复。 |
| OP-DECISION-OPEN.reject 填写驳回原因 / local | 2处；recommended、early | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png)、[reject-dialog · 1440](design/detail-adaptive-direction-c/1440-reject-dialog.png) / [reject-dialog · 390](design/detail-adaptive-direction-c/390-reject-dialog.png)；其余见JSON | 忙碌关闭/重开和迟到结果归属仍待真实Vue验证。 |
| OP-EARLY-DECISION-DETAILS 提前人工处理展开 / local | 1处；candidate、not-eligible | [early · 1440](design/opportunity-detail-direction-c/1440-early.png) / [early · 390](design/opportunity-detail-direction-c/390-early.png)、[candidate · 1440](design/opportunity-detail-direction-c/1440-candidate.png) / [candidate · 390](design/opportunity-detail-direction-c/390-candidate.png)；其余见JSON | 完整动态质量门变化/焦点与六态未验。 |
| OP-BLOCKER-TASK 查看已有补采任务 / navigation | 2处；primary、all-blockers、cleared | [blockers · 1440](design/opportunity-detail-direction-c/1440-blockers.png) / [blockers · 390](design/opportunity-detail-direction-c/390-blockers.png)、[progress · 1440](design/opportunity-detail-direction-c/1440-progress.png) / [progress · 390](design/opportunity-detail-direction-c/390-progress.png)；其余见JSON | 现行查看任务与新建后导航路径不同，不能自动统一契约。 |
| OP-EVIDENCE-TASK 创建或复用补采任务 / write | 1处；new、reused、failed | [collecting · 1440](design/opportunity-detail-direction-c/1440-collecting.png) / [collecting · 390](design/opportunity-detail-direction-c/390-collecting.png)、[progress · 1440](design/opportunity-detail-direction-c/1440-progress.png) / [progress · 390](design/opportunity-detail-direction-c/390-progress.png)；其余见JSON | 排队/复用不能替代实库任务与关联审计验收。 |
| OP-BLOCKERS-DETAILS 展开全部判断条件 / local | 1处；blocked、in-progress、cleared | [blockers · 1440](design/opportunity-detail-direction-c/1440-blockers.png) / [blockers · 390](design/opportunity-detail-direction-c/390-blockers.png)、[cleared · 1440](design/opportunity-detail-direction-c/1440-cleared.png) / [cleared · 390](design/opportunity-detail-direction-c/390-cleared.png)；其余见JSON | 全部code与缺值、长文、主题的组合未穷尽。 |
| OP-DOWNSTREAM-RETRY 重读竞品供应数据 / read | 2处；overview、competition、one-side-failure | [overview-error · 1440](design/insights-direction-c/1440-overview-error.png) / [overview-error · 390](design/insights-direction-c/390-overview-error.png)、[competition-error · 1440](design/insights-direction-c/1440-competition-error.png) / [competition-error · 390](design/insights-direction-c/390-competition-error.png)；其余见JSON | 不把共同失败时被遮蔽的成功响应当无数据；两域独立降级未改源。 |
| OP-COMPETITOR-DISCOVER 采集竞品 / write | 3处；manual、overview、competition | [competitor-busy · 1440](design/insights-direction-c/1440-competitor-busy.png) / [competitor-busy · 390](design/insights-direction-c/390-competitor-busy.png)、[competitor-queued · 1440](design/insights-direction-c/1440-competitor-queued.png) / [competitor-queued · 390](design/insights-direction-c/390-competitor-queued.png)；其余见JSON | 只读权限不能替代管理能力；原稿队列结果并非真实采集证明。 |
| OP-SUPPLIER-DISCOVER 采集供应商 / write | 2处；manual、overview | [supplier-busy · 1440](design/insights-direction-c/1440-supplier-busy.png) / [supplier-busy · 390](design/insights-direction-c/390-supplier-busy.png)、[supplier-queued · 1440](design/insights-direction-c/1440-supplier-queued.png) / [supplier-queued · 390](design/insights-direction-c/390-supplier-queued.png)；其余见JSON | 不使用competitor能力兜底；来源和ID晚到隔离待验。 |
| OP-COMPETITORS-NAV 打开竞品目录 / navigation | 2处；overview、competition、no-access | [overview-no-access · 1440](design/insights-direction-c/1440-overview-no-access.png) / [overview-no-access · 390](design/insights-direction-c/390-overview-no-access.png)、[competition-no-access · 1440](design/insights-direction-c/1440-competition-no-access.png) / [competition-no-access · 390](design/insights-direction-c/390-competition-no-access.png)；其余见JSON | 旧合同按能力展示与实际无条件链接不同；不擅自隐藏或增筛选。 |
| OP-SOURCING-NAV 打开供应链目录 / navigation | 1处；overview、no-access | [overview-no-access · 1440](design/insights-direction-c/1440-overview-no-access.png) / [overview-no-access · 390](design/insights-direction-c/390-overview-no-access.png)、[overview · 1440](design/insights-direction-c/1440-overview.png) / [overview · 390](design/insights-direction-c/390-overview.png)；其余见JSON | 合同能力描述与源链接不一致；目标页鉴权不等于源隐藏。 |
| OP-SCORE-RULES 管理评分规则 / navigation | 2处；manual、overview | [score · 1440](design/insights-direction-c/1440-score.png) / [score · 390](design/insights-direction-c/390-score.png)、[score-readonly · 1440](design/insights-direction-c/1440-score-readonly.png) / [score-readonly · 390](design/insights-direction-c/390-score-readonly.png)；其余见JSON | 源链接能力与目标路由权限须分别审查；不得混成queue。 |
| OP-SCORE-QUEUE 重新评分排队 / write | 1处；allowed、readonly、failure | [score-busy · 1440](design/insights-direction-c/1440-score-busy.png) / [score-busy · 390](design/insights-direction-c/390-score-busy.png)、[score-reload-error · 1440](design/insights-direction-c/1440-score-reload-error.png) / [score-reload-error · 390](design/insights-direction-c/390-score-reload-error.png)；其余见JSON | 读取失败后的成功文案可能盖反馈；评分事实仍等真实运行。 |
| OP-EVIDENCE-ORIGINAL 打开证据原文 / navigation | 1处；original、long-url | [evidence · 1440](design/opportunity-detail-direction-c/1440-evidence.png) / [evidence · 390](design/opportunity-detail-direction-c/390-evidence.png)、[evidence-long · 1440](design/opportunity-detail-direction-c/1440-evidence-long.png) / [evidence-long · 390](design/opportunity-detail-direction-c/390-evidence-long.png)；其余见JSON | 具体URL安全/外部可达不由离线图证明；无后台翻页。 |
| OP-EVIDENCE-COLLAPSE 收起证据 / local | 1处；40、41 | [evidence-40 · 1440](design/opportunity-detail-direction-c/1440-evidence-40.png) / [evidence-40 · 390](design/opportunity-detail-direction-c/390-evidence-40.png)、[evidence-41 · 1440](design/opportunity-detail-direction-c/1440-evidence-41.png) / [evidence-41 · 390](design/opportunity-detail-direction-c/390-evidence-41.png)；其余见JSON | 切tab实际卸载也重置；组合稿保留规则需具体对齐。 |
| OP-EVIDENCE-MORE 继续显示证据 / local | 1处；20、40、41 | [evidence-20 · 1440](design/opportunity-detail-direction-c/1440-evidence-20.png) / [evidence-20 · 390](design/opportunity-detail-direction-c/390-evidence-20.png)、[evidence-41 · 1440](design/opportunity-detail-direction-c/1440-evidence-41.png) / [evidence-41 · 390](design/opportunity-detail-direction-c/390-evidence-41.png)；其余见JSON | 20阈值并非服务分页；每行及焦点/主题交叉未穷尽。 |
| OP-FEEDBACK-SUBMIT 写入经营复盘事实 / write | 2处；valid、period-invalid、returns-invalid、unknown | [form-filled · 1440](design/review-direction-c/1440-form-filled.png) / [form-filled · 390](design/review-direction-c/390-form-filled.png)、[form-unknown · 1440](design/review-direction-c/1440-form-unknown.png) / [form-unknown · 390](design/review-direction-c/390-form-unknown.png)；其余见JSON | 11可编辑字段并非12；observed_at自动取当前时间；同机会组合与单稿夹具不混用。 |
| OP-FEEDBACK-AUDIT 展开复盘审计标识 / local | 1处；record、long | [feedback-details · 1440](design/review-direction-c/1440-feedback-details.png) / [feedback-details · 390](design/review-direction-c/390-feedback-details.png)、[feedback · 1440](design/review-direction-c/1440-feedback.png) / [feedback · 390](design/review-direction-c/390-feedback.png)；其余见JSON | 返回至多20条不叫完整经营周期；当前701组合缺这些事实。 |
| OP-LINEAGE-TECHNICAL 展开节点技术链路 / local | 1处；present、no-correlation | [lineage-details · 1440](design/review-direction-c/1440-lineage-details.png) / [lineage-details · 390](design/review-direction-c/390-lineage-details.png)、[lineage-no-correlation · 1440](design/review-direction-c/1440-lineage-no-correlation.png) / [lineage-no-correlation · 390](design/review-direction-c/390-lineage-no-correlation.png)；其余见JSON | 不凭节点顺序生成因果边；组合缺血缘事实不补造。 |
| OP-LINEAGE-NAV 打开血缘节点 / navigation | 1处；present、empty | [lineage · 1440](design/review-direction-c/1440-lineage.png) / [lineage · 390](design/review-direction-c/390-lineage.png)、[lineage-empty · 1440](design/review-direction-c/1440-lineage-empty.png) / [lineage-empty · 390](design/review-direction-c/390-lineage-empty.png)；其余见JSON | 真实路由授权/节点来源及全部类型需端到端证据。 |
| OP-LINEAGE-FAILURES 展开失败代码 / local | 1处；blocked、degraded、none | [lineage · 1440](design/review-direction-c/1440-lineage.png) / [lineage · 390](design/review-direction-c/390-lineage.png)、[lineage-degraded · 1440](design/review-direction-c/1440-lineage-degraded.png) / [lineage-degraded · 390](design/review-direction-c/390-lineage-degraded.png)；其余见JSON | 所有失败状态及未知age不冒充健康，原型不证明运行事实。 |
| OP-COST-RULES 管理费用规则 / navigation | 1处；allowed、readonly | [snapshot · 1440](design/profit-direction-c/1440-snapshot.png) / [snapshot · 390](design/profit-direction-c/390-snapshot.png)、[readonly · 1440](design/profit-direction-c/1440-readonly.png) / [readonly · 390](design/profit-direction-c/390-readonly.png)；其余见JSON | canConfirmCost不控制此链接，目标页能力独立。 |
| OP-COST-SUBMIT 提交成本双人复核 / write | 2处；sale、purchase、logistics | [sale · 1440](design/profit-direction-c/1440-sale.png) / [sale · 390](design/profit-direction-c/390-sale.png)、[purchase · 1440](design/profit-direction-c/1440-purchase.png) / [purchase · 390](design/profit-direction-c/390-purchase.png)；其余见JSON | 默认UTC截断与本地解析存在偏移；提交未生效，另一人服务端资格需验。 |
| OP-PROFIT-QUEUE 利润重算排队 / write | 1处；valid、no-rule、failure | [queue-busy · 1440](design/profit-direction-c/1440-queue-busy.png) / [queue-busy · 390](design/profit-direction-c/390-queue-busy.png)、[queue-no-rule · 1440](design/profit-direction-c/1440-queue-no-rule.png) / [queue-no-rule · 390](design/profit-direction-c/390-queue-no-rule.png)；其余见JSON | 不能以成本表单必填项阻止现行重算；同一701完整权限成本链仍缺。 |
| OP-RETURN 返回来源 / navigation | 1处；from、fallback | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[control-return-focus · 1440](design/detail-adaptive-direction-c/1440-control-return-focus.png) / [control-return-focus · 390](design/detail-adaptive-direction-c/390-control-return-focus.png)；其余见JSON | 不是完整路由白名单/鉴权证明，history与跨ID范围仍需验证。 |
| OP-DETAIL-RETRY 详情状态主行动 / read | 1处；empty、error、forbidden、expired、blocked | [error · 1440](design/opportunity-detail-direction-c/1440-error.png) / [error · 390](design/opportunity-detail-direction-c/390-error.png)、[forbidden · 1440](design/opportunity-detail-direction-c/1440-forbidden.png) / [forbidden · 390](design/opportunity-detail-direction-c/390-forbidden.png)；其余见JSON | 源文案开始创建/返回工作台/重新登录但实际均重读；次按钮可能可见却无处理器。不得宣称导航已实现。 |
| OP-RUNTIME-DETAILS 展开运行信息 / local | 1处；known、unknown | [technical · 1440](design/opportunity-detail-direction-c/1440-technical.png) / [technical · 390](design/opportunity-detail-direction-c/390-technical.png)、[technical-open · 1440](design/detail-adaptive-direction-c/1440-technical-open.png) / [technical-open · 390](design/detail-adaptive-direction-c/390-technical-open.png)；其余见JSON | 源格式化与原型展开形态不同；无新读请求。 |
| OP-MANUAL-COLLECTION-DETAILS 补证异常手工工具 / local | 1处；candidate、readonly | [candidate · 1440](design/opportunity-detail-direction-c/1440-candidate.png) / [candidate · 390](design/opportunity-detail-direction-c/390-candidate.png)、[overview · 1440](design/insights-direction-c/1440-overview.png) / [overview · 390](design/insights-direction-c/390-overview.png)；其余见JSON | 部分内容在核心图和分析稿分开，完整连续有数据链未证明。 |
| OP-TAB 机会十分区 / navigation | 2处；overview、evidence、profit、risk、market、competition、ai、lineage、feedback、decisions | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[profit · 1440](design/detail-adaptive-direction-c/1440-profit.png) / [profit · 390](design/detail-adaptive-direction-c/390-profit.png)；其余见JSON | 真实v-if卸载子区局部状态，父form仍存；原型全部保留不可当源生命周期已修复。 |
| OP-MORE-ANALYSIS 展开更多分区 / local | 1处；primary、secondary | [directory-open · 1440](design/opportunity-detail-direction-c/1440-directory-open.png) / [directory-open · 390](design/opportunity-detail-direction-c/390-directory-open.png)、[directory-open · 1440](design/detail-adaptive-direction-c/1440-directory-open.png) / [directory-open · 390](design/detail-adaptive-direction-c/390-directory-open.png)；其余见JSON | 新目录形态取代源更多折叠属提案；六态和实际焦点未全验。 |
| OP-DECISION-CLOSE 关闭人工原因窗 / local | 3处；adopt、observe、reject、Escape、header、footer | [observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png)、[reject-dialog · 1440](design/detail-adaptive-direction-c/1440-reject-dialog.png) / [reject-dialog · 390](design/detail-adaptive-direction-c/390-reject-dialog.png)；其余见JSON | 重复标题ID仍在真实Vue；原型忙碌限制不等于旧源已生效。 |
| OP-DECISION-SUBMIT 提交人工决定 / write | 2处；adopt、observe、reject | [adopt-failed · 1440](design/opportunity-detail-direction-c/1440-adopt-failed.png) / [adopt-failed · 390](design/opportunity-detail-direction-c/390-adopt-failed.png)、[decision-unknown · 1440](design/opportunity-detail-direction-c/1440-decision-unknown.png) / [decision-unknown · 390](design/opportunity-detail-direction-c/390-decision-unknown.png)；其余见JSON | 业务原因服务端trim；关闭/重开和当前ID/版本晚到竞态、完整采纳链仍未验证。 |
| OP-P15-EXCLUDED 共享文件中的P15列表入口与弹窗 / excluded | 24处；list-actions、create、ERP、batch-assign、batch-review、batch-archive | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)、[erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)；其余见JSON | 只排除P18业务动作计数，不证明运行不可达：ID切换未清showCreate/showErpImport/showBatch，缓存页残留需真实生命周期验收。P15全页另审。 |
| OP-WIRING-COST 组件事件/容器关联：COST / wiring | 2处；OP-COST-REVIEW-SUBMIT、OP-COST-SUBMIT、OP-PROFIT-QUEUE | [form · 1440](design/profit-direction-c/1440-form.png) / [form · 390](design/profit-direction-c/390-form.png)、[approved-empty · 1440](design/profit-direction-c/1440-approved-empty.png) / [approved-empty · 390](design/profit-direction-c/390-approved-empty.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-DECISION-PANEL 组件事件/容器关联：DECISION-PANEL / wiring | 1处；OP-DECISION-OPEN.adopt、OP-DECISION-OPEN.observe、OP-DECISION-OPEN.reject、OP-EVIDENCE-TASK | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-INSIGHTS 组件事件/容器关联：INSIGHTS / wiring | 1处；OP-COMPETITOR-DISCOVER、OP-SUPPLIER-DISCOVER、OP-SCORE-QUEUE、OP-DOWNSTREAM-RETRY | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-FEEDBACK 组件事件/容器关联：FEEDBACK / wiring | 1处；OP-FEEDBACK-SUBMIT | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-AI 组件事件/容器关联：AI / wiring | 1处；OP-AI-QUEUE、OP-AI-RETRY、OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png)、[rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-DIALOGS 组件事件/容器关联：DIALOGS / wiring | 2处；OP-P15-EXCLUDED、OP-DECISION-SUBMIT | [overview · 1440](design/detail-adaptive-direction-c/1440-overview.png) / [overview · 390](design/detail-adaptive-direction-c/390-overview.png)、[observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-REASON 组件事件/容器关联：REASON / wiring | 3处；OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png)、[rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |
| OP-WIRING-DECISION-CONTAINER 组件事件/容器关联：DECISION-CONTAINER / wiring | 1处；OP-DECISION-OPEN.adopt、OP-DECISION-OPEN.observe、OP-DECISION-OPEN.reject、OP-DECISION-CLOSE、OP-DECISION-SUBMIT | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png)、[rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png)；其余见JSON | 绑定验证的是当前源码事件字符串和操作归属，不是挂载Vue事件执行、权限或生命周期；OP-WIRING编号仅为审阅关系键，不新增业务ID。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| OP-WIRING-COST | @review-cost / $emit('reviewCost', $event) | OP-COST-REVIEW-SUBMIT |
| OP-WIRING-COST | @confirm-cost / confirmCost | OP-COST-SUBMIT |
| OP-WIRING-COST | @review-cost / reviewCost | OP-COST-REVIEW-SUBMIT |
| OP-WIRING-COST | @queue-profit / queueProfit | OP-PROFIT-QUEUE |
| OP-WIRING-DECISION-PANEL | @decide / startDecision | OP-DECISION-OPEN.adopt、OP-DECISION-OPEN.observe、OP-DECISION-OPEN.reject |
| OP-WIRING-DECISION-PANEL | @create-evidence-task / createEvidenceTask | OP-EVIDENCE-TASK |
| OP-WIRING-INSIGHTS | @discover-competitors / discoverCompetitors | OP-COMPETITOR-DISCOVER |
| OP-WIRING-INSIGHTS | @discover-suppliers / discoverSuppliers | OP-SUPPLIER-DISCOVER |
| OP-WIRING-INSIGHTS | @queue-score / queueScore | OP-SCORE-QUEUE |
| OP-WIRING-INSIGHTS | @retry-downstream / loadDownstream | OP-DOWNSTREAM-RETRY |
| OP-WIRING-FEEDBACK | @submit / submitOperatingFeedback | OP-FEEDBACK-SUBMIT |
| OP-WIRING-AI | @queue / queueAi | OP-AI-QUEUE |
| OP-WIRING-AI | @retry / loadAi | OP-AI-RETRY |
| OP-WIRING-AI | @review / reviewAi | OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected |
| OP-WIRING-DIALOGS | @create / create | OP-P15-EXCLUDED |
| OP-WIRING-DIALOGS | @decide / decide | OP-DECISION-SUBMIT |
| OP-WIRING-DIALOGS | @import-browser / importFromErpBrowser | OP-P15-EXCLUDED |
| OP-WIRING-DIALOGS | @import-file / importErpFile | OP-P15-EXCLUDED |
| OP-WIRING-DIALOGS | @create / create | OP-P15-EXCLUDED |
| OP-WIRING-DIALOGS | @decide / decide | OP-DECISION-SUBMIT |
| OP-WIRING-DIALOGS | @import-browser / importFromErpBrowser | OP-P15-EXCLUDED |
| OP-WIRING-DIALOGS | @import-file / importErpFile | OP-P15-EXCLUDED |
| OP-WIRING-REASON | @submit / submitAiReviewReason | OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected |
| OP-WIRING-REASON | @cancel / cancelAiReviewReason | OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected |
| OP-WIRING-REASON | @submit / submitAiReviewReason | OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected |
| OP-WIRING-REASON | @cancel / cancelAiReviewReason | OP-AI-REVIEW.approved、OP-AI-REVIEW.rejected |
| OP-WIRING-DECISION-CONTAINER | 容器定义，无额外事件 | OP-DECISION-OPEN.adopt、OP-DECISION-OPEN.observe、OP-DECISION-OPEN.reject、OP-DECISION-CLOSE、OP-DECISION-SUBMIT |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OpportunityCostReviewQueue.vue / review.reason | 成本复核原因：required、2–1000；提交trim，打开清空；不是模态 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.period_start | 复盘周期开始，required date | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.period_end | 复盘周期结束，required date；源表单不交叉验证先后 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.sales_units | 实际销量，number/min0/required；服务端整数边界独立 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.revenue_amount | 实际销售额，number/min0/step0.000001/required | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.ad_spend_amount | 广告花费，number/min0/step0.000001/required | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.returned_units | 退货量，number/min0/required；服务端与销量关系独立 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.purchase_lead_time_days | 采购交期，number/min0/max3650/required | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.actual_profit_amount | 实际利润，number/step0.000001/required，允许负值 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.currency | 复盘币种trim，required/maxlength3/pattern三字母，提交upper | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.source_ref | 事实来源trim，required/maxlength255，成功清空 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityFeedbackPanel.vue / form.notes | 复盘说明trim，可选/maxlength1000，成功清空 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.platform | 成本平台，required/maxlength80，重算也用此值 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.input_type | sale_price/purchase_price/logistics | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.amount_value | 金额number/min0/step0.000001/required，POST Number；后端售价零限制不同 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.currency | 币种required/maxlength3，父发送原大小写 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.source_type | 来源类型required/maxlength80 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.source_ref_id | 来源标识required/maxlength255 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.evidence_id | 证据ID required/maxlength36，归属/UUID服务端校验 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.observed_at | 观测时间required datetime-local，默认UTC截断再按本地解析，存在偏移风险 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityProfitPanel.vue / costForm.reviewer_id | 指定另一复核人required；选项失败静默空，不等于无人 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / showErpImport | P15 ERP显隐model转发，不是用户文本字段 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / showCreate | P15创建显隐model转发，不是新输入字段 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / showDecision | P18决定显隐model转发，不是原因副本 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / erpImportLimit | P15导入数量model；子组件number/min1/max500/required，父转发不重复计字段 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / decisionReason | P18原因：子textarea required/maxlength1000；父model转发同一值，服务端trim | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / batchAssigneeId | P15指派负责人，assign时required，其他操作发null | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspace.vue / batchReason | P15批量原因required/maxlength1000，父trim | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / erpImportLimit | P15导入数量model；子组件number/min1/max500/required，父转发不重复计字段 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / form.name | P15创建名称required/maxlength200 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / form.market | P15创建市场required/maxlength40 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / form.category | P15创建分类可选/maxlength80 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / form.source_topic_id | P15来源主题可选/maxlength36 | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |
| OpportunityWorkspaceDialogs.vue / decisionReason | P18原因：子textarea required/maxlength1000；父model转发同一值，服务端trim | 仅核对绑定/现行约束，不证明全部输入组合、读屏、错误关联和真实后端；父model与用户字段不重复计数。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OpportunityAiPanel.vue / aside.1 / ai-disclaimer | inline-aside / related-scene-only | [ai · 1440](design/review-direction-c/1440-ai.png) / [ai · 390](design/review-direction-c/390-ai.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityCostReviewQueue.vue / form.1 / approved | form-container / matching-inline-form-scene | [approved-edited · 1440](design/profit-direction-c/1440-approved-edited.png) / [approved-edited · 390](design/profit-direction-c/390-approved-edited.png) | 源资格变化与旧review.id未清，不能依赖展示或单元验证替代服务端复核。 |
| OpportunityCostReviewQueue.vue / form.1 / rejected | form-container / matching-inline-form-scene | [rejected-edited · 1440](design/profit-direction-c/1440-rejected-edited.png) / [rejected-edited · 390](design/profit-direction-c/390-rejected-edited.png) | 源资格变化与旧review.id未清，不能依赖展示或单元验证替代服务端复核。 |
| OpportunityDetailInsights.vue / aside.1 / score-missing | inline-aside / related-scene-only | [score-missing · 1440](design/insights-direction-c/1440-score-missing.png) / [score-missing · 390](design/insights-direction-c/390-score-missing.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityFeedbackPanel.vue / form.1 / operating-feedback | form-container / matching-inline-form-scene | [form-filled · 1440](design/review-direction-c/1440-form-filled.png) / [form-filled · 390](design/review-direction-c/390-form-filled.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityFeedbackPanel.vue / aside.1 / feedback-readonly | inline-aside / related-scene-only | [feedback-readonly · 1440](design/review-direction-c/1440-feedback-readonly.png) / [feedback-readonly · 390](design/review-direction-c/390-feedback-readonly.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityProfitPanel.vue / aside.1 / profit-missing | inline-aside / related-scene-only | [missing · 1440](design/profit-direction-c/1440-missing.png) / [missing · 390](design/profit-direction-c/390-missing.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityProfitPanel.vue / aside.1 / no-run | inline-aside / related-scene-only | [no-run · 1440](design/profit-direction-c/1440-no-run.png) / [no-run · 390](design/profit-direction-c/390-no-run.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityProfitPanel.vue / form.1 / sale | form-container / matching-inline-form-scene | [sale · 1440](design/profit-direction-c/1440-sale.png) / [sale · 390](design/profit-direction-c/390-sale.png) | 三类型原型分开；该机会701无完整成本权限/有数据链，时区/资格/实际POST未验。 |
| OpportunityProfitPanel.vue / form.1 / purchase | form-container / matching-inline-form-scene | [purchase · 1440](design/profit-direction-c/1440-purchase.png) / [purchase · 390](design/profit-direction-c/390-purchase.png) | 三类型原型分开；该机会701无完整成本权限/有数据链，时区/资格/实际POST未验。 |
| OpportunityProfitPanel.vue / form.1 / logistics | form-container / matching-inline-form-scene | [logistics · 1440](design/profit-direction-c/1440-logistics.png) / [logistics · 390](design/profit-direction-c/390-logistics.png) | 三类型原型分开；该机会701无完整成本权限/有数据链，时区/资格/实际POST未验。 |
| OpportunityProfitPanel.vue / aside.2 / cost-readonly | inline-aside / related-scene-only | [readonly · 1440](design/profit-direction-c/1440-readonly.png) / [readonly · 390](design/profit-direction-c/390-readonly.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / adopt | business-dialog-container / related-scene-only | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / observe | business-dialog-container / related-scene-only | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / reject | business-dialog-container / related-scene-only | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / P15-create | business-dialog-container / route-excluded-reference | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 创建入口来自列表；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / P15-ERP | business-dialog-container / route-excluded-reference | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | ERP入口来自列表；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / dialog.1 / P15-assign | native-dialog / route-excluded-reference | [assign-open · 1440](design/opportunity-direction-c/1440-assign-open.png) / [assign-open · 390](design/opportunity-direction-c/390-assign-open.png) | showBatch由P15列表批量事件设置；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / dialog.1 / P15-review | native-dialog / route-excluded-reference | [review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png) | showBatch由P15列表批量事件设置；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / dialog.1 / P15-archive | native-dialog / route-excluded-reference | [archive-open · 1440](design/opportunity-direction-c/1440-archive-open.png) / [archive-open · 390](design/opportunity-direction-c/390-archive-open.png) | showBatch由P15列表批量事件设置；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / form.1 / P15-batch-form | form-container / route-excluded-reference | [assign-edited · 1440](design/opportunity-direction-c/1440-assign-edited.png) / [assign-edited · 390](design/opportunity-direction-c/390-assign-edited.png) | 只作为P15批处理消费者登记；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / aside.1 / P15-review-copy | inline-aside / route-excluded-reference | [review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png) | 列表批量复核说明，不是额外模态；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / aside.2 / P15-archive-copy | inline-aside / route-excluded-reference | [archive-open · 1440](design/opportunity-direction-c/1440-archive-open.png) / [archive-open · 390](design/opportunity-direction-c/390-archive-open.png) | 列表批量归档说明，不是额外模态；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspace.vue / AuditedReasonDialog.1 / AI-approved | native-reason-dialog / matching-dialog-scene | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png) | trim≥2；先关闭再写，原型失败保留不代表真实恢复；不是决定原因同一校验合同。 |
| OpportunityWorkspace.vue / AuditedReasonDialog.1 / AI-rejected | native-reason-dialog / matching-dialog-scene | [rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png) | trim≥2；先关闭再写，原型失败保留不代表真实恢复；不是决定原因同一校验合同。 |
| OpportunityWorkspaceDialogs.vue / dialog.1 / P15-ERP | native-dialog / route-excluded-reference | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | 业务入口仅在列表all视图；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / form.1 / P15-ERP-form | form-container / route-excluded-reference | [erp-edited · 1440](design/opportunity-direction-c/1440-erp-edited.png) / [erp-edited · 390](design/opportunity-direction-c/390-erp-edited.png) | 列表导入表单；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / aside.1 / P15-ERP-copy | inline-aside / route-excluded-reference | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | 列表导入说明；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / dialog.2 / P15-create | native-dialog / route-excluded-reference | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 创建入口仅来自列表；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / form.2 / P15-create-form | form-container / route-excluded-reference | [create-edited · 1440](design/opportunity-direction-c/1440-create-edited.png) / [create-edited · 390](design/opportunity-direction-c/390-create-edited.png) | 列表创建表单；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / aside.2 / P15-create-copy | inline-aside / route-excluded-reference | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 列表创建说明；仍须检查跨列表/详情残留，不能按P18模态验收。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / adopt | native-dialog / matching-dialog-scene | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / observe | native-dialog / matching-dialog-scene | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / reject | native-dialog / matching-dialog-scene | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / form.3 / adopt | form-container / matching-inline-form-scene | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / form.3 / observe | form-container / matching-inline-form-scene | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / form.3 / reject | form-container / matching-inline-form-scene | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 三种原因required≤1000；源重复标题ID、忙碌关闭/重复提交与跨ID归属待验。采纳未串入701组合。 |
| OpportunityWorkspaceDialogs.vue / aside.3 / decision-impact | inline-aside / related-scene-only | [observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png) | 相关离线场景不是全部状态/主题/真实Vue验收。 |

### 明确保留的边界

- 701十分区已组合且有主题密度代表图，但无完整采纳质量门/成本输入复核链，不能借其他夹具填当前机会事实。
- 概览竞品/供应目录链接当前无能力v-if；旧合同按能力展示描述与真实源不同，待明确审核，未擅自修权限或路由。
- P18主状态页各文案都走load且次按钮无handler；原型恢复入口与实际消费者必须逐态对齐。
- 观察/驳回、AI抽检和复核打开按钮部分不禁busy；write无单飞早退，ID/watch和晚到响应无归属token，未知异常称未写入不是事务证明。
- 成本初始时间UTC截断/本地解析偏移、reviewer失败置空、复核id残留、AI先关原因再写差异继续保留OP07–OP10。
- 43个路由动作的六態仍需逐一判断/selector绑定；已有代表控件图不自动等于全动作、所有行/主题/权限状态已验。
- 34个本地v-model位置包含5个父model转发和P15字段，不是34个P18独立用户字段；P18局部用户输入22（成本9/复盘11/复核原因1/决定原因1），AI共享原因另计。
- UiStatePanel默认空/无权/过期主标签与P18统一load处理不一致；默认次按钮未监听。该共享源所有控件必须另行纳入全局分母，不只看一个primary候选。
- useModalDialog仅native showModal/close/归还，不证明所有tab/soft keyboard/关闭忙碌；AI共享组件有Tab圈定，但两个业务消费者仍需独立验收。
- P15入口排除不等于跨ID残留不可达；OpportunityWorkspace watch ID未清三个列表show标志及决定动作草稿；不据此更改权限/生命周期规则。

## P54 局部动作与共享消费者

[逐项机器清单](action-reviews/P54.json)：44个局部源位置 → 17组；4类写入，17组路由动作，0组转发/容器关联不重复计动作。7个本地v-model，9处调用/内嵌容器，14个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有21个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| DG54-VIEW 切换近期记录与证据质量 / navigation | 2处；records、quality | [records:default · 1440](design/data-composed-direction-c/1440-records-default.png) / [records:default · 390](design/data-composed-direction-c/390-records-default.png)、[quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png)；其余见JSON | 原质量区卸载；常驻提案改变切区状态策略。初始深链、history、KeepAlive未验证。 |
| DG54-ENTITY 选择四类近期数据 / read | 1处；trends、opportunities、competitors、suppliers | [records:trends · 1440](design/data-composed-direction-c/1440-records-trends.png) / [records:trends · 390](design/data-composed-direction-c/390-records-trends.png)、[records:opportunities · 1440](design/data-composed-direction-c/1440-records-opportunities.png) / [records:opportunities · 390](design/data-composed-direction-c/390-records-opportunities.png)；其余见JSON | 查询草稿保留与状态清空需跨四类逐项验证；旧快照不改变业务范围，导出等待仍可能漂移。 |
| DG54-FILTER 应用或重置近期筛选 / read | 5处；drawer-open、drawer-close、form-submit、enter、apply、reset | [records:filter · 1440](design/data-composed-direction-c/1440-records-filter.png) / [records:filter · 390](design/data-composed-direction-c/390-records-filter.png)、[records:query-draft · 1440](design/data-composed-direction-c/1440-records-query-draft.png) / [records:query-draft · 390](design/data-composed-direction-c/390-records-query-draft.png)；其余见JSON | 原生提交与Enter、抽屉submit.capture顺序、SQL LIKE和供应商字段范围尚非实际链验收。 |
| DG54-EXPORT 受控CSV导出 / write | 4处；open、ask、submit、cancel、download | [records:export · 1440](design/data-composed-direction-c/1440-records-export.png) / [records:export · 390](design/data-composed-direction-c/390-records-export.png)、[records:export-empty · 1440](design/data-composed-direction-c/1440-records-export-empty.png) / [records:export-empty · 390](design/data-composed-direction-c/390-records-export-empty.png)；其余见JSON | 真实客户端原因无最大长度；服务器2–300。请求与文件名使用可变entity；新稿固定条件/未知防重只是提案，未证真实CSV/审计/重复幂等。 |
| DG54-LOAD 读取与状态重试 / read | 1处；first、empty、error、expired、forbidden、blocked、retry、timeout | [records:loading · 1440](design/data-composed-direction-c/1440-records-loading.png) / [records:loading · 390](design/data-composed-direction-c/390-records-loading.png)、[records:empty · 1440](design/data-composed-direction-c/1440-records-empty.png) / [records:empty · 390](design/data-composed-direction-c/390-records-empty.png)；其余见JSON | 15秒abort非完整生命周期代次保护；失败保留仅有旧行时，不把空数据旧状态一概称快照保留。 |
| DG54-TECH 展开记录技术标识 / local | 2处；desktop-row、mobile-detail | [records:detail · 1440](design/data-composed-direction-c/1440-records-detail.png) / [records:detail · 390](design/data-composed-direction-c/390-records-detail.png)、[records:long-detail · 1440](design/data-composed-direction-c/1440-records-long-detail.png) / [records:long-detail · 390](design/data-composed-direction-c/390-records-long-detail.png)；其余见JSON | 这是行ID展开，不是页尾TechnicalDetails复制；所有类型/长ID状态与共享复制消费者另验。 |
| DG54-PAGE 近期记录本地分页 / read | 2处；previous、next、first、last | [records:page-21 · 1440](design/data-composed-direction-c/1440-records-page-21.png) / [records:page-21 · 390](design/data-composed-direction-c/390-records-page-21.png)、[records:page-two · 1440](design/data-composed-direction-c/1440-records-page-two.png) / [records:page-two · 390](design/data-composed-direction-c/390-records-page-two.png)；其余见JSON | 同一原型场景图不证明真实浏览器history/滚动/每种实体分页。 |
| Q54-LOAD 质量状态恢复读取 / read | 1处；loading、empty、error、forbidden、expired、blocked、primary | [quality:loading · 1440](design/data-composed-direction-c/1440-quality-loading.png) / [quality:loading · 390](design/data-composed-direction-c/390-quality-loading.png)、[quality:empty · 1440](design/data-composed-direction-c/1440-quality-empty.png) / [quality:empty · 390](design/data-composed-direction-c/390-quality-empty.png)；其余见JSON | 原ready模板没有独立刷新按钮；稿中刷新/清搜索按钮属于待审新增呈现。实际状态组件primary可达性与权限未验。 |
| Q54-TAB 切换证据问题核对 / read | 3处；evidence、issues、runs | [quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png)、[quality:issues · 1440](design/data-composed-direction-c/1440-quality-issues.png) / [quality:issues · 390](design/data-composed-direction-c/390-quality-issues.png)；其余见JSON | 真实switchTab不清query/selectedRunId；离线稿会清，需审核差异，不当作同语义实现。 |
| Q54-EVIDENCE 读取或关闭完整证据溯源 / read | 5处；evidence-desktop、evidence-mobile、issue-desktop、issue-mobile、close | [quality:lineage · 1440](design/data-composed-direction-c/1440-quality-lineage.png) / [quality:lineage · 390](design/data-composed-direction-c/390-quality-lineage.png)、[quality:lineage-loading · 1440](design/data-composed-direction-c/1440-quality-lineage-loading.png) / [quality:lineage-loading · 390](design/data-composed-direction-c/390-quality-lineage-loading.png)；其余见JSON | 真实结果落aside无代次；稿改为模态并展示quality_issues，不证明真实迟到详情隔离/授权。 |
| Q54-DOWNLOAD 签发并访问原文下载 / write | 2处；desktop、mobile、grant、access | [quality:download-ready · 1440](design/data-composed-direction-c/1440-quality-download-ready.png) / [quality:download-ready · 390](design/data-composed-direction-c/390-quality-download-ready.png)、[quality:download-busy · 1440](design/data-composed-direction-c/1440-quality-download-busy.png) / [quality:download-busy · 390](design/data-composed-direction-c/390-quality-download-busy.png)；其余见JSON | 原入口无确认窗；稿新增说明/签发窗。签发与实际下载错误不能混为同回执，未验证真实字节、SHA、授权或访问审计。 |
| Q54-TECH 展开证据或问题技术标识 / local | 2处；evidence-mobile、issue-mobile | [quality:lineage-technical · 1440](design/data-composed-direction-c/1440-quality-lineage-technical.png) / [quality:lineage-technical · 390](design/data-composed-direction-c/390-quality-lineage-technical.png)、[quality:issue-technical · 1440](design/data-composed-direction-c/1440-quality-issue-technical.png) / [quality:issue-technical · 390](design/data-composed-direction-c/390-quality-issue-technical.png)；其余见JSON | 新完整溯源技术区不是两个原移动详情展开消费者的逐项证据；不能以复制按钮替代summary验收。 |
| Q54-RUN 当前加载问题的核对下钻 / local | 2处；drill、clear、matched、empty | [quality:run-match · 1440](design/data-composed-direction-c/1440-quality-run-match.png) / [quality:run-match · 390](design/data-composed-direction-c/390-quality-run-match.png)、[quality:run-empty · 1440](design/data-composed-direction-c/1440-quality-run-empty.png) / [quality:run-empty · 390](design/data-composed-direction-c/390-quality-run-empty.png)；其余见JSON | 不查全库异常，跨页缺问题不能伪称没有异常；切内部tab后原runId仍保留。 |
| Q54-BATCH 开放问题批处理预检与提交 / write | 3处；attribute、assign、close、preview、cancel、confirm | [quality:batch-attribute · 1440](design/data-composed-direction-c/1440-quality-batch-attribute.png) / [quality:batch-attribute · 390](design/data-composed-direction-c/390-quality-batch-attribute.png)、[quality:batch-assign · 1440](design/data-composed-direction-c/1440-quality-batch-assign.png) / [quality:batch-assign · 390](design/data-composed-direction-c/390-quality-batch-assign.png)；其余见JSON | 源预检没校验50上限；提交读可变选择/动作/成员/原因，无冻结快照。原ConfirmDialog不接busy；整批SQL/版本/幂等和原型锁定不可混同。 |
| Q54-SELECT 切换开放问题选择 / local | 1处；select、deselect、disabled-closed、hidden-selected | [quality:issues · 1440](design/data-composed-direction-c/1440-quality-issues.png) / [quality:issues · 390](design/data-composed-direction-c/390-quality-issues.png)、[quality:selection-hidden · 1440](design/data-composed-direction-c/1440-quality-selection-hidden.png) / [quality:selection-hidden · 390](design/data-composed-direction-c/390-quality-selection-hidden.png)；其余见JSON | 真实手机无checkbox；原型新增手机选择/清选择。checkbox在源可重复push，同组ID与批量后端去重不是一回事。 |
| Q54-RESOLVE 单问题原因与解决确认 / write | 6处；desktop-open、mobile-open、aside-close、preview、cancel、confirm | [quality:resolve-empty · 1440](design/data-composed-direction-c/1440-quality-resolve-empty.png) / [quality:resolve-empty · 390](design/data-composed-direction-c/390-quality-resolve-empty.png)、[quality:resolve-short · 1440](design/data-composed-direction-c/1440-quality-resolve-short.png) / [quality:resolve-short · 390](design/data-composed-direction-c/390-quality-resolve-short.png)；其余见JSON | 写成功后load吞错再覆盖notice；原confirm短语trim比较，稿用严格全等。取消返回/重复提交/闭窗归属与真实审计仍待验。 |
| Q54-PAGE 证据与问题共享服务端页码 / read | 2处；previous、next、first、last、waiting、failed | [quality:page-first · 1440](design/data-composed-direction-c/1440-quality-page-first.png) / [quality:page-first · 390](design/data-composed-direction-c/390-quality-page-first.png)、[quality:page-last · 1440](design/data-composed-direction-c/1440-quality-page-last.png) / [quality:page-last · 390](design/data-composed-direction-c/390-quality-page-last.png)；其余见JSON | 原翻页失败保留数据但page已变；提案保留已成功页，不能当作源实现已修复。 本补稿busy截图如实保留原型按钮可用与handler防重；源refreshing禁用不同，尚未统一。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformDataCenter.vue / queryDraft | 近期查询草稿；apply时trim后才成为query | 120字符边界/Enter/提交与SQL LIKE、供应商字段差异需真实链验证。 |
| PlatformDataCenter.vue / statusDraft | 随entity状态集选择；apply提交，类型切换清空 | 四类型13状态组合与失败旧快照要分开，不按新类型解释旧行。 |
| DataQualityCenter.vue / query | 质量当前已加载集合本地检索，不trim，不提交GET | 原内部切tab不清query；原型会清，存在行为差异。 |
| DataQualityCenter.vue / batchAction | attribute/assign/close；不同动作决定成员字段适用性 | 预览后改变动作可漂移；源未冻结，三个操作不以一个确认图全验。 |
| DataQualityCenter.vue / batchAssignee | 仅assign显示，候选来自所选问题组织活动成员 | 原预览到提交仍可变，不能编造实际组织成员。 |
| DataQualityCenter.vue / batchReason | 批量原因，maxlength500，预检trim>=2 | 原型模态改版，0/1/2/500/超限和长内容/软键盘仍需完整状态映射。 |
| DataQualityCenter.vue / reason | 单问题原因，maxlength500；每次beginResolve清空 | 字段与共享AuditedReasonDialog同名但范围不同，不能混用2–300限制。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformDataCenter.vue / ResponsiveFilterDrawer.1 / records-filter | responsive-filter / matching-dialog-scene | [records:filter · 1440](design/data-composed-direction-c/1440-records-filter.png) / [records:filter · 390](design/data-composed-direction-c/390-records-filter.png) | 原生submit/Enter关闭与返焦、所有错误/主题需每消费者验证。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / trends | responsive-row-detail / matching-dialog-scene | [records:detail · 1440](design/data-composed-direction-c/1440-records-detail.png) / [records:detail · 390](design/data-composed-direction-c/390-records-detail.png) | 仅原始热点示例详情，不代表所有状态行。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / opportunities | responsive-row-detail / matching-dialog-scene | [opportunities:detail · 1440](design/data-record-detail-direction-c/1440-opportunities-detail.png) / [opportunities:detail · 390](design/data-record-detail-direction-c/390-opportunities-detail.png)、[opportunities-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-opportunities-long-technical-footer.png) / [opportunities-long:technical-footer · 390](design/data-record-detail-direction-c/390-opportunities-long-technical-footer.png) | 合成源投影样例六组字段/标题/技术ID及双端长内容已验；不是全部状态行/主题/真实Vue。桌面详情入口为新提案。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / competitors | responsive-row-detail / matching-dialog-scene | [competitors:detail · 1440](design/data-record-detail-direction-c/1440-competitors-detail.png) / [competitors:detail · 390](design/data-record-detail-direction-c/390-competitors-detail.png)、[competitors-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-competitors-long-technical-footer.png) / [competitors-long:technical-footer · 390](design/data-record-detail-direction-c/390-competitors-long-technical-footer.png) | 合成源投影样例版本/变更语义及六组字段/技术ID、双端长内容已验；全部状态/主题/真实Vue仍待验。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / suppliers | responsive-row-detail / matching-dialog-scene | [suppliers-original:detail · 1440](design/data-record-detail-direction-c/1440-suppliers-original-detail.png) / [suppliers-original:detail · 390](design/data-record-detail-direction-c/390-suppliers-original-detail.png)、[suppliers:detail · 1440](design/data-record-detail-direction-c/1440-suppliers-detail.png) / [suppliers:detail · 390](design/data-record-detail-direction-c/390-suppliers-detail.png)、[suppliers-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-suppliers-long-technical-footer.png) / [suppliers-long:technical-footer · 390](design/data-record-detail-direction-c/390-suppliers-long-technical-footer.png) | 原始隔离与合成供应商/地点、最小起订量/报价详情已分开核对，不引入币种/单位或新的零测量；全部行/主题/真实Vue仍待验。 |
| PlatformDataCenter.vue / AuditedReasonDialog.1 / export-reason | native-reason-dialog / matching-dialog-scene | [records:export · 1440](design/data-composed-direction-c/1440-records-export.png) / [records:export · 390](design/data-composed-direction-c/390-records-export.png) | 原型是新固定范围表单，真实源请求/文件名竞态未修。 |
| DataQualityCenter.vue / ResponsiveDataView.1 / evidence-row | responsive-row-detail / matching-dialog-scene | [quality:evidence-detail · 1440](design/data-composed-direction-c/1440-quality-evidence-detail.png) / [quality:evidence-detail · 390](design/data-composed-direction-c/390-quality-evidence-detail.png) | 完整记录稿已存在；真实shared.show/close及完整溯源交接待Vue验收。 |
| DataQualityCenter.vue / ResponsiveDataView.2 / issue-row | responsive-row-detail / matching-dialog-scene | [quality:issue-detail · 1440](design/data-composed-direction-c/1440-quality-issue-detail.png) / [quality:issue-detail · 390](design/data-composed-direction-c/390-quality-issue-detail.png) | 新稿移动选择为新增，原组件及所有已解决/缺证据组合仍待验。 |
| DataQualityCenter.vue / aside.1 / evidence-lineage | inline-aside / proposal-shape-differs | [quality:lineage · 1440](design/data-composed-direction-c/1440-quality-lineage.png) / [quality:lineage · 390](design/data-composed-direction-c/390-quality-lineage.png) | 提案改为模态且展示关联问题；原aside无代次/初焦点，不能等价接受。 |
| DataQualityCenter.vue / aside.2 / single-reason | inline-aside / proposal-shape-differs | [quality:resolve-valid · 1440](design/data-composed-direction-c/1440-quality-resolve-valid.png) / [quality:resolve-valid · 390](design/data-composed-direction-c/390-quality-resolve-valid.png) | 提案改为独立原因模态；源aside关闭、原因保留规则与并发需确认。 |
| DataQualityCenter.vue / ConfirmDialog.1 / single-confirm | confirmation-dialog / matching-dialog-scene | [quality:resolve-confirm · 1440](design/data-composed-direction-c/1440-quality-resolve-confirm.png) / [quality:resolve-confirm · 390](design/data-composed-direction-c/390-quality-resolve-confirm.png) | 源canConfirm会trim，原型严格等于；原组件取消/重复确认与源POST待验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / attribute-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-confirm.png) / [quality:batch-confirm · 390](design/data-composed-direction-c/390-quality-batch-confirm.png) | 源使用可变选择/原因；后端全有或全无需真实SQL证据。 |
| DataQualityCenter.vue / ConfirmDialog.2 / assign-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-assign-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-assign-confirm.png) / [quality:batch-assign-confirm · 390](design/data-composed-direction-c/390-quality-batch-assign-confirm.png) | 成员为合成示例；真实组织/活动状态/版本并发未验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / close-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-close-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-close-confirm.png) / [quality:batch-close-confirm · 390](design/data-composed-direction-c/390-quality-batch-close-confirm.png) | 只变问题不删原文；原POST/审计/短语trim与并发未验。 |

### 明确保留的边界

- 同页常驻组合已交294PNG；实际质量v-if卸载、浏览器history/深链、scope/晚到响应未合并真实Vue。
- 40个明确控件变体已有364张双端原生状态图；17组主控件81个槽有selector/scene关联，21个槽仍未映射。主控件证据不是全动态行、全部共享消费者或真实Vue验收。
- 三类实体详情已补打开/完整字段/双端长内容证据，全部状态行及逐按钮主题仍未穷尽；Q54源tab保留query/runId与原型清空、短语trim与原型严格全等的差异须具体审核。
- 原质量无ready刷新/清搜索/清选择、无手机checkbox；原型额外入口仍是待审行为，不新增现行源合同ID。
- PlatformShell及UiStatePanel内部控件、表格列显隐/冻结/密度、TechnicalDetails复制必须按调用方再映射；不在44个局部源位置内。
- ConfirmDialog共享typedText适用，acknowledged因本页destructive=false不显示；AuditedReasonDialog内部reason与质量reason分域；TableViewControls密度字段未冒充本页7个v-model。
- ResponsiveDataView的三个调用/六种内容变体不能拿一个shared测试全验；同类动态行、空字段与主题密度交叉场景还未穷尽。
