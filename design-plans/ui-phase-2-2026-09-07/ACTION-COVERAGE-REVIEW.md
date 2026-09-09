# 全站动作与弹窗覆盖对账

基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。

- 当前源候选1478；旧登记1477；新身份17，旧表独有身份16。签名变化不等于增删业务能力。
- 已具体语义对应22页/479源位置/426组；其中路由动作362组，转发/容器关联42组，其余明确排除。其余51页未完成此级映射，不称没有图或没有测试。
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
| [P13 今日工作](page-specs/P13.md) | 111 | [36组](action-reviews/P13.json) | 174个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P14 热点趋势](page-specs/P14.md) | 107 | [51组](action-reviews/P14.json) | 252个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P15 选品机会](page-specs/P15.md) | 158 | [35组](action-reviews/P15.json) | 162个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P16 创建选品](page-specs/P16.md) | 45 | [8组](action-reviews/P16.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P17 评分规则](page-specs/P17.md) | 64 | [19组](action-reviews/P17.json) | 96个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P18 机会详情](page-specs/P18.md) | 158 | [52组](action-reviews/P18.json) | 258个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P19 竞品监控](page-specs/P19.md) | 75 | [22组](action-reviews/P19.json) | 20个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P20 竞品监控规则](page-specs/P20.md) | 75 | [12组](action-reviews/P20.json) | 8个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P21 供应链与利润](page-specs/P21.md) | 90 | [38组](action-reviews/P21.json) | 20个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
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

## P13 局部动作与共享消费者

[逐项机器清单](action-reviews/P13.json)：48个局部源位置 → 36组；3类写入，29组路由动作，5组转发/容器关联不重复计动作。6个本地v-model，7处调用/内嵌容器，15个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有174个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| task.list.create.open 新建入口 / local | 2处；header、empty、create_only、quick-create | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[empty · 1440](design/work-direction-c/1440-empty.png) / [empty · 390](design/work-direction-c/390-empty.png)；其余见JSON | 仅P13新建；P24编辑不属于当前入口。快捷创建仅mounted读取window.search，缓存重入行为仍待验。 |
| work.excluded.exports 排除任务中心专属导出分支 / excluded | 4处；business-tab、exports-tab、export-manage、export-open | ；其余见JSON | 不以P23导出图抵扣P13；若父传参改变须重新核对可达性。 |
| task.read.retry 重读当前本人队列 / read | 1处；error、forbidden、expired、rate_limited | [loading · 1440](design/work-direction-c/1440-loading.png) / [loading · 390](design/work-direction-c/390-loading.png)、[error · 1440](design/work-direction-c/1440-error.png) / [error · 390](design/work-direction-c/390-error.png)；其余见JSON | 旧缓存与迟到GET归属已有源码保护，不在此轮宣称真实Vue复验；重读按钮不是登录或权限恢复。 |
| task.list.page.previous 上一页 / local | 1处；first-disabled、later-page、loading-old-total | [pagination · 1440](design/work-direction-c/1440-pagination.png) / [pagination · 390](design/work-direction-c/390-pagination.png)；其余见JSON | 失败/loading时旧total仍可能显示分页；全分页与中途写入组合未验。 |
| task.list.page.next 下一页 / local | 1处；next、last-disabled | [pagination · 1440](design/work-direction-c/1440-pagination.png) / [pagination · 390](design/work-direction-c/390-pagination.png)；其余见JSON | 只选择本页不是跨页全选；全动态页码未穷尽。 |
| task.editor.close 关闭新建表单 / local | 2处；cancel、escape、busy-escape、reopen-draft | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[create_busy · 1440](design/work-direction-c/1440-create_busy.png) / [create_busy · 390](design/work-direction-c/390-create_busy.png)；其余见JSON | 按钮禁用不等于Escape锁定；发出POST后关闭不会撤销请求，源后续成功仍清表单。 |
| task.editor.create.submit 提交新建 / write | 2处；create、due-set、due-empty、busy、failure | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[create_busy · 1440](design/work-direction-c/1440-create_busy.png) / [create_busy · 390](design/work-direction-c/390-create_busy.png)；其余见JSON | 不将原型窗内错误/字段锁定当作源实现；源notice在窗外，表单字段无busy disabled。相同函数PATCH只归P24。 |
| work.excluded.detail 排除任务详情事件中转 / excluded | 1处；detail-actions、edit、comment、action-fields | ；其余见JSON | 不是删除组件；仅按当前实际入口排除P13。P24及异常组合另验。 |
| task.delete.close 关闭删除表单 / local | 2处；cancel、escape、reopen-cleared | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png)；其余见JSON | 执行中Escape可清deleting；removeTask在await后仍读取deleting.value.id，完整竞态待验。 |
| task.delete.submit 提交删除 / write | 2处；valid、blank、failure、busy | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png)；其余见JSON | 本页不走详情returnPath；已发删除不因关闭取消，真实审计和版本冲突待验。 |
| task.list.status 切换六种任务状态 / local | 1处；all、todo、in_progress、paused、completed、cancelled | [normal · 1440](design/work-direction-c/1440-normal.png) / [normal · 390](design/work-direction-c/390-normal.png)、[paused · 1440](design/work-direction-c/1440-paused.png) / [paused · 390](design/work-direction-c/390-paused.png)；其余见JSON | all不加overdue避免重复；summary总7与列表2是独立夹具，不是完整数据库快照。 |
| task.list.search.disclose 展开搜索排序 / local | 1处；closed、open、advanced-applied | [normal · 1440](design/work-direction-c/1440-normal.png) / [normal · 390](design/work-direction-c/390-normal.png)、[search · 1440](design/work-direction-c/1440-search.png) / [search · 390](design/work-direction-c/390-search.png)；其余见JSON | 当前details/移动布局与C稿不完全同形；焦点、缓存草稿和主题待验。 |
| task.list.search.apply 应用搜索 / local | 2处；button、enter、trimmed、empty、no-results | [search · 1440](design/work-direction-c/1440-search.png) / [search · 390](design/work-direction-c/390-search.png)、[sorted · 1440](design/work-direction-c/1440-sorted.png) / [sorted · 390](design/work-direction-c/390-sorted.png)；其余见JSON | 搜索是服务端过滤；原型只过滤离线样例，不代表全库查询。 |
| task.list.sort 切换排序并应用搜索草稿 / local | 1处；priority_due、due_asc、updated_desc、created_desc | [search · 1440](design/work-direction-c/1440-search.png) / [search · 390](design/work-direction-c/390-search.png)、[sorted · 1440](design/work-direction-c/1440-sorted.png) / [sorted · 390](design/work-direction-c/390-sorted.png)；其余见JSON | 不能改成只排序不应用草稿；URL白名单解析/服务端分页排序保持。 |
| task.list.reset 重置筛选 / local | 2处；search-reset、empty-reset、default-sort | [search · 1440](design/work-direction-c/1440-search.png) / [search · 390](design/work-direction-c/390-search.png)、[no_results · 1440](design/work-direction-c/1440-no_results.png) / [no_results · 390](design/work-direction-c/390-no_results.png)；其余见JSON | 只有非默认sort的空列表仍显示新建而非空态重置；不得按文案猜所有筛选判定相同。 |
| task.list.select.page 选择或清空本页 / local | 1处；select-page、clear-page、mixed、readonly-hidden | [selection · 1440](design/work-direction-c/1440-selection.png) / [selection · 390](design/work-direction-c/390-selection.png)、[readonly · 1440](design/work-direction-c/1440-readonly.png) / [readonly · 390](design/work-direction-c/390-readonly.png)；其余见JSON | 不新增跨页全选；输入事件不是额外API。 |
| task.list.select.clear 清除选择 / local | 1处；clear、none-hidden | [selection · 1440](design/work-direction-c/1440-selection.png) / [selection · 390](design/work-direction-c/390-selection.png)；其余见JSON | 确认批量未结束时选择变化的交互组合仍待运行验收。 |
| task.list.select.row 选择单行 / local | 1处；select、deselect、readonly-hidden | [selection · 1440](design/work-direction-c/1440-selection.png) / [selection · 390](design/work-direction-c/390-selection.png)、[no_assign · 1440](design/work-direction-c/1440-no_assign.png) / [no_assign · 390](design/work-direction-c/390-no_assign.png)；其余见JSON | 当前toggle不自行去重；不以合成图证明所有行焦点/热区。 |
| task.list.detail.open 进入独立任务详情 / navigation | 1处；first、other、long-title、filtered-return | [normal · 1440](design/work-direction-c/1440-normal.png) / [normal · 390](design/work-direction-c/390-normal.png)、[long · 1440](design/work-direction-c/1440-long.png) / [long · 390](design/work-direction-c/390-long.png)；其余见JSON | 只对应离线目标意图；真实详情/返回/关联采集授权归P24完整链。 |
| task.list.row-menu 展开单行操作 / local | 1处；closed、open、terminal、readonly-hidden | [normal · 1440](design/work-direction-c/1440-normal.png) / [normal · 390](design/work-direction-c/390-normal.png)、[completed · 1440](design/work-direction-c/1440-completed.png) / [completed · 390](design/work-direction-c/390-completed.png)；其余见JSON | 原型直接删除入口与源details收纳差异待审；所有状态行菜单图未齐。 |
| task.delete.open 打开单行删除 / local | 1处；active、completed、cancelled、reopen | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png)、[completed · 1440](design/work-direction-c/1440-completed.png) / [completed · 390](design/work-direction-c/390-completed.png)；其余见JSON | 不与详情删除入口重复计数；来源目标及中途重开待验。 |
| task.batch.pause.open 批量暂停 / local | 1处；pause、eligible、ineligible、busy-reopen | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png)、[no_eligible · 1440](design/work-direction-c/1440-no_eligible.png) / [no_eligible · 390](design/work-direction-c/390-no_eligible.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.resume.open 批量继续 / local | 1处；resume、eligible、ineligible、busy-reopen | [resume · 1440](design/work-direction-c/1440-resume.png) / [resume · 390](design/work-direction-c/390-resume.png)、[no_eligible · 1440](design/work-direction-c/1440-no_eligible.png) / [no_eligible · 390](design/work-direction-c/390-no_eligible.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.delay.open 批量延期 / local | 1处；delay、eligible、ineligible、busy-reopen | [delay · 1440](design/work-direction-c/1440-delay.png) / [delay · 390](design/work-direction-c/390-delay.png)、[no_eligible · 1440](design/work-direction-c/1440-no_eligible.png) / [no_eligible · 390](design/work-direction-c/390-no_eligible.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.transfer.open 批量调整负责人 / local | 1处；transfer、eligible、ineligible、busy-reopen | [transfer · 1440](design/work-direction-c/1440-transfer.png) / [transfer · 390](design/work-direction-c/390-transfer.png)、[no_eligible · 1440](design/work-direction-c/1440-no_eligible.png) / [no_eligible · 390](design/work-direction-c/390-no_eligible.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.cancel.open 批量取消 / local | 1处；cancel、eligible、ineligible、busy-reopen | [cancel · 1440](design/work-direction-c/1440-cancel.png) / [cancel · 390](design/work-direction-c/390-cancel.png)、[no_eligible · 1440](design/work-direction-c/1440-no_eligible.png) / [no_eligible · 390](design/work-direction-c/390-no_eligible.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.close 关闭批量确认 / local | 2处；return、escape、busy-close、reopen | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png)、[batch_error · 1440](design/work-direction-c/1440-batch_error.png) / [batch_error · 390](design/work-direction-c/390-batch_error.png)；其余见JSON | 关闭不会取消已发请求。新稿字段/忙碌锁为提案，不能称源已修。 |
| task.batch.submit 逐任务提交批量动作 / write | 2处；pause、resume、delay、transfer、cancel、partial-failure、no-eligible、in-flight-mutation | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png)、[resume · 1440](design/work-direction-c/1440-resume.png) / [resume · 390](design/work-direction-c/390-resume.png)；其余见JSON | 本轮隔离实测等待首项时修改action/原因，第二项请求随之改变；busy=true再次调用也发请求。非真实DOM双击/服务端重复写证明。 |
| task.batch.reason.change 修改批量原因 / local | 1处；pause、delay、transfer、cancel、blank、busy-input | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png)、[delay · 1440](design/work-direction-c/1440-delay.png) / [delay · 390](design/work-direction-c/390-delay.png)；其余见JSON | 原型锁字段不能替代真实输入保护；执行中原因变化可进入下一请求。 |
| task.batch.delay.due.change 修改批量期限 / local | 1处；valid、empty、busy-input | [delay · 1440](design/work-direction-c/1440-delay.png) / [delay · 390](design/work-direction-c/390-delay.png)；其余见JSON | 时区/无效输入由原生及服务端分别验证；不杜撰最早日期限制。 |
| task.batch.transfer.assignee.change 选择批量负责人 / local | 1处；selected、empty、directory-failed | [transfer · 1440](design/work-direction-c/1440-transfer.png) / [transfer · 390](design/work-direction-c/390-transfer.png)、[transfer_error · 1440](design/work-direction-c/1440-transfer_error.png) / [transfer_error · 390](design/work-direction-c/390-transfer_error.png)；其余见JSON | 不新增成员或把无目录当真实无人；活动工作区成员资格仍由后端判定。 |
| work.batch.forward 父子事件转发 / wiring | 1处；@start、@close、@confirm、@update:reason、@update:due-at、@update:assignee-id | ；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| work.list.forward 父子事件转发 / wiring | 1处；@update:selected-ids、@status、@apply-filters、@reset-filters、@create、@remove | ；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| work.editor.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | ；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| work.delete.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | ；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| work.batch.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | ；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| work.batch.forward | @start / previewBatch | task.batch.pause.open、task.batch.resume.open、task.batch.delay.open、task.batch.transfer.open、task.batch.cancel.open |
| work.batch.forward | @close / showBatchImpact = false | task.batch.close |
| work.batch.forward | @confirm / confirmBatch | task.batch.submit |
| work.batch.forward | @update:reason / batchReason = $event | task.batch.reason.change |
| work.batch.forward | @update:due-at / batchDueAt = $event | task.batch.delay.due.change |
| work.batch.forward | @update:assignee-id / batchAssigneeId = $event | task.batch.transfer.assignee.change |
| work.list.forward | @update:selected-ids / selectedIds = $event | task.list.select.page、task.list.select.row、task.list.select.clear |
| work.list.forward | @status / setStatus | task.list.status |
| work.list.forward | @apply-filters / applyFilters | task.list.search.apply、task.list.sort |
| work.list.forward | @reset-filters / resetFilters | task.list.reset |
| work.list.forward | @create / showCreate = true | task.list.create.open |
| work.list.forward | @remove / askRemove | task.delete.open |
| work.editor.definition | 容器定义，无额外事件 | task.list.create.open、task.editor.close、task.editor.create.submit |
| work.delete.definition | 容器定义，无额外事件 | task.delete.open、task.delete.close、task.delete.submit |
| work.batch.definition | 容器定义，无额外事件 | task.batch.close、task.batch.submit、task.batch.pause.open、task.batch.resume.open、task.batch.delay.open、task.batch.transfer.open、task.batch.cancel.open |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| TaskWorkspace.vue / form.title | 新建标题：required，maxlength200；HTML非空不等于trim后有效。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |
| TaskWorkspace.vue / form.description | 可选说明，maxlength5000。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |
| TaskWorkspace.vue / form.priority | low/normal/high/critical四选一；不新增默认优先级算法。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |
| TaskWorkspace.vue / form.due_at | 可选本地日期时间；空为null，有值转ISO；不增加默认期限。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |
| TaskWorkspace.vue / deleteReason | 删除原因，required/maxlength500，提交trim。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |
| TaskListPanel.vue / draftQuery | 本地搜索草稿，maxlength200，props.query变化同步；提交trim。 | 六个v-model以外的排序、checkbox和批量三输入通过事件控制，均在动作清单单列；不声称全部字段校验或实际Vue通过。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| TaskWorkspace.vue / dialog.1 / create | native-dialog / matching-dialog-scene | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png) | 取消保留form而清快捷创建三query；源失败notice窗外，输入未busy锁定；P24编辑变体不计本页。 |
| TaskWorkspace.vue / form.1 / create | form-container / matching-dialog-scene | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png) | 同一弹窗内表单引用，不能重复计业务弹窗。取消保留form而清快捷创建三query；源失败notice窗外，输入未busy锁定；P24编辑变体不计本页。 |
| TaskWorkspace.vue / dialog.2 / delete | native-dialog / matching-dialog-scene | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png) | 目标、版本和原因必须对应同一操作；等待中Escape清deleting与await后读取的竞态待Vue复验。 |
| TaskWorkspace.vue / form.2 / delete | form-container / matching-dialog-scene | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png) | 同一弹窗内表单引用，不能重复计业务弹窗。目标、版本和原因必须对应同一操作；等待中Escape清deleting与await后读取的竞态待Vue复验。 |
| TaskListPanel.vue / form.1 / search | form-container / matching-inline-form-scene | [search · 1440](design/work-direction-c/1440-search.png) / [search · 390](design/work-direction-c/390-search.png) | 应用与排序都提交当前trim草稿，展开/收起不等于应用；全断点/键盘待验。 |
| TaskBatchActions.vue / dialog.1 / pause | native-dialog / matching-dialog-scene | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / resume | native-dialog / matching-dialog-scene | [resume · 1440](design/work-direction-c/1440-resume.png) / [resume · 390](design/work-direction-c/390-resume.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / delay | native-dialog / matching-dialog-scene | [delay · 1440](design/work-direction-c/1440-delay.png) / [delay · 390](design/work-direction-c/390-delay.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / transfer | native-dialog / matching-dialog-scene | [transfer · 1440](design/work-direction-c/1440-transfer.png) / [transfer · 390](design/work-direction-c/390-transfer.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / cancel | native-dialog / matching-dialog-scene | [cancel · 1440](design/work-direction-c/1440-cancel.png) / [cancel · 390](design/work-direction-c/390-cancel.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / pause | form-container / matching-dialog-scene | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / resume | form-container / matching-dialog-scene | [resume · 1440](design/work-direction-c/1440-resume.png) / [resume · 390](design/work-direction-c/390-resume.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / delay | form-container / matching-dialog-scene | [delay · 1440](design/work-direction-c/1440-delay.png) / [delay · 390](design/work-direction-c/390-delay.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / transfer | form-container / matching-dialog-scene | [transfer · 1440](design/work-direction-c/1440-transfer.png) / [transfer · 390](design/work-direction-c/390-transfer.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / cancel | form-container / matching-dialog-scene | [cancel · 1440](design/work-direction-c/1440-cancel.png) / [cancel · 390](design/work-direction-c/390-cancel.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |

### 明确保留的边界

- WORK-C-r1保留66PNG/33双端场景，其中2图是非业务审稿控件板；七弹窗有常态，失败/处理中只部分独立图，全部结果和主题/密度仍待补。
- 当前29个非转发/排除组的174视觉槽均未按action selector映射；scene存在不等于按钮六态/所有动态行/真实Vue验收。
- 本轮实际confirmBatch函数在惰性VM确认：首项pause等待中改action=cancel及原因，第二项发送cancel/新原因；busy=true再次调用仍生成请求。非DOM物理双击或服务端重复写证明；修复需明确冻结执行快照、锁定及结果恢复设计，未迁入源码。
- 源读取生命周期已有active/route/read key/AbortController保护；不得把写入竞态误报为所有GET无隔离。真实跨scope与离开后写入结果归属仍待验。
- NavigationShell本地动作/角色菜单、全局搜索/创建等共享消费者不在48局部候选中；父/work task-workspace传mode=today，scope缓存隔离与真实权限仍分别验收。
- useModalDialog只根据isOpen调用showModal/close并尝试归还焦点；所有Escape调用requestClose，不带统一忙碌锁。新稿Tab/遮罩关闭/字段锁定与源差异不可按共享容器全免验。
- 6个v-model、受控排序与选中字段、批量reason/dueAt/assigneeId分别核对；不将3原生dialog+内部form误称7个定义，也不算P24编辑/五单项弹窗。

## P14 局部动作与共享消费者

[逐项机器清单](action-reviews/P14.json)：65个局部源位置 → 51组；8类写入，42组路由动作，9组转发/容器关联不重复计动作。18个本地v-model，10处调用/内嵌容器，15个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有252个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| TR-RULE-OPEN 打开创建监控 / local | 4处；top-first、top-add、rules-header、rules-empty、detail | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png)、[rules-empty · 1440](design/trend-direction-c/1440-rules-empty.png) / [rules-empty · 390](design/trend-direction-c/390-rules-empty.png)；其余见JSON | 八字段不套P12七字段表单；全入口焦点归还/快速重开仍待验。 |
| TR-REFRESH-SOURCES 立即刷新来源 / write | 1处；read-only、busy、started、failed | [refresh-busy · 1440](design/trend-direction-c/1440-refresh-busy.png) / [refresh-busy · 390](design/trend-direction-c/390-refresh-busy.png)、[refresh-started · 1440](design/trend-direction-c/1440-refresh-started.png) / [refresh-started · 390](design/trend-direction-c/390-refresh-started.png)；其余见JSON | 受理不等于采集完成；本轮不启动真实采集。 |
| TR-TAB-RULES 进入监控规则 / local | 2处；top、mode、readonly、legacy-tab | [rules · 1440](design/trend-direction-c/1440-rules.png) / [rules · 390](design/trend-direction-c/390-rules.png)、[rules-readonly · 1440](design/trend-direction-c/1440-rules-readonly.png) / [rules-readonly · 390](design/trend-direction-c/390-rules-readonly.png)；其余见JSON | 保留旧tab=rules优先级；规则列表可能与错误面板同时渲染，C稿隔离是提案。 |
| TR-TAB-TOPICS 进入趋势主题 / local | 1处；normal、legacy-tab | [topics · 1440](design/trend-direction-c/1440-topics.png) / [topics · 390](design/trend-direction-c/390-topics.png)、[detail · 1440](design/trend-direction-c/1440-detail.png) / [detail · 390](design/trend-direction-c/390-detail.png)；其余见JSON | 本轮源隔离确认tab=rules旧链接点击topics后仍rules；兼容迁移未修。 |
| TR-TAB-GOVERNANCE 进入合并拆分 / local | 1处；manager、readonly-hidden、pending-count | [governance · 1440](design/trend-direction-c/1440-governance.png) / [governance · 390](design/trend-direction-c/390-governance.png)、[governance-empty · 1440](design/trend-direction-c/1440-governance-empty.png) / [governance-empty · 390](design/trend-direction-c/390-governance-empty.png)；其余见JSON | 只进入治理，不执行信号迁移；失败时无同级状态面板，原型保护待实现。 |
| TR-RECOVER 恢复主题工作面 / read | 1处；empty-clear、error-load、expired-load、forbidden-load、blocked-load | [empty · 1440](design/trend-direction-c/1440-empty.png) / [empty · 390](design/trend-direction-c/390-empty.png)、[loading · 1440](design/trend-direction-c/1440-loading.png) / [loading · 390](design/trend-direction-c/390-loading.png)；其余见JSON | C稿登录/选择上下文是待审导航，不是源primary已实现；shared内部全状态仍需消费者验收。 |
| TR-TOPIC-SELECT 选择主题 / local | 1处；first、other、followed、detail-loading | [topics · 1440](design/trend-direction-c/1440-topics.png) / [topics · 390](design/trend-direction-c/390-topics.png)、[detail · 1440](design/trend-direction-c/1440-detail.png) / [detail · 390](design/trend-direction-c/390-detail.png)；其余见JSON | load与topic watcher无任务页同级代次保护；旧详情结果与写入归属仍待真实Vue验证。 |
| TR-PAGE-PREV 上一页 / local | 1处；first-disabled、later-page | [topics · 1440](design/trend-direction-c/1440-topics.png) / [topics · 390](design/trend-direction-c/390-topics.png)、[page-two · 1440](design/trend-direction-c/1440-page-two.png) / [page-two · 390](design/trend-direction-c/390-page-two.png)；其余见JSON | 页大小20，41总数为合成布局，不宣称真实全量任务。 |
| TR-PAGE-NEXT 下一页 / local | 1处；next、last-disabled | [page-two · 1440](design/trend-direction-c/1440-page-two.png) / [page-two · 390](design/trend-direction-c/390-page-two.png)；其余见JSON | 当前页排序不保证跨页排名；所有分页组合尚未穷尽。 |
| TR-HELP 展开解释 / local | 1处；closed、open | [help · 1440](design/trend-direction-c/1440-help.png) / [help · 390](design/trend-direction-c/390-help.png)；其余见JSON | 源帮助称按数量/新鲜度计算置信度，与现有insufficient_data合同不一致；提案诚实文案未迁入。 |
| TR-RELOAD 重新读取规则状态 / read | 1处；error、expired、blocked、loading | [rules-error · 1440](design/trend-direction-c/1440-rules-error.png) / [rules-error · 390](design/trend-direction-c/390-rules-error.png)、[rules · 1440](design/trend-direction-c/1440-rules.png) / [rules · 390](design/trend-direction-c/390-rules.png)；其余见JSON | 该面板后的rules v-for无else，旧规则仍可展示；不把C稿隐藏旧条目当修复。 |
| TR-RULE-STATUS 暂停或启用规则 / write | 1处；enabled-to-paused、paused-to-enabled、failure、repeat | [rules · 1440](design/trend-direction-c/1440-rules.png) / [rules · 390](design/trend-direction-c/390-rules.png)、[rules-paused · 1440](design/trend-direction-c/1440-rules-paused.png) / [rules-paused · 390](design/trend-direction-c/390-rules-paused.png)；其余见JSON | 下一次用返回version，但并发重入/旧对象结果和重读仍待验；无next_collection_at不能推断已暂停。 |
| TR-RULE-RESULTS 查看规则趋势结果 / local | 1处；first-keyword、missing-keyword、existing-filter、legacy-tab | [filtered · 1440](design/trend-direction-c/1440-filtered.png) / [filtered · 390](design/trend-direction-c/390-filtered.png)、[rules-readonly · 1440](design/trend-direction-c/1440-rules-readonly.png) / [rules-readonly · 390](design/trend-direction-c/390-rules-readonly.png)；其余见JSON | 不是精确rule_id筛选，也不一定清除其他条件；C稿与原源URL兼容需逐项验收。 |
| TR-ANOMALY-SUBMIT 创建或复用质量工单 / write | 2处；warning、critical、busy、failed、created、existing | [anomaly-edited · 1440](design/trend-direction-c/1440-anomaly-edited.png) / [anomaly-edited · 390](design/trend-direction-c/390-anomaly-edited.png)、[anomaly-busy · 1440](design/trend-direction-c/1440-anomaly-busy.png) / [anomaly-busy · 390](design/trend-direction-c/390-anomaly-busy.png)；其余见JSON | severity不是来源身份；created=false仍成功，内存id不证明下次服务端无工单；切主题与晚到结果待验。 |
| TR-ANOMALY-CLOSE 关闭异常报告 / local | 2处；cross、cancel、busy-close | [anomaly-open · 1440](design/trend-direction-c/1440-anomaly-open.png) / [anomaly-open · 390](design/trend-direction-c/390-anomaly-open.png)、[anomaly-busy · 1440](design/trend-direction-c/1440-anomaly-busy.png) / [anomaly-busy · 390](design/trend-direction-c/390-anomaly-busy.png)；其余见JSON | C稿原生dialog、锁定与返焦不是源实现；关窗不取消已发请求。 |
| TR-RELEVANCE-SUBMIT 提交无关或恢复相关 / write | 2处；irrelevant、restore、busy、failed、saved | [irrelevant-open · 1440](design/trend-direction-c/1440-irrelevant-open.png) / [irrelevant-open · 390](design/trend-direction-c/390-irrelevant-open.png)、[irrelevant-busy · 1440](design/trend-direction-c/1440-irrelevant-busy.png) / [irrelevant-busy · 390](design/trend-direction-c/390-irrelevant-busy.png)；其余见JSON | 源失败关闭丢原因已隔离复现，C稿失败保留未修Vue；不能用正常成功图抵扣失败。 |
| TR-RELEVANCE-CLOSE 关闭相关性表单 / local | 2处；cross、cancel、busy-close | [irrelevant-open · 1440](design/trend-direction-c/1440-irrelevant-open.png) / [irrelevant-open · 390](design/trend-direction-c/390-irrelevant-open.png)、[restore-open · 1440](design/trend-direction-c/1440-restore-open.png) / [restore-open · 390](design/trend-direction-c/390-restore-open.png)；其余见JSON | 与提交函数失败清空不同；原div没有统一键盘/返焦处理。 |
| TR-FILTER-APPLY 应用筛选 / local | 2处；normal、same-url、all-status、dirty | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png)、[filtered · 1440](design/trend-direction-c/1440-filtered.png) / [filtered · 390](design/trend-direction-c/390-filtered.png)；其余见JSON | 全部status空被省略，syncFromRoute恢复active，旧缺口再次复验；shared capture先关闭不代表读取成功。 |
| TR-FILTER-EDIT.market 修改市场草稿 / local | 1处；draft、applied | [filter-open · 1440](design/trend-direction-c/1440-filter-open.png) / [filter-open · 390](design/trend-direction-c/390-filter-open.png)；其余见JSON | activeFilterCount按所有非空值计算，默认active也计1；取消抽屉不回滚草稿，复制只读当前URL。 |
| TR-FILTER-EDIT.category 修改分类草稿 / local | 1处；draft、applied | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png)；其余见JSON | activeFilterCount按所有非空值计算，默认active也计1；取消抽屉不回滚草稿，复制只读当前URL。 |
| TR-FILTER-EDIT.status 修改状态草稿 / local | 1处；draft、applied | [all-status · 1440](design/trend-direction-c/1440-all-status.png) / [all-status · 390](design/trend-direction-c/390-all-status.png)；其余见JSON | activeFilterCount按所有非空值计算，默认active也计1；取消抽屉不回滚草稿，复制只读当前URL。 |
| TR-FILTER-EDIT.q 修改关键词草稿 / local | 1处；draft、applied | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png)；其余见JSON | activeFilterCount按所有非空值计算，默认active也计1；取消抽屉不回滚草稿，复制只读当前URL。 |
| TR-FILTER-SORT 切换本页排序草稿 / local | 1处；impact、latest、momentum、followed | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png)、[filtered · 1440](design/trend-direction-c/1440-filtered.png) / [filtered · 390](design/trend-direction-c/390-filtered.png)；其余见JSON | 不是全局排序；未应用草稿已经改变本页顺序，与URL不同。 |
| TR-FILTER-CLEAR 清除筛选 / local | 1处；clear、already-default | [filter-open · 1440](design/trend-direction-c/1440-filter-open.png) / [filter-open · 390](design/trend-direction-c/390-filter-open.png)、[empty · 1440](design/trend-direction-c/1440-empty.png) / [empty · 390](design/trend-direction-c/390-empty.png)；其余见JSON | 不恢复全部状态；保留legacy tab及未知query，移动抽屉不会因clear按钮自动submit关闭。 |
| TR-FILTER-COPY 复制已应用视图网址 / local | 1处；success、clipboard-failed、unapplied-draft | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png)、[copy-failed · 1440](design/trend-direction-c/1440-copy-failed.png) / [copy-failed · 390](design/trend-direction-c/390-copy-failed.png)；其余见JSON | 本轮无真实剪贴板写入；原型只展示复制意图，不是实际权限/剪贴板测试。 |
| TR-BACK 返回趋势列表焦点 / local | 1处；mobile-return、deep-link-reload | [detail · 1440](design/trend-direction-c/1440-detail.png) / [detail · 390](design/trend-direction-c/390-detail.png)、[topics · 1440](design/trend-direction-c/1440-topics.png) / [topics · 390](design/trend-direction-c/390-topics.png)；其余见JSON | C稿桌面也单焦点返回，与源双栏不同；reload含topic仍进详情不能误报URL清空。 |
| TR-FOLLOW 关注或取消关注 / write | 1处；follow、unfollow、busy、failure、switched-selection | [followed · 1440](design/trend-direction-c/1440-followed.png) / [followed · 390](design/trend-direction-c/390-followed.png)、[follow-busy · 1440](design/trend-direction-c/1440-follow-busy.png) / [follow-busy · 390](design/trend-direction-c/390-follow-busy.png)；其余见JSON | 源隔离已确认A请求等待期间selected换B，返回后B详情/列表被更新而A未同步；非真实持久化错误证明。 |
| TR-OPPORTUNITY-NAV 转为机会预填导航 / navigation | 1处；selected、readonly | [detail · 1440](design/trend-direction-c/1440-detail.png) / [detail · 390](design/trend-direction-c/390-detail.png)、[detail-readonly · 1440](design/trend-direction-c/1440-detail-readonly.png) / [detail-readonly · 390](design/trend-direction-c/390-detail-readonly.png)；其余见JSON | 不调用POST、不走/opportunities/start，也不表示已通过机会质量门或可以自动采纳。 |
| TR-RELEVANCE-OPEN.irrelevant 打开标记无关 / local | 1处；active、stale、busy | [irrelevant-open · 1440](design/trend-direction-c/1440-irrelevant-open.png) / [irrelevant-open · 390](design/trend-direction-c/390-irrelevant-open.png)；其余见JSON | 原始证据不删除；不是直接提交。 |
| TR-RELEVANCE-OPEN.active 打开恢复相关 / local | 1处；irrelevant、busy | [restore-open · 1440](design/trend-direction-c/1440-restore-open.png) / [restore-open · 390](design/trend-direction-c/390-restore-open.png)；其余见JSON | 恢复是新相关性记录，不抹除历史。 |
| TR-EVIDENCE-ORIGINAL 打开原始来源 / navigation | 1处；each-evidence、long-title | [detail · 1440](design/trend-direction-c/1440-detail.png) / [detail · 390](design/trend-direction-c/390-detail.png)、[detail-long · 1440](design/trend-direction-c/1440-detail-long.png) / [detail-long · 390](design/trend-direction-c/390-detail-long.png)；其余见JSON | 本轮不访问合成原文；实际链接安全、失败和授权内容需另验。 |
| TR-ANOMALY-OPEN 打开指定证据异常报告 / local | 1处；new、busy-disabled、existing-disabled | [anomaly-open · 1440](design/trend-direction-c/1440-anomaly-open.png) / [anomaly-open · 390](design/trend-direction-c/390-anomaly-open.png)、[anomaly-existing · 1440](design/trend-direction-c/1440-anomaly-existing.png) / [anomaly-existing · 390](design/trend-direction-c/390-anomaly-existing.png)；其余见JSON | 按精确证据id，不按当前行序号；所有动态证据消费者与迟到结果待验。 |
| TR-HISTORY-TECHNICAL 展开历史操作者 / local | 1处；none、history、expanded | [detail-history · 1440](design/trend-direction-c/1440-detail-history.png) / [detail-history · 390](design/trend-direction-c/390-detail-history.png)；其余见JSON | 完整历史行/长id/读屏与主题仍待验证。 |
| TR-RULE-SUBMIT 提交八字段监控规则 / write | 2处；default、edited、duplicate、busy、failed、saved | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png)、[rule-edited · 1440](design/trend-direction-c/1440-rule-edited.png) / [rule-edited · 390](design/trend-direction-c/390-rule-edited.png)；其余见JSON | 7周期/3门槛不扩成API全部允许值；源实际重复词校验报400；源窗外错误/关闭锁定未修。 |
| TR-RULE-CLOSE 取消创建监控 / local | 2处；cross、cancel、busy-close、reopen-default | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png)、[rule-busy · 1440](design/trend-direction-c/1440-rule-busy.png) / [rule-busy · 390](design/trend-direction-c/390-rule-busy.png)；其余见JSON | 与异常/相关性ref保留不同；源无初焦点/Escape/循环/返焦，C稿为提案。 |
| TR-PROPOSE 提交合并或拆分提议 / write | 2处；merge、split、busy、failed、queued | [merge-edited · 1440](design/trend-direction-c/1440-merge-edited.png) / [merge-edited · 390](design/trend-direction-c/390-merge-edited.png)、[split-edited · 1440](design/trend-direction-c/1440-split-edited.png) / [split-edited · 390](design/trend-direction-c/390-split-edited.png)；其余见JSON | expected_versions遍历残留sourceIds；候选限当前页同市场/语言active，但目标活动/保留信号由后端验；成功父不调用resetProposal。 |
| TR-PROPOSAL-MODE.merge 切换合并提议 / local | 1处；merge、from-split | [governance · 1440](design/trend-direction-c/1440-governance.png) / [governance · 390](design/trend-direction-c/390-governance.png)、[merge-edited · 1440](design/trend-direction-c/1440-merge-edited.png) / [merge-edited · 390](design/trend-direction-c/390-merge-edited.png)；其余见JSON | 不把切模式当重新建表单；旧草稿/版本混合需明确呈现。 |
| TR-PROPOSAL-MODE.split 切换拆分提议 / local | 1处；split、from-merge | [split-edited · 1440](design/trend-direction-c/1440-split-edited.png) / [split-edited · 390](design/trend-direction-c/390-split-edited.png)；其余见JSON | 无前端强制原主题保留一条；真实后端拒绝链待验，不擅改业务。 |
| TR-DECISION-OPEN.reject 展开驳回说明 / local | 1处；pending、switch-row | [reject-open · 1440](design/trend-direction-c/1440-reject-open.png) / [reject-open · 390](design/trend-direction-c/390-reject-open.png)、[self-decision-failed · 1440](design/trend-direction-c/1440-self-decision-failed.png) / [self-decision-failed · 390](design/trend-direction-c/390-self-decision-failed.png)；其余见JSON | 提议人与决定人不同由后端确认，不伪称前端隐藏即授权。 |
| TR-DECISION-OPEN.confirm 展开确认说明 / local | 1处；pending、switch-row | [confirm-open · 1440](design/trend-direction-c/1440-confirm-open.png) / [confirm-open · 390](design/trend-direction-c/390-confirm-open.png)；其余见JSON | 只是打开内联form，不执行合并/拆分。 |
| TR-DECIDE 提交确认或驳回 / write | 2处；confirm、reject、failed、self-forbidden、completed | [confirm-failed · 1440](design/trend-direction-c/1440-confirm-failed.png) / [confirm-failed · 390](design/trend-direction-c/390-confirm-failed.png)、[confirmed · 1440](design/trend-direction-c/1440-confirmed.png) / [confirmed · 390](design/trend-direction-c/390-confirmed.png)；其余见JSON | 失败保留；成功状态依赖重读，其他管理员、事务版本与关联迁移未真实验证。 |
| TR-DECISION-CANCEL 收起决定表单 / local | 1处；cancel、busy-cancel、reopen | [confirm-open · 1440](design/trend-direction-c/1440-confirm-open.png) / [confirm-open · 390](design/trend-direction-c/390-confirm-open.png)、[reject-open · 1440](design/trend-direction-c/1440-reject-open.png) / [reject-open · 390](design/trend-direction-c/390-reject-open.png)；其余见JSON | 不是撤销已发治理决定，也不新增确认弹窗。 |
| TR-FILTER-FORWARD 父子事件完整转发 / wiring | 1处；@apply、@clear、@save-view、@update-filters、@update-sort | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-DETAIL-FORWARD 父子事件完整转发 / wiring | 1处；@back、@follow、@create-rule、@change-relevance、@report-anomaly | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-GOVERNANCE-FORWARD 父子事件完整转发 / wiring | 1处；@propose、@decide | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-RULE-CALLER 父子事件完整转发 / wiring | 2处；@close、@submit | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-ANOMALY-DEFINITION 模态定义或共享消费者关联 / wiring | 1处；listed-consumer-variants | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-RELEVANCE-DEFINITION 模态定义或共享消费者关联 / wiring | 1处；listed-consumer-variants | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-FILTER-CALLER 模态定义或共享消费者关联 / wiring | 1处；listed-consumer-variants | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-EVIDENCE-FORWARD 父子事件完整转发 / wiring | 1处；@report-anomaly | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |
| TR-RULE-DEFINITION 模态定义或共享消费者关联 / wiring | 1处；listed-consumer-variants | ；其余见JSON | 完整模态初焦点、所有共享入口/主题、忙碌关闭和跨主题结果归属仍待实际Vue验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| TR-FILTER-FORWARD | @apply / applyFilters | TR-FILTER-APPLY |
| TR-FILTER-FORWARD | @clear / clearFilters | TR-FILTER-CLEAR |
| TR-FILTER-FORWARD | @save-view / saveViewLink | TR-FILTER-COPY |
| TR-FILTER-FORWARD | @update-filters / Object.assign(filters, $event) | TR-FILTER-EDIT.market、TR-FILTER-EDIT.category、TR-FILTER-EDIT.status、TR-FILTER-EDIT.q |
| TR-FILTER-FORWARD | @update-sort / sort = $event | TR-FILTER-SORT |
| TR-DETAIL-FORWARD | @back / returnToTopicList | TR-BACK |
| TR-DETAIL-FORWARD | @follow / follow | TR-FOLLOW |
| TR-DETAIL-FORWARD | @create-rule / showRule = true | TR-RULE-OPEN |
| TR-DETAIL-FORWARD | @change-relevance / openRelevance | TR-RELEVANCE-OPEN.irrelevant、TR-RELEVANCE-OPEN.active |
| TR-DETAIL-FORWARD | @report-anomaly / openAnomaly | TR-ANOMALY-OPEN |
| TR-GOVERNANCE-FORWARD | @propose / proposeTopicChange | TR-PROPOSE |
| TR-GOVERNANCE-FORWARD | @decide / decideTopicChange | TR-DECIDE |
| TR-RULE-CALLER | @close / showRule = false | TR-RULE-CLOSE |
| TR-RULE-CALLER | @submit / createRule | TR-RULE-SUBMIT |
| TR-RULE-CALLER | @close / showRule = false | TR-RULE-CLOSE |
| TR-RULE-CALLER | @submit / createRule | TR-RULE-SUBMIT |
| TR-ANOMALY-DEFINITION | 容器定义，无额外事件 | TR-ANOMALY-OPEN、TR-ANOMALY-SUBMIT、TR-ANOMALY-CLOSE |
| TR-RELEVANCE-DEFINITION | 容器定义，无额外事件 | TR-RELEVANCE-OPEN.irrelevant、TR-RELEVANCE-OPEN.active、TR-RELEVANCE-SUBMIT、TR-RELEVANCE-CLOSE |
| TR-FILTER-CALLER | 容器定义，无额外事件 | TR-FILTER-APPLY、TR-FILTER-CLEAR、TR-FILTER-COPY、TR-FILTER-EDIT.market、TR-FILTER-EDIT.category、TR-FILTER-EDIT.status、TR-FILTER-EDIT.q、TR-FILTER-SORT |
| TR-EVIDENCE-FORWARD | @report-anomaly / emit('reportAnomaly', $event) | TR-ANOMALY-OPEN |
| TR-RULE-DEFINITION | 容器定义，无额外事件 | TR-RULE-OPEN、TR-RULE-SUBMIT、TR-RULE-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| TrendDashboard.vue / anomalySeverity | warning/critical；打开异常重置warning，不是从证据自动推断风险。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendDashboard.vue / anomalyReason | 异常原因required 2..500，提交trim；关闭ref保留，重开清空，失败保留。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendDashboard.vue / relevanceReason | 相关性原因required 2..500，提交trim；当前失败也清空且关窗。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendEvidenceTimeline.vue / timelineSource | 来源select为空用aggregate；指定来源查timeline_sources，映射source_count=1；切detail.id清空，仅内存，不发API。 | 此v-model没有独立旧action候选；必须单列消费者，不为填数捏造按钮ID；每来源/未知来源/重置/实际Vue待验。 |
| TrendRuleDialog.vue / form.name | 监控名称required maxlength120；submit不trim，后端另校验。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.include_keywords | 包含词required maxlength500；按英文/中文逗号和换行拆分trim去空，不去重。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.negative_keywords | 排除词可选maxlength500，同样拆分；不替代服务端规范化/重复拒绝。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.market | 独立required输入maxlength40，默认US；不等于筛选页只有US的select。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.language | 独立required输入maxlength40，默认en-US，不随市场自动联动。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.category | 可选maxlength80；空字符串转null，客户端不trim。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.collection_interval_minutes | v-model.number，15/30/60/180/360/720/1440七选项。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendRuleDialog.vue / form.recommendation_min_source_count | v-model.number，1/2/3三选项；只形成候选，不代表已可采纳。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / sourceIds | merge候选checkbox数组，当前页/同市场语言/active/非目标；模式切换保留，expected_versions始终遍历。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / signalIds | split证据checkbox数组，使用selected.evidence的实际id；原主题留一条由后端另验。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / newTitle | split新标题required maxlength500，submit trim；模式切换保留。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / newCategory | split可选分类maxlength80，trim后空为null。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / reason | 治理提议原因required 2..1000，submit trim；成功父load不调用子resetProposal。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |
| TrendChangeQueue.vue / decision.reason | confirm/reject内联原因required 2..1000，trim；beginDecision清空，cancel只清requestId，失败保留。 | 原生required/maxlength不代替服务端校验与字段错误关联；动态图/忙碌锁/主题及完整实际Vue待验。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| TrendDashboard.vue / form.1 / anomaly-open | form-container / matching-dialog-scene | [anomaly-open · 1440](design/trend-direction-c/1440-anomaly-open.png) / [anomaly-open · 390](design/trend-direction-c/390-anomaly-open.png) | 外层role div已由action定义关联，结构扫描此处仅form/aside，不能以容器数推算模态数；原型原生dialog保护待迁入。 |
| TrendDashboard.vue / aside.1 / anomaly-open | inline-aside / related-scene-only | [anomaly-open · 1440](design/trend-direction-c/1440-anomaly-open.png) / [anomaly-open · 390](design/trend-direction-c/390-anomaly-open.png) | 外层role div已由action定义关联，结构扫描此处仅form/aside，不能以容器数推算模态数；原型原生dialog保护待迁入。 |
| TrendDashboard.vue / form.2 / irrelevant-open | form-container / matching-dialog-scene | [irrelevant-open · 1440](design/trend-direction-c/1440-irrelevant-open.png) / [irrelevant-open · 390](design/trend-direction-c/390-irrelevant-open.png) | 外层role div已由action定义关联，结构扫描此处仅form/aside，不能以容器数推算模态数；原型原生dialog保护待迁入。 |
| TrendDashboard.vue / form.2 / restore-open | form-container / matching-dialog-scene | [restore-open · 1440](design/trend-direction-c/1440-restore-open.png) / [restore-open · 390](design/trend-direction-c/390-restore-open.png) | 外层role div已由action定义关联，结构扫描此处仅form/aside，不能以容器数推算模态数；原型原生dialog保护待迁入。 |
| TrendFilterPanel.vue / ResponsiveFilterDrawer.1 / filter-open | responsive-filter / related-scene-only | [filter-open · 1440](design/trend-direction-c/1440-filter-open.png) / [filter-open · 390](design/trend-direction-c/390-filter-open.png) | 移动变体需要与具体五输入共验；引用同场景的桌面内联不等于两个业务弹窗。 |
| TrendFilterPanel.vue / ResponsiveFilterDrawer.1 / filter-edited | responsive-filter / related-scene-only | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png) | 移动变体需要与具体五输入共验；引用同场景的桌面内联不等于两个业务弹窗。 |
| TrendFilterPanel.vue / form.1 / filter-open | form-container / matching-inline-form-scene | [filter-open · 1440](design/trend-direction-c/1440-filter-open.png) / [filter-open · 390](design/trend-direction-c/390-filter-open.png) | 移动变体需要与具体五输入共验；引用同场景的桌面内联不等于两个业务弹窗。 |
| TrendFilterPanel.vue / form.1 / filter-edited | form-container / matching-inline-form-scene | [filter-edited · 1440](design/trend-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/trend-direction-c/390-filter-edited.png) | 移动变体需要与具体五输入共验；引用同场景的桌面内联不等于两个业务弹窗。 |
| TrendRuleDialog.vue / form.1 / rule-open | form-container / matching-dialog-scene | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png) | 规则本体role div通过action定义关联，form/aside不重复算模态；全部八字段/关闭/忙碌失败仍待真实验收。 |
| TrendRuleDialog.vue / aside.1 / rule-open | inline-aside / related-scene-only | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png) | 规则本体role div通过action定义关联，form/aside不重复算模态；全部八字段/关闭/忙碌失败仍待真实验收。 |
| TrendRuleDialog.vue / aside.2 / rule-open | inline-aside / related-scene-only | [rule-open · 1440](design/trend-direction-c/1440-rule-open.png) / [rule-open · 390](design/trend-direction-c/390-rule-open.png) | 规则本体role div通过action定义关联，form/aside不重复算模态；全部八字段/关闭/忙碌失败仍待真实验收。 |
| TrendChangeQueue.vue / form.1 / merge-edited | form-container / matching-inline-form-scene | [merge-edited · 1440](design/trend-direction-c/1440-merge-edited.png) / [merge-edited · 390](design/trend-direction-c/390-merge-edited.png) | 两个内联form定义/四业务态，不算四个弹窗；每个动态队列行及同人/版本/失败待真实后端验收。 |
| TrendChangeQueue.vue / form.1 / split-edited | form-container / matching-inline-form-scene | [split-edited · 1440](design/trend-direction-c/1440-split-edited.png) / [split-edited · 390](design/trend-direction-c/390-split-edited.png) | 两个内联form定义/四业务态，不算四个弹窗；每个动态队列行及同人/版本/失败待真实后端验收。 |
| TrendChangeQueue.vue / form.2 / confirm-open | form-container / matching-inline-form-scene | [confirm-open · 1440](design/trend-direction-c/1440-confirm-open.png) / [confirm-open · 390](design/trend-direction-c/390-confirm-open.png) | 两个内联form定义/四业务态，不算四个弹窗；每个动态队列行及同人/版本/失败待真实后端验收。 |
| TrendChangeQueue.vue / form.2 / reject-open | form-container / matching-inline-form-scene | [reject-open · 1440](design/trend-direction-c/1440-reject-open.png) / [reject-open · 390](design/trend-direction-c/390-reject-open.png) | 两个内联form定义/四业务态，不算四个弹窗；每个动态队列行及同人/版本/失败待真实后端验收。 |

### 明确保留的边界

- 42页面动作组的252代表视觉槽均未逐selector映射；146旧图涵盖68双端场景及10下部，不代表每按钮六态/动态行/全部主题。
- 源applyFilters全部status回active、相关性失败关窗清原因、已启用无时间仍显示已暂停等与C稿有差异，原型不得冒充修复。
- 本轮actual follow在惰性VM中确认A请求等待时selected改B，成功回写B详情及B列表，A未同步；setTab(topics)保留legacy tab=rules并恢复到rules。不是实际浏览器/持久化/权限失败证明，需列入真实实现验收。
- 三工作面共享单个state/busy；规则旧条目可与错误同屏，治理无同级状态面板；原型隔离失败、统一忙碌保护与原生模态仍待批准/实现。
- 局部65候选包括60控件/事件、3role定义与2共享/规则调用；source scan与结构scan统计对象不同，不能合并为业务弹窗总数。
- MonitoringReadinessStrip只展示事实；外层NavigationShell另审。UiStatePanel两个primary消费者已列，secondary未监听，不能宣称恢复链接真实可用。
- ResponsiveFilterDrawer的show/close/遮罩/Tab/Escape由共享组件实现，当前只审一个调用；本页业务role div不复用它，不自动继承模态能力。
- 父/trends为reset_on_scope且提供组织/工作区；局部read/watch没有任务页active/代次保护不等于父无scope隔离。晚到读写结果和缓存激活仍需真实Vue/范围测试。

## P15 局部动作与共享消费者

[逐项机器清单](action-reviews/P15.json)：67个局部源位置 → 35组；4类写入，27组路由动作，6组转发/容器关联不重复计动作。20个本地v-model，17处调用/内嵌容器，35个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有162个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OP-JOURNEY-NAV 创建选品入口 / navigation | 1处；recommended、rule_candidates、evidence_pending、all | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)；其余见JSON | P16向导合同及冲突另审；未批准合并入口。 |
| OP-TREND-RULES-NAV 管理选品规则 / navigation | 1处；all、non-all | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)；其余见JSON | 目标P14加载/权限与返回不由本地离线导航证明。 |
| OP-ERP-OPEN 打开ERP导入 / local | 1处；first-open、reopen、readonly-hidden | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)；其余见JSON | ERP弹窗重开与进行中请求属于独立生命周期，不能承诺重新打开即新任务。 |
| OP-CREATE-OPEN 打开手工添加 / local | 1处；button、initial-create-query、initial-topic-query、reopen | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)；其余见JSON | 初始深链与已缓存页后续query需分开验；不能改为每次query都自动创建。 |
| OP-VIEW 切换四队列 / local | 1处；recommended、rule_candidates、evidence_pending、all | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[rule-candidates · 1440](design/opportunity-direction-c/1440-rule-candidates.png) / [rule-candidates · 390](design/opportunity-direction-c/390-rule-candidates.png)；其余见JSON | 实际syncListRoute仍接纳非all深链decision_status；可见筛选与请求条件不一致待处理，不扩展业务规则。 |
| OP-FILTER-APPLY 应用七字段筛选 / read | 2处；draft、same-query-reload、changed-query、non-all-hidden-decision | [filter-open · 1440](design/opportunity-direction-c/1440-filter-open.png) / [filter-open · 390](design/opportunity-direction-c/390-filter-open.png)、[filter-edited · 1440](design/opportunity-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/opportunity-direction-c/390-filter-edited.png)；其余见JSON | activeFilterCount读取可变草稿，不是已应用数；隐藏decision_status仍可参与请求；C稿分离草稿仅提案。 |
| OP-FILTER-RESET 重置筛选 / read | 1处；filtered、already-empty、hidden-selection | [filtered · 1440](design/opportunity-direction-c/1440-filtered.png) / [filtered · 390](design/opportunity-direction-c/390-filtered.png)、[empty-filtered · 1440](design/opportunity-direction-c/1440-empty-filtered.png) / [empty-filtered · 390](design/opportunity-direction-c/390-empty-filtered.png)；其余见JSON | 重置不是清空选择或删除数据；移动筛选关闭由共享submit捕获，reset本身不submit。 |
| OP-RECOVER 状态面板主次行动 / local | 1处；empty-filtered、empty-all、empty-recommended、empty-candidates、empty-pending、empty-readonly、error、expired、forbidden、blocked | [empty-filtered · 1440](design/opportunity-direction-c/1440-empty-filtered.png) / [empty-filtered · 390](design/opportunity-direction-c/390-empty-filtered.png)、[empty-all · 1440](design/opportunity-direction-c/1440-empty-all.png) / [empty-all · 390](design/opportunity-direction-c/390-empty-all.png)；其余见JSON | 一个复合消费者含两个实际事件，不省略secondary；异常primary沿共享文案（重新登录/返回工作台等）但实际apply，secondary明确标返回机会列表而实际reset，并非history back。原型恢复导航不冒充真实接线。 |
| OP-SELECT 逐行选择 / local | 1处；checked、unchecked、cross-page、hidden-selection | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[selected · 1440](design/opportunity-direction-c/1440-selected.png) / [selected · 390](design/opportunity-direction-c/390-selected.png)；其余见JSON | 当前提交仅items交集，源显示selectedIds总数；不承诺跨页全部写入，禁止用图中有效范围保护冒充源已修。 |
| OP-DETAIL-NAV 查看机会详情 / navigation | 1处；recommended、rule_candidates、evidence_pending、all、readonly | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[rule-candidates · 1440](design/opportunity-direction-c/1440-rule-candidates.png) / [rule-candidates · 390](design/opportunity-direction-c/390-rule-candidates.png)；其余见JSON | 目标详情权限/质量门/P18十分区另审；列表缺图/坏图、长名称、null评分与事实保留。 |
| OP-PAGE-PREV 上一页 / local | 1处；first-disabled、later-page | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[page-two · 1440](design/opportunity-direction-c/1440-page-two.png) / [page-two · 390](design/opportunity-direction-c/390-page-two.png)；其余见JSON | 忙碌和晚到读结果无局部代次保障；实际Vue跨页继续验。 |
| OP-PAGE-NEXT 下一页 / local | 1处；last-disabled、next-page | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[page-two · 1440](design/opportunity-direction-c/1440-page-two.png) / [page-two · 390](design/opportunity-direction-c/390-page-two.png)；其余见JSON | 图稿合成总量不证明真实全页数据；跨页选中数与写入范围分别核对。 |
| OP-SETUP-NEXT 配置下一步 / navigation | 1处；missing-step、all-ready-hidden、unavailable-hidden | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[setup-open · 1440](design/opportunity-direction-c/1440-setup-open.png) / [setup-open · 390](design/opportunity-direction-c/390-setup-open.png)；其余见JSON | 五项配置、特定amazon phone_case成本条件不得泛化为所有商品自动评估已就绪。 |
| OP-SCORE-RULES 配置未知时查看规则 / navigation | 1处；unavailable | [setup-unknown · 1440](design/opportunity-direction-c/1440-setup-unknown.png) / [setup-unknown · 390](design/opportunity-direction-c/390-setup-unknown.png)；其余见JSON | 任何readiness依赖失败合成未知，不是全部未配置；错误不等于真实空。 |
| OP-SETUP-DETAILS 展开配置检查 / local | 1处；collapsed、expanded、all-ready | [recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)、[setup-open · 1440](design/opportunity-direction-c/1440-setup-open.png) / [setup-open · 390](design/opportunity-direction-c/390-setup-open.png)；其余见JSON | details非业务弹窗；展开图未覆盖每个动态步骤的按钮六态。 |
| OP-SETUP-STEP 逐项配置链接 / navigation | 1处；each-missing-step、ready-no-link | [setup-open · 1440](design/opportunity-direction-c/1440-setup-open.png) / [setup-open · 390](design/opportunity-direction-c/390-setup-open.png)；其余见JSON | 实际五步骤路径分别保留；成员能力在目标页校验，不用此链接存在证明有写权限。 |
| OP-BATCH-OPEN.assign 打开批量指派 / local | 1处；open、reopen、cross-page、busy-reopen | [assign-open · 1440](design/opportunity-direction-c/1440-assign-open.png) / [assign-open · 390](design/opportunity-direction-c/390-assign-open.png)、[assign-edited · 1440](design/opportunity-direction-c/1440-assign-edited.png) / [assign-edited · 390](design/opportunity-direction-c/390-assign-edited.png)；其余见JSON | 打开不写；按钮显示记忆数，实际body只取当前页交集；重新打开不取消之前请求。 |
| OP-BATCH-OPEN.review 打开批量复核 / local | 1处；open、reopen、cross-page、busy-reopen | [review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png)、[review-edited · 1440](design/opportunity-direction-c/1440-review-edited.png) / [review-edited · 390](design/opportunity-direction-c/390-review-edited.png)；其余见JSON | 打开不写；按钮显示记忆数，实际body只取当前页交集；重新打开不取消之前请求。 |
| OP-BATCH-OPEN.archive 打开批量归档 / local | 1处；open、reopen、cross-page、busy-reopen | [archive-open · 1440](design/opportunity-direction-c/1440-archive-open.png) / [archive-open · 390](design/opportunity-direction-c/390-archive-open.png)、[archive-edited · 1440](design/opportunity-direction-c/1440-archive-edited.png) / [archive-edited · 390](design/opportunity-direction-c/390-archive-edited.png)；其余见JSON | 打开不写；按钮显示记忆数，实际body只取当前页交集；重新打开不取消之前请求。 |
| OP-BATCH-CANCEL 关闭批量弹窗 / local | 2处；assign、review、archive、escape、busy-close | [assign-open · 1440](design/opportunity-direction-c/1440-assign-open.png) / [assign-open · 390](design/opportunity-direction-c/390-assign-open.png)、[review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png)；其余见JSON | useModalDialog归还焦点不等于请求取消；本轮惰性VM证实旧成功可关闭新窗并清新选择，源未修。 |
| OP-BATCH-SUBMIT 提交当前有效批量范围 / write | 2处；assign、review、archive、empty-effective-selection、failed、late-success | [assign-edited · 1440](design/opportunity-direction-c/1440-assign-edited.png) / [assign-edited · 390](design/opportunity-direction-c/390-assign-edited.png)、[review-edited · 1440](design/opportunity-direction-c/1440-review-edited.png) / [review-edited · 390](design/opportunity-direction-c/390-review-edited.png)；其余见JSON | 与P13逐项循环不同：旧body稳定；问题是await后写共享showBatch/selectedIds。1–50/版本/权限/事务由后端另验；不扩大跨页写规则。 |
| OP-ERP-CLOSE 关闭ERP导入 / local | 3处；close、cancel、escape、busy-close | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)、[erp-closed-busy · 1440](design/opportunity-direction-c/1440-erp-closed-busy.png) / [erp-closed-busy · 390](design/opportunity-direction-c/390-erp-closed-busy.png)；其余见JSON | 保持请求归属与可恢复状态待真实Vue实现验收；不能将关闭文案写成取消导入。 |
| OP-ERP-BROWSER 从浏览器读取ERP并导入 / write | 2处；open、edited、busy、login-opened、login-required、helper-missing、failed、saved | [erp-edited · 1440](design/opportunity-direction-c/1440-erp-edited.png) / [erp-edited · 390](design/opportunity-direction-c/390-erp-edited.png)、[erp-busy · 1440](design/opportunity-direction-c/1440-erp-busy.png) / [erp-busy · 390](design/opportunity-direction-c/390-erp-busy.png)；其余见JSON | 没有真实助手/ERP/权限/幂等校验；接收结果或导入计数不等于已确认采购成本；超时不证明服务器没写。 |
| OP-ERP-FILE 选择JSON立即导入 / write | 1处；array、list、cancel-file-picker、invalid、failed、saved | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)、[erp-file-invalid · 1440](design/opportunity-direction-c/1440-erp-file-invalid.png) / [erp-file-invalid · 390](design/opportunity-direction-c/390-erp-file-invalid.png)；其余见JSON | 源未显式校验parsed.list数组及文件busy；原型结构保护待迁入；不得用用户真实敏感文件验证，不打印payload秘密。 |
| OP-HELPER-DOWNLOAD 下载浏览器助手 / navigation | 1处；link-only | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)、[erp-helper-missing · 1440](design/opportunity-direction-c/1440-erp-helper-missing.png) / [erp-helper-missing · 390](design/opportunity-direction-c/390-erp-helper-missing.png)；其余见JSON | 本轮无真实下载或扩展安装；不能把链接点击当助手已连接。 |
| OP-CREATE-CLOSE 关闭手工添加 / local | 3处；close、cancel、escape、busy-close | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)、[create-edited · 1440](design/opportunity-direction-c/1440-create-edited.png) / [create-edited · 390](design/opportunity-direction-c/390-create-edited.png)；其余见JSON | 初焦点是关闭按钮；取消返回与请求后成功导航需实际Vue验证。 |
| OP-CREATE-SUBMIT 保存手工候选 / write | 2处；empty-required、edited、busy、failed、saved | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)、[create-edited · 1440](design/opportunity-direction-c/1440-create-edited.png) / [create-edited · 390](design/opportunity-direction-c/390-create-edited.png)；其余见JSON | 客户端不trim四字段；后端规范化/UUID/scope另验；未知write文案未写入任何状态不是事务证据。 |
| OP-P18-EXCLUDED 详情读取、十分区与AI操作排除 / excluded | 18处；detail、analysis-tabs、AI-reason | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png)；其余见JSON | 共享父组件仍需真实缓存/跨路由残留测试；排除指正常入口，不宣称任何show ref均按路由清空。 |
| OP-DECISION-EXCLUDED 三种人工决定原因排除 / excluded | 6处；adopt、observe、reject | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png)、[observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png)；其余见JSON | 正常路由排除，不抵扣P18具体图审/权限/五质量门验收。 |
| OP-LIST-WIRING 消费者/容器关联 / wiring | 1处；source-forwarding | [all · 1440](design/opportunity-direction-c/1440-all.png) / [all · 390](design/opportunity-direction-c/390-all.png)、[recommended · 1440](design/opportunity-direction-c/1440-recommended.png) / [recommended · 390](design/opportunity-direction-c/390-recommended.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |
| OP-DIALOGS-WIRING 消费者/容器关联 / wiring | 2处；source-forwarding | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)、[erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |
| OP-BATCH-DEFINITION 消费者/容器关联 / wiring | 1处；source-forwarding | [assign-open · 1440](design/opportunity-direction-c/1440-assign-open.png) / [assign-open · 390](design/opportunity-direction-c/390-assign-open.png)、[review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |
| OP-ERP-DEFINITION 消费者/容器关联 / wiring | 1处；source-forwarding | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |
| OP-CREATE-DEFINITION 消费者/容器关联 / wiring | 1处；source-forwarding | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |
| OP-FILTER-CALLER 消费者/容器关联 / wiring | 1处；source-forwarding | [filter-open · 1440](design/opportunity-direction-c/1440-filter-open.png) / [filter-open · 390](design/opportunity-direction-c/390-filter-open.png)、[filter-edited · 1440](design/opportunity-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/opportunity-direction-c/390-filter-edited.png)；其余见JSON | 关联不新增按钮或业务弹窗；所有动态变体、真实组件及共享内部仍待完整验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| OP-LIST-WIRING | @apply / applyListFilters | OP-FILTER-APPLY |
| OP-LIST-WIRING | @batch / openBatch | OP-BATCH-OPEN.assign、OP-BATCH-OPEN.review、OP-BATCH-OPEN.archive |
| OP-LIST-WIRING | @create / showCreate = true | OP-CREATE-OPEN |
| OP-LIST-WIRING | @manage-setup / router.push($event) | OP-SETUP-NEXT |
| OP-LIST-WIRING | @page / goListPage | OP-PAGE-PREV、OP-PAGE-NEXT |
| OP-LIST-WIRING | @reset / resetListFilters | OP-FILTER-RESET |
| OP-LIST-WIRING | @view / setSelectionView | OP-VIEW |
| OP-LIST-WIRING | @update:selected-ids / selectedOpportunityIds = $event | OP-SELECT |
| OP-DIALOGS-WIRING | @create / create | OP-CREATE-SUBMIT |
| OP-DIALOGS-WIRING | @decide / decide | OP-DECISION-EXCLUDED |
| OP-DIALOGS-WIRING | @import-browser / importFromErpBrowser | OP-ERP-BROWSER |
| OP-DIALOGS-WIRING | @import-file / importErpFile | OP-ERP-FILE |
| OP-DIALOGS-WIRING | @create / create | OP-CREATE-SUBMIT |
| OP-DIALOGS-WIRING | @decide / decide | OP-DECISION-EXCLUDED |
| OP-DIALOGS-WIRING | @import-browser / importFromErpBrowser | OP-ERP-BROWSER |
| OP-DIALOGS-WIRING | @import-file / importErpFile | OP-ERP-FILE |
| OP-BATCH-DEFINITION | 容器定义，无额外事件 | OP-BATCH-CANCEL、OP-BATCH-SUBMIT |
| OP-ERP-DEFINITION | 容器定义，无额外事件 | OP-ERP-CLOSE、OP-ERP-BROWSER、OP-ERP-FILE、OP-HELPER-DOWNLOAD |
| OP-CREATE-DEFINITION | 容器定义，无额外事件 | OP-CREATE-CLOSE、OP-CREATE-SUBMIT |
| OP-FILTER-CALLER | 容器定义，无额外事件 | OP-FILTER-APPLY、OP-FILTER-RESET |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OpportunityWorkspace.vue / showErpImport | 向Dialogs转发erpImportOpen；UI只关显示，不取消桥接/POST。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / showCreate | 转发createOpen；父form仍在，关闭不会重置。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / showDecision | 转发decisionOpen；正常P15无详情，本字段按P18排除，不算列表业务输入。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / erpImportLimit | ERP数量默认200，子number required min1 max500；父同名转发非第二个独立数量输入。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / decisionReason | P18决定原因转发/子输入，正常列表排除；不可当P15批量原因。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / batchAssigneeId | assign专属required select，使用memberOptions真实id；打开清空，review/archive body为null。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspace.vue / batchReason | 批量textarea required maxlength1000；提交trim且非空才执行，每次openBatch清空。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / erpImportLimit | ERP数量默认200，子number required min1 max500；父同名转发非第二个独立数量输入。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / form.name | 手工名称required maxlength200；父默认空；客户端原值不trim，服务端另验。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / form.market | 手工市场required maxlength40，默认US；独立于列表filters.market。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / form.category | 可选分类maxlength80；提交空转null，不trim。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / form.source_topic_id | 可选主题ID maxlength36；挂载query可预填；提交空转null，合法UUID与范围由服务另验。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityWorkspaceDialogs.vue / decisionReason | P18决定原因转发/子输入，正常列表排除；不可当P15批量原因。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.market | 市场maxlength40草稿，非空入URL/query；不是仅限US枚举。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.decision_status | pending/adopted/observing/rejected，仅all显示；但syncListRoute在所有view读非空URL，load仍发送隐藏值。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.coverage_status | insufficient/partial/complete，空表示无该条件；不得把覆盖完整当可采纳。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.blocking_reason | evidence_insufficient/recommendation_insufficient或空；不新增其他阻断规则。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.lifecycle_status | candidate/validating/ready/adopted/observing/rejected/archived或空；归档可筛查不等于恢复写入。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.owner_id | memberOptions实际id或空；名单失败清空并提示，不宣称零成员。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |
| OpportunityListPanel.vue / filters.q | 关键词maxlength200草稿；apply重建URL，reset清空；activeFilterCount当前读草稿。 | 字段当前校验和图稿提案分别保留；每字段错误/焦点/软键盘/禁用/跨路由与真实Vue均待验。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / create-open | business-dialog-container / related-scene-only | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / erp-open | business-dialog-container / related-scene-only | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / adopt | business-dialog-container / route-excluded-reference | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / observe | business-dialog-container / route-excluded-reference | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / OpportunityWorkspaceDialogs.1 / reject | business-dialog-container / route-excluded-reference | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / dialog.1 / assign-open | native-dialog / matching-dialog-scene | [assign-open · 1440](design/opportunity-direction-c/1440-assign-open.png) / [assign-open · 390](design/opportunity-direction-c/390-assign-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / dialog.1 / review-open | native-dialog / matching-dialog-scene | [review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / dialog.1 / archive-open | native-dialog / matching-dialog-scene | [archive-open · 1440](design/opportunity-direction-c/1440-archive-open.png) / [archive-open · 390](design/opportunity-direction-c/390-archive-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / form.1 / assign-edited | form-container / matching-dialog-scene | [assign-edited · 1440](design/opportunity-direction-c/1440-assign-edited.png) / [assign-edited · 390](design/opportunity-direction-c/390-assign-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / form.1 / review-edited | form-container / matching-dialog-scene | [review-edited · 1440](design/opportunity-direction-c/1440-review-edited.png) / [review-edited · 390](design/opportunity-direction-c/390-review-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / form.1 / archive-edited | form-container / matching-dialog-scene | [archive-edited · 1440](design/opportunity-direction-c/1440-archive-edited.png) / [archive-edited · 390](design/opportunity-direction-c/390-archive-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / aside.1 / review-open | inline-aside / related-scene-only | [review-open · 1440](design/opportunity-direction-c/1440-review-open.png) / [review-open · 390](design/opportunity-direction-c/390-review-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / aside.2 / archive-open | inline-aside / related-scene-only | [archive-open · 1440](design/opportunity-direction-c/1440-archive-open.png) / [archive-open · 390](design/opportunity-direction-c/390-archive-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / AuditedReasonDialog.1 / AI-approved | native-reason-dialog / route-excluded-reference | [approved-filled · 1440](design/review-direction-c/1440-approved-filled.png) / [approved-filled · 390](design/review-direction-c/390-approved-filled.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspace.vue / AuditedReasonDialog.1 / AI-rejected | native-reason-dialog / route-excluded-reference | [rejected-filled · 1440](design/review-direction-c/1440-rejected-filled.png) / [rejected-filled · 390](design/review-direction-c/390-rejected-filled.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.1 / erp-open | native-dialog / matching-dialog-scene | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.1 / erp-closed-busy | native-dialog / related-scene-only | [erp-closed-busy · 1440](design/opportunity-direction-c/1440-erp-closed-busy.png) / [erp-closed-busy · 390](design/opportunity-direction-c/390-erp-closed-busy.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.1 / erp-edited | form-container / matching-dialog-scene | [erp-edited · 1440](design/opportunity-direction-c/1440-erp-edited.png) / [erp-edited · 390](design/opportunity-direction-c/390-erp-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.1 / erp-file-invalid | form-container / matching-dialog-scene | [erp-file-invalid · 1440](design/opportunity-direction-c/1440-erp-file-invalid.png) / [erp-file-invalid · 390](design/opportunity-direction-c/390-erp-file-invalid.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / aside.1 / erp-open | inline-aside / related-scene-only | [erp-open · 1440](design/opportunity-direction-c/1440-erp-open.png) / [erp-open · 390](design/opportunity-direction-c/390-erp-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.2 / create-open | native-dialog / matching-dialog-scene | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.2 / create-edited | form-container / matching-dialog-scene | [create-edited · 1440](design/opportunity-direction-c/1440-create-edited.png) / [create-edited · 390](design/opportunity-direction-c/390-create-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.2 / create-failed | form-container / matching-dialog-scene | [create-failed · 1440](design/opportunity-direction-c/1440-create-failed.png) / [create-failed · 390](design/opportunity-direction-c/390-create-failed.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / aside.2 / create-open | inline-aside / related-scene-only | [create-open · 1440](design/opportunity-direction-c/1440-create-open.png) / [create-open · 390](design/opportunity-direction-c/390-create-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / adopt | native-dialog / route-excluded-reference | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / observe | native-dialog / route-excluded-reference | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / dialog.3 / reject | native-dialog / route-excluded-reference | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.3 / adopt | form-container / route-excluded-reference | [adopt-empty · 1440](design/opportunity-detail-direction-c/1440-adopt-empty.png) / [adopt-empty · 390](design/opportunity-detail-direction-c/390-adopt-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.3 / observe | form-container / route-excluded-reference | [observe-empty · 1440](design/opportunity-detail-direction-c/1440-observe-empty.png) / [observe-empty · 390](design/opportunity-detail-direction-c/390-observe-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / form.3 / reject | form-container / route-excluded-reference | [reject-empty · 1440](design/opportunity-detail-direction-c/1440-reject-empty.png) / [reject-empty · 390](design/opportunity-detail-direction-c/390-reject-empty.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityWorkspaceDialogs.vue / aside.3 / decision-impact | inline-aside / route-excluded-reference | [observe-edited · 1440](design/opportunity-detail-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/opportunity-detail-direction-c/390-observe-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityListPanel.vue / ResponsiveFilterDrawer.1 / filter-open | responsive-filter / proposal-shape-differs | [filter-open · 1440](design/opportunity-direction-c/1440-filter-open.png) / [filter-open · 390](design/opportunity-direction-c/390-filter-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityListPanel.vue / ResponsiveFilterDrawer.1 / filter-edited | responsive-filter / proposal-shape-differs | [filter-edited · 1440](design/opportunity-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/opportunity-direction-c/390-filter-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityListPanel.vue / form.1 / filter-open | form-container / proposal-shape-differs | [filter-open · 1440](design/opportunity-direction-c/1440-filter-open.png) / [filter-open · 390](design/opportunity-direction-c/390-filter-open.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |
| OpportunityListPanel.vue / form.1 / filter-edited | form-container / proposal-shape-differs | [filter-edited · 1440](design/opportunity-direction-c/1440-filter-edited.png) / [filter-edited · 390](design/opportunity-direction-c/390-filter-edited.png) | 结构容器和场景关联不等于独立业务弹窗或运行验收；长窗/全主题/逐控件六态/异步生命周期尚待逐项验证。 |

### 明确保留的边界

- 27页面动作组的162个代表视觉槽未逐selector映射；现126PNG为60双端主场景+6长窗下部，不是全部控件/动态行/主题覆盖。
- 确认源记忆两ID但仅提交当前items一条；原型有效范围提示与隐藏选择保护待批准和实现，不新增跨页批量规则。
- 本轮实际confirmBatch惰性VM：向A提交review后关闭，重开archive并选B；旧结果返回仍关新窗并清B选择，原POST的A/action/reason保持稳定。与P13逐项body变更不同，非挂载Vue或真实事务证据。
- 非all深链decision_status仍写入filters且load遍历所有非空筛选；字段隐藏不等于条件清空。activeFilterCount读草稿、图片无error handler等提案差异保持未修。
- ERP浏览器/JSON导入、手工添加与P16创建选品不可合并；实际服务、请求结果核对、真实权限/事务/幂等以及完整具体图审仍待办。
- 四组件67源位置包含P18正常入口排除，父/Dialogs和P18共50源位置不得重复加到全站独立分母；只有List13/Readiness4为本轮新增全局源位置。
- 20个v-model位置包含5个父forward和P18原因，不是20个独立用户字段；checkbox/file input/details由动作另审。17结构容器/多场景关联不等于业务弹窗数量。
- UiStatePanel主次事件均已核对；异常主标签与apply行为分开，次按钮返回机会列表实际reset。ResponsiveFilterDrawer内部按钮/遮罩/Tab/Escape不由单个调用验收。
- 父opportunity-workspace传opportunityId或undefined及capabilities/common；路由reset_on_scope存在，但局部load缺read代次/Abort。不能从局部缺watch推断整站无范围隔离。
- useModalDialog处理原生show/close/Escape/焦点归还，未增加busy或请求取消；全部列表→详情/离开/重开/同tick及迟到成功继续待实际Vue验证。

## P16 局部动作与共享消费者

[逐项机器清单](action-reviews/P16.json)：10个局部源位置 → 8组；2类写入，8组路由动作，0组转发/容器关联不重复计动作。5个本地v-model，3处调用/内嵌容器，11个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有0个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| J-NAV-LIST 返回机会列表 / navigation | 1处；input、running、terminal、busy | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png)、[running · 1440](design/journey-direction-c/1440-running.png) / [running · 390](design/journey-direction-c/390-running.png)；其余见JSON | deactivate保护读取，不阻断已发POST；离开后的成功归属必须独立验证。 当前源码链接不禁用、无本地提交忙碌态；缺返回ID时入口不渲染，不伪造disabled。 |
| J-STATE-RECOVERY 状态面板主次恢复 / local | 1处；restore-failed、restore-expired、restore-forbidden、restore-blocked、read-failed、read-expired、read-forbidden、read-blocked、create-failed | [restore-failed · 1440](design/journey-direction-c/1440-restore-failed.png) / [restore-failed · 390](design/journey-direction-c/390-restore-failed.png)、[restore-expired · 1440](design/journey-direction-c/1440-restore-expired.png) / [restore-expired · 390](design/journey-direction-c/390-restore-expired.png)；其余见JSON | 两个事件均保留；无journey/resumeId时共享重新登录等文案不改变reset行为；恢复副说明不是鉴权修复，真实401/403/存储异常待验。 代表视觉映射只覆盖重试主按钮，副按钮另有4态；无ID时主动作reset，error副动作history.back，expired无副按钮，blocked/forbidden仅说明。图稿的重试忙碌禁用和无ID时“重新输入”文案为待审改进，不宣称Vue已有。 |
| J-CREATE 提交三类选品线索 / write | 2处；keyword、asin、product_url、invalid、busy、failed、late-inactive-success | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png)、[asin · 1440](design/journey-direction-c/1440-asin.png) / [asin · 390](design/journey-direction-c/390-asin.png)；其余见JSON | 源函数隔离证实deactivate后旧成功仍applyJourney并写内存替身活动ID，active=false时不设timer；未认证真实缓存/多标签，原未知错误文案未创建不代表无持久化。 |
| J-SOURCE 查看候选原文 / navigation | 1处；selected、unselected、no-topic、missing-fields、long-result | [results · 1440](design/journey-direction-c/1440-results.png) / [results · 390](design/journey-direction-c/390-results.png)、[selected · 1440](design/journey-direction-c/1440-selected.png) / [selected · 390](design/journey-direction-c/390-selected.png)；其余见JSON | click.stop只停冒泡，不自动证明label默认激活被取消；原型把来源链接与radio分离，仍需实际鼠标/键盘验收。 当前源码链接不禁用、无本地提交忙碌态；缺返回ID时入口不渲染，不伪造disabled。 |
| J-DECIDE 保存三种审计决定 / write | 2处；adopt-contract-pending、observe、reject、empty-reason、failed、success-after-error、deadline-running | [adoption-pending · 1440](design/journey-direction-c/1440-adoption-pending.png) / [adoption-pending · 390](design/journey-direction-c/390-adoption-pending.png)、[observe-edited · 1440](design/journey-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/journey-direction-c/390-observe-edited.png)；其余见JSON | 统一采纳规则及成功清错已落实c31fddc7；r2图与按钮仍非生产视觉。真实SQL竞争、权限、失活后写归属/草稿生命周期、全部决定变体控件六态仍待验。 |
| J-NAV-OPPORTUNITY 查看返回机会 / navigation | 1处；returned-id、missing-id | [adopt-decided · 1440](design/journey-direction-c/1440-adopt-decided.png) / [adopt-decided · 390](design/journey-direction-c/390-adopt-decided.png)、[decided-no-links · 1440](design/journey-direction-c/1440-decided-no-links.png) / [decided-no-links · 390](design/journey-direction-c/390-decided-no-links.png)；其余见JSON | 合格fixture返回ID对应链接已原型核对，不代表实际机会访问权限或生产导航已验证。 当前源码链接不禁用、无本地提交忙碌态；缺返回ID时入口不渲染，不伪造disabled。 |
| J-NAV-TASK 打开返回验证任务 / navigation | 1处；observe、reject、no-task | [observe-decided · 1440](design/journey-direction-c/1440-observe-decided.png) / [observe-decided · 390](design/journey-direction-c/390-observe-decided.png)、[reject-decided · 1440](design/journey-direction-c/1440-reject-decided.png) / [reject-decided · 390](design/journey-direction-c/390-reject-decided.png)；其余见JSON | 请求成功不证明任务执行或消息送达；没有返回ID不补造。 当前源码链接不禁用、无本地提交忙碌态；缺返回ID时入口不渲染，不伪造disabled。 |
| J-RESET 开始下一次 / local | 1处；running、read-busy、terminal、decided、busy-disabled | [running · 1440](design/journey-direction-c/1440-running.png) / [running · 390](design/journey-direction-c/390-running.png)、[read-busy · 1440](design/journey-direction-c/1440-read-busy.png) / [read-busy · 390](design/journey-direction-c/390-read-busy.png)；其余见JSON | 重置保留旧原因已确认；原型清理是待审提案，不能扩充浏览器持久化；写入晚到、storage异常与旧requestId展示仍待验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| SelectionJourney.vue / form.input_kind | keyword/asin/product_url三radio，默认keyword；切类型保留input_value；没有Provider选择。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.input_value | required maxlength200；keyword text，asin pattern十位字母数字，product_url type=url；原生URL不保证HTTPS/无账号/hash，服务端独立验证，原值发送后服务trim。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / selectedResultId | 动态候选ID单选，results优先/first_result回退，单条自动选；资格跟随选中对象，缺topic或未评估不禁候选radio但禁adopt。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / decision.action | adopt/observe/reject默认observe；adopt按canAdopt，选中后换不合格候选仍保留action但函数/按钮阻断；reset仍保留旧action。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / decision.reason | required maxlength1000，前端原值服务trim；失败保留，成功清空；reset保留旧原因，未与输入字段关联错误。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| SelectionJourney.vue / form.1 / keyword | form-container / matching-inline-form-scene | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.1 / asin | form-container / matching-inline-form-scene | [asin · 1440](design/journey-direction-c/1440-asin.png) / [asin · 390](design/journey-direction-c/390-asin.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.1 / url | form-container / matching-inline-form-scene | [url · 1440](design/journey-direction-c/1440-url.png) / [url · 390](design/journey-direction-c/390-url.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / aside.1 / keyword | inline-aside / related-scene-only | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / observe-edited | form-container / matching-inline-form-scene | [observe-edited · 1440](design/journey-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/journey-direction-c/390-observe-edited.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / reject-edited | form-container / matching-inline-form-scene | [reject-edited · 1440](design/journey-direction-c/1440-reject-edited.png) / [reject-edited · 390](design/journey-direction-c/390-reject-edited.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / adoption-pending | form-container / related-scene-only | [adoption-pending · 1440](design/journey-direction-c/1440-adoption-pending.png) / [adoption-pending · 390](design/journey-direction-c/390-adoption-pending.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / adopt-ready | form-container / matching-inline-form-scene | [adopt-ready · 1440](design/journey-direction-c/1440-adopt-ready.png) / [adopt-ready · 390](design/journey-direction-c/390-adopt-ready.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / gate-cost | form-container / matching-inline-form-scene | [gate-cost · 1440](design/journey-direction-c/1440-gate-cost.png) / [gate-cost · 390](design/journey-direction-c/390-gate-cost.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / adopt-conflict | form-container / matching-inline-form-scene | [adopt-conflict · 1440](design/journey-direction-c/1440-adopt-conflict.png) / [adopt-conflict · 390](design/journey-direction-c/390-adopt-conflict.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / adopt-refreshed | form-container / matching-inline-form-scene | [adopt-refreshed · 1440](design/journey-direction-c/1440-adopt-refreshed.png) / [adopt-refreshed · 390](design/journey-direction-c/390-adopt-refreshed.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |

### 明确保留的边界

- r2重拍67全页场景及102代表控件状态双端共338PNG；8动作组40适用视觉槽已映射，8导航禁用/忙碌不适用；采纳radio6态及恢复副按钮4态不新增动作组，完整输入/动态变体仍待审核。
- 用户明确通过P16 r2整体布局，非全页/全控件批准。统一门在c31fddc7已实现，缺门/可采纳/忙碌/冲突/刷新/成功图为隔离fixture，不证明SQL或生产事实。
- 既有create失活后晚到成功仍更新journey/活动ID的源证据不被本轮注销；r2内存ticket保护与reset清草稿仍是待审提案，不等于Vue已有。
- 同一decide表单签名不变但语义已变；当前源成功state=ready，reset继续保留旧原因，字段busy锁及错误关联提案尚未整体落地。
- 2秒轮询、180000ms、三能力、任务终态、真实数据/DB/RBAC与完整浏览器生命周期仍沿原约束；全局分母未冻结。
- r2追加：8动作组代表性视觉槽40已映射、8导航不适用、0未映射；这是有限清单，不包括所有主次恢复文案、输入/候选/观察驳回字段、主题密度或真实Vue生命周期。
- 5个源模型的8控件变体已关联fieldVisualReferences，忙碌锁/内联错误/修正清理仅待审提案；未证明全部动态行、主题密度、跨范围/输入法/真实Vue与生产生命周期。
- 共享UiStatePanel两个事件均已核对，异常标签不能当真实导航；源码样式/父壳层完整所有控件另审。
- 五个v-model不等于五个按钮：输入类型三radio、候选动态radio、决定三radio及动态input/原因另列；旧action候选未扫描这些普通模型。
- 父reset_on_scope及mounted/activated去重、deactivated/unmounted清timer/read版本/Abort已有源码；本轮不推翻已有GET生命周期修复，也不宣称全部写入/存储安全。
- 全局单UUID-v4活动ID不按组织/账号分key；storage读取在try外，GET可能触发超时持久化事件。当前隔离测试无真实localStorage/HTTP/SQL，不等于后端纯只读。

## P17 局部动作与共享消费者

[逐项机器清单](action-reviews/P17.json)：28个局部源位置 → 19组；2类写入，16组路由动作，3组转发/容器关联不重复计动作。9个本地v-model，8处调用/内嵌容器，30个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有96个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| scoring.create.open 打开新规则草稿 / local | 3处；top-loading-or-error、empty、ready-complete、ready-incomplete | [empty · 1440](design/scoring-direction-c/1440-empty.png) / [empty · 390](design/scoring-direction-c/390-empty.png)、[versions · 1440](design/scoring-direction-c/1440-versions.png) / [versions · 390](design/scoring-direction-c/390-versions.png)；其余见JSON | 三个入口不能省略；read/approve-only的当前仅可查看文案不代表没有审批能力；页面异常创建入口仍存在。 |
| scoring.list.retry 重读版本目录 / read | 1处；loading、error、expired、forbidden、blocked | [versions · 1440](design/scoring-direction-c/1440-versions.png) / [versions · 390](design/scoring-direction-c/390-versions.png)、[empty · 1440](design/scoring-direction-c/1440-empty.png) / [empty · 390](design/scoring-direction-c/390-empty.png)；其余见JSON | 当前48图无页面级全部错误/恢复图，引用只是相关列表；共享重新登录/返回工作台标签不是实际导航；旧GET结果归属未保护。 |
| scoring.preview.open 打开发布影响预览 / read | 1处；draft、pending_approval、approved、busy-ignored | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)、[preview-loading · 1440](design/scoring-direction-c/1440-preview-loading.png) / [preview-loading · 390](design/scoring-direction-c/390-preview-loading.png)；其余见JSON | 关闭A读取中再请求B会早退；本轮隔离证实只发A且旧结果存入已关闭预览，不宣称B被读取。无read token/Abort，不当作安全切换已完成。 |
| scoring.action.submit.open 打开提交审批原因 / local | 1处；allowed-state、denied-hidden、reopen、while-other-write | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png)、[action-busy · 1440](design/scoring-direction-c/1440-action-busy.png) / [action-busy · 390](design/scoring-direction-c/390-action-busy.png)；其余见JSON | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| scoring.action.approve.open 打开批准原因 / local | 1处；allowed-state、denied-hidden、reopen、while-other-write | [approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png)、[action-busy · 1440](design/scoring-direction-c/1440-action-busy.png) / [action-busy · 390](design/scoring-direction-c/390-action-busy.png)；其余见JSON | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| scoring.action.reject.open 打开拒绝原因 / local | 1处；allowed-state、denied-hidden、reopen、while-other-write | [reject · 1440](design/scoring-direction-c/1440-reject.png) / [reject · 390](design/scoring-direction-c/390-reject.png)、[action-busy · 1440](design/scoring-direction-c/1440-action-busy.png) / [action-busy · 390](design/scoring-direction-c/390-action-busy.png)；其余见JSON | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| scoring.action.activate.open 打开启用原因 / local | 1处；allowed-state、denied-hidden、reopen、while-other-write | [activate · 1440](design/scoring-direction-c/1440-activate.png) / [activate · 390](design/scoring-direction-c/390-activate.png)、[action-busy · 1440](design/scoring-direction-c/1440-action-busy.png) / [action-busy · 390](design/scoring-direction-c/390-action-busy.png)；其余见JSON | 不同生命周期需分别审查；打开不执行写入，须required原因及确认。服务端版本/状态/权限另验。 |
| scoring.action.rollback.open 打开回滚原因 / local | 1处；allowed-state、denied-hidden、reopen、while-other-write | [rollback · 1440](design/scoring-direction-c/1440-rollback.png) / [rollback · 390](design/scoring-direction-c/390-rollback.png)、[action-busy · 1440](design/scoring-direction-c/1440-action-busy.png) / [action-busy · 390](design/scoring-direction-c/390-action-busy.png)；其余见JSON | 不同生命周期需分别审查；目标仅列表approved/retired，旧active变rolled_back，目标active；不是历史评分回退。服务端版本/状态/权限另验。 |
| scoring.create.close 关闭创建草稿 / local | 3处；close、cancel、escape、busy-close | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png)、[create-risk · 1440](design/scoring-direction-c/1440-create-risk.png) / [create-risk · 390](design/scoring-direction-c/390-create-risk.png)；其余见JSON | 创建取消与生命周期重开清原因不是相同草稿规则；旧成功可能清新编辑，待实例归属验收。 |
| scoring.create.submit 保存正权重规则草稿 / write | 2处；invalid-threshold、less-than-two、weight-total、missing-required、valid、failed、saved | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png)、[create-market_demand · 1440](design/scoring-direction-c/1440-create-market_demand.png) / [create-market_demand · 390](design/scoring-direction-c/390-create-market_demand.png)；其余见JSON | 源六阶段校验隔离通过，不预填业务值；仅初始八维编辑图，完整有效/失败/提交成功图缺失；维度成员对象引用与成功清理/后续load不在busy内待验。 |
| scoring.preview.close 关闭影响预览 / local | 2处；close、escape、inflight | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)、[preview-loading · 1440](design/scoring-direction-c/1440-preview-loading.png) / [preview-loading · 390](design/scoring-direction-c/390-preview-loading.png)；其余见JSON | 旧GET仍能写preview；已隔离验证，不等于新目标被污染或真实数据库产生写入。 |
| scoring.preview.retry 重新试算第1页 / read | 1处；after-error、failed-page-two | [preview-error · 1440](design/scoring-direction-c/1440-preview-error.png) / [preview-error · 390](design/scoring-direction-c/390-preview-error.png)、[preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)；其余见JSON | 仅第1页样本图，不覆盖真实第2页失败；missing_fields与page_summary.unchanged源模板未呈现，图也未穷尽缺失组合。 |
| scoring.preview.previous 预览上一页 / read | 1处；first-disabled、later-page | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)；其余见JSON | 当前48图只有单页样本，不能用双禁用按钮证明实际第二页导航/返回及内容保持。 |
| scoring.preview.next 预览下一页 / read | 1处；last-disabled、has-next | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)；其余见JSON | 21条20/1的历史Vue合同测试存在但本轮未重跑，图稿缺真实多页内容；页摘要非全量影响。 |
| scoring.action.close 关闭生命周期原因 / local | 3处；submit、approve、reject、activate、rollback、busy-close | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png)、[approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png)；其余见JSON | 旧请求成功可关闭新原因窗；全busy关闭与焦点契约仍待实际Vue验证。 |
| scoring.action.submit 提交五种生命周期动作 / write | 2处；submit、approve、reject、activate、rollback、conflict、busy、late-result | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png)、[approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png)；其余见JSON | 隔离证实A approve等待时改B reject，旧body仍A/approve/revision3，成功关B并显示拒绝已完成；不是后端真的拒绝。未知post未写入文案非事务证据，成功重读失败也不冒充整链成功。 |
| scoring.create.definition 原生弹窗定义关联 / wiring | 1处；create-basics | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png)；其余见JSON | 原生焦点/取消不自动认证长窗、全部主题和进行中重开。 |
| scoring.preview.definition 原生弹窗定义关联 / wiring | 1处；preview | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png)；其余见JSON | 原生焦点/取消不自动认证长窗、全部主题和进行中重开。 |
| scoring.action.definition 原生弹窗定义关联 / wiring | 1处；submit、approve、reject、activate、rollback | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png)、[approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png)；其余见JSON | 原生焦点/取消不自动认证长窗、全部主题和进行中重开。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| scoring.create.definition | 容器定义，无额外事件 | scoring.create.close、scoring.create.submit |
| scoring.preview.definition | 容器定义，无额外事件 | scoring.preview.close、scoring.preview.open、scoring.preview.retry、scoring.preview.previous、scoring.preview.next |
| scoring.action.definition | 容器定义，无额外事件 | scoring.action.close、scoring.action.submit |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| ScoreRuleConsole.vue / form.version_code | version_code required maxlength64，初始空；createValidation只查trim非空，服务版本代码字符规则未复制到浏览器pattern。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.name | name required maxlength160，初始空；前端提交原值，服务trim。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.recommend_min | recommend_min初始null，number0..100 step0.01；必填且大于observe_min，不预填默认业务阈值。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.observe_min | observe_min初始null，number0..100 step0.01；低于recommend_min，真实值由用户填写。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / item.weight | 八代码维度各有weight，初始0，number0..100 step0.01；只提交正权重，至少两维且总和四舍五入两位等于100。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / item.evidence_group | 八维各有market/competition/cost/other证据组，初始other；只随正权重维度提交，不自动赋予真实来源。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / item.required | 八维各有required checkbox初始false；至少一个正权重维度为true，零权重required不满足。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / reason | 五生命周期共用reason required maxlength1000；begin清空、close不清、失败保留，runAction原值发送，服务trim。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / targetRuleId | 仅rollback required select，目标来自当前目录approved/retired；begin清空，服务再验同范围，不新增下拉目标。 | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| ScoreRuleConsole.vue / dialog.1 / create-basics | native-dialog / matching-dialog-scene | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-basics | form-container / matching-dialog-scene | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-market_demand | form-container / matching-dialog-scene | [create-market_demand · 1440](design/scoring-direction-c/1440-create-market_demand.png) / [create-market_demand · 390](design/scoring-direction-c/390-create-market_demand.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-competition | form-container / matching-dialog-scene | [create-competition · 1440](design/scoring-direction-c/1440-create-competition.png) / [create-competition · 390](design/scoring-direction-c/390-create-competition.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-profit | form-container / matching-dialog-scene | [create-profit · 1440](design/scoring-direction-c/1440-create-profit.png) / [create-profit · 390](design/scoring-direction-c/390-create-profit.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-fulfillment_efficiency | form-container / matching-dialog-scene | [create-fulfillment_efficiency · 1440](design/scoring-direction-c/1440-create-fulfillment_efficiency.png) / [create-fulfillment_efficiency · 390](design/scoring-direction-c/390-create-fulfillment_efficiency.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-customer_experience | form-container / matching-dialog-scene | [create-customer_experience · 1440](design/scoring-direction-c/1440-create-customer_experience.png) / [create-customer_experience · 390](design/scoring-direction-c/390-create-customer_experience.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-content_fit | form-container / matching-dialog-scene | [create-content_fit · 1440](design/scoring-direction-c/1440-create-content_fit.png) / [create-content_fit · 390](design/scoring-direction-c/390-create-content_fit.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-risk | form-container / matching-dialog-scene | [create-risk · 1440](design/scoring-direction-c/1440-create-risk.png) / [create-risk · 390](design/scoring-direction-c/390-create-risk.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.1 / create-data_quality | form-container / matching-dialog-scene | [create-data_quality · 1440](design/scoring-direction-c/1440-create-data_quality.png) / [create-data_quality · 390](design/scoring-direction-c/390-create-data_quality.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.1 / create-basics | inline-aside / related-scene-only | [create-basics · 1440](design/scoring-direction-c/1440-create-basics.png) / [create-basics · 390](design/scoring-direction-c/390-create-basics.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.2 / preview | native-dialog / matching-dialog-scene | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.2 / preview-loading | native-dialog / matching-dialog-scene | [preview-loading · 1440](design/scoring-direction-c/1440-preview-loading.png) / [preview-loading · 390](design/scoring-direction-c/390-preview-loading.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.2 / preview-error | native-dialog / matching-dialog-scene | [preview-error · 1440](design/scoring-direction-c/1440-preview-error.png) / [preview-error · 390](design/scoring-direction-c/390-preview-error.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.2 / preview | inline-aside / related-scene-only | [preview · 1440](design/scoring-direction-c/1440-preview.png) / [preview · 390](design/scoring-direction-c/390-preview.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.3 / submit | native-dialog / matching-dialog-scene | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.3 / approve | native-dialog / matching-dialog-scene | [approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.3 / reject | native-dialog / matching-dialog-scene | [reject · 1440](design/scoring-direction-c/1440-reject.png) / [reject · 390](design/scoring-direction-c/390-reject.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.3 / activate | native-dialog / matching-dialog-scene | [activate · 1440](design/scoring-direction-c/1440-activate.png) / [activate · 390](design/scoring-direction-c/390-activate.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / dialog.3 / rollback | native-dialog / matching-dialog-scene | [rollback · 1440](design/scoring-direction-c/1440-rollback.png) / [rollback · 390](design/scoring-direction-c/390-rollback.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.2 / submit | form-container / matching-dialog-scene | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.2 / approve | form-container / matching-dialog-scene | [approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.2 / reject | form-container / matching-dialog-scene | [reject · 1440](design/scoring-direction-c/1440-reject.png) / [reject · 390](design/scoring-direction-c/390-reject.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.2 / activate | form-container / matching-dialog-scene | [activate · 1440](design/scoring-direction-c/1440-activate.png) / [activate · 390](design/scoring-direction-c/390-activate.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / form.2 / rollback | form-container / matching-dialog-scene | [rollback · 1440](design/scoring-direction-c/1440-rollback.png) / [rollback · 390](design/scoring-direction-c/390-rollback.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.3 / submit | inline-aside / related-scene-only | [submit · 1440](design/scoring-direction-c/1440-submit.png) / [submit · 390](design/scoring-direction-c/390-submit.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.3 / approve | inline-aside / related-scene-only | [approve · 1440](design/scoring-direction-c/1440-approve.png) / [approve · 390](design/scoring-direction-c/390-approve.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.3 / reject | inline-aside / related-scene-only | [reject · 1440](design/scoring-direction-c/1440-reject.png) / [reject · 390](design/scoring-direction-c/390-reject.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.3 / activate | inline-aside / related-scene-only | [activate · 1440](design/scoring-direction-c/1440-activate.png) / [activate · 390](design/scoring-direction-c/390-activate.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| ScoreRuleConsole.vue / aside.3 / rollback | inline-aside / related-scene-only | [rollback · 1440](design/scoring-direction-c/1440-rollback.png) / [rollback · 390](design/scoring-direction-c/390-rollback.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |

### 明确保留的边界

- 16页面动作×6=96视觉槽未逐selector映射。48图只有24双端场景，缺列表完整异常、有效创建/提交失败成功、多页预览/缺失字段、全部操作失败长窗/主题密度图。
- 本轮源computed校验六阶段通过、正权重过滤body2维；不是完整服务校验或真实创建。仍不填默认权重/阈值，不新增停用按钮。
- 本轮实际runAction/begin/closeAction惰性VM：A approve请求等待时B reject替换当前状态，原body稳定但成功关B窗并显示拒绝已完成。需本次动作快照和结果归属验收；没有真实批准或拒绝记录。
- 实际loadPreview/closePreview惰性VM：A读取中关闭再开B被previewing早退，晚到A存入关闭态；仅一次A GET意图，不是B错误试算。实际Vue/缓存重入仍待验。
- missing_fields和page_summary.unchanged服务字段未在源模板展示，C稿缺失样本未列出不等于覆盖有值场景；既有评分输入/历史运行/审批权限、事务、queueAll与生产未验证。
- QualityGateSetupSummary仅展示父投影与slot；risk正权重和market/competition/cost证据组是规则配置，非机会事实质量门。
- 9模型位置展开为30输入实例：四基本+八维各三+原因与回滚目标；不能用9个默认图填30字段/各态验收。
- UiStatePanel只消费primary load，secondary即使显示也没有本页handler；所有异常具体图与恢复链待补。
- useModalDialog复用原生show/close/Escape/焦点归还，不自动锁busy或取消请求；post的busy只到请求结束，后续load和新begin可并行。
- 父reset_on_scope与真实capabilities传参存在；本组件只有onMounted load，没有active/GET代次/预览Abort。局部风险不等于跨租户服务失守。

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

## P19 局部动作与共享消费者

[逐项机器清单](action-reviews/P19.json)：39个局部源位置 → 22组；5类写入，18组路由动作，2组转发/容器关联不重复计动作。10个本地v-model，7处调用/内嵌容器，22个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有20个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| CP-P20-REGION-EXCLUDED P20规则目录区域排除 / excluded | 4处；P20页首、P20返回、P20恢复事件、P20规则空入口 | [rules · 1440](design/competitor-direction-c/1440-rules.png) / [rules · 390](design/competitor-direction-c/390-rules.png)、[rules-empty · 1440](design/competitor-direction-c/1440-rules-empty.png) / [rules-empty · 390](design/competitor-direction-c/390-rules-empty.png)；其余见JSON | 只排除该固定路由内正常区域；不删除共享源；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-RULE-NAV 查看规则 / 配置阈值 / 当前竞品规则 / navigation | 3处；无启用规则manager、只读查看全部、当前竞品管理者、当前竞品只读 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[readonly · 1440](design/competitor-direction-c/1440-readonly.png) / [readonly · 390](design/competitor-direction-c/390-readonly.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。导航仅有默认/hover/focus/pressed四态；源码没有disabled或请求busy，不造状态。未覆盖所有来源、权限、长文本/主题及真实页面跳转后的运行。 |
| CP-CREATE-OPEN 添加竞品入口 / local | 2处；有规则页首、无规则次级、打开后继续已有实例字段 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[empty · 1440](design/competitor-direction-c/1440-empty.png) / [empty · 390](design/competitor-direction-c/390-empty.png)；其余见JSON | 已补本页精确控件和背景，详见COMPETITOR-ENTRY-QUERY-REVIEW；尚未批准，不代表所有字段/主题/真实Vue。打开及前两步下一步只四态，不伪造busy；P20 create=1关闭回规则标题为无来源入口的离线焦点提案，routePreview不是真实路由。提交期间关闭/上一步锁定仍为提案；双query弹窗优先级、真实异步完成/失败及生命周期仍待。 |
| CP-STATE-RECOVERY 列表异常状态主次恢复 / read | 1处；loading无按钮、empty管理者/只读、error重试/返回、expired仅登录、forbidden主次到home、blocked重读/回home | [loading · 1440](design/competitor-direction-c/1440-loading.png) / [loading · 390](design/competitor-direction-c/390-loading.png)、[empty · 1440](design/competitor-direction-c/1440-empty.png) / [empty · 390](design/competitor-direction-c/390-empty.png)；其余见JSON | 已补按页面和主次按钮独立的四态额外变体，详见COMPETITOR-RECOVERY-STATE-REVIEW；不将同一CP-STATE-RECOVERY跨页覆盖代表键。代表槽状态本批不提升，source loading隐藏footer，不伪造disabled/busy按钮。仍缺全部主题/密度/真实浏览器history和完整fullPath组合、实际异步恢复、真实Vue与用户批准。 |
| CP-SEARCH-RECOVERY 无匹配结果主次操作 / read | 1处；清空搜索、管理者添加、只读刷新 | [search-empty · 1440](design/competitor-direction-c/1440-search-empty.png) / [search-empty · 390](design/competitor-direction-c/390-search-empty.png)、[create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png)；其余见JSON | 已补按页面和主次按钮独立的四态额外变体，详见COMPETITOR-RECOVERY-STATE-REVIEW；不将同一CP-STATE-RECOVERY跨页覆盖代表键。代表槽状态本批不提升，source loading隐藏footer，不伪造disabled/busy按钮。仍缺全部主题/密度/真实浏览器history和完整fullPath组合、实际异步恢复、真实Vue与用户批准。 |
| CP-DETAIL 选择并读取竞品详情 / read | 1处；普通行、当前行重复点击、深链被搜索排除时保留、部分字段、旧读取成功/失败 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[deep-link · 1440](design/competitor-direction-c/1440-deep-link.png) / [deep-link · 390](design/competitor-direction-c/390-deep-link.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。主图为未选中第二对象，另列已选中第一对象。源不因busy禁用，未伪造disabled/busy图；这两槽仍未标通过。真实读代次/历史与KeepAlive独立验收。 |
| CP-SOURCE 打开外部商品来源 / navigation | 2处；详情头来源、首采无快照来源 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[terminal · 1440](design/competitor-direction-c/1440-terminal.png) / [terminal · 390](design/competitor-direction-c/390-terminal.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。导航仅有默认/hover/focus/pressed四态；源码没有disabled或请求busy，不造状态。未覆盖所有来源、权限、长文本/主题及真实页面跳转后的运行。 |
| CP-COLLECT 立即采集 / 首次采集重试 / write | 1处；有快照立即采集、无快照重试、pending禁用、paused禁用、采集受阻、切对象晚到成功/失败 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[terminal · 1440](design/competitor-direction-c/1440-terminal.png) / [terminal · 390](design/competitor-direction-c/390-terminal.png)；其余见JSON | 已补本页代表控件六态的双端实拍与逐selector关联，待用户审核，不是全部变体或实际Vue通过。暂停代表disabled，采集POST在途代表busy；已受理任务pending/running独立，不用旋转标记混作请求提交。其他禁用理由/首次采集/权限/主题仍待。 |
| CP-TOGGLE 暂停 / 恢复监控 / write | 2处；桌面暂停、桌面恢复、移动暂停、移动恢复、busy、冲突 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[paused · 1440](design/competitor-direction-c/1440-paused.png) / [paused · 390](design/competitor-direction-c/390-paused.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。暂停和恢复分别记录；busy指详情内当前提交，明确捕获对象，其他对象只禁写不挂正在提交标记。仅离线pending模型；跨顶部/弹窗写入、终态错误/迟到结果与真实Vue未验。 |
| CP-DELETE-OPEN 打开删除确认 / local | 2处；桌面删除入口、移动更多删除入口、重开清原因 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[more-open · 1440](design/competitor-direction-c/1440-more-open.png) / [more-open · 390](design/competitor-direction-c/390-more-open.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。打开弹窗不是DELETE；disabled/busy代表详情内另一写入在途，不给打开按钮旋转标记。原源桌面直露/移动菜单与新稿统一菜单差异待审。 |
| CP-MORE 移动更多操作 / local | 1处；关闭、展开、键盘展开 | [more-open · 1440](design/competitor-direction-c/1440-more-open.png) / [more-open · 390](design/competitor-direction-c/390-more-open.png)、[control-more-default · 1440](design/competitor-direction-c/1440-control-more-default.png) / [control-more-default · 390](design/competitor-direction-c/390-control-more-default.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。关闭及展开两变体的四态；不增加请求或伪造busy/disabled图，剩余两槽不标完成。桌面菜单是C提案，真实源桌面直露未改。 |
| CP-TASK-LINK 打开本次验证任务 / navigation | 1处；单条变化已建任务、多个变化分别链接 | [alerts-mixed · 1440](design/competitor-direction-c/1440-alerts-mixed.png) / [alerts-mixed · 390](design/competitor-direction-c/390-alerts-mixed.png)、[task-only · 1440](design/competitor-direction-c/1440-task-only.png) / [task-only · 390](design/competitor-direction-c/390-task-only.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。只绑定已有样本返回ID的价格任务链接，四态均为导航，无disabled/busy。评论任务链接、真实任务详情与跨刷新映射仍待。 |
| CP-TASK-CREATE 按变化生成验证任务 / write | 1处；管理者、仅task:create、busy、成功转任务链接、失败 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[task-only · 1440](design/competitor-direction-c/1440-task-only.png) / [task-only · 390](design/competitor-direction-c/390-task-only.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。价格和评论分别用各自change/证据建意图，pending不显示已建任务链接；ID返回后链接另审。详情内写锁和目标提示不证明真实幂等或所有并发写入。 |
| CP-HELP 展开工作流帮助 / local | 1处；收起、展开、键盘 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[control-help-default · 1440](design/competitor-direction-c/1440-control-help-default.png) / [control-help-default · 390](design/competitor-direction-c/390-control-help-default.png)；其余见JSON | 已补本页代表控件的双端精确状态图，待用户审核，不是全变体/主题或真实Vue通过。关闭及展开两变体的四态，Enter/Space保持原生details开合，零请求。不伪造busy/disabled图，剩余两槽不标完成；长文/主题/辅助技术仍待。 |
| CP-CREATE-CONTAINER 创建竞品弹窗定义 / wiring | 1处；步骤1链接、步骤2市场/机会/名称、步骤3确认、失败保留、busy | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png)、[create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png)；其余见JSON | 关闭可在busy中发生；焦点循环/归还尚非真实Vue闭环；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-CREATE-SUBMIT 下一步 / 确认并开始采集 / write | 2处；链接下一步零写入、市场下一步零写入、确认提交、字段非法、失败保留确认步、busy | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png)、[create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png)；其余见JSON | 已补本页代表控件六态的双端实拍与逐selector关联，待用户审核，不是全部变体或实际Vue通过。代表第三步有效确认；前两步下一步、字段/全部错误/主题仍待。disabled与busy共用原busy条件，不新增业务校验禁用。P20 create=1背景不借本图算完成。 |
| CP-CREATE-CLOSE 关闭 / 取消创建 / local | 2处；右上关闭、第1步取消、第2/3步关闭、busy关闭风险 | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png)、[create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。disabled与busy展示已有离线稿的提交期间锁定，真实Vue当前仍可关闭或上一步；不据图宣称已中止请求。P20异常create=1背景仍缺，创建其他步骤/关闭来源组合和实际异步归属需继续验证。 |
| CP-CREATE-PREVIOUS 创建上一步 / local | 1处；市场回链接、确认回市场、busy仍可回退的源差异 | [create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png)、[create-confirm · 1440](design/competitor-direction-c/1440-create-confirm.png) / [create-confirm · 390](design/competitor-direction-c/390-create-confirm.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。disabled与busy展示已有离线稿的提交期间锁定，真实Vue当前仍可关闭或上一步；不据图宣称已中止请求。P20异常create=1背景仍缺，创建其他步骤/关闭来源组合和实际异步归属需继续验证。 |
| CP-RULE-DIALOG-EXCLUDED P19规则表单排除 / excluded | 5处；规则定义、提交与submit、取消与关闭 | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png)、[rule-availability · 1440](design/competitor-direction-c/1440-rule-availability.png) / [rule-availability · 390](design/competitor-direction-c/390-rule-availability.png)；其余见JSON | 保留静态来源但不计P19本地规则写入；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-DELETE-CONTAINER 删除竞品弹窗定义 / wiring | 1处；原因空白、有效原因、版本冲突、busy | [delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png)、[delete-required · 1440](design/competitor-direction-c/1440-delete-required.png) / [delete-required · 390](design/competitor-direction-c/390-delete-required.png)；其余见JSON | 来源缺可访问名称与完整焦点约束；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-DELETE-SUBMIT 确认删除监控 / write | 2处；空白无写入、有效原因、409保留输入、busy、成功后刷新 | [delete-required · 1440](design/competitor-direction-c/1440-delete-required.png) / [delete-required · 390](design/competitor-direction-c/390-delete-required.png)、[delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png)；其余见JSON | 已补本页代表控件六态的双端实拍与逐selector关联，待用户审核，不是全部变体或实际Vue通过。代表已填原因的确认删除；disabled与busy共用原busy条件。版本冲突/空白/取消/关闭/在途结果归属及主题仍待。锁关闭仅是既有离线提案，未改Vue。 |
| CP-DELETE-CLOSE 取消 / 关闭删除 / local | 2处；右上关闭、取消、Escape、busy关闭 | [delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png)、[delete-error · 1440](design/competitor-direction-c/1440-delete-error.png) / [delete-error · 390](design/competitor-direction-c/390-delete-error.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。disabled与busy展示已有离线稿的提交期间锁定，真实Vue当前仍可关闭或上一步；不据图宣称已中止请求。P20异常create=1背景仍缺，创建其他步骤/关闭来源组合和实际异步归属需继续验证。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| CP-CREATE-CONTAINER | 容器定义，无额外事件 | CP-CREATE-SUBMIT、CP-CREATE-CLOSE、CP-CREATE-PREVIOUS |
| CP-DELETE-CONTAINER | 容器定义，无额外事件 | CP-DELETE-SUBMIT、CP-DELETE-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| CompetitorMonitor.vue / query | 搜索query；仅P19显示，初始读取q、修改后清competitor/create；匹配已加载title/external_id/source_site，不是远程搜索。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.product_url | 创建商品URL；必填type=url、maxlength2048；P20仅create=1异常深链显示，不增加provider输入。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.market | 创建市场；必填maxlength40、pattern=[A-Za-z0-9._-]+；保留US初值，不推导市场。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.opportunity_id | 创建关联机会ID；可选maxlength36、UUID pattern；为空时省略请求字段，不自动关联。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.title | 创建监控名称；必填maxlength500，关闭保留本实例；不是浏览器持久化草稿。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.competitor_id | 规则目标；仅P20规则窗，选择真实items.id或空表示当前工作区全部，POST明确null。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.metric | 规则指标；price/rank/review_count/availability；切换会纠正不兼容direction。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.direction | 规则方向；数值increase/decrease/change，库存change/became_unavailable；不是四种一律可用。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.threshold_value | 规则阈值；v-model.number，非库存才显示required/min0/step0.000001；库存省略请求字段，不编币种。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / deleteReason | 删除原因；P19删除窗required maxlength500，提交trim；取消不写，重开清空，冲突保留。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| CompetitorMonitor.vue / aside.1 / directory | inline-aside / related-scene-only | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.1 / readonly | inline-aside / related-scene-only | [readonly · 1440](design/competitor-direction-c/1440-readonly.png) / [readonly · 390](design/competitor-direction-c/390-readonly.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.1 / deep-link | inline-aside / related-scene-only | [deep-link · 1440](design/competitor-direction-c/1440-deep-link.png) / [deep-link · 390](design/competitor-direction-c/390-deep-link.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-link | form-container / matching-dialog-scene | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-market | form-container / matching-dialog-scene | [create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-confirm | form-container / matching-dialog-scene | [create-confirm · 1440](design/competitor-direction-c/1440-create-confirm.png) / [create-confirm · 390](design/competitor-direction-c/390-create-confirm.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-error | form-container / matching-dialog-scene | [create-error · 1440](design/competitor-direction-c/1440-create-error.png) / [create-error · 390](design/competitor-direction-c/390-create-error.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-busy | form-container / matching-dialog-scene | [create-busy · 1440](design/competitor-direction-c/1440-create-busy.png) / [create-busy · 390](design/competitor-direction-c/390-create-busy.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.1 / create-invalid | form-container / matching-dialog-scene | [create-invalid · 1440](design/competitor-direction-c/1440-create-invalid.png) / [create-invalid · 390](design/competitor-direction-c/390-create-invalid.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.2 / create-link | inline-aside / related-scene-only | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.3 / create-confirm | inline-aside / related-scene-only | [create-confirm · 1440](design/competitor-direction-c/1440-create-confirm.png) / [create-confirm · 390](design/competitor-direction-c/390-create-confirm.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.2 / rule-global | form-container / route-excluded-reference | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.2 / rule-target | form-container / route-excluded-reference | [rule-target · 1440](design/competitor-direction-c/1440-rule-target.png) / [rule-target · 390](design/competitor-direction-c/390-rule-target.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.2 / rule-availability | form-container / route-excluded-reference | [rule-availability · 1440](design/competitor-direction-c/1440-rule-availability.png) / [rule-availability · 390](design/competitor-direction-c/390-rule-availability.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.2 / rule-error | form-container / route-excluded-reference | [rule-error · 1440](design/competitor-direction-c/1440-rule-error.png) / [rule-error · 390](design/competitor-direction-c/390-rule-error.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.2 / rule-busy | form-container / route-excluded-reference | [rule-busy · 1440](design/competitor-direction-c/1440-rule-busy.png) / [rule-busy · 390](design/competitor-direction-c/390-rule-busy.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / aside.4 / rule-global | inline-aside / route-excluded-reference | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / aside.4 / rule-availability | inline-aside / route-excluded-reference | [rule-availability · 1440](design/competitor-direction-c/1440-rule-availability.png) / [rule-availability · 390](design/competitor-direction-c/390-rule-availability.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.3 / delete | form-container / matching-dialog-scene | [delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.3 / delete-error | form-container / matching-dialog-scene | [delete-error · 1440](design/competitor-direction-c/1440-delete-error.png) / [delete-error · 390](design/competitor-direction-c/390-delete-error.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.3 / delete-busy | form-container / matching-dialog-scene | [delete-busy · 1440](design/competitor-direction-c/1440-delete-busy.png) / [delete-busy · 390](design/competitor-direction-c/390-delete-busy.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.3 / delete-required | form-container / matching-dialog-scene | [delete-required · 1440](design/competitor-direction-c/1440-delete-required.png) / [delete-required · 390](design/competitor-direction-c/390-delete-required.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |

### 路径与局部模式

初始mode=list；局部模式族：list、create-step-1/2/3、delete。排除：rules-page-region、rule-dialog-in-list。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：CP-MOUNT-READ / onMounted读取list/rules/selected detail；不是按钮或新API；CP-QUERY-OPEN / manager初挂create=1开启创建；competitor深链参与详情恢复；CP-WATCHERS / query修改同步URL；metric纠正direction；失去manage关闭三个窗，不证明在途写入取消。不登记为按钮。

### 明确保留的边界

- 没有逐actionId/selector六态引用，不能从108PNG或通用hover/focus图片扣减全部控件状态槽；navigation仅将源无disabled/busy标为不适用。
- 缺完整所有采集终态/操作失败与成功、帮助展开、生成任务后链接、多对象/长历史/全部主题密度状态组合。
- 状态面primary/secondary按实际分支合为本地恢复组，form/submit合为提交组；此数不是全站固定业务动作分母。
- 本轮不改运行代码/图稿或合同门；P16布局通过不转授P19/P20，完整页面批准保持待审。
- 只审核本地调用方，UiStatePanel/MonitoringReadinessStrip以依赖hash绑定，不把共享源按钮逐路由相乘；条目/模式由真实父props和route.name缓存键决定。
- UiStatePanel loading无footer，expired无secondary，forbidden/blocked的副按钮当前均由父回/home；不能按文案臆造申请权限或影响详情功能。
- 角色隐藏写入口是前端分支，不等于服务端权限/RBAC/租户隔离证明。task:create与competitor:manage独立。
- 十个v-model和七个结构容器是共享源位置；实际可见字段受route/step/metric/权限控制，不乘成所有分支验收。
- CP-B02/B03在54948dd8已局部修复并通过46个双端隔离Vue例；这里只复用未变化证据，不声称本轮重跑Vue或真实SQL/来源采集。
- CP-B01双query并窗、CP-B04删除回调、CP-B05规则重入及CP-G01焦点、CP-G02事实呈现、CP-G03窗口、KeepAlive/scope/history仍未闭环。

## P20 局部动作与共享消费者

[逐项机器清单](action-reviews/P20.json)：39个局部源位置 → 12组；2类写入，8组路由动作，2组转发/容器关联不重复计动作。10个本地v-model，7处调用/内嵌容器，22个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有8个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| CP-RULE-OPEN 新建 / 第一条监控规则 / local | 2处；页首新增、没有启用规则、规则数组为空 | [rules · 1440](design/competitor-direction-c/1440-rules.png) / [rules · 390](design/competitor-direction-c/390-rules.png)、[rules-empty · 1440](design/competitor-direction-c/1440-rules-empty.png) / [rules-empty · 390](design/competitor-direction-c/390-rules-empty.png)；其余见JSON | 已补本页精确控件和背景，详见COMPETITOR-ENTRY-QUERY-REVIEW；尚未批准，不代表所有字段/主题/真实Vue。打开及前两步下一步只四态，不伪造busy；P20 create=1关闭回规则标题为无来源入口的离线焦点提案，routePreview不是真实路由。提交期间关闭/上一步锁定仍为提案；双query弹窗优先级、真实异步完成/失败及生命周期仍待。 |
| CP-RULE-BACK 返回竞品列表 / navigation | 1处；管理者、只读者 | [rules · 1440](design/competitor-direction-c/1440-rules.png) / [rules · 390](design/competitor-direction-c/390-rules.png)、[rules-readonly · 1440](design/competitor-direction-c/1440-rules-readonly.png) / [rules-readonly · 390](design/competitor-direction-c/390-rules-readonly.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。导航仅有默认/hover/focus/pressed四态；源码没有disabled或请求busy，不造状态。未覆盖所有来源、权限、长文本/主题及真实页面跳转后的运行。 |
| CP-STATE-RECOVERY 规则页异常主次恢复 / read | 1处；loading无按钮、读取错误、expired、forbidden、blocked、empty分支非正常规则空态 | [rules-loading · 1440](design/competitor-direction-c/1440-rules-loading.png) / [rules-loading · 390](design/competitor-direction-c/390-rules-loading.png)、[rules-error · 1440](design/competitor-direction-c/1440-rules-error.png) / [rules-error · 390](design/competitor-direction-c/390-rules-error.png)；其余见JSON | 已补按页面和主次按钮独立的四态额外变体，详见COMPETITOR-RECOVERY-STATE-REVIEW；不将同一CP-STATE-RECOVERY跨页覆盖代表键。代表槽状态本批不提升，source loading隐藏footer，不伪造disabled/busy按钮。仍缺全部主题/密度/真实浏览器history和完整fullPath组合、实际异步恢复、真实Vue与用户批准。 |
| CP-LIST-REGION-EXCLUDED P19列表/详情操作区排除 / excluded | 19处；P19页首与恢复、P19对象详情、P19外部来源、P19采集启停、P19验证任务、P19更多帮助 | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png)、[more-open · 1440](design/competitor-direction-c/1440-more-open.png) / [more-open · 390](design/competitor-direction-c/390-more-open.png)；其余见JSON | 不据静态导入把对象操作乘以2；下方独立创建窗因query可达不能一起排除；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-CREATE-CONTAINER 创建竞品弹窗定义 / wiring | 1处；步骤1链接、步骤2市场/机会/名称、步骤3确认、失败保留、busy | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png)、[create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png)；其余见JSON | P20仅初挂create=1可达；图的P19背景不能当P20异常双弹窗图；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-CREATE-SUBMIT 下一步 / 确认并开始采集 / write | 2处；链接下一步零写入、市场下一步零写入、确认提交、字段非法、失败保留确认步、busy | [rules-create-link · 1440](design/competitor-direction-c/1440-rules-create-link.png) / [rules-create-link · 390](design/competitor-direction-c/390-rules-create-link.png)、[rules-create-market · 1440](design/competitor-direction-c/1440-rules-create-market.png) / [rules-create-market · 390](design/competitor-direction-c/390-rules-create-market.png)；其余见JSON | 已补本页精确控件和背景，详见COMPETITOR-ENTRY-QUERY-REVIEW；尚未批准，不代表所有字段/主题/真实Vue。打开及前两步下一步只四态，不伪造busy；P20 create=1关闭回规则标题为无来源入口的离线焦点提案，routePreview不是真实路由。提交期间关闭/上一步锁定仍为提案；双query弹窗优先级、真实异步完成/失败及生命周期仍待。 |
| CP-CREATE-CLOSE 关闭 / 取消创建 / local | 2处；右上关闭、第1步取消、第2/3步关闭、busy关闭风险 | [rules-create-link · 1440](design/competitor-direction-c/1440-rules-create-link.png) / [rules-create-link · 390](design/competitor-direction-c/390-rules-create-link.png)、[rules-create-market · 1440](design/competitor-direction-c/1440-rules-create-market.png) / [rules-create-market · 390](design/competitor-direction-c/390-rules-create-market.png)；其余见JSON | 已补本页精确控件和背景，详见COMPETITOR-ENTRY-QUERY-REVIEW；尚未批准，不代表所有字段/主题/真实Vue。打开及前两步下一步只四态，不伪造busy；P20 create=1关闭回规则标题为无来源入口的离线焦点提案，routePreview不是真实路由。提交期间关闭/上一步锁定仍为提案；双query弹窗优先级、真实异步完成/失败及生命周期仍待。 |
| CP-CREATE-PREVIOUS 创建上一步 / local | 1处；市场回链接、确认回市场、busy仍可回退的源差异 | [rules-create-market · 1440](design/competitor-direction-c/1440-rules-create-market.png) / [rules-create-market · 390](design/competitor-direction-c/390-rules-create-market.png)、[rules-create-confirm · 1440](design/competitor-direction-c/1440-rules-create-confirm.png) / [rules-create-confirm · 390](design/competitor-direction-c/390-rules-create-confirm.png)；其余见JSON | 已补本页精确控件和背景，详见COMPETITOR-ENTRY-QUERY-REVIEW；尚未批准，不代表所有字段/主题/真实Vue。打开及前两步下一步只四态，不伪造busy；P20 create=1关闭回规则标题为无来源入口的离线焦点提案，routePreview不是真实路由。提交期间关闭/上一步锁定仍为提案；双query弹窗优先级、真实异步完成/失败及生命周期仍待。 |
| CP-RULE-CONTAINER 新规则弹窗定义 / wiring | 1处；工作区数值、对象数值、库存、错误保留、busy、双query异常 | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png)、[rule-target · 1440](design/competitor-direction-c/1440-rule-target.png) / [rule-target · 390](design/competitor-direction-c/390-rule-target.png)；其余见JSON | 双query并存尚无专用图/优先级决定；Tab/归还真实Vue未闭环；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |
| CP-RULE-SUBMIT 启用新规则 / write | 2处；全局数值0、指定对象数值、库存change、库存became_unavailable、busy、冲突保留 | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png)、[rule-target · 1440](design/competitor-direction-c/1440-rule-target.png) / [rule-target · 390](design/competitor-direction-c/390-rule-target.png)；其余见JSON | 已补本页代表控件六态的双端实拍与逐selector关联，待用户审核，不是全部变体或实际Vue通过。代表工作区价格规则；disabled与busy共用原busy条件。指定竞品/其他指标/库存/字段/主题仍待；函数重入源风险没有因离线忙碌守卫关闭。 |
| CP-RULE-CLOSE 关闭 / 取消规则 / local | 2处；右上关闭、取消、Escape、busy关闭 | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png)、[rule-error · 1440](design/competitor-direction-c/1440-rule-error.png) / [rule-error · 390](design/competitor-direction-c/390-rule-error.png)；其余见JSON | 已补本页精确代表控件双端状态图，用户尚未批准，不代表全变体/真实Vue/主题完成。disabled与busy展示已有离线稿的提交期间锁定，真实Vue当前仍可关闭或上一步；不据图宣称已中止请求。P20异常create=1背景仍缺，创建其他步骤/关闭来源组合和实际异步归属需继续验证。 |
| CP-DELETE-DIALOG-EXCLUDED P20删除弹窗排除 / excluded | 5处；删除定义、提交与submit、取消与关闭 | [delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png)、[delete-error · 1440](design/competitor-direction-c/1440-delete-error.png) / [delete-error · 390](design/competitor-direction-c/390-delete-error.png)；其余见JSON | 源函数测试可以直接设置不等于P20页面可删竞品；整页场景仅作关联，尚无本动作逐selector的适用六态、全变体/主题/密度验收；用户未批准，不得据此迁入生产。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| CP-CREATE-CONTAINER | 容器定义，无额外事件 | CP-CREATE-SUBMIT、CP-CREATE-CLOSE、CP-CREATE-PREVIOUS |
| CP-RULE-CONTAINER | 容器定义，无额外事件 | CP-RULE-SUBMIT、CP-RULE-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| CompetitorMonitor.vue / query | 搜索query；仅P19显示，初始读取q、修改后清competitor/create；匹配已加载title/external_id/source_site，不是远程搜索。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.product_url | 创建商品URL；必填type=url、maxlength2048；P20仅create=1异常深链显示，不增加provider输入。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.market | 创建市场；必填maxlength40、pattern=[A-Za-z0-9._-]+；保留US初值，不推导市场。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.opportunity_id | 创建关联机会ID；可选maxlength36、UUID pattern；为空时省略请求字段，不自动关联。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / form.title | 创建监控名称；必填maxlength500，关闭保留本实例；不是浏览器持久化草稿。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.competitor_id | 规则目标；仅P20规则窗，选择真实items.id或空表示当前工作区全部，POST明确null。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.metric | 规则指标；price/rank/review_count/availability；切换会纠正不兼容direction。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.direction | 规则方向；数值increase/decrease/change，库存change/became_unavailable；不是四种一律可用。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / rule.threshold_value | 规则阈值；v-model.number，非库存才显示required/min0/step0.000001；库存省略请求字段，不编币种。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |
| CompetitorMonitor.vue / deleteReason | 删除原因；P19删除窗required maxlength500，提交trim；取消不写，重开清空，冲突保留。 | 逐字段默认/编辑/聚焦/校验错误/禁用/busy、长输入/软键盘与主题未完整映射；路由排除不等于移除源绑定。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| CompetitorMonitor.vue / aside.1 / directory | inline-aside / route-excluded-reference | [directory · 1440](design/competitor-direction-c/1440-directory.png) / [directory · 390](design/competitor-direction-c/390-directory.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / aside.1 / readonly | inline-aside / route-excluded-reference | [readonly · 1440](design/competitor-direction-c/1440-readonly.png) / [readonly · 390](design/competitor-direction-c/390-readonly.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / aside.1 / deep-link | inline-aside / route-excluded-reference | [deep-link · 1440](design/competitor-direction-c/1440-deep-link.png) / [deep-link · 390](design/competitor-direction-c/390-deep-link.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.1 / create-link | form-container / related-scene-only | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.1 / create-market | form-container / related-scene-only | [create-market · 1440](design/competitor-direction-c/1440-create-market.png) / [create-market · 390](design/competitor-direction-c/390-create-market.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.1 / create-confirm | form-container / related-scene-only | [create-confirm · 1440](design/competitor-direction-c/1440-create-confirm.png) / [create-confirm · 390](design/competitor-direction-c/390-create-confirm.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.1 / create-error | form-container / related-scene-only | [create-error · 1440](design/competitor-direction-c/1440-create-error.png) / [create-error · 390](design/competitor-direction-c/390-create-error.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.1 / create-busy | form-container / related-scene-only | [create-busy · 1440](design/competitor-direction-c/1440-create-busy.png) / [create-busy · 390](design/competitor-direction-c/390-create-busy.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.1 / create-invalid | form-container / related-scene-only | [create-invalid · 1440](design/competitor-direction-c/1440-create-invalid.png) / [create-invalid · 390](design/competitor-direction-c/390-create-invalid.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / aside.2 / create-link | inline-aside / related-scene-only | [create-link · 1440](design/competitor-direction-c/1440-create-link.png) / [create-link · 390](design/competitor-direction-c/390-create-link.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / aside.3 / create-confirm | inline-aside / related-scene-only | [create-confirm · 1440](design/competitor-direction-c/1440-create-confirm.png) / [create-confirm · 390](design/competitor-direction-c/390-create-confirm.png) | P20 create=1源可达，但此图为P19创建窗；缺P20异常背景/双窗焦点图。 |
| CompetitorMonitor.vue / form.2 / rule-global | form-container / matching-dialog-scene | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.2 / rule-target | form-container / matching-dialog-scene | [rule-target · 1440](design/competitor-direction-c/1440-rule-target.png) / [rule-target · 390](design/competitor-direction-c/390-rule-target.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.2 / rule-availability | form-container / matching-dialog-scene | [rule-availability · 1440](design/competitor-direction-c/1440-rule-availability.png) / [rule-availability · 390](design/competitor-direction-c/390-rule-availability.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.2 / rule-error | form-container / matching-dialog-scene | [rule-error · 1440](design/competitor-direction-c/1440-rule-error.png) / [rule-error · 390](design/competitor-direction-c/390-rule-error.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.2 / rule-busy | form-container / matching-dialog-scene | [rule-busy · 1440](design/competitor-direction-c/1440-rule-busy.png) / [rule-busy · 390](design/competitor-direction-c/390-rule-busy.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.4 / rule-global | inline-aside / related-scene-only | [rule-global · 1440](design/competitor-direction-c/1440-rule-global.png) / [rule-global · 390](design/competitor-direction-c/390-rule-global.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / aside.4 / rule-availability | inline-aside / related-scene-only | [rule-availability · 1440](design/competitor-direction-c/1440-rule-availability.png) / [rule-availability · 390](design/competitor-direction-c/390-rule-availability.png) | 本场景为离线提案关联，不代表每个字段/控件六态、主题或实际Vue通过。 |
| CompetitorMonitor.vue / form.3 / delete | form-container / route-excluded-reference | [delete · 1440](design/competitor-direction-c/1440-delete.png) / [delete · 390](design/competitor-direction-c/390-delete.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.3 / delete-error | form-container / route-excluded-reference | [delete-error · 1440](design/competitor-direction-c/1440-delete-error.png) / [delete-error · 390](design/competitor-direction-c/390-delete-error.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.3 / delete-busy | form-container / route-excluded-reference | [delete-busy · 1440](design/competitor-direction-c/1440-delete-busy.png) / [delete-busy · 390](design/competitor-direction-c/390-delete-busy.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |
| CompetitorMonitor.vue / form.3 / delete-required | form-container / route-excluded-reference | [delete-required · 1440](design/competitor-direction-c/1440-delete-required.png) / [delete-required · 390](design/competitor-direction-c/390-delete-required.png) | 本页固定mode排除，仅保留来源与他页图引用；不计本页弹窗/行为通过。 |

### 路径与局部模式

初始mode=rules；局部模式族：rules、rule-global/target-numeric/availability、create-step-1/2/3-via-query。排除：list-page-region、delete-dialog-in-rules。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：CP-MOUNT-READ / onMounted读取list/rules/selected detail；不是按钮或新API；CP-QUERY-OPEN / manager初挂create=1与competitor字符串可同时开启两窗；优先级未批准；CP-WATCHERS / query修改同步URL；metric纠正direction；失去manage关闭三个窗，不证明在途写入取消。不登记为按钮。

### 明确保留的边界

- 没有逐actionId/selector六态引用，不能从108PNG或通用hover/focus图片扣减全部控件状态槽；navigation仅将源无disabled/busy标为不适用。
- P20缺专用expired/forbidden/blocked、create=1与双query背景/焦点/冲突场景、长规则与全部主题密度组合；不能拿P19背景当等价。
- 状态面primary/secondary按实际分支合为本地恢复组，form/submit合为提交组；此数不是全站固定业务动作分母。
- 本轮不改运行代码/图稿或合同门；P16布局通过不转授P19/P20，完整页面批准保持待审。
- 只审核本地调用方，UiStatePanel/MonitoringReadinessStrip以依赖hash绑定，不把共享源按钮逐路由相乘；条目/模式由真实父props和route.name缓存键决定。
- UiStatePanel loading无footer，expired无secondary，forbidden/blocked的副按钮当前均由父回/home；不能按文案臆造申请权限或影响详情功能。
- 角色隐藏写入口是前端分支，不等于服务端权限/RBAC/租户隔离证明。task:create与competitor:manage独立。
- 十个v-model和七个结构容器是共享源位置；实际可见字段受route/step/metric/权限控制，不乘成所有分支验收。
- CP-B02/B03在54948dd8已局部修复并通过46个双端隔离Vue例；这里只复用未变化证据，不声称本轮重跑Vue或真实SQL/来源采集。
- CP-B01双query并窗、CP-B04删除回调、CP-B05规则重入及CP-G01焦点、CP-G02事实呈现、CP-G03窗口、KeepAlive/scope/history仍未闭环。

## P21 局部动作与共享消费者

[逐项机器清单](action-reviews/P21.json)：54个局部源位置 → 38组；9类写入，31组路由动作，7组转发/容器关联不重复计动作。25个本地v-model，12处调用/内嵌容器，33个明确变体。此处不是全页共享源的去重分母；原静态导入关联数不与本数相减当缺失按钮。

尚有20个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| SC-NAV-SELF 供应商找货页签 / navigation | 1处；SC-NAV sourcing | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[control-nav-self-default · 1440](design/sourcing-direction-c/1440-control-nav-self-default.png) / [control-nav-self-default · 390](design/sourcing-direction-c/390-control-nav-self-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-NAV-RULES 费用规则页签 / navigation | 1处；SC-NAV cost-rules | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[control-nav-rules-default · 1440](design/sourcing-direction-c/1440-control-nav-rules-default.png) / [control-nav-rules-default · 390](design/sourcing-direction-c/390-control-nav-rules-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-S-OPEN 发起找货 / local | 1处；SC-S-OPEN 管理者创建 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-STATE 整页状态主次操作 / read | 1处；SC-STATE 主/次恢复或创建 | [empty · 1440](design/sourcing-direction-c/1440-empty.png) / [empty · 390](design/sourcing-direction-c/390-empty.png)、[loading · 1440](design/sourcing-direction-c/1440-loading.png) / [loading · 390](design/sourcing-direction-c/390-loading.png)；其余见JSON | 双端主次恢复及只读/管理者空目录、搜索分支已逐selector绑定；过期仅主按钮、加载无按钮。disabled/busy无源条件，不编造图，其槽保留not-mapped等待分母复核。源load首GET/本地清空/零写打开通过隔离检查，真实恢复响应/路由/异步与批准仍待。 |
| SC-SEARCH-RECOVERY 空筛选恢复 / read | 1处；SC-SEARCH-CLEAR / 空筛选次动作 | [search-empty · 1440](design/sourcing-direction-c/1440-search-empty.png) / [search-empty · 390](design/sourcing-direction-c/390-search-empty.png)、[control-recovery-search-primary-default · 1440](design/sourcing-direction-c/1440-control-recovery-search-primary-default.png) / [control-recovery-search-primary-default · 390](design/sourcing-direction-c/390-control-recovery-search-primary-default.png)；其余见JSON | 双端主次恢复及只读/管理者空目录、搜索分支已逐selector绑定；过期仅主按钮、加载无按钮。disabled/busy无源条件，不编造图，其槽保留not-mapped等待分母复核。源load首GET/本地清空/零写打开通过隔离检查，真实恢复响应/路由/异步与批准仍待。 |
| SC-DETAIL 选择找货记录 / read | 1处；SC-DETAIL 读对象并同步record | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[keyword-record · 1440](design/sourcing-direction-c/1440-keyword-record.png) / [keyword-record · 390](design/sourcing-direction-c/390-keyword-record.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-REFRESH 重新采集 / write | 1处；SC-REFRESH 管理者POST当前对象 | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[queued · 1440](design/sourcing-direction-c/1440-queued.png) / [queued · 390](design/sourcing-direction-c/390-queued.png)；其余见JSON | 双端六态代表图已绑定；比较按至少两家与busy、重新采集按busy。pending仅记录不可变请求意图、无真实HTTP或成功/失败回调验收；SC-G01–08、主题密度、完整变体、批准与真实Vue仍待。 |
| SC-NAV-RULES-CONTEXT 当前找货费用规则 / navigation | 1处；SC-NAV cost-rules含from | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-DELETE-OPEN 打开删除确认 / local | 1处；SC-DELETE-OPEN 管理者选中目标 | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png)、[control-main-delete-open-default · 1440](design/sourcing-direction-c/1440-control-main-delete-open-default.png) / [control-main-delete-open-default · 390](design/sourcing-direction-c/390-control-main-delete-open-default.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-NAV-COLLECTION 受权采集明细 / navigation | 1处；SC-NAV 受权采集明细 | [platform-inspect · 1440](design/sourcing-direction-c/1440-platform-inspect.png) / [platform-inspect · 390](design/sourcing-direction-c/390-platform-inspect.png)、[control-nav-collection-default · 1440](design/sourcing-direction-c/1440-control-nav-collection-default.png) / [control-nav-collection-default · 390](design/sourcing-direction-c/390-control-nav-collection-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-ERP ERP原页面 / navigation | 1处；SC-ERP 原始ERP新窗口 | [erp · 1440](design/sourcing-direction-c/1440-erp.png) / [erp · 390](design/sourcing-direction-c/390-erp.png)、[control-nav-erp-default · 1440](design/sourcing-direction-c/1440-control-nav-erp-default.png) / [control-nav-erp-default · 390](design/sourcing-direction-c/390-control-nav-erp-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-SELECT 选择报价对比 / local | 1处；SC-SELECT 勾选与实际最多五项同步 | [select-one · 1440](design/sourcing-direction-c/1440-select-one.png) / [select-one · 390](design/sourcing-direction-c/390-select-one.png)、[select-two · 1440](design/sourcing-direction-c/1440-select-two.png) / [select-two · 390](design/sourcing-direction-c/390-select-two.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-SOURCE 原始商品页 / navigation | 1处；SC-SOURCE 原始商品新窗口 | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[missing-quote · 1440](design/sourcing-direction-c/1440-missing-quote.png) / [missing-quote · 390](design/sourcing-direction-c/390-missing-quote.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-QUOTE-OPEN 打开报价确认 / local | 1处；SC-QUOTE-OPEN 管理者无quote | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)、[quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-PURCHASE-OPEN 打开采购任务 / local | 1处；SC-PURCHASE-OPEN 管理者已有quote | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png)、[control-main-purchase-open-default · 1440](design/sourcing-direction-c/1440-control-main-purchase-open-default.png) / [control-main-purchase-open-default · 390](design/sourcing-direction-c/390-control-main-purchase-open-default.png)；其余见JSON | 双端四态代表图已绑定；当前源码无本控件disabled/busy条件，不编造相关图，其槽仍保留not-mapped等待分母逐项复核。具体批准、主题密度、全部变体、真实Vue与异步归属仍待。 |
| SC-COMPARE 保存报价对比 / write | 1处；SC-COMPARE 至少2项且非busy | [select-one · 1440](design/sourcing-direction-c/1440-select-one.png) / [select-one · 390](design/sourcing-direction-c/390-select-one.png)、[select-two · 1440](design/sourcing-direction-c/1440-select-two.png) / [select-two · 390](design/sourcing-direction-c/390-select-two.png)；其余见JSON | 双端六态代表图已绑定；比较按至少两家与busy、重新采集按busy。pending仅记录不可变请求意图、无真实HTTP或成功/失败回调验收；SC-G01–08、主题密度、完整变体、批准与真实Vue仍待。 |
| SC-DIALOG-WIRING 四窗调用与事件装配 / wiring | 2处；SD九个事件转发、删除原因更新、四窗共享调用，不另外计为第五个业务窗 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-S-DIALOG 找货窗口定义 / wiring | 1处；搜索四类输入，字段标签随类型变 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-S-CLOSE 找货关闭/Escape/取消 / local | 3处；SC-S-CLOSE Escape、SC-S-CLOSE X、SC-S-CLOSE 取消 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png)；其余见JSON | 关闭与取消双端六态已绑定；disabled/busy是父请求在途关闭锁提案，真实Vue仍允许关闭，不是取消网络请求。键盘回到实际入口及搜索/删除保留、报价/采购重开预填已离线验证；具体批准、直达query无入口回焦、真实路由/异步归属和辅助技术仍待。 |
| SC-S-SUBMIT 找货最终提交 / write | 2处；SC-S-SUBMIT 表单、SC-S-SUBMIT 按钮 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png)；其余见JSON | 已绑定双端六态代表图，尚未获审或迁入真实Vue；字段/错误/主题密度/全部变体和实际异步归属未验。disabled和busy均使用当前源busy条件，不新增独立禁用业务规则。 |
| SC-QUOTE-DIALOG 报价窗口定义 / wiring | 1处；报价证据确认 | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)、[quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-QUOTE-CLOSE 报价关闭/Escape/取消 / local | 3处；SC-QUOTE-CLOSE Escape、SC-QUOTE-CLOSE X、SC-QUOTE-CLOSE 取消 | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)、[quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png)；其余见JSON | 关闭与取消双端六态已绑定；disabled/busy是父请求在途关闭锁提案，真实Vue仍允许关闭，不是取消网络请求。键盘回到实际入口及搜索/删除保留、报价/采购重开预填已离线验证；具体批准、直达query无入口回焦、真实路由/异步归属和辅助技术仍待。 |
| SC-QUOTE-SUBMIT 报价最终提交 / write | 2处；SC-QUOTE-SUBMIT 表单、SC-QUOTE-SUBMIT 按钮 | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)、[quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png)；其余见JSON | 已绑定双端六态代表图，尚未获审或迁入真实Vue；字段/错误/主题密度/全部变体和实际异步归属未验。disabled和busy均使用当前源busy条件，不新增独立禁用业务规则。 |
| SC-PURCHASE-DIALOG 采购窗口定义 / wiring | 1处；采购MOQ/原因 | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png)、[purchase-error · 1440](design/sourcing-direction-c/1440-purchase-error.png) / [purchase-error · 390](design/sourcing-direction-c/390-purchase-error.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-PURCHASE-CLOSE 采购关闭/Escape/取消 / local | 3处；SC-PURCHASE-CLOSE Escape、SC-PURCHASE-CLOSE X、SC-PURCHASE-CLOSE 取消 | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png)、[purchase-error · 1440](design/sourcing-direction-c/1440-purchase-error.png) / [purchase-error · 390](design/sourcing-direction-c/390-purchase-error.png)；其余见JSON | 关闭与取消双端六态已绑定；disabled/busy是父请求在途关闭锁提案，真实Vue仍允许关闭，不是取消网络请求。键盘回到实际入口及搜索/删除保留、报价/采购重开预填已离线验证；具体批准、直达query无入口回焦、真实路由/异步归属和辅助技术仍待。 |
| SC-PURCHASE-SUBMIT 采购最终提交 / write | 2处；SC-PURCHASE-SUBMIT 表单、SC-PURCHASE-SUBMIT 按钮 | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png)、[purchase-error · 1440](design/sourcing-direction-c/1440-purchase-error.png) / [purchase-error · 390](design/sourcing-direction-c/390-purchase-error.png)；其余见JSON | 已绑定双端六态代表图，尚未获审或迁入真实Vue；字段/错误/主题密度/全部变体和实际异步归属未验。disabled代表数量低于当前MOQ，busy为请求在途；原因不足仅DOM检查未单独制图。 |
| SC-DELETE-DIALOG 删除窗口定义 / wiring | 1处；记录原因软删 | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png)、[delete-error · 1440](design/sourcing-direction-c/1440-delete-error.png) / [delete-error · 390](design/sourcing-direction-c/390-delete-error.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-DELETE-CLOSE 删除关闭/Escape/取消 / local | 3处；SC-DELETE-CLOSE Escape、SC-DELETE-CLOSE X、SC-DELETE-CLOSE 取消 | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png)、[delete-error · 1440](design/sourcing-direction-c/1440-delete-error.png) / [delete-error · 390](design/sourcing-direction-c/390-delete-error.png)；其余见JSON | 关闭与取消双端六态已绑定；disabled/busy是父请求在途关闭锁提案，真实Vue仍允许关闭，不是取消网络请求。键盘回到实际入口及搜索/删除保留、报价/采购重开预填已离线验证；具体批准、直达query无入口回焦、真实路由/异步归属和辅助技术仍待。 |
| SC-DELETE-SUBMIT 删除最终提交 / write | 2处；SC-DELETE-SUBMIT 表单、SC-DELETE-SUBMIT 按钮 | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png)、[delete-error · 1440](design/sourcing-direction-c/1440-delete-error.png) / [delete-error · 390](design/sourcing-direction-c/390-delete-error.png)；其余见JSON | 已绑定双端六态代表图，尚未获审或迁入真实Vue；字段/错误/主题密度/全部变体和实际异步归属未验。disabled和busy均使用当前源busy条件，不新增独立禁用业务规则。 |
| SC-NAV-OPPORTUNITY 机会利润详情 / navigation | 1处；SC-NAV 机会利润详情 | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)、[cost-calculated · 1440](design/sourcing-direction-c/1440-cost-calculated.png) / [cost-calculated · 390](design/sourcing-direction-c/390-cost-calculated.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-COST-WIRING P21机会成本父处理器 / wiring | 1处；成本提交/复核/重算三个事件转发 | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)、[cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-NAV-PROFIT-RULES 利润面板费用规则 / navigation | 1处；SC-NAV 管理费用规则 | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)、[control-nav-profit-rules-default · 1440](design/sourcing-direction-c/1440-control-nav-profit-rules-default.png) / [control-nav-profit-rules-default · 390](design/sourcing-direction-c/390-control-nav-profit-rules-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-COST-REVIEW-WIRING 共享复核事件上送 / wiring | 1处；SC-COST-REVIEW 转发 | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON |  仅有相关整页/弹窗场景，尚无本动作逐selector适用六态及完整主题/密度/真实Vue验收；用户未批准。 |
| SC-COST-SUBMIT 提交双人成本复核 / write | 2处；SC-COST-SUBMIT 表单、SC-COST-SUBMIT 指定复核人且非busy | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)、[cost-reviewers-empty · 1440](design/sourcing-direction-c/1440-cost-reviewers-empty.png) / [cost-reviewers-empty · 390](design/sourcing-direction-c/390-cost-reviewers-empty.png)；其余见JSON | 双端六态代表图已绑定；成本区busy独立于找货，自身请求与同区其他写请求禁用分开。精确机会/复核版本、0金额/时间、字段有效性/禁用、不可变意图及重复提交守卫仅离线验证，非真实Vue函数守卫或实际审批/计算。SC-G01–08、成本读取在途/全部字段对象主题/具体批准与生产验收仍待。 |
| SC-COST-RECALCULATE 利润重算排队 / write | 1处；SC-COST-RECALCULATE 排队 | [cost-recalculating · 1440](design/sourcing-direction-c/1440-cost-recalculating.png) / [cost-recalculating · 390](design/sourcing-direction-c/390-cost-recalculating.png)、[cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)；其余见JSON | 双端六态代表图已绑定；成本区busy独立于找货，自身请求与同区其他写请求禁用分开。精确机会/复核版本、0金额/时间、字段有效性/禁用、不可变意图及重复提交守卫仅离线验证，非真实Vue函数守卫或实际审批/计算。SC-G01–08、成本读取在途/全部字段对象主题/具体批准与生产验收仍待。 |
| SC-COST-REVIEW-OPEN 通过/驳回内联表单 / local | 2处；SC-COST-REVIEW rejected打开、SC-COST-REVIEW approved打开 | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 通过/驳回双端四态已绑定；源无busy禁用，不编造disabled/busy，其槽继续待适用性核对。取消不撤回已发送请求，重开清原因，离线精确回焦；真实异步归属/全部记录/主题密度/具体批准仍待。 |
| SC-COST-REVIEW-SUBMIT 提交复核结论 / write | 2处；SC-COST-REVIEW 表单提交、SC-COST-REVIEW 提交按钮 | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 双端六态代表图已绑定；成本区busy独立于找货，自身请求与同区其他写请求禁用分开。精确机会/复核版本、0金额/时间、字段有效性/禁用、不可变意图及重复提交守卫仅离线验证，非真实Vue函数守卫或实际审批/计算。SC-G01–08、成本读取在途/全部字段对象主题/具体批准与生产验收仍待。 |
| SC-COST-REVIEW-CANCEL 取消内联复核 / local | 1处；SC-COST-REVIEW-CANCEL | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 通过/驳回双端四态已绑定；源无busy禁用，不编造disabled/busy，其槽继续待适用性核对。取消不撤回已发送请求，重开清原因，离线精确回焦；真实异步归属/全部记录/主题密度/具体批准仍待。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| SC-DIALOG-WIRING | @close-search / closeSearch | SC-S-CLOSE |
| SC-DIALOG-WIRING | @create / create | SC-S-SUBMIT |
| SC-DIALOG-WIRING | @close-quote / quoteCandidate = null | SC-QUOTE-CLOSE |
| SC-DIALOG-WIRING | @confirm-quote / confirm | SC-QUOTE-SUBMIT |
| SC-DIALOG-WIRING | @close-purchase / purchaseCandidate = null | SC-PURCHASE-CLOSE |
| SC-DIALOG-WIRING | @purchase / purchase | SC-PURCHASE-SUBMIT |
| SC-DIALOG-WIRING | @close-delete / deleting = null | SC-DELETE-CLOSE |
| SC-DIALOG-WIRING | @remove-search / removeSearch | SC-DELETE-SUBMIT |
| SC-DIALOG-WIRING | @update-delete-reason / deleteReason = $event | SC-DELETE-SUBMIT |
| SC-DIALOG-WIRING | @close-search / closeSearch | SC-S-CLOSE |
| SC-DIALOG-WIRING | @create / create | SC-S-SUBMIT |
| SC-DIALOG-WIRING | @close-quote / quoteCandidate = null | SC-QUOTE-CLOSE |
| SC-DIALOG-WIRING | @confirm-quote / confirm | SC-QUOTE-SUBMIT |
| SC-DIALOG-WIRING | @close-purchase / purchaseCandidate = null | SC-PURCHASE-CLOSE |
| SC-DIALOG-WIRING | @purchase / purchase | SC-PURCHASE-SUBMIT |
| SC-DIALOG-WIRING | @close-delete / deleting = null | SC-DELETE-CLOSE |
| SC-DIALOG-WIRING | @remove-search / removeSearch | SC-DELETE-SUBMIT |
| SC-DIALOG-WIRING | @update-delete-reason / deleteReason = $event | SC-DELETE-SUBMIT |
| SC-S-DIALOG | 容器定义，无额外事件 | SC-S-CLOSE、SC-S-SUBMIT |
| SC-QUOTE-DIALOG | 容器定义，无额外事件 | SC-QUOTE-CLOSE、SC-QUOTE-SUBMIT |
| SC-PURCHASE-DIALOG | 容器定义，无额外事件 | SC-PURCHASE-CLOSE、SC-PURCHASE-SUBMIT |
| SC-DELETE-DIALOG | 容器定义，无额外事件 | SC-DELETE-CLOSE、SC-DELETE-SUBMIT |
| SC-COST-WIRING | @confirm-cost / submitCost | SC-COST-SUBMIT |
| SC-COST-WIRING | @review-cost / reviewCost | SC-COST-REVIEW-SUBMIT |
| SC-COST-WIRING | @queue-profit / queueProfit | SC-COST-RECALCULATE |
| SC-COST-REVIEW-WIRING | @review-cost / $emit('reviewCost', $event) | SC-COST-REVIEW-SUBMIT |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| SourcingWorkspace.vue / query | 按找货显示名/input_ref/status本地筛选；同步URL q，移除create | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / searchForm.input_type | keyword/image/opportunity/product_url四种既有类型，不上传图片 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / searchForm.input_ref | 对应类型原文，required/max2048；仅inputmode变化，不凭空增加URL解析 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.specification | 证据支持的规格文本，不判断单位或语义等价 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.moq | 最小起订量>=1；缺失时源默认1是表单值不是事实 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.lead_time_days | 交期>=0；缺失时默认7需人工核对 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.location | 必填所在地，来自候选或人工证据确认 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.confidence_value | 0–100，0保留；缺失默认80不是采集事实 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.stability_status | stable/variable/unknown原枚举，unknown允许不自行收紧 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.risk_level | low/medium/high/unknown原枚举 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.observed_at | datetime-local按报价原时刻转换，提交转UTC | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / quote.evidence_id | datalist建议候选/ERP证据，仍允许任意文本；真实归属由后端 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / purchaseForm.quantity | 整数且>=当前MOQ，锁定当前quote_id | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / purchaseForm.reason | trim后至少2字，最长1000 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| SourcingWorkspaceDialogs.vue / deleteReasonModel | 双向computed转发updateDeleteReason，仅改输入；required/max500，trim空不删 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.platform | 机会成本平台，初始amazon，max80 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.input_type | sale_price/purchase_price/logistics成本类别 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.amount_value | 非负金额，显式0有效，提交转Number | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.currency | 币种文本max3；不从报价币种自动替换 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.source_type | 来源类型原文本，初始supplier_quote | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.source_ref_id | 成本来源引用max255 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.evidence_id | 成本证据ID max36；前端不证明归属 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.observed_at | 成本datetime-local；源UTC截断默认时间问题未修 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityProfitPanel.vue / costForm.reviewer_id | 指定另一名成本确认人；列表按canConfirmCost读取 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |
| OpportunityCostReviewQueue.vue / review.reason | 通过/驳回理由；trim至少2/max1000，review版本独立 | 仅输入语义与来源核对；逐字段状态、错误关联、时区/角色/主题及真实Vue仍待验 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| SourcingWorkspace.vue / aside.1 / workspace | inline-aside / proposal-shape-differs | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspace.vue / aside.1 / keyword-record | inline-aside / proposal-shape-differs | [keyword-record · 1440](design/sourcing-direction-c/1440-keyword-record.png) / [keyword-record · 390](design/sourcing-direction-c/390-keyword-record.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspace.vue / aside.2 / select-one | inline-aside / related-scene-only | [select-one · 1440](design/sourcing-direction-c/1440-select-one.png) / [select-one · 390](design/sourcing-direction-c/390-select-one.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspace.vue / aside.2 / select-two | inline-aside / related-scene-only | [select-two · 1440](design/sourcing-direction-c/1440-select-two.png) / [select-two · 390](design/sourcing-direction-c/390-select-two.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspace.vue / aside.2 / select-five | inline-aside / related-scene-only | [select-five · 1440](design/sourcing-direction-c/1440-select-five.png) / [select-five · 390](design/sourcing-direction-c/390-select-five.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-keyword | form-container / matching-dialog-scene | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-image | form-container / matching-dialog-scene | [search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-opportunity | form-container / matching-dialog-scene | [search-opportunity · 1440](design/sourcing-direction-c/1440-search-opportunity.png) / [search-opportunity · 390](design/sourcing-direction-c/390-search-opportunity.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-product_url | form-container / matching-dialog-scene | [search-product_url · 1440](design/sourcing-direction-c/1440-search-product_url.png) / [search-product_url · 390](design/sourcing-direction-c/390-search-product_url.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-error | form-container / matching-dialog-scene | [search-error · 1440](design/sourcing-direction-c/1440-search-error.png) / [search-error · 390](design/sourcing-direction-c/390-search-error.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.1 / search-busy | form-container / matching-dialog-scene | [search-busy · 1440](design/sourcing-direction-c/1440-search-busy.png) / [search-busy · 390](design/sourcing-direction-c/390-search-busy.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / aside.1 / search-keyword | inline-aside / related-scene-only | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.2 / quote | form-container / matching-dialog-scene | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.2 / quote-defaults | form-container / matching-dialog-scene | [quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.2 / quote-error | form-container / matching-dialog-scene | [quote-error · 1440](design/sourcing-direction-c/1440-quote-error.png) / [quote-error · 390](design/sourcing-direction-c/390-quote-error.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.2 / quote-busy | form-container / matching-dialog-scene | [quote-busy · 1440](design/sourcing-direction-c/1440-quote-busy.png) / [quote-busy · 390](design/sourcing-direction-c/390-quote-busy.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.3 / purchase | form-container / matching-dialog-scene | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.3 / purchase-error | form-container / matching-dialog-scene | [purchase-error · 1440](design/sourcing-direction-c/1440-purchase-error.png) / [purchase-error · 390](design/sourcing-direction-c/390-purchase-error.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.3 / purchase-busy | form-container / matching-dialog-scene | [purchase-busy · 1440](design/sourcing-direction-c/1440-purchase-busy.png) / [purchase-busy · 390](design/sourcing-direction-c/390-purchase-busy.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.4 / delete | form-container / matching-dialog-scene | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.4 / delete-error | form-container / matching-dialog-scene | [delete-error · 1440](design/sourcing-direction-c/1440-delete-error.png) / [delete-error · 390](design/sourcing-direction-c/390-delete-error.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingWorkspaceDialogs.vue / form.4 / delete-busy | form-container / matching-dialog-scene | [delete-busy · 1440](design/sourcing-direction-c/1440-delete-busy.png) / [delete-busy · 390](design/sourcing-direction-c/390-delete-busy.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingComparisonPanel.vue / aside.1 / comparison | inline-aside / related-scene-only | [comparison · 1440](design/sourcing-direction-c/1440-comparison.png) / [comparison · 390](design/sourcing-direction-c/390-comparison.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingComparisonPanel.vue / aside.1 / spec-format | inline-aside / related-scene-only | [spec-format · 1440](design/sourcing-direction-c/1440-spec-format.png) / [spec-format · 390](design/sourcing-direction-c/390-spec-format.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| SourcingComparisonPanel.vue / aside.1 / spec-different | inline-aside / related-scene-only | [spec-different · 1440](design/sourcing-direction-c/1440-spec-different.png) / [spec-different · 390](design/sourcing-direction-c/390-spec-different.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / aside.1 / cost-missing | inline-aside / related-scene-only | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / form.1 / cost-missing | form-container / matching-inline-form-scene | [cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / form.1 / cost-reviewers-empty | form-container / matching-inline-form-scene | [cost-reviewers-empty · 1440](design/sourcing-direction-c/1440-cost-reviewers-empty.png) / [cost-reviewers-empty · 390](design/sourcing-direction-c/390-cost-reviewers-empty.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / form.1 / cost-submit-error | form-container / matching-inline-form-scene | [cost-submit-error · 1440](design/sourcing-direction-c/1440-cost-submit-error.png) / [cost-submit-error · 390](design/sourcing-direction-c/390-cost-submit-error.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / form.1 / cost-recalculating | form-container / matching-inline-form-scene | [cost-recalculating · 1440](design/sourcing-direction-c/1440-cost-recalculating.png) / [cost-recalculating · 390](design/sourcing-direction-c/390-cost-recalculating.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityProfitPanel.vue / aside.2 / cost-readonly | inline-aside / related-scene-only | [cost-readonly · 1440](design/sourcing-direction-c/1440-cost-readonly.png) / [cost-readonly · 390](design/sourcing-direction-c/390-cost-readonly.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityCostReviewQueue.vue / form.1 / cost-review-approved | form-container / matching-inline-form-scene | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |
| OpportunityCostReviewQueue.vue / form.1 / cost-review-rejected | form-container / matching-inline-form-scene | [cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png) | 主场景或表单对应，不抵扣全部控件适用态/主题/角色 |

### 路径与局部模式

初始mode=mounted读取create/q/opportunity_id并load；源无固定内容tab；局部模式族：source-list/detail、search-four-input-kinds、quote、purchase、delete、opportunity-inline-cost/review。排除：P22-cost-rule-lifecycle-actions、blocked_login-renewal、upload-image、browser-profit-calculation。这是当前挂载路径内源码适用性，不是服务端授权证明。共享源在多页重复引用不增加全站唯一按钮数。

自动动作：SC-MOUNT / 初挂showSearch=create=1未查canManage，但SD父组件canManage门阻断只读弹窗；watch create另查canManage；SC-RESTORE / load先列表再比较历史；record/当前/首个确定selected；detail成功按syncRoute决定替换query；SC-WATCH / query同步q并删create；无record/q反向监听，无定时GET；机会成本监听opportunityId，草稿未重置。不登记为按钮。

### 明确保留的边界

- 四提交及四关闭组共48代表状态槽已绑定，四取消额外变体不增加动作分母；剩122槽未映射。完整输入/错误/主题密度、真实UI与用户批准仍未完成。
- 恢复主次完整矩阵、完整字段与错误、主题/密度、async写入归属/KeepAlive/权限与实际浏览器history未验。
- 源比较历史失败阻断列表；新稿独立降级只为提案，SC-G01–08未关闭。
- P21按实际既有能力细化，P22单独处理；C方向选择/P16布局批准不授予本页批准。
- UiStatePanel默认文案须对照SW实际primary/secondary，不继承P19登录/home行为。
- PP/RQ复用P18，但P21写入由SC负责URL与机会/review版本；不重复全站独立源位置。
- SP无交互候选，规格提示及保存时版本语义仍单独审阅。
- 新稿本地内容tab不是源按钮，不从prototype标记新增业务分母。

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
