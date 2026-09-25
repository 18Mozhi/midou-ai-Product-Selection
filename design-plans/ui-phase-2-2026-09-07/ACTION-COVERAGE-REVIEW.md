# 全站动作与弹窗覆盖对账

基线8e54f6d8；机器对账加人工源语义映射，不替代用户审核。

- 当前源候选1701；旧登记1477；新身份605，旧表独有身份381。签名变化不等于增删业务能力。
- 已具体语义对应47页/1017源位置/961组；其中路由动作758组，转发/容器关联103组，其余明确排除。其余26页未完成此级映射，不称没有图或没有测试。
- 原覆盖门与用户批准保持；静态合同已有引用，不表示六态或全弹窗已验收。

已有视觉授权标记47页；语义动作授权0页。本清单不把视觉通过提升为动作通过，coverage.json中的正式页面签收保持原值。

组数按审阅页累计；共享源在多页重复引用，不代表同数量的全站独立业务动作。

## 逐页缺口

| 页 | 旧静态关联候选（非运行分母） | 语义审阅 | 下一步 |
| --- | --- | --- | --- |
| [P01 正在进入](page-specs/P01.md) | 2 | [1组](action-reviews/P01.json) | 6个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P02 登录](page-specs/P02.md) | 7 | [15组](action-reviews/P02.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P03 注册](page-specs/P03.md) | 7 | [15组](action-reviews/P03.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P04 找回密码](page-specs/P04.md) | 7 | [15组](action-reviews/P04.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P05 验证邮箱](page-specs/P05.md) | 7 | [15组](action-reviews/P05.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P06 重置密码](page-specs/P06.md) | 7 | [15组](action-reviews/P06.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P07 安全设置](page-specs/P07.md) | 7 | [15组](action-reviews/P07.json) | 78个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P08 选择组织与工作区](page-specs/P08.md) | 9 | [11组](action-reviews/P08.json) | 60个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P09 快速引导](page-specs/P09.md) | 1 | [6组](action-reviews/P09.json) | 36个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P10 外观偏好](page-specs/P10.md) | 4 | [13组](action-reviews/P10.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P11 个人中心](page-specs/P11.md) | 2 | [28组](action-reviews/P11.json) | 24个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P12 今日行动](page-specs/P12.md) | 47 | [16组](action-reviews/P12.json) | 90个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P13 今日工作](page-specs/P13.md) | 73 | [36组](action-reviews/P13.json) | 174个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P14 热点趋势](page-specs/P14.md) | 103 | [51组](action-reviews/P14.json) | 252个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P15 选品机会](page-specs/P15.md) | 153 | [35组](action-reviews/P15.json) | 162个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P16 创建选品](page-specs/P16.md) | 41 | [9组](action-reviews/P16.json) | 4个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P17 评分规则](page-specs/P17.md) | 61 | [19组](action-reviews/P17.json) | 96个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P18 机会详情](page-specs/P18.md) | 153 | [52组](action-reviews/P18.json) | 258个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P19 竞品监控](page-specs/P19.md) | 72 | [22组](action-reviews/P19.json) | 20个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P20 竞品监控规则](page-specs/P20.md) | 72 | [12组](action-reviews/P20.json) | 8个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P21 供应链与利润](page-specs/P21.md) | 87 | [38组](action-reviews/P21.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P22 费用与利润规则](page-specs/P22.md) | 63 | [20组](action-reviews/P22.json) | 104个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P23 全部任务](page-specs/P23.md) | 73 | [40组](action-reviews/P23.json) | 194个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P24 任务详情](page-specs/P24.md) | 73 | [34组](action-reviews/P24.json) | 164个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P25 审批中心](page-specs/P25.md) | 75 | [30组](action-reviews/P25.json) | 21个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P26 通知中心](page-specs/P26.md) | 56 | [19组](action-reviews/P26.json) | 3个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P27 自动化规则](page-specs/P27.md) | 52 | [16组](action-reviews/P27.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P28 报表与导出](page-specs/P28.md) | 47 | [11组](action-reviews/P28.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P29 治理概览](page-specs/P29.md) | 155 | [8组](action-reviews/P29.json) | 0个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P30 成员与邀请](page-specs/P30.md) | 155 | [24组](action-reviews/P30.json) | 30个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P31 角色与权限](page-specs/P31.md) | 155 | [25组](action-reviews/P31.json) | 44个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P32 工作区管理](page-specs/P32.md) | 155 | [23组](action-reviews/P32.json) | 28个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P33 团队管理](page-specs/P33.md) | 155 | [17组](action-reviews/P33.json) | 17个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P34 审批模板](page-specs/P34.md) | 155 | [13组](action-reviews/P34.json) | 15个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P35 组织数据](page-specs/P35.md) | 155 | [14组](action-reviews/P35.json) | 54个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P36 组织令牌](page-specs/P36.md) | 155 | [19组](action-reviews/P36.json) | 72个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P37 组织审计](page-specs/P37.md) | 155 | [16组](action-reviews/P37.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P38 平台概览](page-specs/P38.md) | 60 | [20组](action-reviews/P38.json) | 114个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P39 账号与组织](page-specs/P39.md) | 97 | [18组](action-reviews/P39.json) | 48个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P40 组织管理](page-specs/P40.md) | 97 | [16组](action-reviews/P40.json) | 66个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P41 创建组织](page-specs/P41.md) | 97 | [9组](action-reviews/P41.json) | 36个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P42 组织详情](page-specs/P42.md) | 97 | [14组](action-reviews/P42.json) | 54个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P43 用户管理](page-specs/P43.md) | 97 | [39组](action-reviews/P43.json) | 156个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P44 管理员管理](page-specs/P44.md) | 97 | [44组](action-reviews/P44.json) | 186个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P45 角色权限](page-specs/P45.md) | 97 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P46 来源设置](page-specs/P46.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P47 采集程序](page-specs/P47.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P48 热点来源](page-specs/P48.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P49 1688 启用检查](page-specs/P49.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P50 凭证与档案](page-specs/P50.md) | 78 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P51 采集任务](page-specs/P51.md) | 81 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P52 采集总览](page-specs/P52.md) | 81 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P53 网页登录采集](page-specs/P53.md) | 81 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P54 数据中心](page-specs/P54.md) | 58 | [18组](action-reviews/P54.json) | 26个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P55 质量与规则](page-specs/P55.md) | 59 | [8组](action-reviews/P55.json) | 48个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P56 内容管理](page-specs/P56.md) | 75 | [7组](action-reviews/P56.json) | 42个视觉状态槽待判断/映射；完整组合/真实Vue待验 |
| [P57 通知管理](page-specs/P57.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P58 配额管理](page-specs/P58.md) | 76 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P59 安全中心](page-specs/P59.md) | 69 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P60 开放平台](page-specs/P60.md) | 73 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P61 系统状态](page-specs/P61.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P62 链路日志](page-specs/P62.md) | 58 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P63 接口覆盖证据](page-specs/P63.md) | 75 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P64 备份与恢复](page-specs/P64.md) | 44 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P65 发布管理](page-specs/P65.md) | 45 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P66 服务拓扑](page-specs/P66.md) | 43 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P67 Redis 运行](page-specs/P67.md) | 36 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P68 MySQL 运行](page-specs/P68.md) | 39 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P69 文件存储](page-specs/P69.md) | 39 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P70 采集调度](page-specs/P70.md) | 49 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P71 容量边界](page-specs/P71.md) | 41 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
| [P72 界面状态](page-specs/P72.md) | 7 | 未逐项映射 | 对齐合同动作、动态变体、场景与测试 |
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

[逐项机器清单](action-reviews/P01.json)：2个局部源位置 → 1组；0类写入，1组路由动作，0组转发/容器关联不重复计动作。已映射0/0个源码字段位置，1/1处调用/内嵌容器，1个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有6个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-LANDING-CHECK 重新确定登录落点 / read | 2处；mounted、blocked-retry | [p01-loading · 1440](design/identity-direction-c/1440-p01-loading.png) / [p01-loading · 390](design/identity-direction-c/390-p01-loading.png)、[p01-blocked · 1440](design/identity-direction-c/1440-p01-blocked.png) / [p01-blocked · 390](design/identity-direction-c/390-p01-blocked.png)；其余见JSON | 真实会话、真实角色权限、全部服务端目标、生产错误边界与正式M07-03仍未验证。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| LandingRedirectSurface.vue / aside.1 / session-entry-explanation | inline-aside / related-scene-only | [p01-blocked · 1440](design/identity-direction-c/1440-p01-blocked.png) / [p01-blocked · 390](design/identity-direction-c/390-p01-blocked.png) | 该场景只登记说明区域的设计关联；不证明真实会话、权限或成功落点。 |

### 明确保留的边界

- 局部Vue覆盖加载、依赖受阻、缺少目标与过期转登录；真实会话/角色、目标页面自身权限及M07-03仍需独立验证。
- App路由准入与key、api-client/导航存储/主题、UiStatePanel内部消费者仍需实际Vue连续链验收；本清单不扩大局部源分母。
- 所有图片是既有C离线提案；不拿跨模式/跨路径相似画面替代完整当前URL下的键盘、秘密、权限和请求归属验证。

## P02 局部动作与共享消费者

[逐项机器清单](action-reviews/P02.json)：52个局部源位置 → 15组；4类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry | ；其余见JSON | 仅为P07页面控制；不在当前身份路由可操作。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；P07-footer | ；其余见JSON | 仅为P07页面控制；停用后手动导航，不自动跳转。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P03.json)：52个局部源位置 → 15组；4类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry | ；其余见JSON | 仅为P07页面控制；不在当前身份路由可操作。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；P07-footer | ；其余见JSON | 仅为P07页面控制；停用后手动导航，不自动跳转。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P04.json)：52个局部源位置 → 15组；4类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry | ；其余见JSON | 仅为P07页面控制；不在当前身份路由可操作。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；P07-footer | ；其余见JSON | 仅为P07页面控制；停用后手动导航，不自动跳转。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P05.json)：52个局部源位置 → 15组；4类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry | ；其余见JSON | 仅为P07页面控制；不在当前身份路由可操作。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；P07-footer | ；其余见JSON | 仅为P07页面控制；停用后手动导航，不自动跳转。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P06.json)：52个局部源位置 → 15组；4类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 两处同handler独立消费者。普通mfa仅P07初始可达；其他路径需RouterLink跨页。请求竞态/真实秘密生命周期与权限待验。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 普通管理实例非P02–P06路由本地可达；首次设置可从各身份页局部login结果进入。恢复码真实显示/清理和重复确认未验。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / excluded | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 原secret/recovery/currentPassword/code未清。新稿锁定/重新登录提示不证明服务撤销或秘密清理；非P07只作跨路由消费者参考。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry | ；其余见JSON | 仅为P07页面控制；不在当前身份路由可操作。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；P07-footer | ；其余见JSON | 仅为P07页面控制；停用后手动导航，不自动跳转。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P07.json)：52个局部源位置 → 15组；5类写入，13组路由动作，0组转发/容器关联不重复计动作。已映射13/16个源码字段位置，2/13处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有78个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 7处；all-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)；其余见JSON | 最终落点由根页解析；本页图不能证明鉴权或最近成员路径。 |
| ID-FORM-SUBMIT 按模式提交身份表单 / write | 9处；login、register、forgot、reset、mfa-challenge、submit-event、submit-button | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p02-challenge · 1440](design/identity-direction-c/1440-p02-challenge.png) / [p02-challenge · 390](design/identity-direction-c/390-p02-challenge.png)；其余见JSON | 同一submit组实际含五种业务请求，不按一张图全验。首次mode/局部切换/异步返回可不同；完整请求归属和五类表单逐控件六态待验。 |
| ID-SHOW-FORGOT 切到找回密码 / local | 2处；login-to-forgot | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p04-idle · 1440](design/identity-direction-c/1440-p04-idle.png) / [p04-idle · 390](design/identity-direction-c/390-p04-idle.png)；其余见JSON | 原型清输入是提案；离开进行中请求的晚到结果/焦点及浏览器历史未验。 |
| ID-SHOW-LOGIN 返回局部登录模式 / local | 8处；verify-result、seed-complete、footer | [p05-success · 1440](design/identity-direction-c/1440-p05-success.png) / [p05-success · 390](design/identity-direction-c/390-p05-success.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 三个入口不当一个按钮实例；未清密码/密钥/恢复码，重复返回与晚到请求/返焦待验。 |
| ID-SEED-PASSWORD 修改种子密码 / write | 2处；security-setup-change、relogin | [p02-seed · 1440](design/identity-direction-c/1440-p02-seed.png) / [p02-seed · 390](design/identity-direction-c/390-p02-seed.png)、[p02-seed-loading · 1440](design/identity-direction-c/1440-p02-seed-loading.png) / [p02-seed-loading · 390](design/identity-direction-c/390-p02-seed-loading.png)；其余见JSON | 真实输入不受普通form原生校验；返回登录不等于敏感ref全清。新稿busy/校验是提案，真实撤销与权限未验。 |
| ID-MFA-START 开始认证器绑定 / write | 4处；security-setup-enrollment、mfa-management-enrollment | [p02-seed-enroll · 1440](design/identity-direction-c/1440-p02-seed-enroll.png) / [p02-seed-enroll · 390](design/identity-direction-c/390-p02-seed-enroll.png)、[p07-enroll · 1440](design/identity-direction-c/1440-p07-enroll.png) / [p07-enroll · 390](design/identity-direction-c/390-p07-enroll.png)；其余见JSON | 首次设置和P07管理仍复用同一处理器；P07原生校验、单飞及本地输入清理已双端验证。真实会话、MFA种子与服务端权限未使用生产账号验证。 |
| ID-MFA-CONFIRM 确认启用认证器 / write | 4处；security-setup-confirm、mfa-management-confirm | [p02-seed-secret · 1440](design/identity-direction-c/1440-p02-seed-secret.png) / [p02-seed-secret · 390](design/identity-direction-c/390-p02-seed-secret.png)、[p02-seed-recovery · 1440](design/identity-direction-c/1440-p02-seed-recovery.png) / [p02-seed-recovery · 390](design/identity-direction-c/390-p02-seed-recovery.png)；其余见JSON | 恢复码仅在确认响应后显示；本地密钥/密码/验证码随确认清理。双端隔离浏览器流程通过，真实MFA材料与服务端启用记录未用生产账号验证。 |
| ID-MFA-DISABLE 停用MFA并撤销会话 / write | 2处；enabled、recovery-visible、disable | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disable-loading · 1440](design/identity-direction-c/1440-p07-disable-loading.png) / [p07-disable-loading · 390](design/identity-direction-c/390-p07-disable-loading.png)；其余见JSON | 停用成功后清理本地敏感输入并留在页面，明确提示服务端撤销会话；本地204夹具不证明生产Cookie撤销或账号权限。 |
| ID-LEGACY-SESSION-REVOKE 旧会话撤销模板 / excluded | 1处；legacy-sessions-not-public | ；其余见JSON | 不能以静态导入称本9页可操作，也不删除旧源码；个人安全入口实际前往P11，那里另审。 |
| ID-SHOW-REGISTER 切到本地注册 / local | 2处；all-non-register-modes | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p03-idle · 1440](design/identity-direction-c/1440-p03-idle.png) / [p03-idle · 390](design/identity-direction-c/390-p03-idle.png)；其余见JSON | 首次路径不改变，跨mode的密码/挑战/请求归属和焦点仍待验。 |
| ID-ACCOUNT-SECURITY 前往个人安全会话 / navigation | 3处；footer-security | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | 不是旧sessions模式；实际session-status守卫、会话加载和跨路由后返回未验。 |
| ID-MFA-RELOAD 重新读取 MFA 状态 / read | 1处；read-failure、retry-loading、retry-success | [p07-read-error · 1440](design/identity-direction-c/1440-p07-read-error.png) / [p07-read-error · 390](design/identity-direction-c/390-p07-read-error.png)、[p07-loading · 1440](design/identity-direction-c/1440-p07-loading.png) / [p07-loading · 390](design/identity-direction-c/390-p07-loading.png)；其余见JSON | 双端本地 Vue 通过；线上真实认证态与权限拒绝仍未实测。 |
| ID-MFA-RETURN-LOGIN 停用后手动返回登录 / navigation | 1处；enabled、disabled-success、binding | [p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)、[p07-disabled · 1440](design/identity-direction-c/1440-p07-disabled.png) / [p07-disabled · 390](design/identity-direction-c/390-p07-disabled.png)；其余见JSON | 本地路由和组件清理已验证；真实Cookie撤销后的身份服务响应未在生产账号执行。 |
| ID-MFA-ROUTE 前往MFA管理路由 / navigation | 6处；footer-mfa | [p02-idle · 1440](design/identity-direction-c/1440-p02-idle.png) / [p02-idle · 390](design/identity-direction-c/390-p02-idle.png)、[p07-enabled · 1440](design/identity-direction-c/1440-p07-enabled.png) / [p07-enabled · 390](design/identity-direction-c/390-p07-enabled.png)；其余见JSON | P07自身同path链接并不必然重新挂载；query-only改变不证明重置mode，实际守卫待验。 |
| ID-CONTEXT-ROUTE 继续选择组织 / excluded | 0处；login-success-no-route | [p02-success-no-route · 1440](design/identity-direction-c/1440-p02-success-no-route.png) / [p02-success-no-route · 390](design/identity-direction-c/390-p02-success-no-route.png)；其余见JSON | request成功不等于已进工作台；请求landing与mode切换竞态、最终权限未验。 |

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

[逐项机器清单](action-reviews/P08.json)：12个局部源位置 → 11组；2类写入，10组路由动作，0组转发/容器关联不重复计动作。已映射1/1个源码字段位置，1/1处调用/内嵌容器，1个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有60个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌返回根入口 / navigation | 1处；all-states | [p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)；其余见JSON | 仍由根入口决定角色落点，未验真实会话。 |
| NONACTION-ACCOUNT 当前账号占位 / excluded | 0处；placeholder | [p08-organizations · 1440](design/identity-direction-c/1440-p08-organizations.png) / [p08-organizations · 390](design/identity-direction-c/390-p08-organizations.png)；其余见JSON | 当前视觉明确为非交互文字；不新增用户菜单或账号业务动作。 |
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

[逐项机器清单](action-reviews/P09.json)：7个局部源位置 → 6组；0类写入，6组路由动作，0组转发/容器关联不重复计动作。已映射0/0个源码字段位置，0/0处调用/内嵌容器，0个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有36个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| ID-ROOT 品牌回根入口 / navigation | 1处；all-steps | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)；其余见JSON | 不写进度，真实根落点另验。 |
| ID-GUIDE-SKIP 跳过引导 / navigation | 1处；step-1、step-2、step-3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 不是完成标记，不清理服务端状态；所有步骤键盘和返回链待验。 |
| ID-GUIDE-STEP 直接选择三步骤 / local | 1处；1、2、3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)；其余见JSON | 没有URL同步/持久化；初始小数query可导致undefined，未修源组件。 |
| ID-GUIDE-PREVIOUS 上一步 / local | 1处；2-to-1、3-to-2 | [p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)、[p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 首步是隐藏而非disabled；逐状态/焦点/非法初值未全验。 |
| ID-GUIDE-NEXT 下一步 / local | 1处；1-to-2、2-to-3 | [p09-step-1 · 1440](design/identity-direction-c/1440-p09-step-1.png) / [p09-step-1 · 390](design/identity-direction-c/390-p09-step-1.png)、[p09-step-2 · 1440](design/identity-direction-c/1440-p09-step-2.png) / [p09-step-2 · 390](design/identity-direction-c/390-p09-step-2.png)；其余见JSON | 末步替换为完成链接，不补造busy请求或保存进度。 |
| ID-GUIDE-FINISH 结束引导返回根入口 / navigation | 2处；step-3 | [p09-step-3 · 1440](design/identity-direction-c/1440-p09-step-3.png) / [p09-step-3 · 390](design/identity-direction-c/390-p09-step-3.png)；其余见JSON | 只提供跳转，不代表已持久化完成或已验landing。 |

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

[逐项机器清单](action-reviews/P10.json)：13个局部源位置 → 13组；1类写入，11组路由动作，2组转发/容器关联不重复计动作。已映射0/0个源码字段位置，0/0处调用/内嵌容器，0个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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
| TH-TRACE 展开偏好读取关联编号 / local | 1处；request-id-present-collapsed、request-id-present-expanded | [read-error · 1440](design/appearance-direction-c/1440-read-error.png) / [read-error · 390](design/appearance-direction-c/390-read-error.png)、[read-invalid · 1440](design/appearance-direction-c/1440-read-invalid.png) / [read-invalid · 390](design/appearance-direction-c/390-read-invalid.png)；其余见JSON | 本地披露不计弹窗；编号内容归属与真实失败类型、辅助技术组合及全套错误场景仍独立待验。 |
| TH-PREVIEW 主题选项事件转发至本地预览 / wiring | 1处；deep-ocean、aurora-purple、cloud-white | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[aurora-purple-standard · 1440](design/appearance-direction-c/1440-aurora-purple-standard.png) / [aurora-purple-standard · 390](design/appearance-direction-c/390-aurora-purple-standard.png)；其余见JSON | 只记录ThemeStudio父级事件边；共享radio控件自身的交互和六态由TH-PREFERENCE-OPTION组单独核对。 |
| TH-DENSITY 密度选项事件转发至会话显示 / wiring | 1处；standard、compact | [deep-ocean-standard · 1440](design/appearance-direction-c/1440-deep-ocean-standard.png) / [deep-ocean-standard · 390](design/appearance-direction-c/390-deep-ocean-standard.png)、[deep-ocean-compact · 1440](design/appearance-direction-c/1440-deep-ocean-compact.png) / [deep-ocean-compact · 390](design/appearance-direction-c/390-deep-ocean-compact.png)；其余见JSON | 只记录ThemeStudio父级事件边；共享radio控件自身的交互和六态由TH-PREFERENCE-OPTION组单独核对。 |
| TH-PREFERENCE-OPTION 选择主题或密度选项 / local | 1处；theme-options-deep-ocean-aurora-purple-cloud-white、density-options-standard-compact | [theme-blue-focus · 1440](design/appearance-direction-c/1440-theme-blue-focus.png) / [theme-blue-focus · 390](design/appearance-direction-c/390-theme-blue-focus.png)、[theme-blue-pressed · 1440](design/appearance-direction-c/1440-theme-blue-pressed.png) / [theme-blue-pressed · 390](design/appearance-direction-c/390-theme-blue-pressed.png)；其余见JSON | 源具备radio角色、选中tabindex、方向键及禁用样式；此局部核对不证明辅助技术实测、所有主题/密度组合或全站消费者同步。 |
| TH-RESTORE 撤销主题预览 / local | 1处；dirty、default-fallback、restore-during-save | [dirty · 1440](design/appearance-direction-c/1440-dirty.png) / [dirty · 390](design/appearance-direction-c/390-dirty.png)、[density-only · 1440](design/appearance-direction-c/1440-density-only.png) / [density-only · 390](design/appearance-direction-c/390-density-only.png)；其余见JSON | 保存中撤销竞态源码隔离复现；新稿锁定不同，不以saving图声称源可安全撤销。 |
| TH-SAVE 保存主题偏好 / write | 1处；dirty-save、no-snapshot-version-zero、saving、saved、response-different、conflict、failed | [dirty · 1440](design/appearance-direction-c/1440-dirty.png) / [dirty · 390](design/appearance-direction-c/390-dirty.png)、[saving · 1440](design/appearance-direction-c/1440-saving.png) / [saving · 390](design/appearance-direction-c/390-saving.png)；其余见JSON | 请求不含density；GET验证theme而PUT结果直接赋saved。saved状态不等于预览已同步；真实版本竞争/幂等/审计/SQL与生命周期未验。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| TH-PREVIEW | @select / chooseTheme($event) | TH-PREFERENCE-OPTION |
| TH-DENSITY | @select / chooseDensity($event) | TH-PREFERENCE-OPTION |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |

### 明确保留的边界

- 12个ThemeStudio模板候选及1个共享radio控件候选分别映射；两条父级事件绑定只作接线核对，不重复计用户控件。
- 既有86PNG中七类控件图未提供通用逐action selector/state证明，66槽保守未映射，不等于缺66图。
- 源预览缓存/会话密度与服务器版本分域，保存中restore导致saved+dirty已复现未修；新统一busy与错误分类待审。
- role=radio的3主题/2密度是受控按钮而非v-model；全部实例键盘/六态/主题密度组合与真实缓存未验。
- 本页独立ThemeStudio，不拿共享主题浮层的回滚行为、签收或壳层图抵扣整页；无新持久化字段。

## P12 局部动作与共享消费者

[逐项机器清单](action-reviews/P12.json)：23个局部源位置 → 16组；2类写入，15组路由动作，1组转发/容器关联不重复计动作。已映射7/7个源码字段位置，1/1处调用/内嵌容器，1个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有90个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| HD-LOAD 读取首页与规则 / read | 2处；mounted、error、expired、forbidden、blocked、rule-read-failed、missing-selection | [loading · 1440](design/home-direction-c/1440-loading.png) / [loading · 390](design/home-direction-c/390-loading.png)、[error · 1440](design/home-direction-c/1440-error.png) / [error · 390](design/home-direction-c/390-error.png)；其余见JSON | 所有源primary仍重读、secondary无监听。新稿登录/选择范围等恢复链接和独立规则失败是提案，不按图升格实际链。 |
| HD-RULES 管理或查看规则 / navigation | 3处；header、no-manage、runtime-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[readonly · 1440](design/home-direction-c/1440-readonly.png) / [readonly · 390](design/home-direction-c/390-readonly.png)；其余见JSON | 三入口标签/权限分支分别保留；链接本身不要求trend:manage，不代表实际规则API授权。 |
| HD-OPPORTUNITIES 查看推荐清单与全部计数 / navigation | 2处；header-list、queue-all-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[quiet · 1440](design/home-direction-c/1440-quiet.png) / [quiet · 390](design/home-direction-c/390-quiet.png)；其余见JSON | 不能与子区view=recommended合并目标；recommended_count不由当前返回一条样例反推。 |
| HD-START 创建选品入口 / navigation | 1处；header-primary | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[not-configured · 1440](design/home-direction-c/1440-not-configured.png) / [not-configured · 390](design/home-direction-c/390-not-configured.png)；其余见JSON | 只导航，不在首页创建机会；后续P16权限/表单/完整壳层首屏另验。 |
| HD-RESUME 恢复第一条暂停规则 / write | 1处；first-paused、busy、failed、success-reload | [paused · 1440](design/home-direction-c/1440-paused.png) / [paused · 390](design/home-direction-c/390-paused.png)、[resume-busy · 1440](design/home-direction-c/1440-resume-busy.png) / [resume-busy · 390](design/home-direction-c/390-resume-busy.png)；其余见JSON | 仅第一条、不是批量恢复；已有单飞防重复和写入受理/后续读取分离反馈。真实权限、SQL写入和采集调度仍需独立验收。 |
| HD-SETUP 展开或收起首次设置 / local | 1处；open、close、reopen | [not-configured · 1440](design/home-direction-c/1440-not-configured.png) / [not-configured · 390](design/home-direction-c/390-not-configured.png)、[setup-closed · 1440](design/home-direction-c/1440-setup-closed.png) / [setup-closed · 390](design/home-direction-c/390-setup-closed.png)；其余见JSON | 自动展开要求明确not_configured、规则成功读取且无规则；缺automatic_selection保持未知，规则读取失败不开放创建/恢复。 |
| HD-CREATE-RULE 提交七字段规则表单 / write | 2处；form-submit、submit-button、ten-markets、empty-keywords、success-read-failure | [setup-edited · 1440](design/home-direction-c/1440-setup-edited.png) / [setup-edited · 390](design/home-direction-c/390-setup-edited.png)、[setup-invalid · 1440](design/home-direction-c/1440-setup-invalid.png) / [setup-invalid · 390](design/home-direction-c/390-setup-invalid.png)；其余见JSON | 关键词保留重复；语言按现有市场映射，渠道in_app、空分类null、默认名称首关键词。七字段写中锁定，重复提交被拦；读失败保留写入已受理事实。真实权限/SQL/调度待验。 |
| HD-RECOMMENDATION 进入推荐条目 / navigation | 1处；each-recommendation、null-score、long-title-reason | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[no-score · 1440](design/home-direction-c/1440-no-score.png) / [no-score · 390](design/home-direction-c/390-no-score.png)；其余见JSON | 按服务返回顺序，前端不重新排序；动态目标和全记录字段/长值/真实对象可达未穷尽。 |
| HD-CANDIDATES 查看规则命中候选 / navigation | 2处；empty-queue-priority、runtime-count | [candidates · 1440](design/home-direction-c/1440-candidates.png) / [candidates · 390](design/home-direction-c/390-candidates.png)、[running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)；其余见JSON | 源按truthy分支不是严格>0校验；空推荐提示与采集入口互斥，计数区域链接不互斥。 |
| HD-EVIDENCE 查看采集中商品 / navigation | 2处；empty-queue-fallback、runtime-count | [collecting · 1440](design/home-direction-c/1440-collecting.png) / [collecting · 390](design/home-direction-c/390-collecting.png)、[running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)；其余见JSON | 不把候选和采集提示同时显示；不把候选总量candidate_count当采集中。真实列表筛选链待验。 |
| HD-WORK-HEALTH 打开本人其他待办和异常 / navigation | 1处；task、approval、health、dynamic-row | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[long-items · 1440](design/home-direction-c/1440-long-items.png) / [long-items · 390](design/home-direction-c/390-long-items.png)；其余见JSON | changes/follows只参与total未逐项显示；不把数据说明total当当前列表行数，也不跨两个数组自行重排优先级。 |
| HD-TRUTH 展开数据说明 / local | 1处；collapsed、expanded | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[truth-open · 1440](design/home-direction-c/1440-truth-open.png) / [truth-open · 390](design/home-direction-c/390-truth-open.png)；其余见JSON | 不是TechnicalDetails复制；真实可见行与总投影不等同，所有主题/长文本/键盘状态待验。 |
| HD-RECOMMENDED-VIEW 按推荐view查看机会 / navigation | 1处；recommended-count | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[quiet · 1440](design/home-direction-c/1440-quiet.png) / [quiet · 390](design/home-direction-c/390-quiet.png)；其余见JSON | 与顶部无view入口保留不同语义；计数是运行摘要不代表已采纳或当前返回行数。 |
| HD-RUNTIME 展开自动运行详情 / local | 1处；collapsed、expanded、null-timestamps | [running · 1440](design/home-direction-c/1440-running.png) / [running · 390](design/home-direction-c/390-running.png)、[runtime-open · 1440](design/home-direction-c/1440-runtime-open.png) / [runtime-open · 390](design/home-direction-c/390-runtime-open.png)；其余见JSON | 四步骤标记依据不同计数>0，不是每个商品已通过流程的证明；candidate_count与rule_candidate_count字段不能互换。 |
| HD-LOAD-WIRING 首页读取状态事件转交 / wiring | 1处；primary-read | ；其余见JSON | 只记录共享组件事件接线，不单独增加按钮数量。 |
| HD-RULES-READ 重读规则列表 / read | 1处；rules-read-error | ；其余见JSON | 不推断真实RBAC或规则服务可用性。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| HD-LOAD-WIRING | @primary / load | HD-LOAD |

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
- 七字段内联form，无原生弹窗；rules失败与无规则明确区分，不开放创建/恢复。缺automatic_selection显示未知，不显示0；只有明确not_configured且规则成功读取为空才自动展开。
- 既有64图为独立工作面，未组合真实顶/底导航，不能证明实际首条推荐仍在手机首屏；84槽保守未映射。
- /home声明reset_on_scope，父key结合组织/工作区。返回旧缓存key、写入后重读失败和全生命周期仍未真实验收，不把缺watcher直接定性为跨范围泄露。
- NavigationShell实际surfaceProps传capabilities，HomeAutomationOverview接selection；没有把共享导航内部全部控件纳入20个局部候选分母。
- UiStatePanel默认secondary部分状态有标签但本页无监听；过期/无权限新恢复链接为提案，实际调用方未修改。
- 目录/home为reset_on_scope，父key含组织/工作区且KeepAlive最大12；本页读取代次隔离迟到响应。切换范围、缓存返回与真实权限仍须生产身份场景验收。

## P13 局部动作与共享消费者

[逐项机器清单](action-reviews/P13.json)：50个局部源位置 → 36组；3类写入，29组路由动作，5组转发/容器关联不重复计动作。已映射6/6个源码字段位置，7/7处调用/内嵌容器，15个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有174个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| task.list.create.open 新建入口 / local | 2处；header、empty、create_only、quick-create | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[empty · 1440](design/work-direction-c/1440-empty.png) / [empty · 390](design/work-direction-c/390-empty.png)；其余见JSON | 仅P13新建；P24编辑不属于当前入口。快捷创建仅mounted读取window.search，缓存重入行为仍待验。 |
| work.excluded.exports 排除任务中心专属导出分支 / excluded | 2处；business-tab、exports-tab、export-manage、export-open | ；其余见JSON | 不以P23导出图抵扣P13；若父传参改变须重新核对可达性。 |
| task.read.retry 重读当前本人队列 / read | 1处；error、forbidden、expired、rate_limited | [loading · 1440](design/work-direction-c/1440-loading.png) / [loading · 390](design/work-direction-c/390-loading.png)、[error · 1440](design/work-direction-c/1440-error.png) / [error · 390](design/work-direction-c/390-error.png)；其余见JSON | 旧缓存与迟到GET归属已有源码保护，不在此轮宣称真实Vue复验；重读按钮不是登录或权限恢复。 |
| task.list.page.previous 上一页 / local | 1处；first-disabled、later-page、loading-old-total | [pagination · 1440](design/work-direction-c/1440-pagination.png) / [pagination · 390](design/work-direction-c/390-pagination.png)；其余见JSON | 失败/loading时旧total仍可能显示分页；全分页与中途写入组合未验。 |
| task.list.page.next 下一页 / local | 1处；next、last-disabled | [pagination · 1440](design/work-direction-c/1440-pagination.png) / [pagination · 390](design/work-direction-c/390-pagination.png)；其余见JSON | 只选择本页不是跨页全选；全动态页码未穷尽。 |
| task.editor.close 关闭新建表单 / local | 3处；cancel、escape、busy-escape、reopen-draft | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[create_busy · 1440](design/work-direction-c/1440-create_busy.png) / [create_busy · 390](design/work-direction-c/390-create_busy.png)；其余见JSON | 按钮禁用不等于Escape锁定；发出POST后关闭不会撤销请求，源后续成功仍清表单。 |
| task.editor.create.submit 提交新建 / write | 2处；create、due-set、due-empty、busy、failure | [create · 1440](design/work-direction-c/1440-create.png) / [create · 390](design/work-direction-c/390-create.png)、[create_busy · 1440](design/work-direction-c/1440-create_busy.png) / [create_busy · 390](design/work-direction-c/390-create_busy.png)；其余见JSON | 不将原型窗内错误/字段锁定当作源实现；源notice在窗外，表单字段无busy disabled。相同函数PATCH只归P24。 |
| work.excluded.detail 排除任务详情事件中转 / excluded | 2处；detail-actions、edit、comment、action-fields | ；其余见JSON | 不是删除组件；仅按当前实际入口排除P13。P24及异常组合另验。 |
| task.delete.close 关闭删除表单 / local | 3处；cancel、escape、reopen-cleared | [delete · 1440](design/work-direction-c/1440-delete.png) / [delete · 390](design/work-direction-c/390-delete.png)；其余见JSON | 执行中Escape可清deleting；removeTask在await后仍读取deleting.value.id，完整竞态待验。 |
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
| task.batch.close 关闭批量确认 / local | 3处；return、escape、busy-close、reopen | [pause · 1440](design/work-direction-c/1440-pause.png) / [pause · 390](design/work-direction-c/390-pause.png)、[batch_error · 1440](design/work-direction-c/1440-batch_error.png) / [batch_error · 390](design/work-direction-c/390-batch_error.png)；其余见JSON | 关闭不会取消已发请求。新稿字段/忙碌锁为提案，不能称源已修。 |
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

[逐项机器清单](action-reviews/P14.json)：65个局部源位置 → 51组；8类写入，42组路由动作，9组转发/容器关联不重复计动作。已映射18/18个源码字段位置，10/10处调用/内嵌容器，15个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P15.json)：67个局部源位置 → 35组；4类写入，27组路由动作，6组转发/容器关联不重复计动作。已映射20/20个源码字段位置，17/17处调用/内嵌容器，35个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P16.json)：11个局部源位置 → 9组；2类写入，9组路由动作，0组转发/容器关联不重复计动作。已映射5/5个源码字段位置，4/4处调用/内嵌容器，12个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有4个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有2个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| J-NAV-LIST 返回机会列表 / navigation | 1处；input、running、terminal、busy | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png)、[running · 1440](design/journey-direction-c/1440-running.png) / [running · 390](design/journey-direction-c/390-running.png)；其余见JSON | deactivate保护读取，不阻断已发POST；离开后的成功归属必须独立验证。 当前源码链接不禁用、无本地提交忙碌态；缺返回ID时入口不渲染，不伪造disabled。 |
| J-STATE-RECOVERY 状态面板主次恢复 / local | 1处；restore-failed、restore-expired、restore-forbidden、restore-blocked、read-failed、read-expired、read-forbidden、read-blocked、create-failed | [restore-failed · 1440](design/journey-direction-c/1440-restore-failed.png) / [restore-failed · 390](design/journey-direction-c/390-restore-failed.png)、[restore-expired · 1440](design/journey-direction-c/1440-restore-expired.png) / [restore-expired · 390](design/journey-direction-c/390-restore-expired.png)；其余见JSON | 两个事件均保留；无journey/resumeId时共享重新登录等文案不改变reset行为；恢复副说明不是鉴权修复，真实401/403/存储异常待验。 代表视觉映射只覆盖重试主按钮，副按钮另有4态；无ID时主动作reset，error副动作history.back，expired无副按钮，blocked/forbidden仅说明。图稿的重试忙碌禁用和无ID时“重新输入”文案为待审改进，不宣称Vue已有。 2026-09-10实际Vue已验恢复重试的面板未渲染不冒充disabled，精确GET原ID一次；已保存ID的blocked副说明改为读取受阻，不再误提创建。新建无ID仍为创建说明。 |
| J-CREATE 提交三类选品线索 / write | 2处；keyword、asin、product_url、invalid、busy、failed、late-inactive-success | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png)、[asin · 1440](design/journey-direction-c/1440-asin.png) / [asin · 390](design/journey-direction-c/390-asin.png)；其余见JSON | 源函数隔离证实deactivate后旧成功仍applyJourney并写内存替身活动ID，active=false时不设timer；未认证真实缓存/多标签，原未知错误文案未创建不代表无持久化。 |
| J-TIMELINE 展开或收起处理时间轴 / local | 1处；collapsed、expanded | [results · 1440](design/journey-direction-c/1440-results.png) / [results · 390](design/journey-direction-c/390-results.png)；其余见JSON | 真实Vue已补原生四态、中心命中与零副作用，见actualVueLayoutEvidence；旧离线槽仍不冒称该真实Vue证据或全站审批。 |
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
| SelectionJourney.vue / aside.1 / stages | inline-aside / related-scene-only | [results · 1440](design/journey-direction-c/1440-results.png) / [results · 390](design/journey-direction-c/390-results.png) | 真实Vue阶段切换仅在隔离数据复测，不证明生产任务完成。 |
| SelectionJourney.vue / form.1 / keyword | form-container / matching-inline-form-scene | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.1 / asin | form-container / matching-inline-form-scene | [asin · 1440](design/journey-direction-c/1440-asin.png) / [asin · 390](design/journey-direction-c/390-asin.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.1 / url | form-container / matching-inline-form-scene | [url · 1440](design/journey-direction-c/1440-url.png) / [url · 390](design/journey-direction-c/390-url.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / aside.2 / keyword | inline-aside / related-scene-only | [keyword · 1440](design/journey-direction-c/1440-keyword.png) / [keyword · 390](design/journey-direction-c/390-keyword.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / observe-edited | form-container / matching-inline-form-scene | [observe-edited · 1440](design/journey-direction-c/1440-observe-edited.png) / [observe-edited · 390](design/journey-direction-c/390-observe-edited.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / reject-edited | form-container / matching-inline-form-scene | [reject-edited · 1440](design/journey-direction-c/1440-reject-edited.png) / [reject-edited · 390](design/journey-direction-c/390-reject-edited.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / adoption-pending | form-container / related-scene-only | [adoption-pending · 1440](design/journey-direction-c/1440-adoption-pending.png) / [adoption-pending · 390](design/journey-direction-c/390-adoption-pending.png) | 关联是现有离线提案，不是控件全状态/实际Vue/主题/权限/生命周期通过；未批准部分不得迁入生产。 |
| SelectionJourney.vue / form.2 / adopt-ready | form-container / matching-inline-form-scene | [adopt-ready · 1440](design/journey-direction-c/1440-adopt-ready.png) / [adopt-ready · 390](design/journey-direction-c/390-adopt-ready.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / gate-cost | form-container / matching-inline-form-scene | [gate-cost · 1440](design/journey-direction-c/1440-gate-cost.png) / [gate-cost · 390](design/journey-direction-c/390-gate-cost.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / adopt-conflict | form-container / matching-inline-form-scene | [adopt-conflict · 1440](design/journey-direction-c/1440-adopt-conflict.png) / [adopt-conflict · 390](design/journey-direction-c/390-adopt-conflict.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |
| SelectionJourney.vue / form.2 / adopt-refreshed | form-container / matching-inline-form-scene | [adopt-refreshed · 1440](design/journey-direction-c/1440-adopt-refreshed.png) / [adopt-refreshed · 390](design/journey-direction-c/390-adopt-refreshed.png) | 整体布局已获批，具体控件/真实运行与全主题仍未验收。 |

### 明确保留的边界

- 2026-09-10控件补充：114实际Vue图/170检查，原生hover/focus/active按真实输入采集；手机footer换列挤出按钮已修复，blocked恢复副说明仅条件纠正，API/质量门未改。
- 2026-09-10：P16批准布局已局部落地Vue，24张真实挂载图另册，旧离线提案不替代真实验收；新增summary组和只读阶段aside，表单文案导致签名变化，业务handler及五模型不变。
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

[逐项机器清单](action-reviews/P17.json)：28个局部源位置 → 19组；2类写入，16组路由动作，3组转发/容器关联不重复计动作。已映射9/9个源码字段位置，8/8处调用/内嵌容器，30个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P18.json)：95个局部源位置 → 52组；12类写入，43组路由动作，8组转发/容器关联不重复计动作。已映射34/34个源码字段位置，23/23处调用/内嵌容器，38个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P19.json)：39个局部源位置 → 22组；5类写入，18组路由动作，2组转发/容器关联不重复计动作。已映射10/10个源码字段位置，7/7处调用/内嵌容器，22个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P20.json)：39个局部源位置 → 12组；2类写入，8组路由动作，2组转发/容器关联不重复计动作。已映射10/10个源码字段位置，7/7处调用/内嵌容器，22个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

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

[逐项机器清单](action-reviews/P21.json)：54个局部源位置 → 38组；9类写入，31组路由动作，7组转发/容器关联不重复计动作。已映射25/25个源码字段位置，12/12处调用/内嵌容器，33个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有0个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有20个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| SC-NAV-SELF 供应商找货页签 / navigation | 1处；SC-NAV sourcing | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[control-nav-self-default · 1440](design/sourcing-direction-c/1440-control-nav-self-default.png) / [control-nav-self-default · 390](design/sourcing-direction-c/390-control-nav-self-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-NAV-RULES 费用规则页签 / navigation | 1处；SC-NAV cost-rules | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[control-nav-rules-default · 1440](design/sourcing-direction-c/1440-control-nav-rules-default.png) / [control-nav-rules-default · 390](design/sourcing-direction-c/390-control-nav-rules-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-S-OPEN 发起找货 / local | 1处；SC-S-OPEN 管理者创建 | [search-keyword · 1440](design/sourcing-direction-c/1440-search-keyword.png) / [search-keyword · 390](design/sourcing-direction-c/390-search-keyword.png)、[search-image · 1440](design/sourcing-direction-c/1440-search-image.png) / [search-image · 390](design/sourcing-direction-c/390-search-image.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-STATE 整页状态主次操作 / read | 1处；SC-STATE 主/次恢复或创建 | [empty · 1440](design/sourcing-direction-c/1440-empty.png) / [empty · 390](design/sourcing-direction-c/390-empty.png)、[loading · 1440](design/sourcing-direction-c/1440-loading.png) / [loading · 390](design/sourcing-direction-c/390-loading.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-SEARCH-RECOVERY 空筛选恢复 / read | 1处；SC-SEARCH-CLEAR / 空筛选次动作 | [search-empty · 1440](design/sourcing-direction-c/1440-search-empty.png) / [search-empty · 390](design/sourcing-direction-c/390-search-empty.png)、[control-recovery-search-primary-default · 1440](design/sourcing-direction-c/1440-control-recovery-search-primary-default.png) / [control-recovery-search-primary-default · 390](design/sourcing-direction-c/390-control-recovery-search-primary-default.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-DETAIL 选择找货记录 / read | 1处；SC-DETAIL 读对象并同步record | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[keyword-record · 1440](design/sourcing-direction-c/1440-keyword-record.png) / [keyword-record · 390](design/sourcing-direction-c/390-keyword-record.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-REFRESH 重新采集 / write | 1处；SC-REFRESH 管理者POST当前对象 | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[queued · 1440](design/sourcing-direction-c/1440-queued.png) / [queued · 390](design/sourcing-direction-c/390-queued.png)；其余见JSON | 双端六态代表图已绑定；比较按至少两家与busy、重新采集按busy。pending仅记录不可变请求意图、无真实HTTP或成功/失败回调验收；SC-G01–08、主题密度、完整变体、批准与真实Vue仍待。 |
| SC-NAV-RULES-CONTEXT 当前找货费用规则 / navigation | 1处；SC-NAV cost-rules含from | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[cost-missing · 1440](design/sourcing-direction-c/1440-cost-missing.png) / [cost-missing · 390](design/sourcing-direction-c/390-cost-missing.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-DELETE-OPEN 打开删除确认 / local | 1处；SC-DELETE-OPEN 管理者选中目标 | [delete · 1440](design/sourcing-direction-c/1440-delete.png) / [delete · 390](design/sourcing-direction-c/390-delete.png)、[control-main-delete-open-default · 1440](design/sourcing-direction-c/1440-control-main-delete-open-default.png) / [control-main-delete-open-default · 390](design/sourcing-direction-c/390-control-main-delete-open-default.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-NAV-COLLECTION 受权采集明细 / navigation | 1处；SC-NAV 受权采集明细 | [platform-inspect · 1440](design/sourcing-direction-c/1440-platform-inspect.png) / [platform-inspect · 390](design/sourcing-direction-c/390-platform-inspect.png)、[control-nav-collection-default · 1440](design/sourcing-direction-c/1440-control-nav-collection-default.png) / [control-nav-collection-default · 390](design/sourcing-direction-c/390-control-nav-collection-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-ERP ERP原页面 / navigation | 1处；SC-ERP 原始ERP新窗口 | [erp · 1440](design/sourcing-direction-c/1440-erp.png) / [erp · 390](design/sourcing-direction-c/390-erp.png)、[control-nav-erp-default · 1440](design/sourcing-direction-c/1440-control-nav-erp-default.png) / [control-nav-erp-default · 390](design/sourcing-direction-c/390-control-nav-erp-default.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-SELECT 选择报价对比 / local | 1处；SC-SELECT 勾选与实际最多五项同步 | [select-one · 1440](design/sourcing-direction-c/1440-select-one.png) / [select-one · 390](design/sourcing-direction-c/390-select-one.png)、[select-two · 1440](design/sourcing-direction-c/1440-select-two.png) / [select-two · 390](design/sourcing-direction-c/390-select-two.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-SOURCE 原始商品页 / navigation | 1处；SC-SOURCE 原始商品新窗口 | [workspace · 1440](design/sourcing-direction-c/1440-workspace.png) / [workspace · 390](design/sourcing-direction-c/390-workspace.png)、[missing-quote · 1440](design/sourcing-direction-c/1440-missing-quote.png) / [missing-quote · 390](design/sourcing-direction-c/390-missing-quote.png)；其余见JSON | 双端四态代表图及精确目标/target/rel已绑定；合成路径和导航意图不是实际router/外站/权限验收。主题密度/全部对象/来源和具体批准仍待；导航无disabled/busy，不变更原行为。 |
| SC-QUOTE-OPEN 打开报价确认 / local | 1处；SC-QUOTE-OPEN 管理者无quote | [quote · 1440](design/sourcing-direction-c/1440-quote.png) / [quote · 390](design/sourcing-direction-c/390-quote.png)、[quote-defaults · 1440](design/sourcing-direction-c/1440-quote-defaults.png) / [quote-defaults · 390](design/sourcing-direction-c/390-quote-defaults.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-PURCHASE-OPEN 打开采购任务 / local | 1处；SC-PURCHASE-OPEN 管理者已有quote | [purchase · 1440](design/sourcing-direction-c/1440-purchase.png) / [purchase · 390](design/sourcing-direction-c/390-purchase.png)、[control-main-purchase-open-default · 1440](design/sourcing-direction-c/1440-control-main-purchase-open-default.png) / [control-main-purchase-open-default · 390](design/sourcing-direction-c/390-control-main-purchase-open-default.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
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
| SC-COST-REVIEW-OPEN 通过/驳回内联表单 / local | 2处；SC-COST-REVIEW rejected打开、SC-COST-REVIEW approved打开 | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |
| SC-COST-REVIEW-SUBMIT 提交复核结论 / write | 2处；SC-COST-REVIEW 表单提交、SC-COST-REVIEW 提交按钮 | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 双端六态代表图已绑定；成本区busy独立于找货，自身请求与同区其他写请求禁用分开。精确机会/复核版本、0金额/时间、字段有效性/禁用、不可变意图及重复提交守卫仅离线验证，非真实Vue函数守卫或实际审批/计算。SC-G01–08、成本读取在途/全部字段对象主题/具体批准与生产验收仍待。 |
| SC-COST-REVIEW-CANCEL 取消内联复核 / local | 1处；SC-COST-REVIEW-CANCEL | [cost-review-approved · 1440](design/sourcing-direction-c/1440-cost-review-approved.png) / [cost-review-approved · 390](design/sourcing-direction-c/390-cost-review-approved.png)、[cost-review-rejected · 1440](design/sourcing-direction-c/1440-cost-review-rejected.png) / [cost-review-rejected · 390](design/sourcing-direction-c/390-cost-review-rejected.png)；其余见JSON | 四态代表图已绑定；disabled/busy依据sourceStateApplicability登记为当前源码无此控件呈现，不增加图片数或通过数。权限隐藏、选择上限、读取在途、全部变体/字段/主题密度、具体批准和真实Vue生命周期仍需核对。 |

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

- 150个代表状态槽有精确图引用，20个disabled/busy槽按当前源码无此控件呈现单列；未分类代表槽0，不增减38语义组或等同全状态通过。完整输入/错误/全部变体/主题密度、真实UI与用户批准仍未完成。
- 恢复主次完整矩阵、完整字段与错误、主题/密度、async写入归属/KeepAlive/权限与实际浏览器history未验。
- 源比较历史失败阻断列表；新稿独立降级只为提案，SC-G01–08未关闭。
- P21按实际既有能力细化，P22单独处理；C方向选择/P16布局批准不授予本页批准。
- UiStatePanel默认文案须对照SW实际primary/secondary，不继承P19登录/home行为。
- PP/RQ复用P18，但P21写入由SC负责URL与机会/review版本；不重复全站独立源位置。
- SP无交互候选，规格提示及保存时版本语义仍单独审阅。
- 新稿本地内容tab不是源按钮，不从prototype标记新增业务分母。

## P22 局部动作与共享消费者

[逐项机器清单](action-reviews/P22.json)：30个局部源位置 → 20组；2类写入，18组路由动作，2组转发/容器关联不重复计动作。已映射19/19个源码字段位置，7/7处调用/内嵌容器，32个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有104个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| SC-R-BACK 返回找货上下文 / navigation | 2处；directory、no-active | [directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)、[no-active · 1440](design/cost-rules-direction-c/1440-no-active.png) / [no-active · 390](design/cost-rules-direction-c/390-no-active.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-CREATE 打开费用草稿 / local | 2处；create-blank、create-zero、create-automatic | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png)、[create-zero · 1440](design/cost-rules-direction-c/1440-create-zero.png) / [create-zero · 390](design/cost-rules-direction-c/390-create-zero.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-STATE 空目录创建、读取恢复和返回 / local | 1处；loading、empty、error、expired、forbidden、rate-limited、blocked、readonly | [loading · 1440](design/cost-rules-direction-c/1440-loading.png) / [loading · 390](design/cost-rules-direction-c/390-loading.png)、[empty · 1440](design/cost-rules-direction-c/1440-empty.png) / [empty · 390](design/cost-rules-direction-c/390-empty.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-SEARCH 本地搜索和状态筛选 / local | 1处；directory、filter-empty、page-two | [directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)、[filter-empty · 1440](design/cost-rules-direction-c/1440-filter-empty.png) / [filter-empty · 390](design/cost-rules-direction-c/390-filter-empty.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-RESET 清除筛选 / local | 1处；filter-empty、directory | [filter-empty · 1440](design/cost-rules-direction-c/1440-filter-empty.png) / [filter-empty · 390](design/cost-rules-direction-c/390-filter-empty.png)、[directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-SELECT 选择规则版本 / local | 1处；directory、page-two、status-active | [directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)、[page-two · 1440](design/cost-rules-direction-c/1440-page-two.png) / [page-two · 390](design/cost-rules-direction-c/390-page-two.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-PAGE-PREV 上一页 / local | 1处；page-two、directory | [page-two · 1440](design/cost-rules-direction-c/1440-page-two.png) / [page-two · 390](design/cost-rules-direction-c/390-page-two.png)、[directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-PAGE-NEXT 下一页 / local | 1处；directory、page-two | [directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png)、[page-two · 1440](design/cost-rules-direction-c/1440-page-two.png) / [page-two · 390](design/cost-rules-direction-c/390-page-two.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-SOURCE 查看汇率来源 / navigation | 1处；exchange-basis | [exchange-basis · 1440](design/cost-rules-direction-c/1440-exchange-basis.png) / [exchange-basis · 390](design/cost-rules-direction-c/390-exchange-basis.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-SUBMIT 打开提交审批确认 / local | 1处；submit-confirm、submit-conflict | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png)、[submit-conflict · 1440](design/cost-rules-direction-c/1440-submit-conflict.png) / [submit-conflict · 390](design/cost-rules-direction-c/390-submit-conflict.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-APPROVE 两角色批准入口 / local | 2处；selection-approve-confirm、admin-approve-confirm、one-approved、manager-only | [selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png)、[admin-approve-confirm · 1440](design/cost-rules-direction-c/1440-admin-approve-confirm.png) / [admin-approve-confirm · 390](design/cost-rules-direction-c/390-admin-approve-confirm.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-REJECT 两角色拒绝入口 / local | 2处；selection-reject-confirm、admin-reject-confirm | [selection-reject-confirm · 1440](design/cost-rules-direction-c/1440-selection-reject-confirm.png) / [selection-reject-confirm · 390](design/cost-rules-direction-c/390-selection-reject-confirm.png)、[admin-reject-confirm · 1440](design/cost-rules-direction-c/1440-admin-reject-confirm.png) / [admin-reject-confirm · 390](design/cost-rules-direction-c/390-admin-reject-confirm.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-PUBLISH 打开发布确认 / local | 1处；publish-confirm、publish-conflict | [publish-confirm · 1440](design/cost-rules-direction-c/1440-publish-confirm.png) / [publish-confirm · 390](design/cost-rules-direction-c/390-publish-confirm.png)、[publish-conflict · 1440](design/cost-rules-direction-c/1440-publish-conflict.png) / [publish-conflict · 390](design/cost-rules-direction-c/390-publish-conflict.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-ROLLBACK 打开回滚确认 / local | 1处；rollback-confirm、no-rollback、rollback-conflict | [rollback-confirm · 1440](design/cost-rules-direction-c/1440-rollback-confirm.png) / [rollback-confirm · 390](design/cost-rules-direction-c/390-rollback-confirm.png)、[no-rollback · 1440](design/cost-rules-direction-c/1440-no-rollback.png) / [no-rollback · 390](design/cost-rules-direction-c/390-no-rollback.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-CREATE-DEFINITION 草稿原生窗口定义 / wiring | 1处；create-blank、create-automatic | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png)、[create-automatic · 1440](design/cost-rules-direction-c/1440-create-automatic.png) / [create-automatic · 390](design/cost-rules-direction-c/390-create-automatic.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-CREATE-CLOSE 关闭或取消草稿 / local | 3处；create-blank、create-busy、create-conflict | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png)、[create-busy · 1440](design/cost-rules-direction-c/1440-create-busy.png) / [create-busy · 390](design/cost-rules-direction-c/390-create-busy.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-CREATE-SUBMIT 保存草稿 / write | 2处；create-zero、create-automatic、create-invalid、create-busy、create-conflict、create-saved | [create-zero · 1440](design/cost-rules-direction-c/1440-create-zero.png) / [create-zero · 390](design/cost-rules-direction-c/390-create-zero.png)、[create-automatic · 1440](design/cost-rules-direction-c/1440-create-automatic.png) / [create-automatic · 390](design/cost-rules-direction-c/390-create-automatic.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-ACTION-DEFINITION 七种版本操作窗口定义 / wiring | 1处；submit-confirm、selection-approve-confirm、selection-reject-confirm、admin-approve-confirm、admin-reject-confirm、publish-confirm、rollback-confirm | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png)、[selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-ACTION-CLOSE 关闭或取消版本操作 / local | 3处；submit-confirm、rollback-confirm、publish-busy | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png)、[rollback-confirm · 1440](design/cost-rules-direction-c/1440-rollback-confirm.png) / [rollback-confirm · 390](design/cost-rules-direction-c/390-rollback-confirm.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| SC-R-ACTION-SUBMIT 确认版本操作 / write | 2处；submit-confirm、selection-approve-confirm、selection-reject-confirm、admin-approve-confirm、admin-reject-confirm、publish-confirm、rollback-confirm、submit-busy、submit-conflict | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png)、[selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png)；其余见JSON | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| SC-R-CREATE-DEFINITION | 容器定义，无额外事件 | SC-R-CREATE-SUBMIT |
| SC-R-ACTION-DEFINITION | 容器定义，无额外事件 | SC-R-ACTION-SUBMIT |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| CostRuleConsole.vue / search | search.trim().toLocaleLowerCase搜索名称/市场/平台/版本；不请求 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / statusFilter | statusFilter枚举来自当前rules，all为全部；不持久化 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.market | 市场required≤40，默认US | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.platform | 平台required≤80，默认amazon；自动phone_case校验amazon | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.version_code | 版本required≤64，提交trim；不自动生成 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.name | 名称required≤160，提交trim | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.effective_from | 规则生效日期required，默认本地日 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.platform_fee | 平台费0–100，初始空，显式0有效 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.payment_fee | 支付费0–100，初始空，显式0有效 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.tax | 税费0–100，初始空，显式0有效 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.fulfillment | 履约成本>=0，初始空，显式0有效 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.currency | 币种required三字母，默认USD，发送trim uppercase；ISO合法性由后端验证 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.logistics | 物流可选，空省略，0保留；自动phone_case必填 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.automatic_product_family | 默认空仅人工，phone_case要求Amazon+物流+汇率依据 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.conversion_rate | 正汇率，可选；CNY→表单币种；不得解释为只支持USD | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.conversion_effective_on | 汇率日期默认本地日；有数值/URL才要求完整依据，未来日期由后端查 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.conversion_source_url | 来源URL需HTTPS，本地不等于无凭证/可达证据验证 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / rollbackTargetId | 回滚目标同市场平台approved/retired，默认首条；变更不发送请求 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / actionReason | 原因required minlength2 maxlength1000；submit再trim至少2，原生与处理器限制分层 | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| CostRuleConsole.vue / form.1 / directory | form-container / matching-inline-form-scene | [directory · 1440](design/cost-rules-direction-c/1440-directory.png) / [directory · 390](design/cost-rules-direction-c/390-directory.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.1 / filter-empty | form-container / matching-inline-form-scene | [filter-empty · 1440](design/cost-rules-direction-c/1440-filter-empty.png) / [filter-empty · 390](design/cost-rules-direction-c/390-filter-empty.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.1 / create-blank | native-dialog / matching-dialog-scene | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.1 / create-zero | native-dialog / matching-dialog-scene | [create-zero · 1440](design/cost-rules-direction-c/1440-create-zero.png) / [create-zero · 390](design/cost-rules-direction-c/390-create-zero.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.1 / create-automatic | native-dialog / matching-dialog-scene | [create-automatic · 1440](design/cost-rules-direction-c/1440-create-automatic.png) / [create-automatic · 390](design/cost-rules-direction-c/390-create-automatic.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.1 / create-conflict | native-dialog / matching-dialog-scene | [create-conflict · 1440](design/cost-rules-direction-c/1440-create-conflict.png) / [create-conflict · 390](design/cost-rules-direction-c/390-create-conflict.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.1 / create-busy | native-dialog / matching-dialog-scene | [create-busy · 1440](design/cost-rules-direction-c/1440-create-busy.png) / [create-busy · 390](design/cost-rules-direction-c/390-create-busy.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.2 / create-blank | form-container / matching-dialog-scene | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.2 / create-zero | form-container / matching-dialog-scene | [create-zero · 1440](design/cost-rules-direction-c/1440-create-zero.png) / [create-zero · 390](design/cost-rules-direction-c/390-create-zero.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.2 / create-automatic | form-container / matching-dialog-scene | [create-automatic · 1440](design/cost-rules-direction-c/1440-create-automatic.png) / [create-automatic · 390](design/cost-rules-direction-c/390-create-automatic.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.1 / create-blank | inline-aside / related-scene-only | [create-blank · 1440](design/cost-rules-direction-c/1440-create-blank.png) / [create-blank · 390](design/cost-rules-direction-c/390-create-blank.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / submit-confirm | native-dialog / matching-dialog-scene | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / selection-approve-confirm | native-dialog / matching-dialog-scene | [selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / selection-reject-confirm | native-dialog / matching-dialog-scene | [selection-reject-confirm · 1440](design/cost-rules-direction-c/1440-selection-reject-confirm.png) / [selection-reject-confirm · 390](design/cost-rules-direction-c/390-selection-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / admin-approve-confirm | native-dialog / matching-dialog-scene | [admin-approve-confirm · 1440](design/cost-rules-direction-c/1440-admin-approve-confirm.png) / [admin-approve-confirm · 390](design/cost-rules-direction-c/390-admin-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / admin-reject-confirm | native-dialog / matching-dialog-scene | [admin-reject-confirm · 1440](design/cost-rules-direction-c/1440-admin-reject-confirm.png) / [admin-reject-confirm · 390](design/cost-rules-direction-c/390-admin-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / publish-confirm | native-dialog / matching-dialog-scene | [publish-confirm · 1440](design/cost-rules-direction-c/1440-publish-confirm.png) / [publish-confirm · 390](design/cost-rules-direction-c/390-publish-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / dialog.2 / rollback-confirm | native-dialog / matching-dialog-scene | [rollback-confirm · 1440](design/cost-rules-direction-c/1440-rollback-confirm.png) / [rollback-confirm · 390](design/cost-rules-direction-c/390-rollback-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / submit-confirm | form-container / matching-dialog-scene | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / selection-approve-confirm | form-container / matching-dialog-scene | [selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / selection-reject-confirm | form-container / matching-dialog-scene | [selection-reject-confirm · 1440](design/cost-rules-direction-c/1440-selection-reject-confirm.png) / [selection-reject-confirm · 390](design/cost-rules-direction-c/390-selection-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / admin-approve-confirm | form-container / matching-dialog-scene | [admin-approve-confirm · 1440](design/cost-rules-direction-c/1440-admin-approve-confirm.png) / [admin-approve-confirm · 390](design/cost-rules-direction-c/390-admin-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / admin-reject-confirm | form-container / matching-dialog-scene | [admin-reject-confirm · 1440](design/cost-rules-direction-c/1440-admin-reject-confirm.png) / [admin-reject-confirm · 390](design/cost-rules-direction-c/390-admin-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / publish-confirm | form-container / matching-dialog-scene | [publish-confirm · 1440](design/cost-rules-direction-c/1440-publish-confirm.png) / [publish-confirm · 390](design/cost-rules-direction-c/390-publish-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / form.3 / rollback-confirm | form-container / matching-dialog-scene | [rollback-confirm · 1440](design/cost-rules-direction-c/1440-rollback-confirm.png) / [rollback-confirm · 390](design/cost-rules-direction-c/390-rollback-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / submit-confirm | inline-aside / related-scene-only | [submit-confirm · 1440](design/cost-rules-direction-c/1440-submit-confirm.png) / [submit-confirm · 390](design/cost-rules-direction-c/390-submit-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / selection-approve-confirm | inline-aside / related-scene-only | [selection-approve-confirm · 1440](design/cost-rules-direction-c/1440-selection-approve-confirm.png) / [selection-approve-confirm · 390](design/cost-rules-direction-c/390-selection-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / selection-reject-confirm | inline-aside / related-scene-only | [selection-reject-confirm · 1440](design/cost-rules-direction-c/1440-selection-reject-confirm.png) / [selection-reject-confirm · 390](design/cost-rules-direction-c/390-selection-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / admin-approve-confirm | inline-aside / related-scene-only | [admin-approve-confirm · 1440](design/cost-rules-direction-c/1440-admin-approve-confirm.png) / [admin-approve-confirm · 390](design/cost-rules-direction-c/390-admin-approve-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / admin-reject-confirm | inline-aside / related-scene-only | [admin-reject-confirm · 1440](design/cost-rules-direction-c/1440-admin-reject-confirm.png) / [admin-reject-confirm · 390](design/cost-rules-direction-c/390-admin-reject-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / publish-confirm | inline-aside / related-scene-only | [publish-confirm · 1440](design/cost-rules-direction-c/1440-publish-confirm.png) / [publish-confirm · 390](design/cost-rules-direction-c/390-publish-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |
| CostRuleConsole.vue / aside.2 / rollback-confirm | inline-aside / related-scene-only | [rollback-confirm · 1440](design/cost-rules-direction-c/1440-rollback-confirm.png) / [rollback-confirm · 390](design/cost-rules-direction-c/390-rollback-confirm.png) | 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。 |

### 明确保留的边界

- 30源位置/20语义组/19模型/7结构；166旧图的关联不等于每控件六态或19字段验收。
- UNFIXED:打开A审批后load只返回B，当前selected切B而原因保留A，submit使用B ID/revision；setup组合复现不等于实际用户点击链。
- 筛选自动选B可保留query.rule=A；query单独变B无本地watch且load仍优先已选A，父history行为待测。
- 关闭X无disabled但busy函数拒绝关闭；草稿字段无统一busy禁用，原型锁定是提案不是现状。
- 仅关联现有离线图；控件逐态、字段错误关联、全部动态行/主题、真实Vue生命周期与用户审核仍待，不代表生产验收。
- QualityGateSetupSummary纯展示父投影与slot；首active不等于所有市场或所有机会准备好。
- UiStatePanel的两个按钮显隐来自共享组件；主动作空目录创建/其他重读，副动作返回，不伪造权限申请。
- useModalDialog原生焦点回收与cancel转发已追源码，当前测试不挂载DOM，不能证明完整键盘圈。
- 父reset_on_scope缓存key含组织/工作区，不能把局部无GET代次判为服务跨租户泄漏。
- SC-G05读取重排/操作目标/URL关联待真实Vue集成确认；当前仅setup复现。

## P23 局部动作与共享消费者

[逐项机器清单](action-reviews/P23.json)：53个局部源位置 → 40组；3类写入，33组路由动作，5组转发/容器关联不重复计动作。已映射6/6个源码字段位置，7/7处调用/内嵌容器，15个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有194个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| task.list.create.open 新建入口 / local | 2处；header、empty、create_only、quick-create | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)；其余见JSON | 仅P23新建；P24编辑不属于当前入口。快捷创建仅mounted读取window.search，缓存重入行为仍待验。 |
| task.read.retry 重读当前任务列表或导出视图 / read | 1处；error、forbidden、expired、rate_limited | [error · 1440](design/task-direction-c-forms/1440-error.png) / [error · 390](design/task-direction-c-forms/390-error.png)、[forbidden · 1440](design/task-direction-c-forms/1440-forbidden.png) / [forbidden · 390](design/task-direction-c-forms/390-forbidden.png)；其余见JSON | 旧缓存与迟到GET归属已有源码保护，不在此轮宣称真实Vue复验；重读按钮不是登录或权限恢复。 |
| task.list.page.previous 上一页 / local | 1处；first-disabled、later-page、loading-old-total | ；其余见JSON | 本页源有真实多页按钮，当前两批C稿只有单条任务，尚无P23分页图，不以P13两条样本或默认目录图抵扣。 |
| task.list.page.next 下一页 / local | 1处；next、last-disabled | ；其余见JSON | 本页源有真实多页按钮，当前两批C稿只有单条任务，尚无P23分页图，不以P13两条样本或默认目录图抵扣。 |
| task.editor.close 关闭新建表单 / local | 3处；cancel、escape、busy-escape、reopen-draft | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)；其余见JSON | 按钮禁用不等于Escape锁定；发出POST后关闭不会撤销请求，源后续成功仍清表单。 |
| task.editor.create.submit 提交新建 / write | 2处；create、due-set、due-empty、busy、failure | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)；其余见JSON | 不将原型窗内错误/字段锁定当作源实现；源notice在窗外，表单字段无busy disabled。相同函数PATCH只归P24。 |
| task.all.excluded.detail 排除任务详情事件中转 / excluded | 1处；detail-actions、edit、comment、action-fields | ；其余见JSON | 不是删除组件；仅按当前实际入口排除P23。P24及异常组合另验。 |
| task.delete.close 关闭删除表单 / local | 3处；cancel、escape、reopen-cleared | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 执行中Escape可清deleting；removeTask在await后仍读取deleting.value.id，完整竞态待验。 |
| task.delete.submit 提交删除 / write | 2处；valid、blank、failure、busy | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 本页不走详情returnPath；已发删除不因关闭取消，真实审计和版本冲突待验。 |
| task.list.status 切换六种任务状态 / local | 1处；all、todo、in_progress、paused、completed、cancelled | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | all不加overdue避免重复；summary总7与列表2是独立夹具，不是完整数据库快照。 |
| task.list.search.disclose 展开搜索排序 / local | 1处；closed、open、advanced-applied | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 当前details/移动布局与C稿不完全同形；焦点、缓存草稿和主题待验。 |
| task.list.search.apply 应用搜索 / local | 2处；button、enter、trimmed、empty、no-results | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 搜索是服务端过滤；原型只过滤离线样例，不代表全库查询。 |
| task.list.sort 切换排序并应用搜索草稿 / local | 1处；priority_due、due_asc、updated_desc、created_desc | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 不能改成只排序不应用草稿；URL白名单解析/服务端分页排序保持。 |
| task.list.reset 重置筛选 / local | 2处；search-reset、empty-reset、default-sort | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 只有非默认sort的空列表仍显示新建而非空态重置；不得按文案猜所有筛选判定相同。 |
| task.list.select.page 选择或清空本页 / local | 1处；select-page、clear-page、mixed、readonly-hidden | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 不新增跨页全选；输入事件不是额外API。 |
| task.list.select.clear 清除选择 / local | 1处；clear、none-hidden | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 确认批量未结束时选择变化的交互组合仍待运行验收。 |
| task.list.select.row 选择单行 / local | 1处；select、deselect、readonly-hidden | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 当前toggle不自行去重；不以合成图证明所有行焦点/热区。 |
| task.list.detail.open 进入独立任务详情 / navigation | 1处；first、other、long-title、filtered-return | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 只对应离线目标意图；真实详情/返回/关联采集授权归P24完整链。 |
| task.list.row-menu 展开单行操作 / local | 1处；closed、open、terminal、readonly-hidden | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 原型直接删除入口与源details收纳差异待审；所有状态行菜单图未齐。 |
| task.delete.open 打开单行删除 / local | 1处；active、completed、cancelled、reopen | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 不与详情删除入口重复计数；来源目标及中途重开待验。 |
| task.batch.pause.open 批量暂停 / local | 1处；pause、eligible、ineligible、busy-reopen | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.resume.open 批量继续 / local | 1处；resume、eligible、ineligible、busy-reopen | [batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.delay.open 批量延期 / local | 1处；delay、eligible、ineligible、busy-reopen | [batch-delay · 1440](design/task-direction-c-forms/1440-batch-delay.png) / [batch-delay · 390](design/task-direction-c-forms/390-batch-delay.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.transfer.open 批量调整负责人 / local | 1处；transfer、eligible、ineligible、busy-reopen | [batch-transfer · 1440](design/task-direction-c-forms/1440-batch-transfer.png) / [batch-transfer · 390](design/task-direction-c-forms/390-batch-transfer.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.cancel.open 批量取消 / local | 1处；cancel、eligible、ineligible、busy-reopen | [batch-cancel · 1440](design/task-direction-c-forms/1440-batch-cancel.png) / [batch-cancel · 390](design/task-direction-c-forms/390-batch-cancel.png)；其余见JSON | 执行期间返回/重开可以修改action；源迭代每次读当前action/字段，不是全部操作参数快照。 |
| task.batch.close 关闭批量确认 / local | 3处；return、escape、busy-close、reopen | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 关闭不会取消已发请求。新稿字段/忙碌锁为提案，不能称源已修。 |
| task.batch.submit 逐任务提交批量动作 / write | 2处；pause、resume、delay、transfer、cancel、partial-failure、no-eligible、in-flight-mutation | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 本轮隔离实测等待首项时修改action/原因，第二项请求随之改变；busy=true再次调用也发请求。非真实DOM双击/服务端重复写证明。 |
| task.batch.reason.change 修改批量原因 / local | 1处；pause、delay、transfer、cancel、blank、busy-input | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 原型锁字段不能替代真实输入保护；执行中原因变化可进入下一请求。 |
| task.batch.delay.due.change 修改批量期限 / local | 1处；valid、empty、busy-input | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 时区/无效输入由原生及服务端分别验证；不杜撰最早日期限制。 |
| task.batch.transfer.assignee.change 选择批量负责人 / local | 1处；selected、empty、directory-failed | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 不新增成员或把无目录当真实无人；活动工作区成员资格仍由后端判定。 |
| task.all.batch.forward 父子事件转发 / wiring | 1处；@start、@close、@confirm、@update:reason、@update:due-at、@update:assignee-id | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| task.all.list.forward 父子事件转发 / wiring | 1处；@update:selected-ids、@status、@apply-filters、@reset-filters、@create、@remove | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png)、[empty · 1440](design/task-direction-c/1440-empty.png) / [empty · 390](design/task-direction-c/390-empty.png)；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| task.all.editor.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| task.all.delete.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| task.all.batch.definition 弹窗定义与业务变体关联 / wiring | 1处；source-container、listed-business-variants | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png)、[batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png)；其余见JSON | 容器存在不证明各变体、键盘焦点、忙碌保护或全部主题已验收。 |
| task.view.business 业务任务视图 / local | 1处；business-tab | ；其余见JSON | 当前TASK-C两包无导出视图场景，明确缺稿，不能用报表页或业务列表证明本页对应状态。 |
| task.view.exports 导出任务视图 / local | 1处；exports-tab | ；其余见JSON | 当前TASK-C两包无导出视图场景，明确缺稿，不能用报表页或业务列表证明本页对应状态。 |
| task.export.manage 创建或管理导出 / navigation | 2处；export-manage | ；其余见JSON | 当前TASK-C两包无导出视图场景，明确缺稿，不能用报表页或业务列表证明本页对应状态。 |
| task.export.open 查看导出所属报表 / navigation | 1处；export-open | ；其余见JSON | 当前TASK-C两包无导出视图场景，明确缺稿，不能用报表页或业务列表证明本页对应状态。 |
| task.detail.return P23路由不可达的详情返回入口 / excluded | 1处；not-applicable-on-list-route | ；其余见JSON | 仅记录共享组件中不适用于P23列表路由的详情返回控件。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| task.all.batch.forward | @start / previewBatch | task.batch.pause.open、task.batch.resume.open、task.batch.delay.open、task.batch.transfer.open、task.batch.cancel.open |
| task.all.batch.forward | @close / showBatchImpact = false | task.batch.close |
| task.all.batch.forward | @confirm / confirmBatch | task.batch.submit |
| task.all.batch.forward | @update:reason / batchReason = $event | task.batch.reason.change |
| task.all.batch.forward | @update:due-at / batchDueAt = $event | task.batch.delay.due.change |
| task.all.batch.forward | @update:assignee-id / batchAssigneeId = $event | task.batch.transfer.assignee.change |
| task.all.list.forward | @update:selected-ids / selectedIds = $event | task.list.select.page、task.list.select.row、task.list.select.clear |
| task.all.list.forward | @status / setStatus | task.list.status |
| task.all.list.forward | @apply-filters / applyFilters | task.list.search.apply、task.list.sort |
| task.all.list.forward | @reset-filters / resetFilters | task.list.reset |
| task.all.list.forward | @create / showCreate = true | task.list.create.open |
| task.all.list.forward | @remove / askRemove | task.delete.open |
| task.all.editor.definition | 容器定义，无额外事件 | task.list.create.open、task.editor.close、task.editor.create.submit |
| task.all.delete.definition | 容器定义，无额外事件 | task.delete.open、task.delete.close、task.delete.submit |
| task.all.batch.definition | 容器定义，无额外事件 | task.batch.close、task.batch.submit、task.batch.pause.open、task.batch.resume.open、task.batch.delay.open、task.batch.transfer.open、task.batch.cancel.open |

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
| TaskWorkspace.vue / dialog.1 / create | native-dialog / matching-dialog-scene | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png) | 取消保留form而清快捷创建三query；源失败notice窗外，输入未busy锁定；P24编辑变体不计本页。 |
| TaskWorkspace.vue / form.1 / create | form-container / matching-dialog-scene | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png) | 同一弹窗内表单引用，不能重复计业务弹窗。取消保留form而清快捷创建三query；源失败notice窗外，输入未busy锁定；P24编辑变体不计本页。 |
| TaskWorkspace.vue / dialog.2 / delete | native-dialog / matching-dialog-scene | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png) | 目标、版本和原因必须对应同一操作；等待中Escape清deleting与await后读取的竞态待Vue复验。 |
| TaskWorkspace.vue / form.2 / delete | form-container / matching-dialog-scene | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png) | 同一弹窗内表单引用，不能重复计业务弹窗。目标、版本和原因必须对应同一操作；等待中Escape清deleting与await后读取的竞态待Vue复验。 |
| TaskListPanel.vue / form.1 / search | form-container / matching-inline-form-scene | [list · 1440](design/task-direction-c/1440-list.png) / [list · 390](design/task-direction-c/390-list.png) | 应用与排序都提交当前trim草稿，展开/收起不等于应用；全断点/键盘待验。 |
| TaskBatchActions.vue / dialog.1 / pause | native-dialog / matching-dialog-scene | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / resume | native-dialog / matching-dialog-scene | [batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / delay | native-dialog / matching-dialog-scene | [batch-delay · 1440](design/task-direction-c-forms/1440-batch-delay.png) / [batch-delay · 390](design/task-direction-c-forms/390-batch-delay.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / transfer | native-dialog / matching-dialog-scene | [batch-transfer · 1440](design/task-direction-c-forms/1440-batch-transfer.png) / [batch-transfer · 390](design/task-direction-c-forms/390-batch-transfer.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / dialog.1 / cancel | native-dialog / matching-dialog-scene | [batch-cancel · 1440](design/task-direction-c-forms/1440-batch-cancel.png) / [batch-cancel · 390](design/task-direction-c-forms/390-batch-cancel.png) | 字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / pause | form-container / matching-dialog-scene | [batch-pause · 1440](design/task-direction-c-forms/1440-batch-pause.png) / [batch-pause · 390](design/task-direction-c-forms/390-batch-pause.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / resume | form-container / matching-dialog-scene | [batch-resume · 1440](design/task-direction-c-forms/1440-batch-resume.png) / [batch-resume · 390](design/task-direction-c-forms/390-batch-resume.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / delay | form-container / matching-dialog-scene | [batch-delay · 1440](design/task-direction-c-forms/1440-batch-delay.png) / [batch-delay · 390](design/task-direction-c-forms/390-batch-delay.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / transfer | form-container / matching-dialog-scene | [batch-transfer · 1440](design/task-direction-c-forms/1440-batch-transfer.png) / [batch-transfer · 390](design/task-direction-c-forms/390-batch-transfer.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |
| TaskBatchActions.vue / form.1 / cancel | form-container / matching-dialog-scene | [batch-cancel · 1440](design/task-direction-c-forms/1440-batch-cancel.png) / [batch-cancel · 390](design/task-direction-c-forms/390-batch-cancel.png) | 同一弹窗内表单引用，不能重复计业务弹窗。字段、返回和Escape无统一busy保护；confirmBatch逐请求读取可变操作与字段。原型锁定不能当源修复。 |

### 明确保留的边界

- 关联两包60PNG中P23相关的目录、筛选空、创建、删除、五批量和读取异常；其余P24编辑/详情/进度与审核board不抵扣P23。
- P23导出视图及多页/混合任务/只读列表/各写失败与忙碌缺具体图，不能以来源hash或通用截图补全。
- 源删除等待中closeDeleteDialog清deleting，成功返回后读deleting.id抛TypeError且未load；函数组合已复现，实际Escape序列/服务写入尚未验证或修复。
- 共享批量每项重读动作/字段且函数无busy guard的既有风险继续待修；本页读取已经有active/read ownership保护，不能以写入风险概括全部读取。
- 按钮逐态、字段、全部主题/密度、具体审批、真实Vue/API/SQL与部署仍未完成。
- 父/tasks传mode=all且无taskId，列表不带mine，summary仍本人；当前read owner/Abort保护继续保留，不把本次函数边界桩当作新生命周期验证。
- TaskListPanel状态summary不是全工作区列表总量；TaskBatchActions五类资格/原因/日期/真实成员分别验；选中本页不是选中全部结果。
- 6模型以外还有排序/checkbox/批量三字段的事件控制。P24详情/编辑/评论排除，导出视图4源位置在P23可达且无相应C图。
- useModalDialog无统一busy守卫；原生cancel可清目标，删除返回后空引用已在源组合测试复现。实际键盘/焦点与真实API待验。

## P24 局部动作与共享消费者

[逐项机器清单](action-reviews/P24.json)：52个局部源位置 → 34组；7类写入，28组路由动作，5组转发/容器关联不重复计动作。已映射5/5个源码字段位置，7/7处调用/内嵌容器，17个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有164个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| detail.hidden-list-shell 详情CSS隐藏的列表/导出外层 / excluded | 7处；隐藏头部新建、隐藏业务/导出Tab、隐藏列表事件、隐藏批量事件、隐藏导出导航、隐藏分页 | ；其余见JSON | 原合同说头部入口可在详情存在，指共享DOM；当前CSS排除实际可见性。?create=1仍可开新建窗；?view=exports仍可触发读取优先分支，此异常不可按按钮可达归属，待获审实施修复。 |
| read.retry 重新加载 / read | 1处；error、not_found、forbidden、expired、rate_limited | [error · 1440](design/task-direction-c-forms/1440-error.png) / [error · 390](design/task-direction-c-forms/390-error.png)、[not_found · 1440](design/task-direction-c-forms/1440-not_found.png) / [not_found · 390](design/task-direction-c-forms/390-not_found.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| editor.close 关闭新建/编辑 / local | 3处；新建、编辑、Escape、取消 | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)、[edit · 1440](design/task-direction-c-forms/1440-edit.png) / [edit · 390](design/task-direction-c-forms/390-edit.png)；其余见JSON | 在途关闭与成功晚到对新草稿影响待验证；清快捷query不取消已发写入。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| editor.submit 新建/编辑提交 / write | 2处；快捷query新建、编辑 | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png)、[edit · 1440](design/task-direction-c-forms/1440-edit.png) / [edit · 390](design/task-direction-c-forms/390-edit.png)；其余见JSON | 普通详情无可见新建按钮，但首次create=1可开窗。四字段无busy禁用，Escape可关闭；成功清form并load当前分支。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| delete.close 取消删除 / local | 3处；取消、Escape | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | P23源测试已复现等待关闭→成功空引用，未修；P24正常删除成功返回来源，新脚本覆盖。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| delete.submit 确认删除 / write | 2处；普通成功、错误保留、在途关闭风险 | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 不硬删历史审计；原生Escape仍存在已知晚到空引用，未实施修复。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.return 关闭详情返回 / navigation | 2处；有有效from、回退 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.collection.open 查看关联采集任务 / navigation | 1处；有关联、无关联隐藏 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 不为本页推断平台权限；关联有无与真实目标拒绝仍需独立图和运行证明。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.technical.toggle 技术详情 / local | 1处；收起、展开 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 当前无busy/disabled表示，仍待明确适用性，不编造禁用图。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.start 开始 / write | 1处；start、提交中、失败保留 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 不新增原因/确认弹窗。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.resume 继续 / write | 1处；resume、提交中、失败保留 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 不新增原因/确认弹窗。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.complete 完成 / write | 1处；complete、提交中、失败保留 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 按auto_score_status区分入队、无活动规则；不把完成等同评分已完成。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.progress.open 更新进度 / local | 1处；progress | [progress · 1440](design/task-direction-c-forms/1440-progress.png) / [progress · 390](design/task-direction-c-forms/390-progress.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.pause.open 暂停 / local | 1处；pause | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.delay.open 调整期限 / local | 1处；delay | [delay · 1440](design/task-direction-c-forms/1440-delay.png) / [delay · 390](design/task-direction-c-forms/390-delay.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.transfer.open 转交负责人 / local | 1处；transfer | [transfer · 1440](design/task-direction-c-forms/1440-transfer.png) / [transfer · 390](design/task-direction-c-forms/390-transfer.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.cancel.open 取消任务 / local | 1处；cancel | [cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.more.toggle 更多任务操作 / local | 1处；收起、展开 | [more · 1440](design/task-direction-c/1440-more.png) / [more · 390](design/task-direction-c/390-more.png)；其余见JSON | 需覆盖只分配权与终态菜单，不从固定in_progress样本推全状态。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| editor.edit.open 编辑任务 / local | 1处；打开编辑、终态编辑 | [edit · 1440](design/task-direction-c-forms/1440-edit.png) / [edit · 390](design/task-direction-c-forms/390-edit.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| delete.open 删除任务 / local | 1处；打开删除、终态删除 | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| comment.submit 添加评论 / write | 2处；可提交、提交中、失败保留 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 评论字段缺显式关联label的可访问性需补；原型活动区不是完整评论六态/版本冲突图。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| comment.change 评论输入 / local | 1处；草稿、空白、长文 | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png)；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.action.close 返回或Escape关闭单项表单 / local | 3处；pause、cancel、delay、transfer、progress | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png)、[cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png)；其余见JSON | 源返回/字段仍可操作与原型忙碌表现不能等同；提交中关闭策略待具体获审，焦点/晚到结果须实测。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.action.submit 确认单项操作 / write | 2处；pause、cancel、delay、transfer、progress | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png)、[cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png)；其余见JSON | 原因trim、期限ISO、转交真实成员、进度Number/说明trim；在途字段修改不进入已发送body，成功仍关窗、失败保留当前草稿，待改善提示/锁定策略。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.transfer.assignee.change 接收成员 / local | 1处；成员目录、目录不可用 | [transfer · 1440](design/task-direction-c-forms/1440-transfer.png) / [transfer · 390](design/task-direction-c-forms/390-transfer.png)；其余见JSON | 当前字段无busy禁用；原生required不等于非空trim语义或服务验证。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.delay.due.change 新截止时间 / local | 1处；本地时间、必填校验 | [delay · 1440](design/task-direction-c-forms/1440-delay.png) / [delay · 390](design/task-direction-c-forms/390-delay.png)；其余见JSON | 当前字段无busy禁用；原生required不等于非空trim语义或服务验证。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.progress.percent.change 完成进度 / local | 1处；0、100、越界 | [progress · 1440](design/task-direction-c-forms/1440-progress.png) / [progress · 390](design/task-direction-c-forms/390-progress.png)、[progress-error · 1440](design/task-direction-c-forms/1440-progress-error.png) / [progress-error · 390](design/task-direction-c-forms/390-progress-error.png)；其余见JSON | 当前字段无busy禁用；原生required不等于非空trim语义或服务验证。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.progress.note.change 进展说明 / local | 1处；草稿、校验 | [progress · 1440](design/task-direction-c-forms/1440-progress.png) / [progress · 390](design/task-direction-c-forms/390-progress.png)、[progress-error · 1440](design/task-direction-c-forms/1440-progress-error.png) / [progress-error · 390](design/task-direction-c-forms/390-progress-error.png)；其余见JSON | 当前字段无busy禁用；原生required不等于非空trim语义或服务验证。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.action.reason.change 操作原因 / local | 1处；pause、cancel、delay、transfer | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png)、[cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png)；其余见JSON | 当前字段无busy禁用；原生required不等于非空trim语义或服务验证。具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| editor.definition 任务编辑窗定义 / wiring | 1处；P24局部消费者 | ；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| delete.definition 删除窗定义 / wiring | 1处；P24局部消费者 | ；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.action.definition 五单项表单定义 / wiring | 1处；P24局部消费者 | ；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.parent.forward 详情父级事件转发 / wiring | 1处；P24局部消费者 | ；其余见JSON | 具体按钮六态、长内容、主题/密度和真实Vue/服务验收未完成；既有C场景只是关联，不自动通过。 |
| detail.action-dialog.forward 详情动作弹窗事件转发 / wiring | 2处；close、submit、field-model | ；其余见JSON | 事件所有权连接，不独立提交；父级仍保持TaskWorkspace中的既有请求所有权。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| editor.definition | 容器定义，无额外事件 | editor.submit、editor.close |
| delete.definition | 容器定义，无额外事件 | delete.submit、delete.close |
| detail.action.definition | 容器定义，无额外事件 | detail.action.submit、detail.action.close |
| detail.parent.forward | @action / action | detail.start、detail.resume、detail.complete、detail.pause.open、detail.cancel.open、detail.delay.open、detail.transfer.open、detail.progress.open |
| detail.parent.forward | @edit / editTask | editor.edit.open |
| detail.parent.forward | @remove / askRemove | delete.open |
| detail.parent.forward | @submit-action / submitTaskAction | detail.action.submit |
| detail.parent.forward | @close-action / taskActionEditor = null | detail.action.close |
| detail.parent.forward | @add-comment / addComment | comment.submit |
| detail.parent.forward | @update:comment / comment = $event | comment.change |
| detail.parent.forward | @update:action-form / taskActionForm = $event | detail.transfer.assignee.change、detail.delay.due.change、detail.progress.percent.change、detail.progress.note.change、detail.action.reason.change |
| detail.action-dialog.forward | @submit / emit('submitAction') | detail.action.submit |
| detail.action-dialog.forward | @close / emit('closeAction') | detail.action.close |
| detail.action-dialog.forward | @update:action-form / emit('update:actionForm', $event) | detail.transfer.assignee.change、detail.delay.due.change、detail.progress.percent.change、detail.progress.note.change、detail.action.reason.change |
| detail.action-dialog.forward | @submit / emit('submitAction') | detail.action.submit |
| detail.action-dialog.forward | @close / emit('closeAction') | detail.action.close |
| detail.action-dialog.forward | @update:action-form / emit('update:actionForm', $event) | detail.transfer.assignee.change、detail.delay.due.change、detail.progress.percent.change、detail.progress.note.change、detail.action.reason.change |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| TaskWorkspace.vue / form.title | 新建/编辑标题，required/max200 | 五个父v-model之外，子组件六个受控输入另以事件动作登记；在途策略及全字段视觉未验。 |
| TaskWorkspace.vue / form.description | 新建/编辑说明，max5000 | 五个父v-model之外，子组件六个受控输入另以事件动作登记；在途策略及全字段视觉未验。 |
| TaskWorkspace.vue / form.priority | low/normal/high/critical | 五个父v-model之外，子组件六个受控输入另以事件动作登记；在途策略及全字段视觉未验。 |
| TaskWorkspace.vue / form.due_at | 可选本地时间，提交ISO/null | 五个父v-model之外，子组件六个受控输入另以事件动作登记；在途策略及全字段视觉未验。 |
| TaskWorkspace.vue / deleteReason | 删除必填原因，max500，提交trim | 五个父v-model之外，子组件六个受控输入另以事件动作登记；在途策略及全字段视觉未验。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| TaskWorkspace.vue / dialog.1 / create | native-dialog / matching-dialog-scene | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskWorkspace.vue / dialog.1 / edit | native-dialog / matching-dialog-scene | [edit · 1440](design/task-direction-c-forms/1440-edit.png) / [edit · 390](design/task-direction-c-forms/390-edit.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskWorkspace.vue / form.1 / create | form-container / related-scene-only | [create · 1440](design/task-direction-c-forms/1440-create.png) / [create · 390](design/task-direction-c-forms/390-create.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskWorkspace.vue / form.1 / edit | form-container / related-scene-only | [edit · 1440](design/task-direction-c-forms/1440-edit.png) / [edit · 390](design/task-direction-c-forms/390-edit.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskWorkspace.vue / dialog.2 / delete | native-dialog / matching-dialog-scene | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskWorkspace.vue / form.2 / delete | form-container / related-scene-only | [delete · 1440](design/task-direction-c-forms/1440-delete.png) / [delete · 390](design/task-direction-c-forms/390-delete.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskDetailPanel.vue / form.1 / comment | form-container / related-scene-only | [detail · 1440](design/task-direction-c/1440-detail.png) / [detail · 390](design/task-direction-c/390-detail.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / dialog.1 / pause | native-dialog / matching-dialog-scene | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / dialog.1 / cancel | native-dialog / matching-dialog-scene | [cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / dialog.1 / delay | native-dialog / matching-dialog-scene | [delay · 1440](design/task-direction-c-forms/1440-delay.png) / [delay · 390](design/task-direction-c-forms/390-delay.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / dialog.1 / transfer | native-dialog / matching-dialog-scene | [transfer · 1440](design/task-direction-c-forms/1440-transfer.png) / [transfer · 390](design/task-direction-c-forms/390-transfer.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / dialog.1 / progress | native-dialog / matching-dialog-scene | [progress · 1440](design/task-direction-c-forms/1440-progress.png) / [progress · 390](design/task-direction-c-forms/390-progress.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / form.1 / pause | form-container / related-scene-only | [pause · 1440](design/task-direction-c-forms/1440-pause.png) / [pause · 390](design/task-direction-c-forms/390-pause.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / form.1 / cancel | form-container / related-scene-only | [cancel · 1440](design/task-direction-c-forms/1440-cancel.png) / [cancel · 390](design/task-direction-c-forms/390-cancel.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / form.1 / delay | form-container / related-scene-only | [delay · 1440](design/task-direction-c-forms/1440-delay.png) / [delay · 390](design/task-direction-c-forms/390-delay.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / form.1 / transfer | form-container / related-scene-only | [transfer · 1440](design/task-direction-c-forms/1440-transfer.png) / [transfer · 390](design/task-direction-c-forms/390-transfer.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |
| TaskActionDialog.vue / form.1 / progress | form-container / related-scene-only | [progress · 1440](design/task-direction-c-forms/1440-progress.png) / [progress · 390](design/task-direction-c-forms/390-progress.png) | 与真实调用形态关联，不代表逐按钮六态、主题/密度、完整权限及真实Vue验证通过。 |

### 明确保留的边界

- 普通P24隐藏头部/列表/批量/导出/分页；原合同关于头部可在详情存在只反映共享DOM，不是当前可见入口。
- UNFIXED: ?view=exports有report:read时优先读取导出，初次详情selected为空且导出区被CSS隐藏；无权限回business只改变路由意图。需真实浏览器确认呈现。
- ?create=1允许首次详情快捷新建，虽无可见头部按钮；正式设计需涵盖此真实入口而非凭空新增按钮。
- 开始/继续/完成直接写入，不新增原因/确认弹窗。转交独立task:assign，无本地终态限制，不套用批量资格。
- 在途可编辑五字段与返回；请求body已捕获，成功关窗/失败留当前草稿；提交快照、错误可发现性、关闭焦点与晚到风险待具体交互批准。
- 主题/密度/长任务名/多活动/关联与无关联/只分配权/终态/版本冲突/成员目录失败/全部按钮六态缺完整图；不能用固定in_progress样本抵扣。
- P13/P23列表/批量消费者不计本页可见控件；CSS隐藏不等于卸载，原生dialog和quick-create query仍需单独归属。
- 读取已有active/route/read-key/Abort保护；本批隔离边界不重复证明完整GET生命周期，写请求不随切页取消。
- 既有60PNG是P23/P24/board共享总数，没有新增或重拍，图存在不表示真实Vue/服务或用户批准。

## P25 局部动作与共享消费者

[逐项机器清单](action-reviews/P25.json)：42个局部源位置 → 30组；5类写入，25组路由动作，5组转发/容器关联不重复计动作。已映射11/11个源码字段位置，7/7处调用/内嵌容器，10个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有21个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有20个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| AN-A-TEMPLATE-OPEN 管理/配置审批模板 / local | 3处；管理模板、配置第一个模板、空队列配置 | [normal · 1440](design/approval-direction-c/1440-normal.png) / [normal · 390](design/approval-direction-c/390-normal.png)、[no_templates · 1440](design/approval-direction-c/1440-no_templates.png) / [no_templates · 390](design/approval-direction-c/390-no_templates.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-REQUEST-OPEN 发起审批入口 / local | 2处；头部、空队列 | [normal · 1440](design/approval-direction-c/1440-normal.png) / [normal · 390](design/approval-direction-c/390-normal.png)、[empty · 1440](design/approval-direction-c/1440-empty.png) / [empty · 390](design/approval-direction-c/390-empty.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-TECH-REQUEST 页级请求编号 / local | 1处；收起、展开 | [error · 1440](design/approval-direction-c/1440-error.png) / [error · 390](design/approval-direction-c/390-error.png)、[request-default · 1440](design/approval-diagnostics-direction-c/1440-request-default.png) / [request-default · 390](design/approval-diagnostics-direction-c/390-request-default.png)；其余见JSON | 页级标识可能随其他并发API覆盖；图稿不能把它当每个窗口独立请求归属。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| AN-A-LOAD 刷新最新状态 / read | 1处；error、forbidden、expired、rate_limited、version_conflict | [error · 1440](design/approval-direction-c/1440-error.png) / [error · 390](design/approval-direction-c/390-error.png)、[forbidden · 1440](design/approval-direction-c/1440-forbidden.png) / [forbidden · 390](design/approval-direction-c/390-forbidden.png)；其余见JSON | 成员失败走Promise.all整页失败，不借TaskWorkspace的局部成员退化逻辑。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-NOTICE-CLOSE 关闭详情错误提示 / local | 1处；详情失败、404 | [detail_error · 1440](design/approval-direction-c/1440-detail_error.png) / [detail_error · 390](design/approval-direction-c/390-detail_error.png)、[detail_missing · 1440](design/approval-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/approval-direction-c/390-detail_missing.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-PAGE 审批分页 / read | 2处；上一页、下一页 | [pagination · 1440](design/approval-direction-c/1440-pagination.png) / [pagination · 390](design/approval-direction-c/390-pagination.png)、[page-next-default · 1440](design/approval-navigation-direction-c/1440-page-next-default.png) / [page-next-default · 390](design/approval-navigation-direction-c/390-page-next-default.png)；其余见JSON | page query变更本身没有全筛选watch；分页保留深链可能重开详情，不改为清除。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-CLOSE-FOCUS 关闭审批详情与键盘边界 / local | 2处；关闭按钮、Escape、遮罩、Tab、Shift+Tab | [approve-closed-pending · 1440](design/approval-lifecycle-direction-c/1440-approve-closed-pending.png) / [approve-closed-pending · 390](design/approval-lifecycle-direction-c/390-approve-closed-pending.png)、[approve-reopened-pending · 1440](design/approval-lifecycle-direction-c/1440-approve-reopened-pending.png) / [approve-reopened-pending · 390](design/approval-lifecycle-direction-c/390-approve-reopened-pending.png)；其余见JSON | 当前无busy关闭守卫；未模拟在途结果与原生焦点组合，迟到结果问题已有源复现，未修。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10表单包补代表关闭按钮focus、空闲关闭/重开图；新增顶部关闭与非详情遮罩沿待审提案，发布返回清原因与源内存规则不同。仅已列控件，不据此签收源Vue、其余六态或在途关闭归属。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-NAV-RESOURCE 查看关联资源 / navigation | 1处；任务、机会决策 | [detail · 1440](design/approval-direction-c/1440-detail.png) / [detail · 390](design/approval-direction-c/390-detail.png)、[task · 1440](design/approval-direction-c/1440-task.png) / [task · 390](design/approval-direction-c/390-task.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-NAV-RETURN 返回通知中心 / navigation | 1处；有效来源、无效来源隐藏 | [detail · 1440](design/approval-direction-c/1440-detail.png) / [detail · 390](design/approval-direction-c/390-detail.png)、[return-default · 1440](design/approval-navigation-direction-c/1440-return-default.png) / [return-default · 390](design/approval-navigation-direction-c/390-return-default.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-NAV-EVIDENCE 逐项查看证据 / navigation | 1处；原四项、新增/移除合成、不适用隐藏 | [evidence · 1440](design/approval-direction-c/1440-evidence.png) / [evidence · 390](design/approval-direction-c/390-evidence.png)、[removed · 1440](design/approval-direction-c/1440-removed.png) / [removed · 390](design/approval-direction-c/390-removed.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-DECIDE-REJECT 驳回 / write | 1处；允许、空原因、提交中、409保留原因 | [reject-pending · 1440](design/approval-lifecycle-direction-c/1440-reject-pending.png) / [reject-pending · 390](design/approval-lifecycle-direction-c/390-reject-pending.png)、[reject-owner-failure · 1440](design/approval-lifecycle-direction-c/1440-reject-owner-failure.png) / [reject-owner-failure · 390](design/approval-lifecycle-direction-c/390-reject-owner-failure.png)；其余见JSON | 证据缺失仅提示，不添加五门或强制审批门槛；A成功会关闭后来B源问题未修，DOM禁用不冒称函数重入守卫。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10新增本按钮代表逐态及失败保留双端图；仅已列selector/场景，不覆盖全部字段/变体/跨窗pending归属，未映射disabled仍待有依据核对，具体审核和真实Vue/服务不据此通过。 |
| AN-A-DECIDE-APPROVE 批准并流转 / write | 1处；允许、空原因、提交中、409保留原因 | [approve-pending · 1440](design/approval-lifecycle-direction-c/1440-approve-pending.png) / [approve-pending · 390](design/approval-lifecycle-direction-c/390-approve-pending.png)、[approve-owner-failure · 1440](design/approval-lifecycle-direction-c/1440-approve-owner-failure.png) / [approve-owner-failure · 390](design/approval-lifecycle-direction-c/390-approve-owner-failure.png)；其余见JSON | 证据缺失仅提示，不添加五门或强制审批门槛；A成功会关闭后来B源问题未修，DOM禁用不冒称函数重入守卫。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10新增本按钮代表逐态及失败保留双端图；仅已列selector/场景，不覆盖全部字段/变体/跨窗pending归属，未映射disabled仍待有依据核对，具体审核和真实Vue/服务不据此通过。 |
| AN-TECH-RESOURCE 资源与节点编号 / local | 1处；收起、展开 | [technical · 1440](design/approval-direction-c/1440-technical.png) / [technical · 390](design/approval-direction-c/390-technical.png)、[technical-default · 1440](design/approval-navigation-direction-c/1440-technical-default.png) / [technical-default · 390](design/approval-navigation-direction-c/390-technical-default.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-TEMPLATE-CLOSE 取消模板草稿窗口 / local | 2处；取消、Escape | [template-closed-pending · 1440](design/approval-lifecycle-direction-c/1440-template-closed-pending.png) / [template-closed-pending · 390](design/approval-lifecycle-direction-c/390-template-closed-pending.png)、[template-reopened-pending · 1440](design/approval-lifecycle-direction-c/1440-template-reopened-pending.png) / [template-reopened-pending · 390](design/approval-lifecycle-direction-c/390-template-reopened-pending.png)；其余见JSON | 未提交草稿保留，原型统一在途锁定并非当前Vue表现；叠加发布的关闭层级待真实组合验证。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10表单包补代表关闭按钮focus、空闲关闭/重开图；新增顶部关闭与非详情遮罩沿待审提案，发布返回清原因与源内存规则不同。仅已列控件，不据此签收源Vue、其余六态或在途关闭归属。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-TEMPLATE-SUBMIT 保存模板草稿与必填定位 / write | 2处；task、opportunity_decision、invalid展开、失败、忙碌 | [template-pending · 1440](design/approval-lifecycle-direction-c/1440-template-pending.png) / [template-pending · 390](design/approval-lifecycle-direction-c/390-template-pending.png)、[template-owner-failure · 1440](design/approval-lifecycle-direction-c/1440-template-owner-failure.png) / [template-owner-failure · 390](design/approval-lifecycle-direction-c/390-template-owner-failure.png)；其余见JSON | 成员字段目前折叠，原型直接显示；失败主要notice在页级，图的就近错误尚未迁Vue。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10新增本按钮代表逐态及失败保留双端图；仅已列selector/场景，不覆盖全部字段/变体/跨窗pending归属，未映射disabled仍待有依据核对，具体审核和真实Vue/服务不据此通过。 |
| AN-A-TEMPLATE-FIELDS 展开审批人与超时接收人 / local | 1处；收起、展开、invalid自动展开 | [template · 1440](design/approval-direction-c/1440-template.png) / [template · 390](design/approval-direction-c/390-template.png)；其余见JSON | C稿把业务必填字段直接展开，这是结构提案，不能当作原生折叠控件六态图。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| AN-A-PUBLISH-OPEN 发布草稿入口 / local | 1处；每个真实draft模板、模板窗上叠加发布窗 | [template · 1440](design/approval-direction-c/1440-template.png) / [template · 390](design/approval-direction-c/390-template.png)、[publish · 1440](design/approval-direction-c/1440-publish.png) / [publish · 390](design/approval-direction-c/390-publish.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-PUBLISH-CLOSE 返回/取消发布 / local | 2处；返回、Escape | [publish-closed-pending · 1440](design/approval-lifecycle-direction-c/1440-publish-closed-pending.png) / [publish-closed-pending · 390](design/approval-lifecycle-direction-c/390-publish-closed-pending.png)、[publish-reopened-pending · 1440](design/approval-lifecycle-direction-c/1440-publish-reopened-pending.png) / [publish-reopened-pending · 390](design/approval-lifecycle-direction-c/390-publish-reopened-pending.png)；其余见JSON | 原合同两种关闭描述不同；本轮源检查确认。下次openPublish会清原因，不声称旧原因被重新带入。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10表单包补代表关闭按钮focus、空闲关闭/重开图；新增顶部关闭与非详情遮罩沿待审提案，发布返回清原因与源内存规则不同。仅已列控件，不据此签收源Vue、其余六态或在途关闭归属。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-PUBLISH-SUBMIT 确认发布模板 / write | 2处；发布、失败、处理中 | [publish-pending · 1440](design/approval-lifecycle-direction-c/1440-publish-pending.png) / [publish-pending · 390](design/approval-lifecycle-direction-c/390-publish-pending.png)、[publish-owner-failure · 1440](design/approval-lifecycle-direction-c/1440-publish-owner-failure.png) / [publish-owner-failure · 390](design/approval-lifecycle-direction-c/390-publish-owner-failure.png)；其余见JSON | 标题current_version与请求revision不同语义；原独立夹具不能拼成一致版本链。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10新增本按钮代表逐态及失败保留双端图；仅已列selector/场景，不覆盖全部字段/变体/跨窗pending归属，未映射disabled仍待有依据核对，具体审核和真实Vue/服务不据此通过。 |
| AN-A-REQUEST-CLOSE 取消发起审批 / local | 2处；取消、Escape | [request-closed-pending · 1440](design/approval-lifecycle-direction-c/1440-request-closed-pending.png) / [request-closed-pending · 390](design/approval-lifecycle-direction-c/390-request-closed-pending.png)、[request-reopened-pending · 1440](design/approval-lifecycle-direction-c/1440-request-reopened-pending.png) / [request-reopened-pending · 390](design/approval-lifecycle-direction-c/390-request-reopened-pending.png)；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10表单包补代表关闭按钮focus、空闲关闭/重开图；新增顶部关闭与非详情遮罩沿待审提案，发布返回清原因与源内存规则不同。仅已列控件，不据此签收源Vue、其余六态或在途关闭归属。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-REQUEST-SUBMIT 发起审批与必填定位 / write | 2处；task、opportunity_decision、invalid展开、失败、处理中 | [request-pending · 1440](design/approval-lifecycle-direction-c/1440-request-pending.png) / [request-pending · 390](design/approval-lifecycle-direction-c/390-request-pending.png)、[request-owner-failure · 1440](design/approval-lifecycle-direction-c/1440-request-owner-failure.png) / [request-owner-failure · 390](design/approval-lifecycle-direction-c/390-request-owner-failure.png)；其余见JSON | resource_type由已发布模板watch派生，不加独立字段；服务端验证存在/类型/范围，原型不证明真实发起。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10新增本按钮代表逐态及失败保留双端图；仅已列selector/场景，不覆盖全部字段/变体/跨窗pending归属，未映射disabled仍待有依据核对，具体审核和真实Vue/服务不据此通过。 |
| AN-A-REQUEST-FIELDS 展开关联资源编号 / local | 1处；收起、展开 | [request · 1440](design/approval-direction-c/1440-request.png) / [request · 390](design/approval-direction-c/390-request.png)；其余见JSON | C稿资源编号直接可见，不用该图充作原折叠控件已审核。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| AN-A-QUEUE 待我处理/我发起的 / read | 2处；decidable、requested | [normal · 1440](design/approval-direction-c/1440-normal.png) / [normal · 390](design/approval-direction-c/390-normal.png)、[requested · 1440](design/approval-direction-c/1440-requested.png) / [requested · 390](design/approval-direction-c/390-requested.png)；其余见JSON | 当前页mineCount仅本页can_decide数，不画成全组织审批总量。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-FILTER 审批状态筛选 / read | 1处；pending、approved、rejected、全部、cancelled仅URL | [normal · 1440](design/approval-direction-c/1440-normal.png) / [normal · 390](design/approval-direction-c/390-normal.png)、[empty · 1440](design/approval-direction-c/1440-empty.png) / [empty · 390](design/approval-direction-c/390-empty.png)；其余见JSON | 既有VM已证实全部刷新差异，显式空值仅是C原型修订，Vue尚未修；没有cancelled独立按钮。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-DETAIL 读取审批详情 / read | 1处；动态行、读取中、404、失败 | [normal · 1440](design/approval-direction-c/1440-normal.png) / [normal · 390](design/approval-direction-c/390-normal.png)、[detail_loading · 1440](design/approval-direction-c/1440-detail_loading.png) / [detail_loading · 390](design/approval-direction-c/390-detail_loading.png)；其余见JSON | 同实例A/B返回乱序与关闭后回流已复现；parent作用域隔离不等于同页读取归属。具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 2026-09-10导航包补实际入口四态/逻辑选中和分页边界；仅列出变体，未列禁用/忙碌不补造。离线点击不等于真实Vue/服务或在途结果归属通过。 |
| AN-A-QUEUE-FORWARD 队列事件转发 / wiring | 1处；P25本地消费者 | ；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| D-AN-APPROVAL 审批详情定义 / wiring | 1处；P25本地消费者 | ；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| D-AN-TEMPLATE 模板草稿定义 / wiring | 1处；P25本地消费者 | ；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| D-AN-PUBLISH 模板发布定义 / wiring | 1处；P25本地消费者 | ；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |
| D-AN-REQUEST 发起审批定义 / wiring | 1处；P25本地消费者 | ；其余见JSON | 具体控件六态、主题/密度/长内容、完整角色和真实Vue/服务尚未验收；场景关联不是控件批准。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| AN-A-QUEUE-FORWARD | @queue / setQueue | AN-A-QUEUE |
| AN-A-QUEUE-FORWARD | @filter / setFilter | AN-A-FILTER |
| AN-A-QUEUE-FORWARD | @open / open | AN-A-DETAIL |
| AN-A-QUEUE-FORWARD | @create-request / showRequest = true | AN-A-REQUEST-OPEN |
| AN-A-QUEUE-FORWARD | @manage-templates / showTemplate = true | AN-A-TEMPLATE-OPEN |
| D-AN-APPROVAL | 容器定义，无额外事件 | AN-A-CLOSE-FOCUS、AN-A-DECIDE-REJECT、AN-A-DECIDE-APPROVE |
| D-AN-TEMPLATE | 容器定义，无额外事件 | AN-A-TEMPLATE-CLOSE、AN-A-TEMPLATE-SUBMIT、AN-A-PUBLISH-OPEN |
| D-AN-PUBLISH | 容器定义，无额外事件 | AN-A-PUBLISH-CLOSE、AN-A-PUBLISH-SUBMIT |
| D-AN-REQUEST | 容器定义，无额外事件 | AN-A-REQUEST-CLOSE、AN-A-REQUEST-SUBMIT |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| ApprovalWorkspace.vue / reason | 批准/驳回原始原因，max1000；trim仅用于判空 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.name | 模板名称，required/max200 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.resource_type | 模板资源类型，task或opportunity_decision | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.node_name | 单节点名称，required/max120 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.sla_minutes | SLA分钟number/min1/max43200；服务要求整数 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.approver_id | 当前工作区审批人成员 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / templateForm.escalation_assignee_id | 当前工作区超时接收人 | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / publishReason | 发布原因，required/max500，提交trim | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / requestForm.template_id | 已发布模板ID，required；watch派生resource_type | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / requestForm.resource_id | 资源ID，required，提交trim | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |
| ApprovalWorkspace.vue / requestForm.title | 审批标题，required/max200，提交trim | 当前字段未统一busy锁；原型直接展开必填及窗内错误是提案，不是现有Vue已改。仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 2026-09-10 APPROVAL-FORMS-C-r1按当前Vue AST核对本字段原生约束，11字段焦点/标签/说明、适用必填/范围/长度图见包README；不代表所有输入变体或真实服务获批。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| ApprovalWorkspace.vue / dialog.1 / detail | native-dialog / matching-dialog-scene | [detail · 1440](design/approval-direction-c/1440-detail.png) / [detail · 390](design/approval-direction-c/390-detail.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.1 / fallback | native-dialog / matching-dialog-scene | [fallback · 1440](design/approval-direction-c/1440-fallback.png) / [fallback · 390](design/approval-direction-c/390-fallback.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.1 / task | native-dialog / matching-dialog-scene | [task · 1440](design/approval-direction-c/1440-task.png) / [task · 390](design/approval-direction-c/390-task.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.1 / detail_readonly | native-dialog / matching-dialog-scene | [detail_readonly · 1440](design/approval-direction-c/1440-detail_readonly.png) / [detail_readonly · 390](design/approval-direction-c/390-detail_readonly.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.2 / template | native-dialog / matching-dialog-scene | [template · 1440](design/approval-direction-c/1440-template.png) / [template · 390](design/approval-direction-c/390-template.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / form.1 / template | form-container / related-scene-only | [template · 1440](design/approval-direction-c/1440-template.png) / [template · 390](design/approval-direction-c/390-template.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.3 / publish | native-dialog / matching-dialog-scene | [publish · 1440](design/approval-direction-c/1440-publish.png) / [publish · 390](design/approval-direction-c/390-publish.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / form.2 / publish | form-container / related-scene-only | [publish · 1440](design/approval-direction-c/1440-publish.png) / [publish · 390](design/approval-direction-c/390-publish.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / dialog.4 / request | native-dialog / matching-dialog-scene | [request · 1440](design/approval-direction-c/1440-request.png) / [request · 390](design/approval-direction-c/390-request.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |
| ApprovalWorkspace.vue / form.3 / request | form-container / related-scene-only | [request · 1440](design/approval-direction-c/1440-request.png) / [request · 390](design/approval-direction-c/390-request.png) | 仅当前消费者关联；全按钮/字段、角色、主题、在途关闭/错误和真实Vue/API仍未验收。 |

### 明确保留的边界

- 2026-09-10生命周期包54PNG：五写入预览锁原请求/窗口代次，原窗失败保留、模拟成功仅关原窗；关闭/重开及旧A结果不改后来B。双端106离线检查，生产读写竞态和requestId覆盖仍未修。模板/发起/发布disabled取源busy=true条件，新增3映射；当前103有图/20源无状态/21待核对，不替代其他变体或具体批准。
- 全部按钮setFilter('')移除status，刷新回pending；原型显式空值修订不等于真实Vue修复。只监听approval，不宣称history同步所有筛选。
- 读A/B乱序、关闭后旧读回流、A审批成功关闭后来B已源复现；写入body仍为A，不夸大成批准错对象或线上事故。
- 发布返回清目标但保留原因，Escape清两者；重开总是清原因。模板/发起关闭保留草稿。
- 模板/请求/发布失败仍主要页级notice；图中窗内错误/统一busy字段锁/直接展开必填只是提案。
- 单节点UI不改成多节点、证据缺失警告不改成硬门槛、升级不等于自动批准；当前页计数不作全工作区汇总。
- 新增5写入代表控件64PNG，27视觉槽已有明确selector映射，117代表槽未映射；字段、动态行/模板、叠加焦点、角色/主题/软键盘和真实链继续验。关闭再重开期间pending归属未完整实现/验收。
- 2026-09-10表单包新增88PNG，11字段、4关闭focus代表槽及空闲重开图；累计31视觉槽映射、113未映射。表单直接展开、中文字段错误和非详情遮罩关闭为提案；在途归属/真实Vue与服务仍待。旧条目117为前批历史。
- 2026-09-10导航包354PNG：41变体、17既有组/19额外入口，5阅读目录不增加源动作。新增65代表槽，累计96已映射、48未映射；页级requestId、字段折叠替代和状态适用性仍待。仅新稿修复固定标题遮挡目录并核对章节跳转；旧图、源Vue和生产不变。
- ApprovalQueuePanel委托保持与父handler对应；P34组织审批与P26通知不合并权限/动作，useModalDialog其他消费者不因此通过。
- 父壳层有reset_on_scope键规则，但同实例A/B读写晚到并不受此键保护；本批不证明跨组织越权或完整缓存生命周期。
- 原夹具目录模板v1/详情锁v3、节点无升级而历史升级、同成员不同名等独立响应保留，不拼造一致数据库链。
- 94图含2非业务控件板，43双端主场景和8下部图；关联不等于全控件六态，具体批准仍待。

## P26 局部动作与共享消费者

[逐项机器清单](action-reviews/P26.json)：23个局部源位置 → 19组；6类写入，17组路由动作，2组转发/容器关联不重复计动作。已映射6/6个源码字段位置，3/3处调用/内嵌容器，16个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有3个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有12个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| AN-N-PREF-OPEN 通知偏好入口 / local | 1处；normal、preferences | [normal · 1440](design/notification-direction-c/1440-normal.png) / [normal · 390](design/notification-direction-c/390-normal.png)、[preferences · 1440](design/notification-direction-c/1440-preferences.png) / [preferences · 390](design/notification-direction-c/390-preferences.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-ALL-READ 全部标记已读 / write | 1处；all_read_intent、all_read_busy、all_read_error | [all_read_intent · 1440](design/notification-direction-c/1440-all_read_intent.png) / [all_read_intent · 390](design/notification-direction-c/390-all_read_intent.png)、[all_read_busy · 1440](design/notification-direction-c/1440-all_read_busy.png) / [all_read_busy · 390](design/notification-direction-c/390-all_read_busy.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-TECH-PAGE 页级技术详情 / local | 1处；error | [error · 1440](design/notification-direction-c/1440-error.png) / [error · 390](design/notification-direction-c/390-error.png)、[diagnostic-error-default · 1440](design/notification-forms-direction-c/diagnostic-error-default-1440.png) / [diagnostic-error-default · 390](design/notification-forms-direction-c/diagnostic-error-default-390.png)；其余见JSON | 五类页级错误样本经真实api-client/api隔离处理后生成；仅合成编号，真实共享requestId后到覆盖风险未修。代表四态有图，disabled/busy按当前源码无呈现单列；无编号/真实请求/用户批准仍待。 |
| AN-N-FILTER-CATEGORY 通知分类 / read | 1处；normal、category_task、category_approval、category_competitor、category_system | [normal · 1440](design/notification-direction-c/1440-normal.png) / [normal · 390](design/notification-direction-c/390-normal.png)、[category_task · 1440](design/notification-direction-c/1440-category_task.png) / [category_task · 390](design/notification-direction-c/390-category_task.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-UNREAD 只看未读 / read | 1处；unread | [unread · 1440](design/notification-direction-c/1440-unread.png) / [unread · 390](design/notification-direction-c/390-unread.png)、[unread-off-default · 1440](design/notification-navigation-direction-c/unread-off-default-1440.png) / [unread-off-default · 390](design/notification-navigation-direction-c/unread-off-default-390.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-FILTER-STATUS 通知处理状态筛选 / read | 1处；normal、workflow_open、workflow_progress、workflow_closed | [normal · 1440](design/notification-direction-c/1440-normal.png) / [normal · 390](design/notification-direction-c/390-normal.png)、[workflow_open · 1440](design/notification-direction-c/1440-workflow_open.png) / [workflow_open · 390](design/notification-direction-c/390-workflow_open.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-LOAD 重新加载 / read | 1处；loading、error、forbidden、expired、rate_limited、version_conflict | [loading · 1440](design/notification-direction-c/1440-loading.png) / [loading · 390](design/notification-direction-c/390-loading.png)、[error · 1440](design/notification-direction-c/1440-error.png) / [error · 390](design/notification-direction-c/390-error.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-DETAIL 打开消息并自动已读 / write | 1处；detail、detail_unread、read_busy、read_error、read_ack | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png)、[detail_unread · 1440](design/notification-direction-c/1440-detail_unread.png) / [detail_unread · 390](design/notification-direction-c/390-detail_unread.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-PAGE 通知分页 / read | 2处；pagination | [pagination · 1440](design/notification-direction-c/1440-pagination.png) / [pagination · 390](design/notification-direction-c/390-pagination.png)、[previous-default · 1440](design/notification-navigation-direction-c/previous-default-1440.png) / [previous-default · 390](design/notification-navigation-direction-c/previous-default-390.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-DETAIL-WIRING 详情窗口定义 / wiring | 1处；detail | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-CLOSE-DETAIL 关闭消息详情 / local | 2处；detail、read_busy | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png)、[read_busy · 1440](design/notification-direction-c/1440-read_busy.png) / [read_busy · 390](design/notification-direction-c/390-read_busy.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-SOURCE 返回消息来源 / navigation | 1处；detail、detail_missing | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png)、[detail_missing · 1440](design/notification-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/notification-direction-c/390-detail_missing.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-START 开始处理通知 / write | 1处；detail、start_busy、start_error | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png)、[start_busy · 1440](design/notification-direction-c/1440-start_busy.png) / [start_busy · 390](design/notification-direction-c/390-start_busy.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-CLOSE 关闭通知 / write | 1处；detail_progress、close_error | [detail_progress · 1440](design/notification-direction-c/1440-detail_progress.png) / [detail_progress · 390](design/notification-direction-c/390-detail_progress.png)、[close_error · 1440](design/notification-direction-c/1440-close_error.png) / [close_error · 390](design/notification-direction-c/390-close_error.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-REOPEN 重新打开通知 / write | 1处；detail_closed、reopen_error | [detail_closed · 1440](design/notification-direction-c/1440-detail_closed.png) / [detail_closed · 390](design/notification-direction-c/390-detail_closed.png)、[reopen_error · 1440](design/notification-direction-c/1440-reopen_error.png) / [reopen_error · 390](design/notification-direction-c/390-reopen_error.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-TECH-RESOURCE 资源技术详情 / local | 1处；detail_technical | [detail_technical · 1440](design/notification-direction-c/1440-detail_technical.png) / [detail_technical · 390](design/notification-direction-c/390-detail_technical.png)、[technical-default · 1440](design/notification-navigation-direction-c/technical-default-1440.png) / [technical-default · 390](design/notification-navigation-direction-c/technical-default-390.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-PREF-WIRING 偏好窗口定义 / wiring | 1处；preferences | [preferences · 1440](design/notification-direction-c/1440-preferences.png) / [preferences · 390](design/notification-direction-c/390-preferences.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| AN-N-PREF-CLOSE 取消通知偏好 / local | 2处；preferences、preferences_busy | [preferences · 1440](design/notification-direction-c/1440-preferences.png) / [preferences · 390](design/notification-direction-c/390-preferences.png)、[preferences_busy · 1440](design/notification-direction-c/1440-preferences_busy.png) / [preferences_busy · 390](design/notification-direction-c/390-preferences_busy.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批新增导航/关闭控件图；selected逻辑状态另记，不混入六态。额外偏好图标仅提案，生产归属缺口及全页批准仍待。 |
| AN-N-PREF-SAVE 保存通知偏好 / write | 2处；preferences_intent、preferences_busy、preferences_error、preferences_conflict | [preferences_intent · 1440](design/notification-direction-c/1440-preferences_intent.png) / [preferences_intent · 390](design/notification-direction-c/390-preferences_intent.png)、[preferences_busy · 1440](design/notification-direction-c/1440-preferences_busy.png) / [preferences_busy · 390](design/notification-direction-c/390-preferences_busy.png)；其余见JSON | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| AN-N-DETAIL-WIRING | 容器定义，无额外事件 | AN-N-DETAIL、AN-N-CLOSE-DETAIL |
| AN-N-PREF-WIRING | 容器定义，无额外事件 | AN-N-PREF-OPEN、AN-N-PREF-CLOSE、AN-N-PREF-SAVE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| NotificationCenter.vue / unread | 未读过滤：URL unread=1，API unread=true；不是已读写操作 | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / preferences.in_app_enabled | 站内通知总开关 | load会覆盖未保存ref；字段提交中未统一禁用，当前不修复或改变契约。源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批notification-forms-direction-c以源AST核对原生布尔约束，并补说明关联/键盘焦点/关闭/等待和邮件禁用图；真实Vue未改。 |
| NotificationCenter.vue / preferences.email_enabled | 邮件渠道固定关闭且禁用；服务未接入，不产生外部发送 | load会覆盖未保存ref；字段提交中未统一禁用，当前不修复或改变契约。源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批notification-forms-direction-c以源AST核对原生布尔约束，并补说明关联/键盘焦点/关闭/等待和邮件禁用图；真实Vue未改。 |
| NotificationCenter.vue / preferences.task_enabled | 任务事件偏好 | load会覆盖未保存ref；字段提交中未统一禁用，当前不修复或改变契约。源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批notification-forms-direction-c以源AST核对原生布尔约束，并补说明关联/键盘焦点/关闭/等待和邮件禁用图；真实Vue未改。 |
| NotificationCenter.vue / preferences.approval_enabled | 审批事件偏好 | load会覆盖未保存ref；字段提交中未统一禁用，当前不修复或改变契约。源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批notification-forms-direction-c以源AST核对原生布尔约束，并补说明关联/键盘焦点/关闭/等待和邮件禁用图；真实Vue未改。 |
| NotificationCenter.vue / preferences.competitor_enabled | 竞品事件偏好 | load会覆盖未保存ref；字段提交中未统一禁用，当前不修复或改变契约。源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 本批notification-forms-direction-c以源AST核对原生布尔约束，并补说明关联/键盘焦点/关闭/等待和邮件禁用图；真实Vue未改。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| NotificationCenter.vue / dialog.1 / detail | native-dialog / matching-dialog-scene | [detail · 1440](design/notification-direction-c/1440-detail.png) / [detail · 390](design/notification-direction-c/390-detail.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.1 / detail_unread | native-dialog / matching-dialog-scene | [detail_unread · 1440](design/notification-direction-c/1440-detail_unread.png) / [detail_unread · 390](design/notification-direction-c/390-detail_unread.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.1 / detail_progress | native-dialog / matching-dialog-scene | [detail_progress · 1440](design/notification-direction-c/1440-detail_progress.png) / [detail_progress · 390](design/notification-direction-c/390-detail_progress.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.1 / detail_closed | native-dialog / matching-dialog-scene | [detail_closed · 1440](design/notification-direction-c/1440-detail_closed.png) / [detail_closed · 390](design/notification-direction-c/390-detail_closed.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.1 / detail_missing | native-dialog / matching-dialog-scene | [detail_missing · 1440](design/notification-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/notification-direction-c/390-detail_missing.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.1 / detail_long | native-dialog / matching-dialog-scene | [detail_long · 1440](design/notification-direction-c/1440-detail_long.png) / [detail_long · 390](design/notification-direction-c/390-detail_long.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.2 / preferences | native-dialog / matching-dialog-scene | [preferences · 1440](design/notification-direction-c/1440-preferences.png) / [preferences · 390](design/notification-direction-c/390-preferences.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.2 / preferences_busy | native-dialog / matching-dialog-scene | [preferences_busy · 1440](design/notification-direction-c/1440-preferences_busy.png) / [preferences_busy · 390](design/notification-direction-c/390-preferences_busy.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.2 / preferences_error | native-dialog / matching-dialog-scene | [preferences_error · 1440](design/notification-direction-c/1440-preferences_error.png) / [preferences_error · 390](design/notification-direction-c/390-preferences_error.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.2 / preferences_conflict | native-dialog / matching-dialog-scene | [preferences_conflict · 1440](design/notification-direction-c/1440-preferences_conflict.png) / [preferences_conflict · 390](design/notification-direction-c/390-preferences_conflict.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / dialog.2 / preference-fields-and-feedback-c-r1 | native-dialog / matching-dialog-scene | [modal-preferences · 1440](design/notification-forms-direction-c/modal-preferences-1440.png) / [modal-preferences · 390](design/notification-forms-direction-c/modal-preferences-390.png)、[modal-preferences_off · 1440](design/notification-forms-direction-c/modal-preferences_off-1440.png) / [modal-preferences_off · 390](design/notification-forms-direction-c/modal-preferences_off-390.png)、[modal-preferences_busy · 1440](design/notification-forms-direction-c/modal-preferences_busy-1440.png) / [modal-preferences_busy · 390](design/notification-forms-direction-c/modal-preferences_busy-390.png)、[modal-preferences_error · 1440](design/notification-forms-direction-c/modal-preferences_error-1440.png) / [modal-preferences_error · 390](design/notification-forms-direction-c/modal-preferences_error-390.png)、[modal-preferences_conflict · 1440](design/notification-forms-direction-c/modal-preferences_conflict-1440.png) / [modal-preferences_conflict · 390](design/notification-forms-direction-c/modal-preferences_conflict-390.png) | 70图中34字段、10同窗反馈、26页级诊断；表单级错误关联仍是提案，非字段无效。真实在途/草稿归属已另行源码与Vue回归，不用这些旧图证明新反馈路径。 |
| NotificationCenter.vue / form.1 / preferences | form-container / related-scene-only | [preferences · 1440](design/notification-direction-c/1440-preferences.png) / [preferences · 390](design/notification-direction-c/390-preferences.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / form.1 / preferences_busy | form-container / related-scene-only | [preferences_busy · 1440](design/notification-direction-c/1440-preferences_busy.png) / [preferences_busy · 390](design/notification-direction-c/390-preferences_busy.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / form.1 / preferences_error | form-container / related-scene-only | [preferences_error · 1440](design/notification-direction-c/1440-preferences_error.png) / [preferences_error · 390](design/notification-direction-c/390-preferences_error.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / form.1 / preferences_conflict | form-container / related-scene-only | [preferences_conflict · 1440](design/notification-direction-c/1440-preferences_conflict.png) / [preferences_conflict · 390](design/notification-direction-c/390-preferences_conflict.png) | 源码语义已核对；独立图稿关联不代表真实Vue、全变体、角色或生产验收。未映射状态继续细化，未获用户全页批准。 |
| NotificationCenter.vue / form.1 / preference-fields-and-feedback-c-r1 | form-container / matching-dialog-scene | [modal-preferences · 1440](design/notification-forms-direction-c/modal-preferences-1440.png) / [modal-preferences · 390](design/notification-forms-direction-c/modal-preferences-390.png)、[modal-preferences_off · 1440](design/notification-forms-direction-c/modal-preferences_off-1440.png) / [modal-preferences_off · 390](design/notification-forms-direction-c/modal-preferences_off-390.png)、[modal-preferences_busy · 1440](design/notification-forms-direction-c/modal-preferences_busy-1440.png) / [modal-preferences_busy · 390](design/notification-forms-direction-c/modal-preferences_busy-390.png)、[modal-preferences_error · 1440](design/notification-forms-direction-c/modal-preferences_error-1440.png) / [modal-preferences_error · 390](design/notification-forms-direction-c/modal-preferences_error-390.png)、[modal-preferences_conflict · 1440](design/notification-forms-direction-c/modal-preferences_conflict-1440.png) / [modal-preferences_conflict · 390](design/notification-forms-direction-c/modal-preferences_conflict-390.png) | 70图中34字段、10同窗反馈、26页级诊断；表单级错误关联仍是提案，非字段无效。真实在途/草稿归属已另行源码与Vue回归，不用这些旧图证明新反馈路径。 |

### 明确保留的边界

- 28项源码测试覆盖读取/详情/偏好归属及正常路径，并保留普通行与深链busy差异；非完整页面、全局上下文或生命周期验收。
- 导航240图及本批字段/诊断70图后，代表槽85有图、12按当前源码无呈现单列、3仍待适用性核对；不是完整字段/所有组合或整页批准。原98+60+240图不改。
- SSE/路由、列表/详情、全局导航、角色/主题/密度及真实API组合未验收。
- 余3槽为分页busy及偏好关闭disabled/busy，需完整调用边界登记，不用假禁用图填数。
- useModalDialog提供原生开关/焦点返回；本轮VM测试替身不证明DOM焦点，完整组合仍需真实Vue验收。
- 读取meta/error、详情GET、自动已读/workflow和偏好草稿/保存归属已局部修复；全局上下文、markAll及模态内错误可达性仍非本轮完整验收。

## P27 局部动作与共享消费者

[逐项机器清单](action-reviews/P27.json)：19个局部源位置 → 16组；2类写入，14组路由动作，2组转发/容器关联不重复计动作。已映射10/10个源码字段位置，3/3处调用/内嵌容器，32个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有0个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有10个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| AR-CREATE 创建规则 / local | 1处；create | [normal · 1440](design/automation-direction-c/1440-normal.png) / [normal · 390](design/automation-direction-c/390-normal.png)、[create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-LOAD 重新加载 / read | 1处；error、blocked、expired、forbidden、rate_limited、version_conflict | [error · 1440](design/automation-direction-c/1440-error.png) / [error · 390](design/automation-direction-c/390-error.png)、[blocked · 1440](design/automation-direction-c/1440-blocked.png) / [blocked · 390](design/automation-direction-c/390-blocked.png)；其余见JSON | 本批代表控件及已列扩展变体均有逐态图；不代表所有数据/角色/主题/错误与在途组合、提案新增控件或真实Vue通过。 |
| AR-DETAIL 查看执行记录 / read | 1处；detail、empty、history | [normal · 1440](design/automation-direction-c/1440-normal.png) / [normal · 390](design/automation-direction-c/390-normal.png)、[detail · 1440](design/automation-direction-c/1440-detail.png) / [detail · 390](design/automation-direction-c/390-detail.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-EDIT 编辑规则 / local | 1处；edit、active、paused | [normal · 1440](design/automation-direction-c/1440-normal.png) / [normal · 390](design/automation-direction-c/390-normal.png)、[paused · 1440](design/automation-direction-c/1440-paused.png) / [paused · 390](design/automation-direction-c/390-paused.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-STATUS 暂停或恢复 / write | 1处；pause、resume | [normal · 1440](design/automation-direction-c/1440-normal.png) / [normal · 390](design/automation-direction-c/390-normal.png)、[paused · 1440](design/automation-direction-c/1440-paused.png) / [paused · 390](design/automation-direction-c/390-paused.png)；其余见JSON | 本批代表控件及已列扩展变体均有逐态图；不代表所有数据/角色/主题/错误与在途组合、提案新增控件或真实Vue通过。 |
| AR-DETAIL-CLOSE 关闭执行记录 / local | 1处；close-button、escape-via-wiring | [detail · 1440](design/automation-direction-c/1440-detail.png) / [detail · 390](design/automation-direction-c/390-detail.png)、[long_history · 1440](design/automation-direction-c/1440-long_history.png) / [long_history · 390](design/automation-direction-c/390-long_history.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-TASK 查看关联人工任务 / navigation | 1处；task-link | [execution_task · 1440](design/automation-direction-c/1440-execution_task.png) / [execution_task · 390](design/automation-direction-c/390-execution_task.png)、[task-default · 1440](design/automation-controls-direction-c/task-default-1440.png) / [task-default · 390](design/automation-controls-direction-c/task-default-390.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-NOTIFICATION 查看触发通知与来源 / navigation | 1处；notification-link | [detail · 1440](design/automation-direction-c/1440-detail.png) / [detail · 390](design/automation-direction-c/390-detail.png)、[notification-default · 1440](design/automation-controls-direction-c/notification-default-1440.png) / [notification-default · 390](design/automation-controls-direction-c/notification-default-390.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-TECH 执行技术详情 / local | 1处；collapsed、expanded | [execution_task · 1440](design/automation-direction-c/1440-execution_task.png) / [execution_task · 390](design/automation-direction-c/390-execution_task.png)、[technical · 1440](design/automation-direction-c/1440-technical.png) / [technical · 390](design/automation-direction-c/390-technical.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-TEMPLATE 应用业务模板 / local | 1处；overdue、competitor、rejected | [template_overdue · 1440](design/automation-direction-c/1440-template_overdue.png) / [template_overdue · 390](design/automation-direction-c/390-template_overdue.png)、[template_competitor · 1440](design/automation-direction-c/1440-template_competitor.png) / [template_competitor · 390](design/automation-direction-c/390-template_competitor.png)；其余见JSON | 本批代表控件及已列扩展变体均有逐态图；不代表所有数据/角色/主题/错误与在途组合、提案新增控件或真实Vue通过。 |
| AR-SAMPLE 查看预览样本 / navigation | 1处；sample-link | [preview_samples · 1440](design/automation-direction-c/1440-preview_samples.png) / [preview_samples · 390](design/automation-direction-c/390-preview_samples.png)、[sample-default · 1440](design/automation-controls-direction-c/sample-default-1440.png) / [sample-default · 390](design/automation-controls-direction-c/sample-default-390.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-EDITOR-CLOSE 取消创建或编辑 / local | 1处；create-cancel、edit-cancel、escape-via-wiring、pending-cancel | [create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png)、[edit · 1440](design/automation-direction-c/1440-edit.png) / [edit · 390](design/automation-direction-c/390-edit.png)；其余见JSON | 本批代表控件及已列扩展变体均有逐态图；不代表所有数据/角色/主题/错误与在途组合、提案新增控件或真实Vue通过。 |
| AR-PREVIEW 只读试运行 / read | 1处；preview、pending、failed、empty、samples、changed | [preview · 1440](design/automation-direction-c/1440-preview.png) / [preview · 390](design/automation-direction-c/390-preview.png)、[preview_task · 1440](design/automation-direction-c/1440-preview_task.png) / [preview_task · 390](design/automation-direction-c/390-preview_task.png)；其余见JSON | 新增124图关联代表控件的实际默认/悬停/Tab焦点/按下及适用在途态；不是所有模板、暂停恢复、创建编辑、错误类重载或共享新增控件/真实Vue/用户批准。 |
| AR-SAVE 创建并启用或保存修改 / write | 2处；create、edit、validation、pending、conflict | [create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png)、[edit · 1440](design/automation-direction-c/1440-edit.png) / [edit · 390](design/automation-direction-c/390-edit.png)；其余见JSON | 本批代表控件及已列扩展变体均有逐态图；不代表所有数据/角色/主题/错误与在途组合、提案新增控件或真实Vue通过。 |
| D-AR-EXECUTIONS 执行记录原生模态接线 / wiring | 2处；detail | [detail · 1440](design/automation-direction-c/1440-detail.png) / [detail · 390](design/automation-direction-c/390-detail.png)；其余见JSON | 独立C场景只证明已有图稿关联；尚未建立该控件逐状态selector证据，不代表真实Vue、全变体、角色/主题或生产通过。 |
| D-AR-EDITOR 新建/编辑原生模态接线 / wiring | 2处；create、edit | [create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png)、[edit · 1440](design/automation-direction-c/1440-edit.png) / [edit · 390](design/automation-direction-c/390-edit.png)；其余见JSON | 独立C场景只证明已有图稿关联；尚未建立该控件逐状态selector证据，不代表真实Vue、全变体、角色/主题或生产通过。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| D-AR-EXECUTIONS | @cancel / handleDetailCancel | AR-DETAIL-CLOSE |
| D-AR-EDITOR | @cancel / handleCreateCancel | AR-EDITOR-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| AutomationRuleCenter.vue / form.name | 名称required/max200 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.trigger_event_type | 触发器四项；task.created循环保护 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.condition_severity | 严重程度any/info/warning/critical | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.action_type | notify_owner/create_task；任务触发仅前者 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.owner_id | 当前范围成员required | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.action_assignee_id | create_task条件下成员required | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.action_title | 动作标题required/max200 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / editReason | 仅编辑required；UI500，服务1000不擅自统一 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.rate_limit_count | number required/min1/max1000；默认20 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |
| AutomationRuleCenter.vue / form.rate_limit_window_minutes | number required/min1/max1440；默认60 | 本批只覆盖逐字段适用状态及7个离线组合；并非真实Vue、辅助技术、全部触发/成员/主题/窗口生命周期或用户批准。成员夹具仅一人，在途未代验切换其他成员。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| AutomationRuleCenter.vue / dialog.1 / detail | native-dialog / matching-dialog-scene | [detail · 1440](design/automation-direction-c/1440-detail.png) / [detail · 390](design/automation-direction-c/390-detail.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / executions_empty | native-dialog / matching-dialog-scene | [executions_empty · 1440](design/automation-direction-c/1440-executions_empty.png) / [executions_empty · 390](design/automation-direction-c/390-executions_empty.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_queued | native-dialog / matching-dialog-scene | [execution_queued · 1440](design/automation-direction-c/1440-execution_queued.png) / [execution_queued · 390](design/automation-direction-c/390-execution_queued.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_leased | native-dialog / matching-dialog-scene | [execution_leased · 1440](design/automation-direction-c/1440-execution_leased.png) / [execution_leased · 390](design/automation-direction-c/390-execution_leased.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_retry | native-dialog / matching-dialog-scene | [execution_retry · 1440](design/automation-direction-c/1440-execution_retry.png) / [execution_retry · 390](design/automation-direction-c/390-execution_retry.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_succeeded | native-dialog / matching-dialog-scene | [execution_succeeded · 1440](design/automation-direction-c/1440-execution_succeeded.png) / [execution_succeeded · 390](design/automation-direction-c/390-execution_succeeded.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_rate | native-dialog / matching-dialog-scene | [execution_rate · 1440](design/automation-direction-c/1440-execution_rate.png) / [execution_rate · 390](design/automation-direction-c/390-execution_rate.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_failed | native-dialog / matching-dialog-scene | [execution_failed · 1440](design/automation-direction-c/1440-execution_failed.png) / [execution_failed · 390](design/automation-direction-c/390-execution_failed.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_dead | native-dialog / matching-dialog-scene | [execution_dead · 1440](design/automation-direction-c/1440-execution_dead.png) / [execution_dead · 390](design/automation-direction-c/390-execution_dead.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_unknown | native-dialog / matching-dialog-scene | [execution_unknown · 1440](design/automation-direction-c/1440-execution_unknown.png) / [execution_unknown · 390](design/automation-direction-c/390-execution_unknown.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_suppressed | native-dialog / matching-dialog-scene | [execution_suppressed · 1440](design/automation-direction-c/1440-execution_suppressed.png) / [execution_suppressed · 390](design/automation-direction-c/390-execution_suppressed.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / execution_task | native-dialog / matching-dialog-scene | [execution_task · 1440](design/automation-direction-c/1440-execution_task.png) / [execution_task · 390](design/automation-direction-c/390-execution_task.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / technical | native-dialog / matching-dialog-scene | [technical · 1440](design/automation-direction-c/1440-technical.png) / [technical · 390](design/automation-direction-c/390-technical.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.1 / long_history | native-dialog / matching-dialog-scene | [long_history · 1440](design/automation-direction-c/1440-long_history.png) / [long_history · 390](design/automation-direction-c/390-long_history.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / create | native-dialog / matching-dialog-scene | [create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / edit | native-dialog / matching-dialog-scene | [edit · 1440](design/automation-direction-c/1440-edit.png) / [edit · 390](design/automation-direction-c/390-edit.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / create_busy | native-dialog / matching-dialog-scene | [create_busy · 1440](design/automation-direction-c/1440-create_busy.png) / [create_busy · 390](design/automation-direction-c/390-create_busy.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / edit_busy | native-dialog / matching-dialog-scene | [edit_busy · 1440](design/automation-direction-c/1440-edit_busy.png) / [edit_busy · 390](design/automation-direction-c/390-edit_busy.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / create_error | native-dialog / matching-dialog-scene | [create_error · 1440](design/automation-direction-c/1440-create_error.png) / [create_error · 390](design/automation-direction-c/390-create_error.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / edit_conflict | native-dialog / matching-dialog-scene | [edit_conflict · 1440](design/automation-direction-c/1440-edit_conflict.png) / [edit_conflict · 390](design/automation-direction-c/390-edit_conflict.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview | native-dialog / matching-dialog-scene | [preview · 1440](design/automation-direction-c/1440-preview.png) / [preview · 390](design/automation-direction-c/390-preview.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_task | native-dialog / matching-dialog-scene | [preview_task · 1440](design/automation-direction-c/1440-preview_task.png) / [preview_task · 390](design/automation-direction-c/390-preview_task.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_empty | native-dialog / matching-dialog-scene | [preview_empty · 1440](design/automation-direction-c/1440-preview_empty.png) / [preview_empty · 390](design/automation-direction-c/390-preview_empty.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_samples | native-dialog / matching-dialog-scene | [preview_samples · 1440](design/automation-direction-c/1440-preview_samples.png) / [preview_samples · 390](design/automation-direction-c/390-preview_samples.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_busy | native-dialog / matching-dialog-scene | [preview_busy · 1440](design/automation-direction-c/1440-preview_busy.png) / [preview_busy · 390](design/automation-direction-c/390-preview_busy.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_error | native-dialog / matching-dialog-scene | [preview_error · 1440](design/automation-direction-c/1440-preview_error.png) / [preview_error · 390](design/automation-direction-c/390-preview_error.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / preview_changed | native-dialog / matching-dialog-scene | [preview_changed · 1440](design/automation-direction-c/1440-preview_changed.png) / [preview_changed · 390](design/automation-direction-c/390-preview_changed.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / members_empty | native-dialog / matching-dialog-scene | [members_empty · 1440](design/automation-direction-c/1440-members_empty.png) / [members_empty · 390](design/automation-direction-c/390-members_empty.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / members_error | native-dialog / matching-dialog-scene | [members_error · 1440](design/automation-direction-c/1440-members_error.png) / [members_error · 390](design/automation-direction-c/390-members_error.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / dialog.2 / validation | native-dialog / matching-dialog-scene | [validation · 1440](design/automation-direction-c/1440-validation.png) / [validation · 390](design/automation-direction-c/390-validation.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / form.1 / create | form-container / matching-dialog-scene | [create · 1440](design/automation-direction-c/1440-create.png) / [create · 390](design/automation-direction-c/390-create.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |
| AutomationRuleCenter.vue / form.1 / edit | form-container / matching-dialog-scene | [edit · 1440](design/automation-direction-c/1440-edit.png) / [edit · 390](design/automation-direction-c/390-edit.png) | 当前C提案形态关联，不证明真实模态全组合、全部焦点/失败/生命周期或用户批准。 |

### 明确保留的边界

- 19源位置归16语义组，14路由动作含2写入组，另2模态接线；预览POST为只读。
- 124新增双端图为14动作提供68条精确selector/状态引用；10源码无禁用/忙碌呈现槽与6导航不禁用槽分列。0代表槽未映射不等于所有业务变体、字段、主题或全页已验收。
- 编辑/暂停源函数缺少重复提交早退，preview与保存忙碌条件独立；仅记录原语义，不用提案的按钮效果冒充防重入已修。
- 真实source action_failed仍一律承诺重试；C图稿终态解释已区分，真实Vue文字未改。
- r2追加恢复、编辑保存、另两模板、五类错误重载及编辑取消10变体/84图；42条扩展状态引用不增加业务动作。目录/分区/额外关闭按钮等提案新增控件、字段全态及真实生命周期仍待。
- useModalDialog开关/焦点仅此调用方接线核对，不是所有消费方生命周期或无障碍验收。
- AR-G01–G03仍待：窗内错误、读取/详情/写后刷新归属、跨范围缓存、成员/版本/所有规则组合；本次不修改业务。

## P28 局部动作与共享消费者

[逐项机器清单](action-reviews/P28.json)：14个局部源位置 → 11组；2类写入，10组路由动作，1组转发/容器关联不重复计动作。已映射0/0个源码字段位置，1/1处调用/内嵌容器，17个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有0个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有8个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| RP-CREATE 导出当前报表 CSV / write | 1处；opportunity、trend、team、empty、create_busy、create_error | [opportunity · 1440](design/report-direction-c/1440-opportunity.png) / [opportunity · 390](design/report-direction-c/390-opportunity.png)、[trend · 1440](design/report-direction-c/1440-trend.png) / [trend · 390](design/report-direction-c/390-trend.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-TYPE 切换报表类型 / navigation | 1处；opportunity、trend、team | [opportunity · 1440](design/report-direction-c/1440-opportunity.png) / [opportunity · 390](design/report-direction-c/390-opportunity.png)、[trend · 1440](design/report-direction-c/1440-trend.png) / [trend · 390](design/report-direction-c/390-trend.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-TECH 技术详情 / local | 2处；download_error、technical、detail_dead | [download_error · 1440](design/report-direction-c/1440-download_error.png) / [download_error · 390](design/report-direction-c/390-download_error.png)、[technical · 1440](design/report-direction-c/1440-technical.png) / [technical · 390](design/report-direction-c/390-technical.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-LOAD 重新加载 / read | 1处；error、expired、forbidden、rate_limited、blocked | [error · 1440](design/report-direction-c/1440-error.png) / [error · 390](design/report-direction-c/390-error.png)、[expired · 1440](design/report-direction-c/1440-expired.png) / [expired · 390](design/report-direction-c/390-expired.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-REFRESH 刷新状态 / read | 1处；opportunity、refreshing、refresh_error | [opportunity · 1440](design/report-direction-c/1440-opportunity.png) / [opportunity · 390](design/report-direction-c/390-opportunity.png)、[refreshing · 1440](design/report-direction-c/1440-refreshing.png) / [refreshing · 390](design/report-direction-c/390-refreshing.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-TASKS 在任务中心查看 / navigation | 1处；opportunity | [opportunity · 1440](design/report-direction-c/1440-opportunity.png) / [opportunity · 390](design/report-direction-c/390-opportunity.png)、[tasks-default · 1440](design/report-controls-direction-c/tasks-default-1440.png) / [tasks-default · 390](design/report-controls-direction-c/tasks-default-390.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-DOWNLOAD 下载文件 / read | 1处；opportunity、download_busy、download_error、download_409、download_410、download_503 | [opportunity · 1440](design/report-direction-c/1440-opportunity.png) / [opportunity · 390](design/report-direction-c/390-opportunity.png)、[download_busy · 1440](design/report-direction-c/1440-download_busy.png) / [download_busy · 390](design/report-direction-c/390-download_busy.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-REGENERATE 重新生成 / write | 2处；detail_expired、detail_dead、detail_boundary、detail_status_mismatch、regenerate_busy、regenerate_error、regenerated | [detail_expired · 1440](design/report-direction-c/1440-detail_expired.png) / [detail_expired · 390](design/report-direction-c/390-detail_expired.png)、[detail_dead · 1440](design/report-direction-c/1440-detail_dead.png) / [detail_dead · 390](design/report-direction-c/390-detail_dead.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-DETAIL 查看详情 / read | 1处；detail_succeeded、detail_queued、detail_not_found、detail_forbidden | [detail_succeeded · 1440](design/report-direction-c/1440-detail_succeeded.png) / [detail_succeeded · 390](design/report-direction-c/390-detail_succeeded.png)、[detail_queued · 1440](design/report-direction-c/1440-detail_queued.png) / [detail_queued · 390](design/report-direction-c/390-detail_queued.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| RP-CLOSE 关闭导出详情 / local | 1处；detail_succeeded、detail_expired | [detail_succeeded · 1440](design/report-direction-c/1440-detail_succeeded.png) / [detail_succeeded · 390](design/report-direction-c/390-detail_succeeded.png)、[detail_expired · 1440](design/report-direction-c/1440-detail_expired.png) / [detail_expired · 390](design/report-direction-c/390-detail_expired.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| D-RP-EXPORT 导出详情模态接线 / wiring | 2处；detail_succeeded、detail_queued、detail_expired | [detail_succeeded · 1440](design/report-direction-c/1440-detail_succeeded.png) / [detail_succeeded · 390](design/report-direction-c/390-detail_succeeded.png)、[detail_queued · 1440](design/report-direction-c/1440-detail_queued.png) / [detail_queued · 390](design/report-direction-c/390-detail_queued.png)；其余见JSON | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| D-RP-EXPORT | @cancel / handleDetailCancel | RP-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| ReportCenter.vue / dialog.1 / detail_succeeded | native-dialog / matching-dialog-scene | [detail_succeeded · 1440](design/report-direction-c/1440-detail_succeeded.png) / [detail_succeeded · 390](design/report-direction-c/390-detail_succeeded.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_queued | native-dialog / matching-dialog-scene | [detail_queued · 1440](design/report-direction-c/1440-detail_queued.png) / [detail_queued · 390](design/report-direction-c/390-detail_queued.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_leased | native-dialog / matching-dialog-scene | [detail_leased · 1440](design/report-direction-c/1440-detail_leased.png) / [detail_leased · 390](design/report-direction-c/390-detail_leased.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_retry | native-dialog / matching-dialog-scene | [detail_retry · 1440](design/report-direction-c/1440-detail_retry.png) / [detail_retry · 390](design/report-direction-c/390-detail_retry.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_no_sample | native-dialog / matching-dialog-scene | [detail_no_sample · 1440](design/report-direction-c/1440-detail_no_sample.png) / [detail_no_sample · 390](design/report-direction-c/390-detail_no_sample.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_expired | native-dialog / matching-dialog-scene | [detail_expired · 1440](design/report-direction-c/1440-detail_expired.png) / [detail_expired · 390](design/report-direction-c/390-detail_expired.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_dead | native-dialog / matching-dialog-scene | [detail_dead · 1440](design/report-direction-c/1440-detail_dead.png) / [detail_dead · 390](design/report-direction-c/390-detail_dead.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_unknown | native-dialog / matching-dialog-scene | [detail_unknown · 1440](design/report-direction-c/1440-detail_unknown.png) / [detail_unknown · 390](design/report-direction-c/390-detail_unknown.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_zero | native-dialog / matching-dialog-scene | [detail_zero · 1440](design/report-direction-c/1440-detail_zero.png) / [detail_zero · 390](design/report-direction-c/390-detail_zero.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_boundary | native-dialog / matching-dialog-scene | [detail_boundary · 1440](design/report-direction-c/1440-detail_boundary.png) / [detail_boundary · 390](design/report-direction-c/390-detail_boundary.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_status_mismatch | native-dialog / matching-dialog-scene | [detail_status_mismatch · 1440](design/report-direction-c/1440-detail_status_mismatch.png) / [detail_status_mismatch · 390](design/report-direction-c/390-detail_status_mismatch.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / regenerate_busy | native-dialog / matching-dialog-scene | [regenerate_busy · 1440](design/report-direction-c/1440-regenerate_busy.png) / [regenerate_busy · 390](design/report-direction-c/390-regenerate_busy.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / regenerate_error | native-dialog / matching-dialog-scene | [regenerate_error · 1440](design/report-direction-c/1440-regenerate_error.png) / [regenerate_error · 390](design/report-direction-c/390-regenerate_error.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / regenerated | native-dialog / matching-dialog-scene | [regenerated · 1440](design/report-direction-c/1440-regenerated.png) / [regenerated · 390](design/report-direction-c/390-regenerated.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / technical | native-dialog / matching-dialog-scene | [technical · 1440](design/report-direction-c/1440-technical.png) / [technical · 390](design/report-direction-c/390-technical.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_not_found | native-dialog / route-excluded-reference | [detail_not_found · 1440](design/report-direction-c/1440-detail_not_found.png) / [detail_not_found · 390](design/report-direction-c/390-detail_not_found.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |
| ReportCenter.vue / dialog.1 / detail_forbidden | native-dialog / route-excluded-reference | [detail_forbidden · 1440](design/report-direction-c/1440-detail_forbidden.png) / [detail_forbidden · 390](design/report-direction-c/390-detail_forbidden.png) | 仅独立图稿及当前源码核对；完整组合、真实Vue生命周期/服务/下载字节、主题密度、用户批准和生产验收未完成。 |

### 明确保留的边界

- 当前全新图与真实Vue未整合；接口/SQL未改，读取批次、创建回执/下载提示和刷新重入已局部修复，重建并发策略/缓存范围及全局诊断仲裁仍待。
- 208图覆盖10代表控件和14明确变体，不是全部导出记录/状态/主题/密度/角色/缩放组合。
- useModalDialog仅此调用方接线核对，不是全部焦点/跨缓存生命周期验收。
- RP-G01–G04和F03-G05仍待；全部输入为空不代表统计口径、文件或权限已获准。

## P29 局部动作与共享消费者

[逐项机器清单](action-reviews/P29.json)：13个局部源位置 → 8组；1类写入，4组路由动作，0组转发/容器关联不重复计动作。已映射6/6个源码字段位置，2/2处调用/内嵌容器，32个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有0个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

另有4个disabled/busy槽按逐项源码证据登记为当前控件无此呈现；不计图片或验收通过，不减少语义动作数。原源候选、实际子控件和源文件指纹必须一致；隐藏、父面板loading或函数拒绝不冒充按钮禁用。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| EX-P34-FIRST-FAILURE P34首次读取失败转发（非本页） / excluded | 2处；normal | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OG-REFRESH 刷新组织资料 / read | 1处；normal、refreshing、loading、refresh_error、dirty_refresh | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)、[refreshing · 1440](design/organization-profile-direction-c/1440-refreshing.png) / [refreshing · 390](design/organization-profile-direction-c/390-refreshing.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OG-RETRY 错误后重新加载 / read | 1处；error、blocked、expired、forbidden、rate_limited、conflict_page | [error · 1440](design/organization-profile-direction-c/1440-error.png) / [error · 390](design/organization-profile-direction-c/390-error.png)、[blocked · 1440](design/organization-profile-direction-c/1440-blocked.png) / [blocked · 390](design/organization-profile-direction-c/390-blocked.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OG-PROFILE-SAVE 保存并审计 / write | 2处；editing、save_busy、save_error、save_conflict、save_success、write_read_failed、save_timeout | [editing · 1440](design/organization-profile-direction-c/1440-editing.png) / [editing · 390](design/organization-profile-direction-c/390-editing.png)、[save_busy · 1440](design/organization-profile-direction-c/1440-save_busy.png) / [save_busy · 390](design/organization-profile-direction-c/390-save_busy.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OG-PROFILE-LOGO Logo浏览器有效性 / local | 1处；normal、logo_invalid、blank_logo | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)、[logo_invalid · 1440](design/organization-profile-direction-c/1440-logo_invalid.png) / [logo_invalid · 390](design/organization-profile-direction-c/390-logo_invalid.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| EX-P30-MEMBERS P30成员事件（非本页） / excluded | 1处；normal | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| EX-P31-ROLES P31授权事件（非本页） / excluded | 1处；normal | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| EX-REASON-ORIGINS 共享原因窗的其他页调用 / excluded | 4处；normal | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png)；其余见JSON | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | 名称；required、maxlength120，初值data.name | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |
| OrganizationAdminCenter.vue / form.logo_url | Logo；url、https://.*、maxlength2048，可空；输入清自定义错误 | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |
| OrganizationAdminCenter.vue / form.timezone | 时区；required、maxlength64，自由文本，不造枚举 | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |
| OrganizationAdminCenter.vue / form.data_retention_days | 保留天数；v-model.number，number/min30/max3650/required；原生默认step1 | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | 默认工作区；required，按当前返回名称展示，不新增active-only过滤 | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |
| OrganizationAdminCenter.vue / form.reason | 变更原因；required、maxlength500；成功load清空，保存期间未禁用输入 | 字段代表状态与8组合已有图；真实Vue、全主题/密度/软键盘/原生select弹出层仍待。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / normal | form-container / matching-inline-form-scene | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / editing | form-container / matching-inline-form-scene | [editing · 1440](design/organization-profile-direction-c/1440-editing.png) / [editing · 390](design/organization-profile-direction-c/390-editing.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / blank_logo | form-container / matching-inline-form-scene | [blank_logo · 1440](design/organization-profile-direction-c/1440-blank_logo.png) / [blank_logo · 390](design/organization-profile-direction-c/390-blank_logo.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / long_name | form-container / matching-inline-form-scene | [long_name · 1440](design/organization-profile-direction-c/1440-long_name.png) / [long_name · 390](design/organization-profile-direction-c/390-long_name.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / long_workspace | form-container / matching-inline-form-scene | [long_workspace · 1440](design/organization-profile-direction-c/1440-long_workspace.png) / [long_workspace · 390](design/organization-profile-direction-c/390-long_workspace.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / missing_workspace | form-container / matching-inline-form-scene | [missing_workspace · 1440](design/organization-profile-direction-c/1440-missing_workspace.png) / [missing_workspace · 390](design/organization-profile-direction-c/390-missing_workspace.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / no_options | form-container / matching-inline-form-scene | [no_options · 1440](design/organization-profile-direction-c/1440-no_options.png) / [no_options · 390](design/organization-profile-direction-c/390-no_options.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / archived_option | form-container / matching-inline-form-scene | [archived_option · 1440](design/organization-profile-direction-c/1440-archived_option.png) / [archived_option · 390](design/organization-profile-direction-c/390-archived_option.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / refreshing | form-container / matching-inline-form-scene | [refreshing · 1440](design/organization-profile-direction-c/1440-refreshing.png) / [refreshing · 390](design/organization-profile-direction-c/390-refreshing.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / refresh_error | form-container / matching-inline-form-scene | [refresh_error · 1440](design/organization-profile-direction-c/1440-refresh_error.png) / [refresh_error · 390](design/organization-profile-direction-c/390-refresh_error.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / refresh_success | form-container / matching-inline-form-scene | [refresh_success · 1440](design/organization-profile-direction-c/1440-refresh_success.png) / [refresh_success · 390](design/organization-profile-direction-c/390-refresh_success.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / dirty_refresh | form-container / matching-inline-form-scene | [dirty_refresh · 1440](design/organization-profile-direction-c/1440-dirty_refresh.png) / [dirty_refresh · 390](design/organization-profile-direction-c/390-dirty_refresh.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / save_busy | form-container / matching-inline-form-scene | [save_busy · 1440](design/organization-profile-direction-c/1440-save_busy.png) / [save_busy · 390](design/organization-profile-direction-c/390-save_busy.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / save_error | form-container / matching-inline-form-scene | [save_error · 1440](design/organization-profile-direction-c/1440-save_error.png) / [save_error · 390](design/organization-profile-direction-c/390-save_error.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / save_conflict | form-container / matching-inline-form-scene | [save_conflict · 1440](design/organization-profile-direction-c/1440-save_conflict.png) / [save_conflict · 390](design/organization-profile-direction-c/390-save_conflict.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / save_success | form-container / matching-inline-form-scene | [save_success · 1440](design/organization-profile-direction-c/1440-save_success.png) / [save_success · 390](design/organization-profile-direction-c/390-save_success.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / write_read_failed | form-container / matching-inline-form-scene | [write_read_failed · 1440](design/organization-profile-direction-c/1440-write_read_failed.png) / [write_read_failed · 390](design/organization-profile-direction-c/390-write_read_failed.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / save_timeout | form-container / matching-inline-form-scene | [save_timeout · 1440](design/organization-profile-direction-c/1440-save_timeout.png) / [save_timeout · 390](design/organization-profile-direction-c/390-save_timeout.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / logo_invalid | form-container / matching-inline-form-scene | [logo_invalid · 1440](design/organization-profile-direction-c/1440-logo_invalid.png) / [logo_invalid · 390](design/organization-profile-direction-c/390-logo_invalid.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / reason_missing | form-container / matching-inline-form-scene | [reason_missing · 1440](design/organization-profile-direction-c/1440-reason_missing.png) / [reason_missing · 390](design/organization-profile-direction-c/390-reason_missing.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / retention_invalid | form-container / matching-inline-form-scene | [retention_invalid · 1440](design/organization-profile-direction-c/1440-retention_invalid.png) / [retention_invalid · 390](design/organization-profile-direction-c/390-retention_invalid.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / timezone_invalid | form-container / matching-inline-form-scene | [timezone_invalid · 1440](design/organization-profile-direction-c/1440-timezone_invalid.png) / [timezone_invalid · 390](design/organization-profile-direction-c/390-timezone_invalid.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / name_invalid | form-container / matching-inline-form-scene | [name_invalid · 1440](design/organization-profile-direction-c/1440-name_invalid.png) / [name_invalid · 390](design/organization-profile-direction-c/390-name_invalid.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-editing | form-container / matching-inline-form-scene | [editing-form · 1440](design/organization-profile-fields-direction-c/editing-form-1440.png) / [editing-form · 390](design/organization-profile-fields-direction-c/editing-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-save_busy | form-container / matching-inline-form-scene | [save_busy-form · 1440](design/organization-profile-fields-direction-c/save_busy-form-1440.png) / [save_busy-form · 390](design/organization-profile-fields-direction-c/save_busy-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-save_conflict | form-container / matching-inline-form-scene | [save_conflict-form · 1440](design/organization-profile-fields-direction-c/save_conflict-form-1440.png) / [save_conflict-form · 390](design/organization-profile-fields-direction-c/save_conflict-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-write_read_failed | form-container / matching-inline-form-scene | [write_read_failed-form · 1440](design/organization-profile-fields-direction-c/write_read_failed-form-1440.png) / [write_read_failed-form · 390](design/organization-profile-fields-direction-c/write_read_failed-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-save_timeout | form-container / matching-inline-form-scene | [save_timeout-form · 1440](design/organization-profile-fields-direction-c/save_timeout-form-1440.png) / [save_timeout-form · 390](design/organization-profile-fields-direction-c/save_timeout-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-missing_workspace | form-container / matching-inline-form-scene | [missing_workspace-form · 1440](design/organization-profile-fields-direction-c/missing_workspace-form-1440.png) / [missing_workspace-form · 390](design/organization-profile-fields-direction-c/missing_workspace-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-no_options | form-container / matching-inline-form-scene | [no_options-form · 1440](design/organization-profile-fields-direction-c/no_options-form-1440.png) / [no_options-form · 390](design/organization-profile-fields-direction-c/no_options-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.1 / fields-archived_option | form-container / matching-inline-form-scene | [archived_option-form · 1440](design/organization-profile-fields-direction-c/archived_option-form-1440.png) / [archived_option-form · 390](design/organization-profile-fields-direction-c/archived_option-form-390.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / fresh-summary-no-reason-origin | native-reason-dialog / route-excluded-reference | [normal · 1440](design/organization-profile-direction-c/1440-normal.png) / [normal · 390](design/organization-profile-direction-c/390-normal.png) | 具体用户批准、完整字段/角色/主题/密度/真实Vue生命周期/数据库审计与生产验收未完成。 |

### 明确保留的边界

- Logo四态及六字段47代表状态/8表单组合已绑定；不是全部字段/角色/主题/密度/软键盘组合。
- 110字段图、170控件图与74整页图不代表真实Vue已实现；OG-G02和其它生命周期缺口仍存在。
- P30–P37子组件和共享原因窗全源需分别核对；不以父层排除完成其它页面。
- 全局缓存/组织隔离、共享诊断及未提交草稿策略仍待，不从Token保护推断资料页安全。

## P30 局部动作与共享消费者

[逐项机器清单](action-reviews/P30.json)：30个局部源位置 → 24组；4类写入，19组路由动作，1组转发/容器关联不重复计动作。已映射9/9个源码字段位置，3/3处调用/内嵌容器，13个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有30个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| EX-P34-FIRST-FAILURE P34首次读取失败转发（非本页） / excluded | 2处；normal | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-REFRESH 刷新成员资料 / read | 1处；normal、refreshing、refresh_error | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[refreshing · 1440](design/members-direction-c/1440-refreshing.png) / [refreshing · 390](design/members-direction-c/390-refreshing.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-RETRY 重新加载 / read | 1处；error、blocked、expired、forbidden、rate_limited | [error · 1440](design/members-direction-c/1440-error.png) / [error · 390](design/members-direction-c/390-error.png)、[blocked · 1440](design/members-direction-c/1440-blocked.png) / [blocked · 390](design/members-direction-c/390-blocked.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| EX-P29-PROFILE 组织资料分支排除 / excluded | 3处；normal | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| WIRE-MEMBERS 成员子组件事件接线 / wiring | 1处；normal | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| EX-P31-ROLES 独立角色页排除 / excluded | 1处；normal | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| D-OG-REASON 共享原因确认与取消调用 / local | 3处；reason_disable、reason_restore、reason_role、reason_revoke、reason_short、reason_long、action_busy、action_conflict | [reason_disable · 1440](design/members-direction-c/1440-reason_disable.png) / [reason_disable · 390](design/members-direction-c/390-reason_disable.png)、[reason_restore · 1440](design/members-direction-c/1440-reason_restore.png) / [reason_restore · 390](design/members-direction-c/390-reason_restore.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| EX-P36-TOKEN-REASON 令牌原因调用排除 / excluded | 1处；normal | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-INVITE 创建邀请 / write | 2处；invite_form、invite_invalid、invite_busy、invite_partial、invite_interrupted、invite_success | [invite_form · 1440](design/members-direction-c/1440-invite_form.png) / [invite_form · 390](design/members-direction-c/390-invite_form.png)、[invite_invalid · 1440](design/members-direction-c/1440-invite_invalid.png) / [invite_invalid · 390](design/members-direction-c/390-invite_invalid.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-TAB-PENDING 待接受邀请 / local | 1处；normal、invite_acceptance、invite_empty | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[invite_acceptance · 1440](design/members-direction-c/1440-invite_acceptance.png) / [invite_acceptance · 390](design/members-direction-c/390-invite_acceptance.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-TAB-EXPIRED 已失效邀请 / local | 1处；invite_expired、invite_revoked、invite_boundary | [invite_expired · 1440](design/members-direction-c/1440-invite_expired.png) / [invite_expired · 390](design/members-direction-c/390-invite_expired.png)、[invite_revoked · 1440](design/members-direction-c/1440-invite_revoked.png) / [invite_revoked · 390](design/members-direction-c/390-invite_revoked.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-INVITATION-REVOKE 撤销邀请 / write | 1处；normal、reason_revoke、action_busy、action_conflict | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[reason_revoke · 1440](design/members-direction-c/1440-reason_revoke.png) / [reason_revoke · 390](design/members-direction-c/390-reason_revoke.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-SEARCH 搜索姓名或邮箱 / local | 1处；search、filter_empty | [search · 1440](design/members-direction-c/1440-search.png) / [search · 390](design/members-direction-c/390-search.png)、[filter_empty · 1440](design/members-direction-c/1440-filter_empty.png) / [filter_empty · 390](design/members-direction-c/390-filter_empty.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-STATUS-FILTER 成员有效状态筛选 / local | 1处；filter_locked、disabled_locked | [filter_locked · 1440](design/members-direction-c/1440-filter_locked.png) / [filter_locked · 390](design/members-direction-c/390-filter_locked.png)、[disabled_locked · 1440](design/members-direction-c/1440-disabled_locked.png) / [disabled_locked · 390](design/members-direction-c/390-disabled_locked.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-ROLE-FILTER 角色筛选 / local | 1处；filter_role、multiple_roles | [filter_role · 1440](design/members-direction-c/1440-filter_role.png) / [filter_role · 390](design/members-direction-c/390-filter_role.png)、[multiple_roles · 1440](design/members-direction-c/1440-multiple_roles.png) / [multiple_roles · 390](design/members-direction-c/390-multiple_roles.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-TEAM-FILTER 团队筛选 / local | 1处；filter_team、filter_empty | [filter_team · 1440](design/members-direction-c/1440-filter_team.png) / [filter_team · 390](design/members-direction-c/390-filter_team.png)、[filter_empty · 1440](design/members-direction-c/1440-filter_empty.png) / [filter_empty · 390](design/members-direction-c/390-filter_empty.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-SORT 成员排序 / local | 1处；normal、multipage | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[multipage · 1440](design/members-direction-c/1440-multipage.png) / [multipage · 390](design/members-direction-c/390-multipage.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-RESET 重置成员筛选 / local | 1处；normal、filter_empty | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[filter_empty · 1440](design/members-direction-c/1440-filter_empty.png) / [filter_empty · 390](design/members-direction-c/390-filter_empty.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-TECH 展开成员技术详情 / local | 1处；technical、long_member | [technical · 1440](design/members-direction-c/1440-technical.png) / [technical · 390](design/members-direction-c/390-technical.png)、[long_member · 1440](design/members-direction-c/1440-long_member.png) / [long_member · 390](design/members-direction-c/390-long_member.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-ROLE-SELECT 选择单行角色 / local | 1处；normal、multiple_roles | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png)、[multiple_roles · 1440](design/members-direction-c/1440-multiple_roles.png) / [multiple_roles · 390](design/members-direction-c/390-multiple_roles.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-ROLE-ASSIGN 分配所选角色 / write | 1处；reason_role、action_busy、action_conflict | [reason_role · 1440](design/members-direction-c/1440-reason_role.png) / [reason_role · 390](design/members-direction-c/390-reason_role.png)、[action_busy · 1440](design/members-direction-c/1440-action_busy.png) / [action_busy · 390](design/members-direction-c/390-action_busy.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-STATE 禁用或恢复成员关系 / write | 1处；reason_disable、reason_restore、disabled_locked、self_forbidden、last_admin、action_busy、action_conflict | [reason_disable · 1440](design/members-direction-c/1440-reason_disable.png) / [reason_disable · 390](design/members-direction-c/390-reason_disable.png)、[reason_restore · 1440](design/members-direction-c/1440-reason_restore.png) / [reason_restore · 390](design/members-direction-c/390-reason_restore.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-PREV 成员上一页 / local | 1处；multipage、page_two | [multipage · 1440](design/members-direction-c/1440-multipage.png) / [multipage · 390](design/members-direction-c/390-multipage.png)、[page_two · 1440](design/members-direction-c/1440-page_two.png) / [page_two · 390](design/members-direction-c/390-page_two.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OG-M-NEXT 成员下一页 / local | 1处；multipage、page_two | [multipage · 1440](design/members-direction-c/1440-multipage.png) / [multipage · 390](design/members-direction-c/390-multipage.png)、[page_two · 1440](design/members-direction-c/1440-page_two.png) / [page_two · 390](design/members-direction-c/390-page_two.png)；其余见JSON | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| WIRE-MEMBERS | @invite / inviteMembers | OG-M-INVITE |
| WIRE-MEMBERS | @invitation-action / invitationAction | OG-M-INVITATION-REVOKE |
| WIRE-MEMBERS | @update-invitation-tab / invitationTab = $event | OG-M-TAB-PENDING、OG-M-TAB-EXPIRED |
| WIRE-MEMBERS | @update-member-query / memberQuery = $event; memberPage = 1; | OG-M-SEARCH |
| WIRE-MEMBERS | @update-member-status / memberStatus = $event; memberPage = 1; | OG-M-STATUS-FILTER |
| WIRE-MEMBERS | @update-member-role / memberRole = $event; memberPage = 1; | OG-M-ROLE-FILTER |
| WIRE-MEMBERS | @update-member-team / memberTeam = $event; memberPage = 1; | OG-M-TEAM-FILTER |
| WIRE-MEMBERS | @update-member-sort / memberSort = $event; memberPage = 1; | OG-M-SORT |
| WIRE-MEMBERS | @update-member-page / memberPage = $event | OG-M-PREV、OG-M-NEXT |
| WIRE-MEMBERS | @reset-member-filters / memberQuery = ''; memberStatus = ''; memberRole = ''; memberTeam = ''; memberSort = 'name_asc'; memberPage = 1; | OG-M-RESET |
| WIRE-MEMBERS | @update-member-role-selection / memberRoles[$event.memberId] = $event.role | OG-M-ROLE-SELECT |
| WIRE-MEMBERS | @assign-role / assignRole | OG-M-ROLE-ASSIGN |
| WIRE-MEMBERS | @member-action / memberAction | OG-M-STATE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / form.logo_url | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / form.timezone | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / form.reason | P29 summary专属字段；P30不呈现，不与成员邀请reason混为同一表单 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.emails | 邀请邮箱textarea必填；无maxlength；分隔/邮箱254边界由父函数校验 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.role_code | 必填固定五角色select；选择本身不写入 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.reason | 邀请原因必填maxlength500，父函数trim后1–500；不是共享窗的至少2字规则 | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / normal | form-container / route-excluded-reference | [normal · 1440](design/members-direction-c/1440-normal.png) / [normal · 390](design/members-direction-c/390-normal.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_disable | native-reason-dialog / matching-dialog-scene | [reason_disable · 1440](design/members-direction-c/1440-reason_disable.png) / [reason_disable · 390](design/members-direction-c/390-reason_disable.png)、[reason_disable-form · 1440](design/members-fields-direction-c/reason_disable-form-1440.png) / [reason_disable-form · 390](design/members-fields-direction-c/reason_disable-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_restore | native-reason-dialog / matching-dialog-scene | [reason_restore · 1440](design/members-direction-c/1440-reason_restore.png) / [reason_restore · 390](design/members-direction-c/390-reason_restore.png)、[reason_restore-form · 1440](design/members-fields-direction-c/reason_restore-form-1440.png) / [reason_restore-form · 390](design/members-fields-direction-c/reason_restore-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_role | native-reason-dialog / matching-dialog-scene | [reason_role · 1440](design/members-direction-c/1440-reason_role.png) / [reason_role · 390](design/members-direction-c/390-reason_role.png)、[reason_role-form · 1440](design/members-fields-direction-c/reason_role-form-1440.png) / [reason_role-form · 390](design/members-fields-direction-c/reason_role-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_revoke | native-reason-dialog / matching-dialog-scene | [reason_revoke · 1440](design/members-direction-c/1440-reason_revoke.png) / [reason_revoke · 390](design/members-direction-c/390-reason_revoke.png)、[reason_revoke-form · 1440](design/members-fields-direction-c/reason_revoke-form-1440.png) / [reason_revoke-form · 390](design/members-fields-direction-c/reason_revoke-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_form | form-container / matching-inline-form-scene | [invite_form · 1440](design/members-direction-c/1440-invite_form.png) / [invite_form · 390](design/members-direction-c/390-invite_form.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_invalid | form-container / matching-inline-form-scene | [invite_invalid · 1440](design/members-direction-c/1440-invite_invalid.png) / [invite_invalid · 390](design/members-direction-c/390-invite_invalid.png)、[invite_invalid-form · 1440](design/members-fields-direction-c/invite_invalid-form-1440.png) / [invite_invalid-form · 390](design/members-fields-direction-c/invite_invalid-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_partial | form-container / matching-inline-form-scene | [invite_partial · 1440](design/members-direction-c/1440-invite_partial.png) / [invite_partial · 390](design/members-direction-c/390-invite_partial.png)、[invite_partial-form · 1440](design/members-fields-direction-c/invite_partial-form-1440.png) / [invite_partial-form · 390](design/members-fields-direction-c/invite_partial-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_busy | form-container / matching-inline-form-scene | [invite_busy · 1440](design/members-direction-c/1440-invite_busy.png) / [invite_busy · 390](design/members-direction-c/390-invite_busy.png)、[invite_busy-form · 1440](design/members-fields-direction-c/invite_busy-form-1440.png) / [invite_busy-form · 390](design/members-fields-direction-c/invite_busy-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_interrupted | form-container / matching-inline-form-scene | [invite_interrupted · 1440](design/members-direction-c/1440-invite_interrupted.png) / [invite_interrupted · 390](design/members-direction-c/390-invite_interrupted.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_success | form-container / matching-inline-form-scene | [invite_success · 1440](design/members-direction-c/1440-invite_success.png) / [invite_success · 390](design/members-direction-c/390-invite_success.png)、[invite_success-form · 1440](design/members-fields-direction-c/invite_success-form-1440.png) / [invite_success-form · 390](design/members-fields-direction-c/invite_success-form-390.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_empty | form-container / matching-inline-form-scene | [invite_empty · 1440](design/members-direction-c/1440-invite_empty.png) / [invite_empty · 390](design/members-direction-c/390-invite_empty.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |
| OrganizationMemberPanel.vue / form.1 / invite_boundary | form-container / matching-inline-form-scene | [invite_boundary · 1440](design/members-direction-c/1440-invite_boundary.png) / [invite_boundary · 390](design/members-direction-c/390-invite_boundary.png) | 当前源码及独立C稿关联，不代表精确控件全部状态、真实Vue/异步归属、具体用户批准或生产验收。 |

### 明确保留的边界

- 十字段74代表状态/八表单组合双端164图已绑定；该新子稿按真实共享前端取消旧提案500上限，仅记录离线意图，不代表服务接受501字或生产已改。全部组合、主题/密度/软键盘仍待。
- 94旧图保留上下文；新444图绑定19代表动作84状态、22附加变体92状态，另10纯提案40状态和6反馈上下文。仍有30代表槽未映射，不补造native select按下弹出或原因窗提交busy。
- 独立提案复用busy，而实际父源refreshing与写busy分离；当前只核对被选目标，不代表全页忙碌生命周期或全部字段/角色/主题/密度/软键盘组合通过。
- OG-G01角色选择陈旧、OG-G02邀请尾部/notice及通用写后重读、OG-G03原因上限/重开、跨范围迟到回执与全部C真实实现继续待。
- 共享reason字段在AuditedReasonDialog，required/minimumLength默认2、无maxlength；邀请表单reason已有500上限。六个value/emit字段另在controlledInputs，不能漏算为仅三个可编辑字段。
- useAuditedReason新ask取消上个请求，finish先关窗；useModalDialog返焦/销毁与全部调用方跨缓存时序仍待。

## P31 局部动作与共享消费者

[逐项机器清单](action-reviews/P31.json)：32个局部源位置 → 25组；3类写入，20组路由动作，1组转发/容器关联不重复计动作。已映射20/20个源码字段位置，4/4处调用/内嵌容器，20个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有44个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| EX-P34-FIRST-FAILURE P34首次读取失败转发（非本页） / excluded | 2处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OG-REFRESH 刷新角色权限 / read | 1处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OG-RETRY 重新加载 / read | 1处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| EX-P29-PROFILE 组织资料分支排除 / excluded | 3处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| EX-P30-MEMBERS 成员分支排除 / excluded | 1处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| WIRE-ROLES 角色子组件接线 / wiring | 1处；grants | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| D-OG-REASON 撤销原因确认调用 / local | 3处；revoke、revoke-invalid | [revoke · 1440](design/roles-direction-c/1440-revoke.png) / [revoke · 390](design/roles-direction-c/390-revoke.png)、[revoke-invalid · 1440](design/roles-direction-c/1440-revoke-invalid.png) / [revoke-invalid · 390](design/roles-direction-c/390-revoke-invalid.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| EX-P36-TOKEN-REASON 令牌原因排除 / excluded | 1处；roles | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| role.section.{section} 角色/范围/授权分区 / local | 1处；roles、scopes、grants | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)、[scopes · 1440](design/roles-direction-c/1440-scopes.png) / [scopes · 390](design/roles-direction-c/390-scopes.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| role.select.{roleCode} 选择只读模板 / local | 1处；roles、role-auditor、role-query-empty | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)、[role-auditor · 1440](design/roles-direction-c/1440-role-auditor.png) / [role-auditor · 390](design/roles-direction-c/390-role-auditor.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| role.capability.technical.toggle 技术能力披露 / local | 1处；role-technical | [role-technical · 1440](design/roles-direction-c/1440-role-technical.png) / [role-technical · 390](design/roles-direction-c/390-role-technical.png)、[role-technical-closed-default · 1440](design/roles-controls-direction-c/role-technical-closed-default-1440.png) / [role-technical-closed-default · 390](design/roles-controls-direction-c/role-technical-closed-default-390.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| role.capability.filter.reset 重置能力筛选 / local | 1处；roles、matrix-empty | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png)、[matrix-empty · 1440](design/roles-direction-c/1440-matrix-empty.png) / [matrix-empty · 390](design/roles-direction-c/390-matrix-empty.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| role.scope.filter.reset 重置范围筛选 / local | 1处；scopes、scopes-empty | [scopes · 1440](design/roles-direction-c/1440-scopes.png) / [scopes · 390](design/roles-direction-c/390-scopes.png)、[scopes-empty · 1440](design/roles-direction-c/1440-scopes-empty.png) / [scopes-empty · 390](design/roles-direction-c/390-scopes-empty.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.create.form.toggle 展开或取消创建 / local | 1处；grants、create-opportunity | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[create-opportunity · 1440](design/roles-direction-c/1440-create-opportunity.png) / [create-opportunity · 390](design/roles-direction-c/390-create-opportunity.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.create.submit 创建授权 / write | 2处；create-task、create-opportunity、create-competitor、create-sourcing、create-invalid-expiry、create-busy | [create-task · 1440](design/roles-direction-c/1440-create-task.png) / [create-task · 390](design/roles-direction-c/390-create-task.png)、[create-opportunity · 1440](design/roles-direction-c/1440-create-opportunity.png) / [create-opportunity · 390](design/roles-direction-c/390-create-opportunity.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.create.type.change 选择资源类型 / local | 1处；create-task、create-opportunity、create-competitor、create-sourcing | [create-task · 1440](design/roles-direction-c/1440-create-task.png) / [create-task · 390](design/roles-direction-c/390-create-task.png)、[create-opportunity · 1440](design/roles-direction-c/1440-create-opportunity.png) / [create-opportunity · 390](design/roles-direction-c/390-create-opportunity.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.status.select.{status} 授权状态筛选 / read | 1处；grants、grants-filter-empty | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[grants-filter-empty · 1440](design/roles-direction-c/1440-grants-filter-empty.png) / [grants-filter-empty · 390](design/roles-direction-c/390-grants-filter-empty.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.select.{grantId} 选择当前页授权 / local | 1处；grants、grants-search-empty | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[grants-search-empty · 1440](design/roles-direction-c/1440-grants-search-empty.png) / [grants-search-empty · 390](design/roles-direction-c/390-grants-search-empty.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.technical.toggle 披露资源与授权编号 / local | 1处；grant-technical | [grant-technical · 1440](design/roles-direction-c/1440-grant-technical.png) / [grant-technical · 390](design/roles-direction-c/390-grant-technical.png)、[grant-technical-closed-default · 1440](design/roles-controls-direction-c/grant-technical-closed-default-1440.png) / [grant-technical-closed-default · 390](design/roles-controls-direction-c/grant-technical-closed-default-390.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.expiry.submit 更新授权到期时间 / write | 2处；grants、extend-busy | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[extend-busy · 1440](design/roles-direction-c/1440-extend-busy.png) / [extend-busy · 390](design/roles-direction-c/390-extend-busy.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.revoke.request 请求撤销授权 / write | 1处；grants、revoke、revoke-invalid | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[revoke · 1440](design/roles-direction-c/1440-revoke.png) / [revoke · 390](design/roles-direction-c/390-revoke.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.page.previous 授权上一页 / read | 1处；grants | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[page-prev-disabled · 1440](design/roles-controls-direction-c/page-prev-disabled-1440.png) / [page-prev-disabled · 390](design/roles-controls-direction-c/page-prev-disabled-390.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.page.next 授权下一页 / read | 1处；grants | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png)、[page-next-disabled · 1440](design/roles-controls-direction-c/page-next-disabled-1440.png) / [page-next-disabled · 390](design/roles-controls-direction-c/page-next-disabled-390.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.create.form.open 创建首条授权 / local | 1处；grants-none、roles-no-grants | [grants-none · 1440](design/roles-direction-c/1440-grants-none.png) / [grants-none · 390](design/roles-direction-c/390-grants-none.png)、[roles-no-grants · 1440](design/roles-direction-c/1440-roles-no-grants.png) / [roles-no-grants · 390](design/roles-direction-c/390-roles-no-grants.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| grant.status.all 查看全部授权 / read | 1处；grants-filter-empty | [grants-filter-empty · 1440](design/roles-direction-c/1440-grants-filter-empty.png) / [grants-filter-empty · 390](design/roles-direction-c/390-grants-filter-empty.png)、[all-grants-default · 1440](design/roles-controls-direction-c/all-grants-default-1440.png) / [all-grants-default · 390](design/roles-controls-direction-c/all-grants-default-390.png)；其余见JSON | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| WIRE-ROLES | @update-grant-type / updateResourceGrantType | grant.create.type.change |
| WIRE-ROLES | @update-grant-status / updateResourceGrantStatus | grant.status.select.{status}、grant.status.all |
| WIRE-ROLES | @update-grant-page / updateResourceGrantPage | grant.page.previous、grant.page.next |
| WIRE-ROLES | @create-grant / createResourceGrant | grant.create.submit |
| WIRE-ROLES | @extend-grant / extendResourceGrant | grant.expiry.submit |
| WIRE-ROLES | @revoke-grant / revokeResourceGrant | grant.revoke.request |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / form.logo_url | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / form.timezone | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / form.reason | P29 summary专属，P31不显示 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / roleQuery | 已加载角色名称/描述/中文能力的trim小写查询；不搜索原始role.code | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / capabilityQuery | 已加载能力中文和原始能力名称查询 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / capabilityGroup | 已加载能力分组选择，不调用API | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / scopeQuery | 已加载成员姓名/邮箱/团队查询 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / scopeFilter | own/team/workspace/organization本地筛选 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.workspace_id | required，来自当前工作区列表；不扩大读取范围 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.resource_id | required trim UUID v1–5及变体模式；2026-09-10用户确认保留从真实详情复制UUID，不新增按名称选资源 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.grantee_membership_id | required，只从grantTargets对象列表选择，不以所有members替代 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.actions | 按类型白名单多选；checkbox无原生required，按钮及父函数保护至少一项 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.reason | required trim maxlength500；不同于共享撤销窗前端至少2字且无max | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantForm.expires_at | required datetime-local；min/max在setup生成；父级提交按当前时间重新检查未来30天 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantQuery | 只搜索当前页成员/工作区/中文类型/中文动作；不搜索授权或资源UUID、reason | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantMutation.reason | required trim maxlength500；选中授权对象变化会重置 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / grantMutation.expires_at | required datetime-local；默认现在+7天，原期限下一可选分钟与原min取大；就地错误关联；不是原expiry+7天 | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / roles | form-container / route-excluded-reference | [roles · 1440](design/roles-direction-c/1440-roles.png) / [roles · 390](design/roles-direction-c/390-roles.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / revoke | native-reason-dialog / matching-dialog-scene | [revoke · 1440](design/roles-direction-c/1440-revoke.png) / [revoke · 390](design/roles-direction-c/390-revoke.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / revoke-invalid | native-reason-dialog / matching-dialog-scene | [revoke-invalid · 1440](design/roles-direction-c/1440-revoke-invalid.png) / [revoke-invalid · 390](design/roles-direction-c/390-revoke-invalid.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / revoke-short | native-reason-dialog / matching-dialog-scene | [revoke-short-form · 1440](design/roles-fields-direction-c/revoke-short-form-1440.png) / [revoke-short-form · 390](design/roles-fields-direction-c/revoke-short-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / revoke-long | native-reason-dialog / matching-dialog-scene | [revoke-long-form · 1440](design/roles-fields-direction-c/revoke-long-form-1440.png) / [revoke-long-form · 390](design/roles-fields-direction-c/revoke-long-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-task | form-container / matching-inline-form-scene | [create-task · 1440](design/roles-direction-c/1440-create-task.png) / [create-task · 390](design/roles-direction-c/390-create-task.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-opportunity | form-container / matching-inline-form-scene | [create-opportunity · 1440](design/roles-direction-c/1440-create-opportunity.png) / [create-opportunity · 390](design/roles-direction-c/390-create-opportunity.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-competitor | form-container / matching-inline-form-scene | [create-competitor · 1440](design/roles-direction-c/1440-create-competitor.png) / [create-competitor · 390](design/roles-direction-c/390-create-competitor.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-sourcing | form-container / matching-inline-form-scene | [create-sourcing · 1440](design/roles-direction-c/1440-create-sourcing.png) / [create-sourcing · 390](design/roles-direction-c/390-create-sourcing.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-invalid-expiry | form-container / matching-inline-form-scene | [create-invalid-expiry · 1440](design/roles-direction-c/1440-create-invalid-expiry.png) / [create-invalid-expiry · 390](design/roles-direction-c/390-create-invalid-expiry.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-busy | form-container / matching-inline-form-scene | [create-busy · 1440](design/roles-direction-c/1440-create-busy.png) / [create-busy · 390](design/roles-direction-c/390-create-busy.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-ready | form-container / matching-inline-form-scene | [create-ready-form · 1440](design/roles-fields-direction-c/create-ready-form-1440.png) / [create-ready-form · 390](design/roles-fields-direction-c/create-ready-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-errors | form-container / matching-inline-form-scene | [create-errors-form · 1440](design/roles-fields-direction-c/create-errors-form-1440.png) / [create-errors-form · 390](design/roles-fields-direction-c/create-errors-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-no-actions | form-container / matching-inline-form-scene | [create-no-actions-form · 1440](design/roles-fields-direction-c/create-no-actions-form-1440.png) / [create-no-actions-form · 390](design/roles-fields-direction-c/create-no-actions-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.1 / create-pending | form-container / matching-inline-form-scene | [create-pending-form · 1440](design/roles-fields-direction-c/create-pending-form-1440.png) / [create-pending-form · 390](design/roles-fields-direction-c/create-pending-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.2 / grants | form-container / matching-inline-form-scene | [grants · 1440](design/roles-direction-c/1440-grants.png) / [grants · 390](design/roles-direction-c/390-grants.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.2 / extend-busy | form-container / matching-inline-form-scene | [extend-busy · 1440](design/roles-direction-c/1440-extend-busy.png) / [extend-busy · 390](design/roles-direction-c/390-extend-busy.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.2 / extend-ready | form-container / matching-inline-form-scene | [extend-ready-form · 1440](design/roles-fields-direction-c/extend-ready-form-1440.png) / [extend-ready-form · 390](design/roles-fields-direction-c/extend-ready-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.2 / extend-not-later | form-container / matching-inline-form-scene | [extend-not-later-form · 1440](design/roles-fields-direction-c/extend-not-later-form-1440.png) / [extend-not-later-form · 390](design/roles-fields-direction-c/extend-not-later-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |
| OrganizationRolePanel.vue / form.2 / extend-pending | form-container / matching-inline-form-scene | [extend-pending-form · 1440](design/roles-fields-direction-c/extend-pending-form-1440.png) / [extend-pending-form · 390](design/roles-fields-direction-c/extend-pending-form-390.png) | 仅当前源码语义与旧独立C稿上下文关联；精确控件六态、完整组合、真实Vue异步生命周期和用户批准仍待。 |

### 明确保留的边界

- 原48图保留上下文；新42控件378图绑定18代表动作76状态及24变体113状态，44代表槽仍未映射；父页刷新/错误、真实多页、字段六态仍待。单页分页仅disabled，唯一已选授权不证明切换。
- 提交中草稿归属、刷新重置延期草稿、确认期间切组织、创建成功覆盖重读失败提示仍待真实Vue与产品决策。
- 用户已确认四项控件视觉；新16字段代表状态与9组合保持待审。UUID复制、共享前端501字/服务端500界线、延期不得早于原值在新子稿明确，所有字段排列/主题密度/软键盘/日期弹层及真实Vue仍待，不新增目录或权限。
- 实际共享撤销reason无maxlength，但服务端max500；各调用方约束及重开生命周期仍待。
- use-modal-dialog仅绑定当前源码读取，不宣称旧48图已覆盖此依赖或全部返焦/销毁场景。

## P32 局部动作与共享消费者

[逐项机器清单](action-reviews/P32.json)：30个局部源位置 → 23组；2类写入，18组路由动作，0组转发/容器关联不重复计动作。已映射11/11个源码字段位置，3/3处调用/内嵌容器，18个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有28个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| EX-P34-FIRST-FAILURE P34首次读取失败转发（非本页） / excluded | 2处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)；其余见JSON | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OG-REFRESH 刷新工作区 / read | 1处；normal、refreshing、refresh_error | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)、[refreshing · 1440](design/workspaces-direction-c/1440-refreshing.png) / [refreshing · 390](design/workspaces-direction-c/390-refreshing.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-RETRY 重新加载 / read | 1处；error、blocked、expired、forbidden、rate_limited | [error · 1440](design/workspaces-direction-c/1440-error.png) / [error · 390](design/workspaces-direction-c/390-error.png)、[blocked · 1440](design/workspaces-direction-c/1440-blocked.png) / [blocked · 390](design/workspaces-direction-c/390-blocked.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| EX-P29-PROFILE 资料分支排除 / excluded | 3处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)；其余见JSON | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| EX-P30-MEMBERS 成员分支排除 / excluded | 1处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)；其余见JSON | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| EX-P31-ROLES 授权分支排除 / excluded | 1处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)；其余见JSON | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| D-OG-REASON 归档与恢复原因 / local | 3处；reason_archive、reason_restore、reason_short、reason_long | [reason_archive · 1440](design/workspaces-direction-c/1440-reason_archive.png) / [reason_archive · 390](design/workspaces-direction-c/390-reason_archive.png)、[reason_restore · 1440](design/workspaces-direction-c/1440-reason_restore.png) / [reason_restore · 390](design/workspaces-direction-c/390-reason_restore.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| EX-P36-TOKEN 令牌原因排除 / excluded | 1处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)；其余见JSON | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OG-W-OPEN 打开创建 / local | 2处；normal、empty、create | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)、[empty · 1440](design/workspaces-direction-c/1440-empty.png) / [empty · 390](design/workspaces-direction-c/390-empty.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-CREATE 创建并审计 / write | 2处；create、create_invalid、create_required、create_busy、create_failure、create_success、create_read_failed | [create · 1440](design/workspaces-direction-c/1440-create.png) / [create · 390](design/workspaces-direction-c/390-create.png)、[create_invalid · 1440](design/workspaces-direction-c/1440-create_invalid.png) / [create_invalid · 390](design/workspaces-direction-c/390-create_invalid.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-CANCEL 取消创建 / local | 1处；create_draft、create_busy | [create_draft · 1440](design/workspaces-direction-c/1440-create_draft.png) / [create_draft · 390](design/workspaces-direction-c/390-create_draft.png)、[create_busy · 1440](design/workspaces-direction-c/1440-create_busy.png) / [create_busy · 390](design/workspaces-direction-c/390-create_busy.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-STATUS-ALL 全部状态 / local | 1处；catalog | [catalog · 1440](design/workspaces-direction-c/1440-catalog.png) / [catalog · 390](design/workspaces-direction-c/390-catalog.png)、[status-all-default · 1440](design/workspaces-controls-direction-c/status-all-default-1440.png) / [status-all-default · 390](design/workspaces-controls-direction-c/status-all-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-STATUS-ACTIVE 正常使用 / local | 1处；active | [active · 1440](design/workspaces-direction-c/1440-active.png) / [active · 390](design/workspaces-direction-c/390-active.png)、[status-active-default · 1440](design/workspaces-controls-direction-c/status-active-default-1440.png) / [status-active-default · 390](design/workspaces-controls-direction-c/status-active-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-STATUS-ARCHIVED 已归档 / local | 1处；archived | [archived · 1440](design/workspaces-direction-c/1440-archived.png) / [archived · 390](design/workspaces-direction-c/390-archived.png)、[status-archived-default · 1440](design/workspaces-controls-direction-c/status-archived-default-1440.png) / [status-archived-default · 390](design/workspaces-controls-direction-c/status-archived-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-RESET 重置筛选 / local | 1处；search、catalog | [search · 1440](design/workspaces-direction-c/1440-search.png) / [search · 390](design/workspaces-direction-c/390-search.png)、[catalog · 1440](design/workspaces-direction-c/1440-catalog.png) / [catalog · 390](design/workspaces-direction-c/390-catalog.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-CLEAR-EMPTY 空结果清除筛选 / local | 1处；filter_empty | [filter_empty · 1440](design/workspaces-direction-c/1440-filter_empty.png) / [filter_empty · 390](design/workspaces-direction-c/390-filter_empty.png)、[clear-empty-default · 1440](design/workspaces-controls-direction-c/clear-empty-default-1440.png) / [clear-empty-default · 390](design/workspaces-controls-direction-c/clear-empty-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-SELECT 选择工作区 / local | 1处；selected、search | [selected · 1440](design/workspaces-direction-c/1440-selected.png) / [selected · 390](design/workspaces-direction-c/390-selected.png)、[search · 1440](design/workspaces-direction-c/1440-search.png) / [search · 390](design/workspaces-direction-c/390-search.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-PREVIOUS 上一页 / local | 1处；catalog、page_two | [catalog · 1440](design/workspaces-direction-c/1440-catalog.png) / [catalog · 390](design/workspaces-direction-c/390-catalog.png)、[page_two · 1440](design/workspaces-direction-c/1440-page_two.png) / [page_two · 390](design/workspaces-direction-c/390-page_two.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-NEXT 下一页 / local | 1处；catalog、page_two | [catalog · 1440](design/workspaces-direction-c/1440-catalog.png) / [catalog · 390](design/workspaces-direction-c/390-catalog.png)、[page_two · 1440](design/workspaces-direction-c/1440-page_two.png) / [page_two · 390](design/workspaces-direction-c/390-page_two.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-STATE 归档或恢复 / write | 1处；selected、restore、normal、reason_archive、reason_restore、action_busy、action_conflict、default_conflict | [selected · 1440](design/workspaces-direction-c/1440-selected.png) / [selected · 390](design/workspaces-direction-c/390-selected.png)、[restore · 1440](design/workspaces-direction-c/1440-restore.png) / [restore · 390](design/workspaces-direction-c/390-restore.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-TEAMS 团队与成员入口 / navigation | 1处；selected | [selected · 1440](design/workspaces-direction-c/1440-selected.png) / [selected · 390](design/workspaces-direction-c/390-selected.png)、[teams-default · 1440](design/workspaces-controls-direction-c/teams-default-1440.png) / [teams-default · 390](design/workspaces-controls-direction-c/teams-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-PROFILE 默认工作区设置入口 / navigation | 1处；normal | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png)、[profile-default · 1440](design/workspaces-controls-direction-c/profile-default-1440.png) / [profile-default · 390](design/workspaces-controls-direction-c/profile-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |
| OG-W-TECH 技术详情 / local | 1处；technical | [technical · 1440](design/workspaces-direction-c/1440-technical.png) / [technical · 390](design/workspaces-direction-c/390-technical.png)、[technical-default · 1440](design/workspaces-controls-direction-c/technical-default-1440.png) / [technical-default · 390](design/workspaces-controls-direction-c/technical-default-390.png)；其余见JSON | 已绑定代表控件/列明变体；未映射状态适用性、字段、全部组合、真实Vue与具体用户批准仍待。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / form.logo_url | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / form.timezone | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / form.data_retention_days | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / form.reason | 仅P29资料表单，P32不显示 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.name | required maxlength120；无自动生成，提交trim；等待仍可编辑 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.slug | required maxlength63，小写字母数字连字符且首尾非连字符；UI拒绝大写，服务另有lowercase归一化 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.reason | required maxlength500；提交trim，不是共享原因窗至少2字规则 | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / query | 只查询当前返回name/slug，trim转小写；不查询id/版本/成员数，无maxlength | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / sort | name_asc/members_desc/updated_desc，后两者并列时名称排序；不发GET | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / normal | form-container / route-excluded-reference | [normal · 1440](design/workspaces-direction-c/1440-normal.png) / [normal · 390](design/workspaces-direction-c/390-normal.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_archive | native-reason-dialog / matching-dialog-scene | [reason_archive · 1440](design/workspaces-direction-c/1440-reason_archive.png) / [reason_archive · 390](design/workspaces-direction-c/390-reason_archive.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_restore | native-reason-dialog / matching-dialog-scene | [reason_restore · 1440](design/workspaces-direction-c/1440-reason_restore.png) / [reason_restore · 390](design/workspaces-direction-c/390-reason_restore.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_short | native-reason-dialog / matching-dialog-scene | [reason_short · 1440](design/workspaces-direction-c/1440-reason_short.png) / [reason_short · 390](design/workspaces-direction-c/390-reason_short.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_long | native-reason-dialog / matching-dialog-scene | [reason_long · 1440](design/workspaces-direction-c/1440-reason_long.png) / [reason_long · 390](design/workspaces-direction-c/390-reason_long.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / controls-archive-composition | native-reason-dialog / matching-dialog-scene | [composition-archive · 1440](design/workspaces-controls-direction-c/composition-archive-1440.png) / [composition-archive · 390](design/workspaces-controls-direction-c/composition-archive-390.png) | 仅原因窗局部组合提案，字段边界与真实生命周期未获批准。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / controls-restore-composition | native-reason-dialog / matching-dialog-scene | [composition-restore · 1440](design/workspaces-controls-direction-c/composition-restore-1440.png) / [composition-restore · 390](design/workspaces-controls-direction-c/composition-restore-390.png) | 仅原因窗局部组合提案，字段边界与真实生命周期未获批准。 |
| OrganizationWorkspacePanel.vue / form.1 / create | form-container / related-scene-only | [create · 1440](design/workspaces-direction-c/1440-create.png) / [create · 390](design/workspaces-direction-c/390-create.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_draft | form-container / related-scene-only | [create_draft · 1440](design/workspaces-direction-c/1440-create_draft.png) / [create_draft · 390](design/workspaces-direction-c/390-create_draft.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_invalid | form-container / related-scene-only | [create_invalid · 1440](design/workspaces-direction-c/1440-create_invalid.png) / [create_invalid · 390](design/workspaces-direction-c/390-create_invalid.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_required | form-container / related-scene-only | [create_required · 1440](design/workspaces-direction-c/1440-create_required.png) / [create_required · 390](design/workspaces-direction-c/390-create_required.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_long | form-container / related-scene-only | [create_long · 1440](design/workspaces-direction-c/1440-create_long.png) / [create_long · 390](design/workspaces-direction-c/390-create_long.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_busy | form-container / related-scene-only | [create_busy · 1440](design/workspaces-direction-c/1440-create_busy.png) / [create_busy · 390](design/workspaces-direction-c/390-create_busy.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_conflict | form-container / related-scene-only | [create_conflict · 1440](design/workspaces-direction-c/1440-create_conflict.png) / [create_conflict · 390](design/workspaces-direction-c/390-create_conflict.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_failure | form-container / related-scene-only | [create_failure · 1440](design/workspaces-direction-c/1440-create_failure.png) / [create_failure · 390](design/workspaces-direction-c/390-create_failure.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_success | form-container / related-scene-only | [create_success · 1440](design/workspaces-direction-c/1440-create_success.png) / [create_success · 390](design/workspaces-direction-c/390-create_success.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_read_failed | form-container / related-scene-only | [create_read_failed · 1440](design/workspaces-direction-c/1440-create_read_failed.png) / [create_read_failed · 390](design/workspaces-direction-c/390-create_read_failed.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |
| OrganizationWorkspacePanel.vue / form.1 / create_unknown | form-container / related-scene-only | [create_unknown · 1440](design/workspaces-direction-c/1440-create_unknown.png) / [create_unknown · 390](design/workspaces-direction-c/390-create_unknown.png) | 当前源码与旧C稿上下文关联；逐控件状态、完整组合、真实Vue生命周期、具体用户批准与生产验收仍待。 |

### 明确保留的边界

- 原型内联错误、缺失计数区分、原生button语义、未知写结果保护尚未进入真实Vue。
- 创建成功会清除等待期间后续编辑；归档原因等待与当前组织/目标版本归属仍需具体决策与真实验证。
- 新控件稿保留旧原型字段锁定、reason max500及未知结果保护提案；不能用控件图批准这些未确认的生产行为。
- 共享原因窗的原生焦点/销毁/跨路由归属尚未由本页证明。
- 原92PNG只是上下文，不冒充逐控件六态或真实Vue。

## P33 局部动作与共享消费者

[逐项机器清单](action-reviews/P33.json)：31个局部源位置 → 17组；2类写入，12组路由动作，0组转发/容器关联不重复计动作。已映射13/13个源码字段位置，3/3处调用/内嵌容器，14个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有17个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| EX-P34-FIRST-FAILURE P34首次读取失败转发（非本页） / excluded | 2处；normal | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-REFRESH 刷新团队 / read | 1处；normal、refreshing、refresh_error | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)、[refreshing · 1440](design/teams-direction-c/1440-refreshing.png) / [refreshing · 390](design/teams-direction-c/390-refreshing.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-RETRY 重新加载 / read | 1处；error、blocked、expired、forbidden、rate_limited | [error · 1440](design/teams-direction-c/1440-error.png) / [error · 390](design/teams-direction-c/390-error.png)、[blocked · 1440](design/teams-direction-c/1440-blocked.png) / [blocked · 390](design/teams-direction-c/390-blocked.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| EX-P29-PROFILE 资料分支排除 / excluded | 3处；normal | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| EX-P30-MEMBERS 成员分支排除 / excluded | 1处；normal | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| EX-P31-ROLES 授权分支排除 / excluded | 1处；normal | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| D-OG-REASON 分配与移除原因 / local | 3处；reason_assign、reason_remove、reason_short、reason_long | [reason_assign · 1440](design/teams-direction-c/1440-reason_assign.png) / [reason_assign · 390](design/teams-direction-c/390-reason_assign.png)、[reason_remove · 1440](design/teams-direction-c/1440-reason_remove.png) / [reason_remove · 390](design/teams-direction-c/390-reason_remove.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| EX-P36-TOKEN 令牌原因排除 / excluded | 1处；normal | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-OPEN 打开创建 / local | 2处；normal、empty、create | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png)、[empty · 1440](design/teams-direction-c/1440-empty.png) / [empty · 390](design/teams-direction-c/390-empty.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-CREATE 创建团队 / write | 2处；create_draft、create_optional_empty、create_required、create_busy、create_failure、create_success、create_read_failed | [create_draft · 1440](design/teams-direction-c/1440-create_draft.png) / [create_draft · 390](design/teams-direction-c/390-create_draft.png)、[create_optional_empty · 1440](design/teams-direction-c/1440-create_optional_empty.png) / [create_optional_empty · 390](design/teams-direction-c/390-create_optional_empty.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-CANCEL 取消创建 / local | 1处；create_draft、create_busy | [create_draft · 1440](design/teams-direction-c/1440-create_draft.png) / [create_draft · 390](design/teams-direction-c/390-create_draft.png)、[create_busy · 1440](design/teams-direction-c/1440-create_busy.png) / [create_busy · 390](design/teams-direction-c/390-create_busy.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-FILTER 状态与筛选重置 / local | 5处；catalog、archived、filter_empty | [catalog · 1440](design/teams-direction-c/1440-catalog.png) / [catalog · 390](design/teams-direction-c/390-catalog.png)、[archived · 1440](design/teams-direction-c/1440-archived.png) / [archived · 390](design/teams-direction-c/390-archived.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-SELECT 选择团队 / local | 1处；selected、switched_pending | [selected · 1440](design/teams-direction-c/1440-selected.png) / [selected · 390](design/teams-direction-c/390-selected.png)、[switched_pending · 1440](design/teams-direction-c/1440-switched_pending.png) / [switched_pending · 390](design/teams-direction-c/390-switched_pending.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-PAGE 前后分页 / local | 2处；catalog、page_two | [catalog · 1440](design/teams-direction-c/1440-catalog.png) / [catalog · 390](design/teams-direction-c/390-catalog.png)、[page_two · 1440](design/teams-direction-c/1440-page_two.png) / [page_two · 390](design/teams-direction-c/390-page_two.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-MEMBER 分配与移除成员 / write | 2处；member_missing、locked_member、no_members、archived、member_busy、member_failure、member_success、switched_pending | [member_missing · 1440](design/teams-direction-c/1440-member_missing.png) / [member_missing · 390](design/teams-direction-c/390-member_missing.png)、[locked_member · 1440](design/teams-direction-c/1440-locked_member.png) / [locked_member · 390](design/teams-direction-c/390-locked_member.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-T-LINK 成员与工作区入口 / navigation | 2处；selected | [selected · 1440](design/teams-direction-c/1440-selected.png) / [selected · 390](design/teams-direction-c/390-selected.png)、[members-default · 1440](design/teams-controls-direction-c/members-default-1440.png) / [members-default · 390](design/teams-controls-direction-c/members-default-390.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OG-TECH 技术详情 / local | 1处；technical | [technical · 1440](design/teams-direction-c/1440-technical.png) / [technical · 390](design/teams-direction-c/390-technical.png)、[technical-default · 1440](design/teams-controls-direction-c/technical-default-1440.png) / [technical-default · 390](design/teams-controls-direction-c/technical-default-390.png)；其余见JSON | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / form.logo_url | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / form.timezone | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / form.data_retention_days | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / form.reason | 仅P29资料表单，P33排除 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.name | required/max120，提交trim，等待仍编辑 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.lead_membership_id | 可留空；活动成员不排除锁定账号；负责人创建时加入团队 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.default_workflow_key | 可留空/max80；trim，不检查流程存在 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.reason | required/max500，trim，不追加共享原因最短2字规则 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / query | 仅名称/负责人邮箱/流程键，trim小写，不搜索成员名单 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / sort | name_asc/members_desc/updated_desc；后两者并列按名称 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / selectedMembershipId | 当前组织活动成员；非原生required；换团队清空，等待仍编辑 | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / normal | form-container / route-excluded-reference | [normal · 1440](design/teams-direction-c/1440-normal.png) / [normal · 390](design/teams-direction-c/390-normal.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_assign | native-reason-dialog / matching-dialog-scene | [reason_assign · 1440](design/teams-direction-c/1440-reason_assign.png) / [reason_assign · 390](design/teams-direction-c/390-reason_assign.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_remove | native-reason-dialog / matching-dialog-scene | [reason_remove · 1440](design/teams-direction-c/1440-reason_remove.png) / [reason_remove · 390](design/teams-direction-c/390-reason_remove.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_short | native-reason-dialog / matching-dialog-scene | [reason_short · 1440](design/teams-direction-c/1440-reason_short.png) / [reason_short · 390](design/teams-direction-c/390-reason_short.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / reason_long | native-reason-dialog / matching-dialog-scene | [reason_long · 1440](design/teams-direction-c/1440-reason_long.png) / [reason_long · 390](design/teams-direction-c/390-reason_long.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / composition-assign | native-reason-dialog / matching-dialog-scene | [composition-assign · 1440](design/teams-controls-direction-c/composition-assign-1440.png) / [composition-assign · 390](design/teams-controls-direction-c/composition-assign-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / composition-remove | native-reason-dialog / matching-dialog-scene | [composition-remove · 1440](design/teams-controls-direction-c/composition-remove-1440.png) / [composition-remove · 390](design/teams-controls-direction-c/composition-remove-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-empty | form-container / matching-inline-form-scene | [composition-create-empty · 1440](design/teams-fields-direction-c/composition-create-empty-1440.png) / [composition-create-empty · 390](design/teams-fields-direction-c/composition-create-empty-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-ready | form-container / matching-inline-form-scene | [composition-create-ready · 1440](design/teams-fields-direction-c/composition-create-ready-1440.png) / [composition-create-ready · 390](design/teams-fields-direction-c/composition-create-ready-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-optional-empty | form-container / matching-inline-form-scene | [composition-create-optional-empty · 1440](design/teams-fields-direction-c/composition-create-optional-empty-1440.png) / [composition-create-optional-empty · 390](design/teams-fields-direction-c/composition-create-optional-empty-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-invalid | form-container / matching-inline-form-scene | [composition-create-invalid · 1440](design/teams-fields-direction-c/composition-create-invalid-1440.png) / [composition-create-invalid · 390](design/teams-fields-direction-c/composition-create-invalid-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-boundary | form-container / matching-inline-form-scene | [composition-create-boundary · 1440](design/teams-fields-direction-c/composition-create-boundary-1440.png) / [composition-create-boundary · 390](design/teams-fields-direction-c/composition-create-boundary-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-pending | form-container / matching-inline-form-scene | [composition-create-pending · 1440](design/teams-fields-direction-c/composition-create-pending-1440.png) / [composition-create-pending · 390](design/teams-fields-direction-c/composition-create-pending-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |
| OrganizationTeamPanel.vue / form.1 / composition-create-failed | form-container / matching-inline-form-scene | [composition-create-failed · 1440](design/teams-fields-direction-c/composition-create-failed-1440.png) / [composition-create-failed · 390](design/teams-fields-direction-c/composition-create-failed-390.png) | 源码和独立图稿对应，不是挂载Vue/真实后端/生产或用户批准；完整适用性与生命周期仍待。 |

### 明确保留的边界

- OG-G02：成员请求等待后读取后来选择，可能异常或错误归属；图稿保护未进入Vue。
- 创建成功清除后续草稿；共享原因max500/晚到结果保护仍属未批准提案；不决定新政策。
- 代表六态未映射部分仍需适用性审查，不把179个列明控件状态当全部状态空间。
- 原型不是完整Vue响应性、原生缩放、多主题、多角色或真实权限/审计证明。
- 成员操作选择区不是原生form，不计第四表单；两张成员组合单独关联该字段。

## P34 局部动作与共享消费者

[逐项机器清单](action-reviews/P34.json)：29个局部源位置 → 13组；0类写入，8组路由动作，1组转发/容器关联不重复计动作。已映射16/16个源码字段位置，3/3处调用/内嵌容器，3个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有15个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OG-REFRESH 刷新组织审批 / read | 1处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[refresh-default · 1440](design/org-approvals-controls-direction-c/refresh-default-1440.png) / [refresh-default · 390](design/org-approvals-controls-direction-c/refresh-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-RETRY 错误后重新加载 / read | 2处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[retry-error-default · 1440](design/org-approvals-controls-direction-c/retry-error-default-1440.png) / [retry-error-default · 390](design/org-approvals-controls-direction-c/retry-error-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| WIRE-P34-RETRY 失败区域重试转发 / wiring | 2处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| EX-P29-PROFILE 组织资料排除 / excluded | 3处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| EX-P30-MEMBERS 成员事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| EX-P31-ROLES 授权事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| EX-REASON-ORIGINS 其他页原因窗调用排除 / excluded | 4处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-A-VIEW 记录/模板阅读视图 / local | 2处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[view-requests-available-default · 1440](design/org-approvals-controls-direction-c/view-requests-available-default-1440.png) / [view-requests-available-default · 390](design/org-approvals-controls-direction-c/view-requests-available-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-A-REQUEST-FILTER 审批重置与分页 / local | 3处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[request-reset-default · 1440](design/org-approvals-controls-direction-c/request-reset-default-1440.png) / [request-reset-default · 390](design/org-approvals-controls-direction-c/request-reset-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-A-TEMPLATE-FILTER 模板重置、清除与分页 / local | 4处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[template-reset-default · 1440](design/org-approvals-controls-direction-c/template-reset-default-1440.png) / [template-reset-default · 390](design/org-approvals-controls-direction-c/template-reset-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-A-SELECT 选择模板版本详情 / local | 1处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[select-default · 1440](design/org-approvals-controls-direction-c/select-default-1440.png) / [select-default · 390](design/org-approvals-controls-direction-c/select-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-TECH 折叠技术详情与请求追踪 / local | 3处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[request-technical-closed-default · 1440](design/org-approvals-controls-direction-c/request-technical-closed-default-1440.png) / [request-technical-closed-default · 390](design/org-approvals-controls-direction-c/request-technical-closed-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OG-A-LINK 审批工作台与组织审计 / navigation | 2处；source-current | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[approvals-default · 1440](design/org-approvals-controls-direction-c/approvals-default-1440.png) / [approvals-default · 390](design/org-approvals-controls-direction-c/approvals-default-390.png)；其余见JSON | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| WIRE-P34-RETRY | @reload / load() | OG-RETRY |
| WIRE-P34-RETRY | @reload / load() | OG-RETRY |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / form.logo_url | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / form.timezone | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / form.reason | P29资料分支，P34排除 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / requestQuery | 标题/模板名/工作区名，trim中文小写；不搜索技术ID，无输入maxlength，URL恢复截200 UTF-16单位 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / requestStatus | all/pending/approved/rejected/cancelled；改变条件回第一页 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / requestWorkspace | 按已返回模板的工作区名称筛选；同名合并，不伪造工作区ID选项 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / requestResource | all/task/opportunity_decision；未知类型只能在all内显示 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / requestSort | created_desc/created_asc/title_asc/status_asc；状态按显示文案排序 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / templateQuery | 模板名/工作区名，trim中文小写；不搜索节点或ID，无输入maxlength，URL恢复截200 UTF-16单位 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / templateStatus | all/published/draft/archived；归档模板可阅读 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / templateWorkspace | 已返回模板工作区名称去重；同名合并，非新业务筛选规则 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / templateResource | all/task/opportunity_decision，不修改会话工作区 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / templateSort | name_asc/updated_desc/nodes_desc/workspace_asc；updated_desc按current_version而不是更新时间 | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / summary-excluded | form-container / route-excluded-reference | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png) | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / no-local-origin | native-reason-dialog / route-excluded-reference | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png) | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |
| OrganizationApprovalPanel.vue / aside.1 / readonly-notice | inline-aside / related-scene-only | [normal · 1440](design/org-approvals-direction-c/1440-normal.png) / [normal · 390](design/org-approvals-direction-c/390-normal.png)、[templates · 1440](design/org-approvals-direction-c/1440-templates.png) / [templates · 390](design/org-approvals-direction-c/390-templates.png) | 源语义/离线图关联，不是整页C、完整生命周期、真实后端、权限或生产验收；局部批准另记。 |

### 明确保留的边界

- 当前C整合、加载、登录/网络反馈仍有待审区域；实际Vue手机权限白区已单独局部批准，不代表顶部或整页。
- 其他按钮态、完整父状态适用性、手机返回目录/筛选折叠与生产整合仍未全部实施批准。
- 同名工作区、最长内容、200%缩放、主题密度、全角色、组织切换/卸载/多实例时序及真实SQL/RBAC仍待验。
- source-reviewed不是整页完成；待审组合不因当前路由验证通过而自动批准。
- 三个结构记录不等于三个本页弹窗；本页业务弹窗为0。
- 模板详情article不被结构扫描当dialog；首版/无变化/差异阅读保持只读。

## P35 局部动作与共享消费者

[逐项机器清单](action-reviews/P35.json)：23个局部源位置 → 14组；0类写入，9组路由动作，0组转发/容器关联不重复计动作。已映射14/14个源码字段位置，4/4处调用/内嵌容器，4个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有54个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OG-REFRESH 刷新组织数据 / read | 1处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-RETRY 重新加载 / read | 1处；source-current | [error · 1440](design/org-data-direction-c/1440-error.png) / [error · 390](design/org-data-direction-c/390-error.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| EX-P34-RETRY 审批专有重试排除 / excluded | 2处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| EX-P29-PROFILE 组织资料排除 / excluded | 3处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| EX-P30-MEMBERS 成员事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| EX-P31-ROLES 资源授权事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| EX-REASON-ORIGINS 其他页原因窗排除 / excluded | 4处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-REPORT 前往报表工作台 / navigation | 1处；source-current | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-VIEW 工作区/导出视图 / local | 2处；source-current | [exports · 1440](design/org-data-direction-c/1440-exports.png) / [exports · 390](design/org-data-direction-c/390-exports.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-W-FILTER 工作区重置 / local | 1处；source-current | [workspace_search · 1440](design/org-data-direction-c/1440-workspace_search.png) / [workspace_search · 390](design/org-data-direction-c/390-workspace_search.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-W-PAGE 工作区分页 / local | 2处；source-current | [workspace_page_two · 1440](design/org-data-direction-c/1440-workspace_page_two.png) / [workspace_page_two · 390](design/org-data-direction-c/390-workspace_page_two.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-E-FILTER 导出重置 / local | 1处；source-current | [export_search · 1440](design/org-data-direction-c/1440-export_search.png) / [export_search · 390](design/org-data-direction-c/390-export_search.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-D-E-PAGE 导出分页 / local | 2处；source-current | [export_page_two · 1440](design/org-data-direction-c/1440-export_page_two.png) / [export_page_two · 390](design/org-data-direction-c/390-export_page_two.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OG-TECH 导出技术详情 / local | 1处；source-current | [technical · 1440](design/org-data-direction-c/1440-technical.png) / [technical · 390](design/org-data-direction-c/390-technical.png)；其余见JSON | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / form.logo_url | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / form.timezone | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / form.reason | P29组织资料分支，P35排除 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / workspaceQuery | 只搜索工作区名称，trim与中文小写；无maxlength；初始URL截200 UTF-16单位 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / workspaceStatus | all/active/archived；筛选变化回第一页 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / workspaceSort | total_desc/name_asc/trends_desc/opportunities_desc/tasks_desc/exports_desc；合计非质量分 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / exportQuery | 搜索工作区名称/中文报表类型/中文状态，不搜ID；无maxlength；初始URL截200单位 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / exportWorkspace | 已加载导出workspace_name去重排序，非完整工作区目录；同名合并 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / exportType | all/opportunity/trend/team；未知值保留在全部内 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / exportStatus | all/queued/leased/retry_scheduled/succeeded/dead_letter/expired | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / exportSort | created_desc/created_asc/updated_desc/rows_desc/workspace_asc；只排序已加载记录 | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / summary-excluded | form-container / route-excluded-reference | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png) | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / no-local-origin | native-reason-dialog / route-excluded-reference | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png) | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / aside.1 / observed-at | inline-aside / related-scene-only | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)、[exports · 1440](design/org-data-direction-c/1440-exports.png) / [exports · 390](design/org-data-direction-c/390-exports.png) | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |
| OrganizationDataPanel.vue / aside.2 / quality-notice | inline-aside / related-scene-only | [normal · 1440](design/org-data-direction-c/1440-normal.png) / [normal · 390](design/org-data-direction-c/390-normal.png)、[exports · 1440](design/org-data-direction-c/1440-exports.png) / [exports · 390](design/org-data-direction-c/390-exports.png) | 源语义与独立图关联，不是全页C、完整生命周期、真实API/权限或生产验收。 |

### 明确保留的边界

- 独立控件/字段图通过额外精确验证关联；未改旧清单格式或冒充统一六态图包，因此通用六态槽继续not-mapped。
- 父级七类故障/刷新/鉴权替换已有实际App矩阵及独立276张C设计图；新区域待审、实际实施未完成，不能用P34区域批准代替。
- 手机导出详情及null/0已有局部批准；生成/重试和新筛选组合未答不通过。
- 完整URL历史、缓存/多实例/组织切换、主题密度、200%缩放、真实API/SQL/RBAC和全73页生产验收待完成。
- 源扫描4容器：2父共享/他页结构及2子行内说明，不等于P35有4个业务弹窗。
- 子组件details、section、列表不是原生dialog或抽屉；父真实异常、路由归属和生命周期另验。

## P36 局部动作与共享消费者

[逐项机器清单](action-reviews/P36.json)：25个局部源位置 → 19组；3类写入，12组路由动作，2组转发/容器关联不重复计动作。已映射13/13个源码字段位置，6/6处调用/内嵌容器，9个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有72个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OG-REFRESH 刷新令牌数据 / read | 1处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-RETRY 重新读取 / read | 1处；source-current | [error · 1440](design/org-token-direction-c/1440-error.png) / [error · 390](design/org-token-direction-c/390-error.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| EX-P34-RETRY 审批专有转发排除 / excluded | 2处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| EX-P29-PROFILE 资料表单排除 / excluded | 3处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| EX-P30-MEMBERS 成员转发排除 / excluded | 1处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| EX-P31-ROLES 资源授权转发排除 / excluded | 1处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| EX-GENERIC-REASON 他页原因入口排除 / excluded | 1处；source-current | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| W-K-REASON 原因窗父转发 / wiring | 2处；source-current | [reason_rotate · 1440](design/org-token-direction-c/1440-reason_rotate.png) / [reason_rotate · 390](design/org-token-direction-c/390-reason_rotate.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| W-K-ASK 轮换/撤销原因调用 / wiring | 1处；source-current | [reason_revoke · 1440](design/org-token-direction-c/1440-reason_revoke.png) / [reason_revoke · 390](design/org-token-direction-c/390-reason_revoke.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-COPY 复制明文 / local | 1处；source-current | [copy_success · 1440](design/org-token-direction-c/1440-copy_success.png) / [copy_success · 390](design/org-token-direction-c/390-copy_success.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-DISMISS 关闭本次明文 / local | 1处；source-current | [secret_dismissed · 1440](design/org-token-direction-c/1440-secret_dismissed.png) / [secret_dismissed · 390](design/org-token-direction-c/390-secret_dismissed.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-CREATE 创建组织令牌 / write | 2处；source-current | [create_draft · 1440](design/org-token-direction-c/1440-create_draft.png) / [create_draft · 390](design/org-token-direction-c/390-create_draft.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-SCOPE 选择读取范围 / local | 1处；source-current | [create_all_scopes · 1440](design/org-token-direction-c/1440-create_all_scopes.png) / [create_all_scopes · 390](design/org-token-direction-c/390-create_all_scopes.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-TTL 有效期快捷选择 / local | 1处；source-current | [create · 1440](design/org-token-direction-c/1440-create.png) / [create · 390](design/org-token-direction-c/390-create.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-FILTER 重置筛选 / local | 1处；source-current | [search · 1440](design/org-token-direction-c/1440-search.png) / [search · 390](design/org-token-direction-c/390-search.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-TECH 技术详情 / local | 1处；source-current | [technical · 1440](design/org-token-direction-c/1440-technical.png) / [technical · 390](design/org-token-direction-c/390-technical.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-ROTATE 轮换密钥 / write | 1处；source-current | [reason_rotate · 1440](design/org-token-direction-c/1440-reason_rotate.png) / [reason_rotate · 390](design/org-token-direction-c/390-reason_rotate.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-REVOKE 撤销访问 / write | 1处；source-current | [reason_revoke · 1440](design/org-token-direction-c/1440-reason_revoke.png) / [reason_revoke · 390](design/org-token-direction-c/390-reason_revoke.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OG-K-PAGE 前后分页 / local | 2处；source-current | [page_two · 1440](design/org-token-direction-c/1440-page_two.png) / [page_two · 390](design/org-token-direction-c/390-page_two.png)；其余见JSON | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| W-K-REASON | @submit / submitAuditedReason | OG-K-ROTATE、OG-K-REVOKE |
| W-K-REASON | @cancel / cancelAuditedReason | OG-K-ROTATE、OG-K-REVOKE |
| W-K-REASON | @submit / submitAuditedReason | OG-K-ROTATE、OG-K-REVOKE |
| W-K-REASON | @cancel / cancelAuditedReason | OG-K-ROTATE、OG-K-REVOKE |
| W-K-ASK | 容器定义，无额外事件 | OG-K-ROTATE、OG-K-REVOKE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / form.logo_url | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / form.timezone | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / form.reason | P29资料分支，本页排除 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / tokenQuery | 搜索名称/前缀/中文状态/scope，不搜索ID；本地无maxlength，URL初读200 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / statusFilter | all/active/expiring/never_used/revoked/rotated/expired；按已返回数据计算 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / scopeFilter | 全部及四固定scope，只筛选已有数据不更改授权 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / tokenSort | created_desc/expires_asc/last_used_desc/name_asc/status_asc，完整数组先排序再分页 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / createForm.name | 名称required/max120，提交trim；等待仍可编辑 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / createForm.ttl_days | number模型，required/min1/max365；默认90，四快捷只改草稿 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / createForm.reason | 创建原因required/max500，提交trim；不等于共享原因窗上限 | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / summary-excluded | form-container / route-excluded-reference | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / rotate | native-reason-dialog / matching-dialog-scene | [reason_rotate · 1440](design/org-token-direction-c/1440-reason_rotate.png) / [reason_rotate · 390](design/org-token-direction-c/390-reason_rotate.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / revoke | native-reason-dialog / matching-dialog-scene | [reason_revoke · 1440](design/org-token-direction-c/1440-reason_revoke.png) / [reason_revoke · 390](design/org-token-direction-c/390-reason_revoke.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / aside.1 / security | inline-aside / related-scene-only | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / aside.2 / truth | inline-aside / related-scene-only | [normal · 1440](design/org-token-direction-c/1440-normal.png) / [normal · 390](design/org-token-direction-c/390-normal.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / form.1 / draft | form-container / matching-inline-form-scene | [create_draft · 1440](design/org-token-direction-c/1440-create_draft.png) / [create_draft · 390](design/org-token-direction-c/390-create_draft.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / form.1 / busy-proposal-differs | form-container / proposal-shape-differs | [create_busy · 1440](design/org-token-direction-c/1440-create_busy.png) / [create_busy · 390](design/org-token-direction-c/390-create_busy.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / form.1 / failure | form-container / matching-inline-form-scene | [create_failure · 1440](design/org-token-direction-c/1440-create_failure.png) / [create_failure · 390](design/org-token-direction-c/390-create_failure.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |
| OrganizationTokenPanel.vue / aside.3 / preview | inline-aside / related-scene-only | [create_draft · 1440](design/org-token-direction-c/1440-create_draft.png) / [create_draft · 390](design/org-token-direction-c/390-create_draft.png) | 源码/独立图关联，不是完整C、父级生命周期、真实权限/API或生产验收。 |

### 明确保留的边界

- 本页仅手机四筛选字段/帮助/底部重置获局部批准并有真实子Vue证据；创建及其他控件问题仍待答。
- 原662PNG与10实图分别关联，独立schema不强充统一六态slot，72个路由动作槽仍not-mapped。
- 父级完整错误/刷新、URL历史、路由/组织/KeepAlive生命周期、OG-G05、真实MySQL/权限/审计/幂等与全73页部署验收仍待。
- 既有P35颜色门失败仍未获修复授权；不以本登记通过代替完整测试或自动提交。
- 6处caller结构不等于6个业务弹窗；共享原生原因窗仅两种上下文。
- 共享reason字段和6个源位置单独登记，原提案max500、busy草稿锁与复制归属保护不冒充实际Vue。

## P37 局部动作与共享消费者

[逐项机器清单](action-reviews/P37.json)：23个局部源位置 → 16组；0类写入，11组路由动作，0组转发/容器关联不重复计动作。已映射14/14个源码字段位置，6/6处调用/内嵌容器，9个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| OG-REFRESH 刷新审计第一页 / read | 1处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-RETRY 重新读取 / read | 1处；source-current | [error · 1440](design/org-audit-direction-c/1440-error.png) / [error · 390](design/org-audit-direction-c/390-error.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| EX-P34-RETRY 审批专有恢复排除 / excluded | 2处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| EX-P29-PROFILE 组织资料表单排除 / excluded | 3处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| EX-P30-MEMBERS 成员事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| EX-P31-ROLES 资源授权事件排除 / excluded | 1处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| EX-REASON 其他页面原因调用排除 / excluded | 4处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-FILTER 应用七项精确条件 / read | 2处；source-current | [advanced · 1440](design/org-audit-direction-c/1440-advanced.png) / [advanced · 390](design/org-audit-direction-c/390-advanced.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-ADVANCED 高级条件展开与收起 / local | 1处；source-current | [advanced · 1440](design/org-audit-direction-c/1440-advanced.png) / [advanced · 390](design/org-audit-direction-c/390-advanced.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-RESET 重置全部条件 / read | 1处；source-current | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-SYSTEM 系统连接记录开合 / local | 1处；source-current | [system_collapsed · 1440](design/org-audit-direction-c/1440-system_collapsed.png) / [system_collapsed · 390](design/org-audit-direction-c/390-system_collapsed.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-SELECT 选择审计记录 / local | 1处；source-current | [selected · 1440](design/org-audit-direction-c/1440-selected.png) / [selected · 390](design/org-audit-direction-c/390-selected.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-MORE 加载更多 / read | 1处；source-current | [more_busy · 1440](design/org-audit-direction-c/1440-more_busy.png) / [more_busy · 390](design/org-audit-direction-c/390-more_busy.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-COPY-REQUEST 复制请求ID / local | 1处；source-current | [request_copied · 1440](design/org-audit-direction-c/1440-request_copied.png) / [request_copied · 390](design/org-audit-direction-c/390-request_copied.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-AUD-COPY-TRACE 复制追踪ID / local | 1处；source-current | [trace_copied · 1440](design/org-audit-direction-c/1440-trace_copied.png) / [trace_copied · 390](design/org-audit-direction-c/390-trace_copied.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OG-TECH 技术详情 / local | 1处；source-current | [technical · 1440](design/org-audit-direction-c/1440-technical.png) / [technical · 390](design/org-audit-direction-c/390-technical.png)；其余见JSON | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationAdminCenter.vue / form.name | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.logo_url | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.timezone | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.data_retention_days | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.default_workspace_id | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / form.reason | P29资料字段，本路由排除 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / loadedQuery | 仅搜索已加载操作/对象类型/结果/request_id/trace_id；maxlength160；不检索metadata/actor或resource ID | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.action | maxlength128，trim后精确操作代码，不是中文模糊搜索 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.outcome | 空/succeeded/failed/blocked，原生select | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.resource_type | maxlength80，trim后精确类型，不是对象ID | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.request_id | maxlength128，trim后精确请求ID | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.trace_id | maxlength128，trim后精确追踪ID | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.occurred_from | datetime-local，max为结束，提交ISO；无默认必填 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.occurred_to | datetime-local，min为开始；两端存在且开始更晚时拒绝查询 | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationAdminCenter.vue / form.1 / summary-excluded | form-container / route-excluded-reference | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAdminCenter.vue / AuditedReasonDialog.1 / other-route-excluded | native-reason-dialog / route-excluded-reference | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / aside.1 / boundary | inline-aside / related-scene-only | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.1 / normal | form-container / proposal-shape-differs | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.1 / advanced | form-container / proposal-shape-differs | [advanced · 1440](design/org-audit-direction-c/1440-advanced.png) / [advanced · 390](design/org-audit-direction-c/390-advanced.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / form.1 / range | form-container / proposal-shape-differs | [range_error · 1440](design/org-audit-direction-c/1440-range_error.png) / [range_error · 390](design/org-audit-direction-c/390-range_error.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / aside.2 / selected | inline-aside / related-scene-only | [normal · 1440](design/org-audit-direction-c/1440-normal.png) / [normal · 390](design/org-audit-direction-c/390-normal.png)、[selected · 1440](design/org-audit-direction-c/1440-selected.png) / [selected · 390](design/org-audit-direction-c/390-selected.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / aside.2 / technical | inline-aside / related-scene-only | [technical · 1440](design/org-audit-direction-c/1440-technical.png) / [technical · 390](design/org-audit-direction-c/390-technical.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |
| OrganizationAuditPanel.vue / aside.3 / empty | inline-aside / related-scene-only | [empty · 1440](design/org-audit-direction-c/1440-empty.png) / [empty · 390](design/org-audit-direction-c/390-empty.png) | 来源与图稿关联；复制及分页响应归属已有局部Vue验证，完整C、历史/生命周期、权限/API与生产验收未完成。 |

### 明确保留的边界

- 基础筛选和手机详情问题尚未回复，全部P37新图待审。
- 19控件变体中的三个便捷动作和缺失ID禁用是提案，非生产规则。
- 原104、字段38、控件172图分别关联，不把独立schema强充通用六态槽。
- 复制及分页响应归属已做局部保护，不扩大为全部OG-G05通过；查询失败已用条件错位及URL反向恢复仍待处理。
- P35既有颜色门授权待答；全73页C实施、部署和签收未完成。
- 父共享原因的跨页遗留状态不在当前登记中验收。
- 子源10候选、八模型和四结构都需真实Vue生命周期验证。

## P38 局部动作与共享消费者

[逐项机器清单](action-reviews/P38.json)：30个局部源位置 → 20组；0类写入，19组路由动作，1组转发/容器关联不重复计动作。已映射2/2个源码字段位置，1/1处调用/内嵌容器，3个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有114个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA38-WINDOW 切换查看范围 / read | 1处；41083a84c60ec185.1 | [window15m · 1440](design/platform-overview-direction-c/1440-window15m.png) / [window15m · 390](design/platform-overview-direction-c/390-window15m.png)、[window7d · 1440](design/platform-overview-direction-c/1440-window7d.png) / [window7d · 390](design/platform-overview-direction-c/390-window7d.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-REFRESH 刷新与两类重试 / read | 3处；15e83f4e8898e4d7.1、17f7411f1727355d.1、3569d8f0f015857e.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[blocked · 1440](design/platform-overview-direction-c/1440-blocked.png) / [blocked · 390](design/platform-overview-direction-c/390-blocked.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-LOGIN 重新登录入口 / navigation | 1处；5587941412d5210f.1 | [expired · 1440](design/platform-overview-direction-c/1440-expired.png) / [expired · 390](design/platform-overview-direction-c/390-expired.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-COLLECTION 等待处理与查看任务 / navigation | 2处；65c09ba74ca8870b.1、348b42f6f4eb388b.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-ROOTCAUSE 需要关注入口 / navigation | 1处；d1c0b626714a7ff9.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-ORGANIZATIONS 查看组织与管理组织和用户 / navigation | 2处；52444eba9c2a98bc.1、f84b8209be451866.1 | [superadmin · 1440](design/platform-overview-direction-c/1440-superadmin.png) / [superadmin · 390](design/platform-overview-direction-c/390-superadmin.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-USERS 查看用户 / navigation | 1处；c4dfc8f822a18263.1 | [superadmin · 1440](design/platform-overview-direction-c/1440-superadmin.png) / [superadmin · 390](design/platform-overview-direction-c/390-superadmin.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-SOURCES 来源导航的三处变体 / navigation | 3处；06b4b917d7a90e96.1、5074531b9e5b8a16.1、ba487bb14816185a.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[trend · 1440](design/platform-overview-direction-c/1440-trend.png) / [trend · 390](design/platform-overview-direction-c/390-trend.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-DATA 查看数据 / navigation | 1处；9ae1b37e258dde35.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-QUEUE 采集进度与无趋势恢复 / navigation | 2处；1ce54f6253c32ad1.1、2e8c2f831b1b02a5.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[trend · 1440](design/platform-overview-direction-c/1440-trend.png) / [trend · 390](design/platform-overview-direction-c/390-trend.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-TECH 来源与告警原生技术折叠 / local | 2处；1c008f867673db60.1、1c008f867673db60.2 | [technical · 1440](design/platform-overview-direction-c/1440-technical.png) / [technical · 390](design/platform-overview-direction-c/390-technical.png)、[alert_details · 1440](design/platform-overview-direction-c/1440-alert_details.png) / [alert_details · 390](design/platform-overview-direction-c/390-alert_details.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-PROVIDERS 来源展开收起 / local | 1处；d604390773d9cd06.1 | [many_providers · 1440](design/platform-overview-direction-c/1440-many_providers.png) / [many_providers · 390](design/platform-overview-direction-c/390-many_providers.png)、[all_providers · 1440](design/platform-overview-direction-c/1440-all_providers.png) / [all_providers · 390](design/platform-overview-direction-c/390-all_providers.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-PREVIEW-OPEN 手机记录预览 / local | 1处；6da4dad42cb34c8d.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[long_fields · 1440](design/platform-overview-direction-c/1440-long_fields.png) / [long_fields · 390](design/platform-overview-direction-c/390-long_fields.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-PREVIEW-CLOSE 关闭与焦点循环 / local | 3处；c182428cb2c0ed66.1、988131834dc4bd6f.1、847801b2ac6e7a17.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[long_fields · 1440](design/platform-overview-direction-c/1440-long_fields.png) / [long_fields · 390](design/platform-overview-direction-c/390-long_fields.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-PREVIEW-DIALOG 共享预览容器关联 / wiring | 1处；a3c9be2acacfd788.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-COLUMNS 列设置展开 / local | 1处；e2fd0d02cbd9f684.1 | [columns · 1440](design/platform-overview-direction-c/1440-columns.png) / [columns · 390](design/platform-overview-direction-c/390-columns.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-COLUMN-TOGGLE 切换来源显示列 / local | 1处；921f4be18a3fe814.1 | [columns · 1440](design/platform-overview-direction-c/1440-columns.png) / [columns · 390](design/platform-overview-direction-c/390-columns.png)、[one_column · 1440](design/platform-overview-direction-c/1440-one_column.png) / [one_column · 390](design/platform-overview-direction-c/390-one_column.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-FREEZE 冻结首个可见列 / local | 1处；d09cd5524db7bee5.1 | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png)、[unfrozen · 1440](design/platform-overview-direction-c/1440-unfrozen.png) / [unfrozen · 390](design/platform-overview-direction-c/390-unfrozen.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-REQUEST-DETAILS 共享请求技术详情 / local | 1处；b3ffca8eb967d682.1 | [technical · 1440](design/platform-overview-direction-c/1440-technical.png) / [technical · 390](design/platform-overview-direction-c/390-technical.png)、[blocked · 1440](design/platform-overview-direction-c/1440-blocked.png) / [blocked · 390](design/platform-overview-direction-c/390-blocked.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PA38-REQUEST-COPY 复制请求编号 / local | 1处；c19091da9e2471f1.1 | [copy_success · 1440](design/platform-overview-direction-c/1440-copy_success.png) / [copy_success · 390](design/platform-overview-direction-c/390-copy_success.png)、[copy_failed · 1440](design/platform-overview-direction-c/1440-copy_failed.png) / [copy_failed · 390](design/platform-overview-direction-c/390-copy_failed.png)；其余见JSON | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA38-PREVIEW-DIALOG | 容器定义，无额外事件 | PA38-PREVIEW-OPEN、PA38-PREVIEW-CLOSE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformDashboard.vue / windowCode | 现有四时间窗；URL replace保留其他查询；pending时禁用 | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| TableViewControls.vue / density | 表格密度standard/compact，经v-model和watch本地应用；无显式事件签名，不冒充扫描动作候选 | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformDashboard.vue / ResponsiveDataView.1 / normal | responsive-row-detail / related-scene-only | [normal · 1440](design/platform-overview-direction-c/1440-normal.png) / [normal · 390](design/platform-overview-direction-c/390-normal.png) | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PlatformDashboard.vue / ResponsiveDataView.1 / unknown_provider | responsive-row-detail / related-scene-only | [unknown_provider · 1440](design/platform-overview-direction-c/1440-unknown_provider.png) / [unknown_provider · 390](design/platform-overview-direction-c/390-unknown_provider.png) | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |
| PlatformDashboard.vue / ResponsiveDataView.1 / long_fields | responsive-row-detail / related-scene-only | [long_fields · 1440](design/platform-overview-direction-c/1440-long_fields.png) / [long_fields · 390](design/platform-overview-direction-c/390-long_fields.png) | 具体组合/逐控件六态和全父壳生命周期需分开审核；本登记不授予视觉、权限或生产验收。 |

### 明确保留的边界

- 8张入口组合待审，不填充通用六态，也不抵扣其他未审构图。
- ready刷新401/403旧快照展示策略已询问、待用户决策；本轮保持现状。
- 除P38至来源频道缓存往返外，其他父壳/KeepAlive、真实角色与目标页业务、全主题/密度/缩放和生产验收仍待完成。
- 共享组件仅核对本页消费者，不推广为其他页面验收。
- 密度是独立模型驱动交互，不因动作扫描器不收集纯v-model而省略。
- role=dialog定义由候选扫描器登记，不冒充结构容器扫描器的额外结果。

## P39 局部动作与共享消费者

[逐项机器清单](action-reviews/P39.json)：22个局部源位置 → 18组；0类写入，8组路由动作，2组转发/容器关联不重复计动作。已映射6/6个源码字段位置，3/3处调用/内嵌容器，3个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有48个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA-NAV-ORG 进入组织管理目录 / navigation | 1处；29448f61eb8ffc80.1 | [normal · 1440](design/account-overview-direction-c/1440-normal.png) / [normal · 390](design/account-overview-direction-c/390-normal.png)；其余见JSON | 共享导航已在用户授权的C方向内；此登记只映射源语义，不代表逐控件六态、完整App壳或生产验收。 |
| PA-NAV-USER 进入用户管理目录 / navigation | 1处；ffed2dd7f439c4b0.1 | [normal · 1440](design/account-overview-direction-c/1440-normal.png) / [normal · 390](design/account-overview-direction-c/390-normal.png)；其余见JSON | 共享导航已在用户授权的C方向内；此登记只映射源语义，不代表逐控件六态、完整App壳或生产验收。 |
| PA-NAV-ADMIN 进入管理员管理目录 / navigation | 1处；e400286c7cd59e44.1 | [normal · 1440](design/account-overview-direction-c/1440-normal.png) / [normal · 390](design/account-overview-direction-c/390-normal.png)；其余见JSON | 共享导航已在用户授权的C方向内；此登记只映射源语义，不代表逐控件六态、完整App壳或生产验收。 |
| PA39-NAV-ORG-ADMIN-BRANCH 管理员列表分支组织导航（P39排除） / excluded | 1处；apps/web/src/components/PlatformAccountGlobalRail.vue#29448f61eb8ffc80.1 | ；其余见JSON | 只排除P44条件分支，不代表P44页面已完成本动作映射。 |
| PA39-NAV-USER-ADMIN-BRANCH 管理员列表分支用户导航（P39排除） / excluded | 1处；apps/web/src/components/PlatformAccountGlobalRail.vue#ffed2dd7f439c4b0.1 | ；其余见JSON | 只排除P44条件分支，不代表P43页面已完成本动作映射。 |
| PA39-NAV-ADMIN-ADMIN-BRANCH 管理员列表分支管理员导航（P39排除） / excluded | 1处；apps/web/src/components/PlatformAccountGlobalRail.vue#e400286c7cd59e44.1 | ；其余见JSON | 只排除P44条件分支，不代表P44页面已完成本动作映射。 |
| PA-FILTER-DRAWER 移动筛选抽屉容器关联 / wiring | 1处；03d32a05b1b3fd19.1 | [filter_open · 1440](design/account-overview-direction-c/1440-filter_open.png) / [filter_open · 390](design/account-overview-direction-c/390-filter_open.png)；其余见JSON | 场景引用不等同弹窗完整组合或真实焦点生命周期验收。 |
| PA-FILTER 查询与状态筛选 / read | 2处；2d610959fc00fb96.1、e9658d470d4cbeaf.1 | [filter_open · 1440](design/account-overview-direction-c/1440-filter_open.png) / [filter_open · 390](design/account-overview-direction-c/390-filter_open.png)、[filtered_empty · 1440](design/account-overview-direction-c/1440-filtered_empty.png) / [filtered_empty · 390](design/account-overview-direction-c/390-filtered_empty.png)；其余见JSON | 沿用现有URL、读取与筛选规则；场景图不抵扣各字段逐控件状态或真实会话/RBAC验收。 |
| PA-RESET 清除当前页组织筛选 / read | 2处；20080e701de7f5cb.1、86ea70e081f1f8e3.1 | [filtered_empty · 1440](design/account-overview-direction-c/1440-filtered_empty.png) / [filtered_empty · 390](design/account-overview-direction-c/390-filtered_empty.png)；其余见JSON | P44专属空态重置另行排除；本组不改变路由或读取合同。 |
| PA-REFRESH 首次读取失败后重新加载 / read | 1处；322a4ac62ce3a305.1 | [error · 1440](design/account-overview-direction-c/1440-error.png) / [error · 390](design/account-overview-direction-c/390-error.png)、[refresh_failed · 1440](design/account-overview-direction-c/1440-refresh_failed.png) / [refresh_failed · 390](design/account-overview-direction-c/390-refresh_failed.png)；其余见JSON | 错误状态场景存在不代表生产401/403或读取副作用已验收。 |
| PA39-ORG-CREATE-EMPTY-EXCLUDED 组织列表空态创建（P39排除） / excluded | 1处；f68d2406f8c1db70.1 | ；其余见JSON | 只排除P39中的P40空态分支，不代表P40动作完成。 |
| PA-ORG-DETAIL 查看组织详情 / navigation | 2处；6923b73e52535ef3.1、2a07373cb016b4b5.1 | [preview · 1440](design/account-overview-direction-c/1440-preview.png) / [preview · 390](design/account-overview-direction-c/390-preview.png)、[preview_technical · 1440](design/account-overview-direction-c/1440-preview_technical.png) / [preview_technical · 390](design/account-overview-direction-c/390-preview_technical.png)；其余见JSON | 详情页内容/全局缓存往返和目标路由真实授权另属P42及生产验收。 |
| PA-ORG-DETAIL-WIRING 组织详情事件转发 / wiring | 1处；8871f6d994e9fced.1 | [preview · 1440](design/account-overview-direction-c/1440-preview.png) / [preview · 390](design/account-overview-direction-c/390-preview.png)；其余见JSON | 事件链可静态追到父handler；不替代已挂载真实权限或目标页验收。 |
| PA-ORG-TECH 展开组织技术详情 / local | 1处；1c008f867673db60.1 | [preview_technical · 1440](design/account-overview-direction-c/1440-preview_technical.png) / [preview_technical · 390](design/account-overview-direction-c/390-preview_technical.png)；其余见JSON | 折叠交互引用既有场景，不证明复制、读屏或全部字段状态。 |
| PA43-DETAIL-OUT-OF-SCOPE 用户/管理员详情转发（P39排除） / excluded | 2处；44e761922e1da1d0.1、103fa7d7798d62d6.1 | ；其余见JSON | 排除只针对P39路由；P43/P44详情链路未由本记录验收。 |
| PA44-RESET-OUT-OF-SCOPE 管理员空态清除筛选（P39排除） / excluded | 1处；86ea70e081f1f8e3.2 | ；其余见JSON | 排除只针对P39路由，不代表P44空态完成验收。 |
| PA44-USER-CREATE-OUT-OF-SCOPE 管理员空态新建（P39排除） / excluded | 1处；38003e3f7b002f71.1 | ；其余见JSON | 排除只针对P39子组件变体；不代表P39页头创建弹窗或P44写入完成验收。 |
| PA40-REFRESH-OUT-OF-SCOPE 组织列表手动刷新（P39排除） / excluded | 1处；9c9141422bfd2c11.1 | ；其余见JSON | 排除只针对P39概览变体，不代表P40刷新按钮的真实生命周期验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA-FILTER-DRAWER | 容器定义，无额外事件 | PA-FILTER |
| PA-ORG-DETAIL-WIRING | @open-organization / emit('open-organization', $event) | PA-ORG-DETAIL |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformAccountDirectoryWorkspace.vue / query | 搜索关键词v-model，桌面内联/手机筛选抽屉共用 | 字段/主题/读屏的逐控件组合需各自证据。 |
| PlatformAccountDirectoryWorkspace.vue / query | 同一查询字段在移动抽屉内的v-model实例，不是新业务字段 | 不重复计算为独立查询动作。 |
| PlatformAccountDirectoryWorkspace.vue / query | 账号概览分支使用的查询v-model，仍绑定同一父级筛选草稿 | 不是额外筛选条件或独立请求。 |
| PlatformAccountDirectoryWorkspace.vue / status | 账号状态v-model；选项随组织/管理员筛选变体而异 | 保留disabled/archived区分，不由本映射决定服务端权限。 |
| PlatformAccountDirectoryWorkspace.vue / status | 同一状态字段在移动抽屉内的v-model实例 | 不重复计算为独立字段或动作。 |
| PlatformAccountDirectoryWorkspace.vue / status | 账号概览分支使用的状态v-model，仍绑定同一父级筛选草稿 | 不是额外筛选条件或独立请求。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformAccountDirectoryWorkspace.vue / ResponsiveFilterDrawer.1 / mobile-filter-open | responsive-filter / related-scene-only | [filter_open · 1440](design/account-overview-direction-c/1440-filter_open.png) / [filter_open · 390](design/account-overview-direction-c/390-filter_open.png) | 焦点循环与触发器归还仍须独立真实Vue证据。 |
| PlatformAccountGlobalRail.vue / aside.1 / desktop-account-global-rail | inline-aside / related-scene-only | [normal · 1440](design/account-overview-direction-c/1440-normal.png) / [normal · 390](design/account-overview-direction-c/390-normal.png) | P39 overview不显示该rail；该场景只引用相关布局，非逐组件验收。 |
| PlatformOrganizationRecords.vue / ResponsiveDataView.1 / mobile-organization-preview | responsive-row-detail / related-scene-only | [preview · 1440](design/account-overview-direction-c/1440-preview.png) / [preview · 390](design/account-overview-direction-c/390-preview.png) | 相关预览场景不替代完整预览/详情往返生命周期。 |

### 明确保留的边界

- 本审阅只覆盖P39目录与组织记录子组件22个源码位置；P39其余父组件按钮、输入、弹窗和壳层动作尚未纳入。
- P40-P44共享组件条件分支显式排除于P39，不等于对应目的页动作已审阅。
- 视觉方向已获用户统一授权继续实施；逐控件六态映射、真实App壳/KeepAlive、RBAC、组织读取与生产验收仍分开核验。
- 本记录仅覆盖P39目录展示组件和组织记录消费者；不声明完整P39全页语义映射。
- 页头创建/其他详情对话框、NavigationShell、角色比较和完整P40-P44路由变体仍需各自映射。
- 用户已授权第二阶段剩余视觉方向自动通过；此语义台账不记录逐控件六态批准，也不替代真实权限/生产验收。

## P40 局部动作与共享消费者

[逐项机器清单](action-reviews/P40.json)：53个局部源位置 → 16组；1类写入，11组路由动作，4组转发/容器关联不重复计动作。已映射7/14个源码字段位置，6/10处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有66个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA-ORG-CREATE 从组织目录进入创建组织 / navigation | 2处；page-header、unfiltered-empty-state | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png)、[empty · 1440](design/platform-organizations-direction-c/1440-empty.png) / [empty · 390](design/platform-organizations-direction-c/390-empty.png)；其余见JSON | 浏览器路由夹具证明入口目标；不代表P41创建表单、服务端写入或权限验收。 |
| PA-USER-CREATE 从组织目录创建用户 / write | 3处；page-header-and-native-dialog | [create_user · 1440](design/account-overview-direction-c/1440-create_user.png) / [create_user · 390](design/account-overview-direction-c/390-create_user.png)、[create_busy · 1440](design/account-overview-direction-c/1440-create_busy.png) / [create_busy · 390](design/account-overview-direction-c/390-create_busy.png)；其余见JSON | 当前E2E覆盖P40弹窗打开；不能由本映射推定真实POST、RBAC、审计或生产创建已验收。 |
| PA40-USER-CREATE-CANCEL 取消新建用户 / local | 1处；native-dialog-footer-cancel | [create_user · 1440](design/account-overview-direction-c/1440-create_user.png) / [create_user · 390](design/account-overview-direction-c/390-create_user.png)；其余见JSON | 本次源映射未声称所有输入草稿清除、真实辅助技术或生产会话行为通过。 |
| PA40-USER-DIALOG-WIRING P40用户弹窗的父子事件接线 / wiring | 4处；create-user-dialog、shared-inactive-dialog-branches | [create_user · 1440](design/account-overview-direction-c/1440-create_user.png) / [create_user · 390](design/account-overview-direction-c/390-create_user.png)；其余见JSON | 接线登记不等于每个共享弹窗分支的字段/焦点/写入验收；P40只验当前可达用户创建分支。 |
| PA-FILTER 查询并应用组织筛选 / read | 2处；desktop-inline-filter、mobile-filter-drawer | [filter · 1440](design/platform-organizations-direction-c/1440-filter.png) / [filter · 390](design/platform-organizations-direction-c/390-filter.png)、[filtered_empty · 1440](design/platform-organizations-direction-c/1440-filtered_empty.png) / [filtered_empty · 390](design/platform-organizations-direction-c/390-filtered_empty.png)；其余见JSON | 现有夹具验证浏览器URL与读取参数，不证明真实MySQL过滤、权限或排序。 |
| PA-RESET 清除组织筛选 / read | 2处；filter-bar-reset、filtered-empty-clear | [filtered_empty · 1440](design/platform-organizations-direction-c/1440-filtered_empty.png) / [filtered_empty · 390](design/platform-organizations-direction-c/390-filtered_empty.png)；其余见JSON | 不外推浏览器完整历史栈、跨KeepAlive返回或真实服务端查询验收。 |
| PA-REFRESH 刷新组织记录或重试首次读取 / read | 2处；manual-refresh、first-read-error-retry | [refreshing · 1440](design/platform-organizations-direction-c/1440-refreshing.png) / [refreshing · 390](design/platform-organizations-direction-c/390-refreshing.png)、[error · 1440](design/platform-organizations-direction-c/1440-error.png) / [error · 390](design/platform-organizations-direction-c/390-error.png)；其余见JSON | 读取错误/保留快照/过期/拒绝策略与真实网络、RBAC仍待独立验收。 |
| PA40-WORKSPACE-WIRING 父级连接组织目录工作区 / wiring | 1处；organization-list-route | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png)；其余见JSON | 本组核对事件连接，不代表父级请求、角色权限和缓存/迟到结果已生产验收。 |
| PA40-FILTER-DRAWER 移动筛选抽屉容器接线 / wiring | 1处；mobile-filter-drawer | [filter · 1440](design/platform-organizations-direction-c/1440-filter.png) / [filter · 390](design/platform-organizations-direction-c/390-filter.png)；其余见JSON | 焦点循环、触发器返焦、软键盘及共享抽屉其它消费者单独验收。 |
| PA-ORG-DETAIL 从桌面记录或手机预览打开组织详情 / navigation | 2处；desktop-row、mobile-preview | [preview · 1440](design/platform-organizations-direction-c/1440-preview.png) / [preview · 390](design/platform-organizations-direction-c/390-preview.png)、[detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)；其余见JSON | 当前浏览器路由夹具不是P42编辑/状态操作、真实组织授权或KeepAlive历史验收。 |
| PA40-ORG-DETAIL-WIRING 组织记录详情事件转发 / wiring | 1处；organization-records-component | [preview · 1440](design/platform-organizations-direction-c/1440-preview.png) / [preview · 390](design/platform-organizations-direction-c/390-preview.png)；其余见JSON | 事件接线可追到父处理器；不代表目标组织真实存在或P42写入获准。 |
| PA-ORG-TECH 展开或收起组织技术标识 / local | 1处；mobile-preview-technical-details | [preview_technical · 1440](design/platform-organizations-direction-c/1440-preview_technical.png) / [preview_technical · 390](design/platform-organizations-direction-c/390-preview_technical.png)；其余见JSON | 图示和当前本地展开不证明读屏播报或真实长标识完整性。 |
| PA-NAV-ORG 侧栏进入组织管理 / navigation | 1处；platform-directory-rail | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png)；其余见JSON | 只核对当前局部路由入口，不外推NavigationShell或全站角色可见性。 |
| PA-NAV-USER 侧栏进入用户管理 / navigation | 1处；platform-directory-rail | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png)；其余见JSON | P43目标页数据、动作与权限另行映射。 |
| PA-NAV-ADMIN 侧栏进入管理员管理 / navigation | 1处；platform-directory-rail | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png)；其余见JSON | P44目标页数据、动作与权限另行映射。 |
| PA40-EXCLUDED-CONDITIONAL-BRANCHES 明确排除的其他路由和共享弹窗分支 / excluded | 28处；permissions、overview-refresh、P41、P42、P43、P44、password-dialog、reason-dialog | ；其余见JSON | 显式排除只界定P40；P41-P45页面及其写入/焦点状态仍待各自动作映射。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA40-USER-DIALOG-WIRING | @close-create-user / closeCreateUser | PA40-USER-CREATE-CANCEL |
| PA40-USER-DIALOG-WIRING | @create-user / createUser | PA-USER-CREATE |
| PA40-USER-DIALOG-WIRING | @close-password / closePassword | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @reset-password / resetPassword | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @close-reason / cancelReason | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @submit-reason / submitReason | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @update:reason-text / reasonText = $event | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @close-create-user / closeCreateUser | PA40-USER-CREATE-CANCEL |
| PA40-USER-DIALOG-WIRING | @create-user / createUser | PA-USER-CREATE |
| PA40-USER-DIALOG-WIRING | @close-password / closePassword | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @reset-password / resetPassword | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @close-reason / cancelReason | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @submit-reason / submitReason | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @update:reason-text / reasonText = $event | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-USER-DIALOG-WIRING | @cancel / handleCreateUserCancel | PA40-USER-CREATE-CANCEL |
| PA40-WORKSPACE-WIRING | @apply-filters / applyFilters | PA-FILTER |
| PA40-WORKSPACE-WIRING | @reset-filters / resetFilters | PA-RESET |
| PA40-WORKSPACE-WIRING | @load / load | PA-REFRESH |
| PA40-WORKSPACE-WIRING | @create-organization / openOrganizationWizard | PA-ORG-CREATE |
| PA40-WORKSPACE-WIRING | @create-admin / openCreateUser(true) | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-WORKSPACE-WIRING | @open-organization / openOrganization | PA-ORG-DETAIL |
| PA40-WORKSPACE-WIRING | @open-user / openUserDetail | PA40-EXCLUDED-CONDITIONAL-BRANCHES |
| PA40-FILTER-DRAWER | 容器定义，无额外事件 | PA-FILTER |
| PA40-ORG-DETAIL-WIRING | @open-organization / emit('open-organization', $event) | PA-ORG-DETAIL |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformAccountCenter.vue / query | 父级组织查询草稿，参与原URL/GET合同 | 浏览器回退、KeepAlive与真实查询另验。 |
| PlatformAccountCenter.vue / status | 父级组织状态草稿，空/active/archived沿用现有筛选 | 真实状态数据/RBAC另验。 |
| PlatformAccountDialogs.vue / userForm.email | P40新建用户弹窗邮箱字段 | 服务端账户规则与真实创建另验。 |
| PlatformAccountDialogs.vue / userForm.temporary_password | P40新建用户临时密码字段 | 真实凭证策略、显示与安全验收另行处理。 |
| PlatformAccountDialogs.vue / userForm.platform_role_code | P40新建用户的平台角色选择 | 本地显示不证明服务端角色授权。 |
| PlatformAccountDialogs.vue / userForm.organization_id | P40新建用户的组织归属选择 | 真实组织范围及后端归属另验。 |
| PlatformAccountDialogs.vue / userForm.organization_role_code | P40新建用户的组织角色选择 | 写入和权限验收仍未完成。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformAccountDirectoryWorkspace.vue / ResponsiveFilterDrawer.1 / p40-mobile-filter | responsive-filter / related-scene-only | [filter · 1440](design/platform-organizations-direction-c/1440-filter.png) / [filter · 390](design/platform-organizations-direction-c/390-filter.png) | 真实软键盘、完整焦点循环和用户取消草稿仍待验。 |
| PlatformAccountDirectoryWorkspace.vue / form.1 / p40-organization-filter-form | form-container / matching-inline-form-scene | [filter · 1440](design/platform-organizations-direction-c/1440-filter.png) / [filter · 390](design/platform-organizations-direction-c/390-filter.png) | 真实输入法、服务端边界与读屏逐字段验收仍待办。 |
| PlatformAccountGlobalRail.vue / aside.1 / p40-platform-directory-rail | inline-aside / related-scene-only | [list · 1440](design/platform-organizations-direction-c/1440-list.png) / [list · 390](design/platform-organizations-direction-c/390-list.png) | 真实platform:superadmin授权与跨路由返回另验。 |
| PlatformOrganizationRecords.vue / ResponsiveDataView.1 / p40-mobile-organization-preview | responsive-row-detail / matching-dialog-scene | [preview · 1440](design/platform-organizations-direction-c/1440-preview.png) / [preview · 390](design/platform-organizations-direction-c/390-preview.png) | 这里只核对P40记录和预览入口，不代替完整返回/KeepAlive。 |
| PlatformAccountDialogs.vue / dialog.1 / p40-create-user-dialog | native-dialog / matching-dialog-scene | [create_user · 1440](design/account-overview-direction-c/1440-create_user.png) / [create_user · 390](design/account-overview-direction-c/390-create_user.png) | 完整表单验证、真实POST、失败恢复和生产授权仍待验。 |
| PlatformAccountDialogs.vue / form.1 / p40-create-user-form | form-container / matching-inline-form-scene | [create_user · 1440](design/account-overview-direction-c/1440-create_user.png) / [create_user · 390](design/account-overview-direction-c/390-create_user.png) | 字段边界、原生校验与真实权限结果另验。 |

### 明确保留的边界

- 此文件对P40五个真实Vue源码作逐候选登记；过滤和记录六态尚未逐控件绑定到实际截图。
- 新建用户弹窗证据是本地fixture/入口交互，不等于真实账户POST、角色授权或生产数据验收。
- P41/P42/P43/P44与共享组件剩余消费者独立审阅，不由P40的条件排除或局部页面覆盖。
- 共享ResponsiveFilterDrawer与ResponsiveDataView在P40只作消费者形态登记；焦点返回、软键盘、读屏及所有其他调用方未由此关闭。
- PlatformAccountDialogs中的密码重置和共享原因窗按P43/P42条件排除；本页只纳入新建用户分支。
- 全局壳、真实RBAC/MySQL、写入审计、服务端错误与生产验收均与本地候选映射分开。

## P41 局部动作与共享消费者

[逐项机器清单](action-reviews/P41.json)：25个局部源位置 → 9组；1类写入，6组路由动作，2组转发/容器关联不重复计动作。已映射3/5个源码字段位置，3/3处调用/内嵌容器，3个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有36个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA41-OPEN 从组织目录页头进入新建组织向导 / navigation | 1处；organization-header-entry | [create · 1440](design/platform-organizations-direction-c/1440-create.png) / [create · 390](design/platform-organizations-direction-c/390-create.png)；其余见JSON | 路由入口验证不代表P41真实组织创建、角色授权或数据库事务通过。 |
| PA41-NEXT 校验组织资料并进入管理员确认 / local | 1处；valid-inputs、invalid-inputs | [create_filled · 1440](design/platform-organizations-direction-c/1440-create_filled.png) / [create_filled · 390](design/platform-organizations-direction-c/390-create_filled.png)、[create_invalid · 1440](design/platform-organizations-direction-c/1440-create_invalid.png) / [create_invalid · 390](design/platform-organizations-direction-c/390-create_invalid.png)；其余见JSON | 原生校验和本地夹具不代表所有浏览器/输入法与读屏实测。 |
| PA41-BACK 返回组织资料步骤 / local | 1处；back-from-confirmation | [create_confirm · 1440](design/platform-organizations-direction-c/1440-create_confirm.png) / [create_confirm · 390](design/platform-organizations-direction-c/390-create_confirm.png)、[create_filled · 1440](design/platform-organizations-direction-c/1440-create_filled.png) / [create_filled · 390](design/platform-organizations-direction-c/390-create_filled.png)；其余见JSON | 父表单保留草稿是当前既有行为；导航重入与真实写入事务另验。 |
| PA41-CANCEL 取消向导并返回组织目录 / local | 2处；explicit-cancel、native-escape | [create · 1440](design/platform-organizations-direction-c/1440-create.png) / [create · 390](design/platform-organizations-direction-c/390-create.png)、[create_admin · 1440](design/platform-organizations-direction-c/1440-create_admin.png) / [create_admin · 390](design/platform-organizations-direction-c/390-create_admin.png)；其余见JSON | 取消不会撤销已发请求；真实离页与浏览器历史语义按写入归属测试核验。 |
| PA41-CURRENT-INPUT 编辑组织资料/首位管理员并清除旧错误 / local | 3处；name、slug、initial-admin-user | [create_filled · 1440](design/platform-organizations-direction-c/1440-create_filled.png) / [create_filled · 390](design/platform-organizations-direction-c/390-create_filled.png)、[create_admin · 1440](design/platform-organizations-direction-c/1440-create_admin.png) / [create_admin · 390](design/platform-organizations-direction-c/390-create_admin.png)；其余见JSON | 管理员候选只来自当前账号概览返回的数据，不扩大为全库查询或授权确认。 |
| PA41-CREATE 确认并创建组织及默认工作区 / write | 2处；default-superadmin、selected-active-admin、busy、failure-retry、success-route-to-detail | [create_confirm · 1440](design/platform-organizations-direction-c/1440-create_confirm.png) / [create_confirm · 390](design/platform-organizations-direction-c/390-create_confirm.png)、[create_busy · 1440](design/platform-organizations-direction-c/1440-create_busy.png) / [create_busy · 390](design/platform-organizations-direction-c/390-create_busy.png)；其余见JSON | 测试使用隔离拦截；不证明真实MySQL原子性、真实RBAC、审计或M07-03生产签收。 |
| PA41-DIALOG-CONTAINER P41 原生向导容器与本地动作归属 / wiring | 1处；two-step-native-dialog | [create · 1440](design/platform-organizations-direction-c/1440-create.png) / [create · 390](design/platform-organizations-direction-c/390-create.png)；其余见JSON | 容器与实际App的一般读屏/全部浏览器原生dialog行为另验。 |
| PA41-WIZARD-WIRING 父级接管向导字段错误、关闭与提交事件 / wiring | 1处；clear-error、close、submit | [create_confirm · 1440](design/platform-organizations-direction-c/1440-create_confirm.png) / [create_confirm · 390](design/platform-organizations-direction-c/390-create_confirm.png)；其余见JSON | 父级事务是否成功仍由隔离测试之外的服务端合同验收。 |
| PA41-EXCLUDED-OTHER-CENTER-ACTIONS 同一父组件中的非P41目录、详情和共享动作 / excluded | 13处；P39-account-overview、P40-organization-list、P42-organization-detail、P43-user-detail、P44-admin-detail、P45-role-center | ；其余见JSON | 显式排除仅界定P41，不代表这些其他页面的动作或权限/生命周期完成验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA41-DIALOG-CONTAINER | 容器定义，无额外事件 | PA41-BACK、PA41-CANCEL、PA41-CREATE、PA41-CURRENT-INPUT、PA41-NEXT |
| PA41-WIZARD-WIRING | @clear-error / createError = '' | PA41-CURRENT-INPUT |
| PA41-WIZARD-WIRING | @close / closeOrganizationWizard | PA41-CANCEL |
| PA41-WIZARD-WIRING | @submit / createOrganization | PA41-CREATE |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| OrganizationCreationWizard.vue / form.name | 组织名称，父级表单模型保留创建草稿 | 原生长度/必填约束保留；真实写入由既有父级服务合同另验。 |
| OrganizationCreationWizard.vue / form.slug | 组织标识，沿用当前小写字母/数字/连字符原生模式 | 保持当前允许尾部连字符的真实规则，不推断为严格slug校验或完整服务端IANA/字符策略。 |
| OrganizationCreationWizard.vue / form.initial_admin_user_id | 可选首位管理员，空值继续由当前操作者作为默认管理员 | 选项来自当前概览用户集合且禁用非active项，不等于全库查询或后端授权结果。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| OrganizationCreationWizard.vue / dialog.1 / p41-two-step-wizard | native-dialog / matching-dialog-scene | [create · 1440](design/platform-organizations-direction-c/1440-create.png) / [create · 390](design/platform-organizations-direction-c/390-create.png) | 直接URL初始焦点、Escape/返回焦点与真实App缓存导航单独核验。 |
| OrganizationCreationWizard.vue / form.1 / p41-profile-and-final-confirmation | form-container / matching-inline-form-scene | [create_confirm · 1440](design/platform-organizations-direction-c/1440-create_confirm.png) / [create_confirm · 390](design/platform-organizations-direction-c/390-create_confirm.png) | 浏览器约束验证和真实MySQL原子性分开验收。 |
| OrganizationCreationWizard.vue / aside.1 / p41-identity-and-step-context | inline-aside / related-scene-only | [create · 1440](design/platform-organizations-direction-c/1440-create.png) / [create · 390](design/platform-organizations-direction-c/390-create.png) | 视觉授权不代替主题、密度、200%缩放与实际读屏验收。 |

### 明确保留的边界

- P41源动作已逐候选分类；全部可见按钮hover/focus/pressed/disabled/busy仍未逐控件绑定到具体状态图。
- 桌面/手机C稿按用户统一授权自动通过，不代表直接深链、完整浏览器历史或真实管理员授权通过。
- 生产隔离夹具没有创建真实组织、默认工作区或管理员关系。
- 父级PlatformAccountCenter共享其他路由控制已逐候选排除；不代表P39/P40/P42/P43/P44/P45全页审阅完成。
- P41组织创建事务继续由原createOrganization与现有API拥有；本映射不授权真实生产业务写入。
- 全局壳、真实RBAC/MySQL、事务审计与正式M07-03保持独立验收。

## P42 局部动作与共享消费者

[逐项机器清单](action-reviews/P42.json)：45个局部源位置 → 14组；2类写入，9组路由动作，3组转发/容器关联不重复计动作。已映射3/11个源码字段位置，5/10处调用/内嵌容器，5个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有54个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA42-CLOSE 关闭组织详情并返回组织目录 / local | 4处；native-escape、missing-return、header-close、footer-close | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_missing · 1440](design/platform-organizations-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/platform-organizations-direction-c/390-detail_missing.png)；其余见JSON | 路由回退/焦点返回的真实浏览器行为不由静态动作归属证明。 |
| PA42-RETRY 重新读取组织概览以恢复缺失或过期快照 / local | 2处；missing-reload、post-write-refresh-retry | [detail_missing · 1440](design/platform-organizations-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/platform-organizations-direction-c/390-detail_missing.png)、[refresh_error · 1440](design/platform-organizations-direction-c/1440-refresh_error.png) / [refresh_error · 390](design/platform-organizations-direction-c/390-refresh_error.png)；其余见JSON | 本地拦截验证不证明服务端权限、真实概览完整性或数据库状态。 |
| PA42-INPUT 编辑组织名称、时区和数据保留天数并清除旧反馈 / local | 3处；name、timezone、data-retention-days | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_invalid · 1440](design/platform-organizations-direction-c/1440-detail_invalid.png) / [detail_invalid · 390](design/platform-organizations-direction-c/390-detail_invalid.png)；其余见JSON | 字段原生约束沿用当前合同；本映射不扩大服务端校验规则。 |
| PA42-SAVE 提交组织资料更新 / write | 2处；valid-submit、invalid-submit、busy、failure、write-success-refresh-warning、success-refresh | [detail_invalid · 1440](design/platform-organizations-direction-c/1440-detail_invalid.png) / [detail_invalid · 390](design/platform-organizations-direction-c/390-detail_invalid.png)、[save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)；其余见JSON | 既有隔离请求测试不等于真实MySQL原子性、RBAC、审计或M07-03验收。 |
| PA42-TECH 展开组织slug和UUID技术详情 / local | 1处；collapsed、expanded | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_technical · 1440](design/platform-organizations-direction-c/1440-detail_technical.png) / [detail_technical · 390](design/platform-organizations-direction-c/390-detail_technical.png)；其余见JSON | 原生details跨浏览器与读屏体验尚未做完整设备验收。 |
| PA42-STATUS 选择停用或恢复组织并打开原因确认 / local | 1处；active-to-disable、inactive-to-restore、busy | [disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)、[restore_reason · 1440](design/platform-organizations-direction-c/1440-restore_reason.png) / [restore_reason · 390](design/platform-organizations-direction-c/390-restore_reason.png)；其余见JSON | 选择目标本身不写状态；实际RBAC及服务端状态转换另验。 |
| PA42-REASON-INPUT 编辑组织操作审计原因 / local | 1处；edit-reason、required-minlength、maxlength-300 | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)；其余见JSON | 本项仅记录共享原因窗在P42链路上的输入，不扩大原有原因长度或审计策略。 |
| PA42-REASON-CANCEL 取消组织操作原因确认 / local | 1处；native-escape、cancel-button | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)；其余见JSON | 取消行为不代表写入请求已经提交或回滚。 |
| PA42-REASON-SUBMIT 确认原因并继续组织资料或状态操作 / write | 2处；valid-confirm、invalid-reason、busy、write-failure、write-success | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)；其余见JSON | 隔离验证不等于真实API、MySQL事务、生产权限、审计持久化或正式验收。 |
| PA42-DETAIL-WIRING 组织详情子组件事件由父级接管 / wiring | 2处；close、retry、clear-feedback、save、toggle-status | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)；其余见JSON | 事件映射不代替各处理器的服务端/权限验收。 |
| PA42-DIALOG-CONTAINERS P42详情与共享原因原生窗口容器 / wiring | 2处；organization-detail-dialog、shared-reason-dialog | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)；其余见JSON | 容器结构映射不代替所有浏览器原生dialog、焦点和读屏验收。 |
| PA42-REASON-WIRING 父级为共享原因窗接入P42原因草稿与操作处理 / wiring | 3处；reason-cancel、reason-submit、reason-input、shared-user-and-password-excluded | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)；其余见JSON | 共享弹窗复用不将P43用户创建/密码重置并入P42，也不证明真实审计写入。 |
| PA42-EXCLUDED-CENTER 父组件内与P42详情无关的目录、角色、用户及其他页面事件 / excluded | 11处；P39、P40、P41、P43、P45 | ；其余见JSON | 排除只界定P42，不替代对应页面动作验收。 |
| PA42-EXCLUDED-DIALOGS 共享账号新建和密码重置弹窗不属于P42 / excluded | 10处；create-user-dialog、reset-password-dialog | ；其余见JSON | P43操作的独立页面映射/权限/审计验收不由本项完成。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA42-DETAIL-WIRING | @close / closeOrganizationDetail | PA42-CLOSE |
| PA42-DETAIL-WIRING | @retry / retryOrganizationRead | PA42-RETRY |
| PA42-DETAIL-WIRING | @clear-feedback / clearOrganizationFeedback | PA42-INPUT |
| PA42-DETAIL-WIRING | @save / updateOrganization | PA42-SAVE |
| PA42-DETAIL-WIRING | @toggle-status / toggleOrganization | PA42-STATUS |
| PA42-DETAIL-WIRING | @close / closeOrganizationDetail | PA42-CLOSE |
| PA42-DETAIL-WIRING | @retry / retryOrganizationRead | PA42-RETRY |
| PA42-DETAIL-WIRING | @clear-feedback / clearOrganizationFeedback | PA42-INPUT |
| PA42-DETAIL-WIRING | @save / updateOrganization | PA42-SAVE |
| PA42-DETAIL-WIRING | @toggle-status / toggleOrganization | PA42-STATUS |
| PA42-DIALOG-CONTAINERS | 容器定义，无额外事件 | PA42-CLOSE、PA42-RETRY、PA42-INPUT、PA42-SAVE、PA42-TECH、PA42-STATUS、PA42-REASON-INPUT、PA42-REASON-CANCEL、PA42-REASON-SUBMIT |
| PA42-REASON-WIRING | @close-create-user / closeCreateUser | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @create-user / createUser | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @close-password / closePassword | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @reset-password / resetPassword | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @close-reason / cancelReason | PA42-REASON-CANCEL |
| PA42-REASON-WIRING | @submit-reason / submitReason | PA42-REASON-SUBMIT |
| PA42-REASON-WIRING | @update:reason-text / reasonText = $event | PA42-REASON-INPUT |
| PA42-REASON-WIRING | @close-create-user / closeCreateUser | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @create-user / createUser | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @close-password / closePassword | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @reset-password / resetPassword | PA42-EXCLUDED-DIALOGS |
| PA42-REASON-WIRING | @close-reason / cancelReason | PA42-REASON-CANCEL |
| PA42-REASON-WIRING | @submit-reason / submitReason | PA42-REASON-SUBMIT |
| PA42-REASON-WIRING | @update:reason-text / reasonText = $event | PA42-REASON-INPUT |
| PA42-REASON-WIRING | @cancel / handleReasonCancel | PA42-REASON-CANCEL |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformOrganizationDetailDialog.vue / form.name | 组织显示名称草稿 | 沿用已有必填和长度约束；不推断额外服务端规则。 |
| PlatformOrganizationDetailDialog.vue / form.timezone | 组织时区草稿 | 沿用必填与长度约束；服务端合同仍是最终校验依据。 |
| PlatformOrganizationDetailDialog.vue / form.data_retention_days | 组织数据保留天数草稿 | 控件显示30–3650整数范围；不扩大持久化规则。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformOrganizationDetailDialog.vue / dialog.1 / p42-detail-dialog | native-dialog / matching-dialog-scene | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_missing · 1440](design/platform-organizations-direction-c/1440-detail_missing.png) / [detail_missing · 390](design/platform-organizations-direction-c/390-detail_missing.png) | 完整App缓存导航和真实组织权限未由局部图证明。 |
| PlatformOrganizationDetailDialog.vue / aside.1 / p42-identity-facts | inline-aside / related-scene-only | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_unknown · 1440](design/platform-organizations-direction-c/1440-detail_unknown.png) / [detail_unknown · 390](design/platform-organizations-direction-c/390-detail_unknown.png) | 示例状态不证明生产组织数据完整性。 |
| PlatformOrganizationDetailDialog.vue / form.1 / p42-profile-and-save | form-container / matching-inline-form-scene | [detail · 1440](design/platform-organizations-direction-c/1440-detail.png) / [detail · 390](design/platform-organizations-direction-c/390-detail.png)、[detail_invalid · 1440](design/platform-organizations-direction-c/1440-detail_invalid.png) / [detail_invalid · 390](design/platform-organizations-direction-c/390-detail_invalid.png)、[save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png) | 拦截请求与真实MySQL提交保持不同验收层。 |
| PlatformAccountDialogs.vue / dialog.3 / p42-audited-reason-dialog | native-dialog / matching-dialog-scene | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)、[restore_reason · 1440](design/platform-organizations-direction-c/1440-restore_reason.png) / [restore_reason · 390](design/platform-organizations-direction-c/390-restore_reason.png) | 本地构图不证明生产审计日志已持久化。 |
| PlatformAccountDialogs.vue / form.3 / p42-reason-form | form-container / matching-inline-form-scene | [save_reason · 1440](design/platform-organizations-direction-c/1440-save_reason.png) / [save_reason · 390](design/platform-organizations-direction-c/390-save_reason.png)、[disable_reason · 1440](design/platform-organizations-direction-c/1440-disable_reason.png) / [disable_reason · 390](design/platform-organizations-direction-c/390-disable_reason.png)、[restore_reason · 1440](design/platform-organizations-direction-c/1440-restore_reason.png) / [restore_reason · 390](design/platform-organizations-direction-c/390-restore_reason.png)、[reason_invalid · 1440](design/platform-organizations-direction-c/1440-reason_invalid.png) / [reason_invalid · 390](design/platform-organizations-direction-c/390-reason_invalid.png) | 模拟确认不代表生产端审计持久化。 |

### 明确保留的边界

- 动作映射只登记当前源码候选及语义归属，不证明所有按钮状态、弹窗变体或完整浏览器交互均已验收。
- 用户视觉自动通过与actionApproval分开；本页动作审核仍待用户确认。
- 本地隔离回归不证明真实RBAC、MySQL写入、审计持久化或正式M07-03生产验收。
- 父级PlatformAccountCenter仍承载P39/P40/P41/P42/P43/P45；本动作映射只接收P42组织详情及其原因链路。
- 共享用户创建/密码重置窗口明确作为P43排除；其可视DOM复用不代表P42可达。
- 视觉自动通过、动作映射与真实生产RBAC/MySQL/审计/M07-03验收是独立结论。

## P43 局部动作与共享消费者

[逐项机器清单](action-reviews/P43.json)：67个局部源位置 → 39组；3类写入，27组路由动作，5组转发/容器关联不重复计动作。已映射11/17个源码字段位置，12/12处调用/内嵌容器，12个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有156个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA43-OUT-ADMINS 权限管理入口（仅P45可达） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-ROLE-REFRESH 角色目录读取入口（仅P45可达） / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-ORG-CREATE 组织创建入口（归P41） / excluded | 2处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-CREATE-OPEN 打开新建用户窗 / local | 1处；open、busy | [users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)、[users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-REFRESH 读取或刷新用户目录 / read | 2处；initial、manual-refresh、retry | [users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)、[users--error · 1440](design/user-admin-direction-c/1440-users--error.png) / [users--error · 390](design/user-admin-direction-c/390-users--error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-WORKSPACE-WIRING 目录子组件到父级的事件接线 / wiring | 1处；filters、reset、load、open-user | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)、[users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-WIZARD 组织创建向导事件（归P41） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DIALOGS-WIRING 创建、改密与原因窗父子接线 / wiring | 2处；create、password、reason | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-ORG-DETAIL 组织详情事件（归P42） / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-WIRING 用户详情事件父级接线 / wiring | 2处；close、retry、status、role、membership、password、session | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-NAVIGATION 账号工作区二级导航 / navigation | 3处；organizations、users、admins | [users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-ORG-REFRESH 组织记录刷新（归P40） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-FILTER-DRAWER 移动端筛选抽屉容器 / local | 1处；closed、open | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-FILTER 提交邮箱/组织/状态筛选 / read | 2处；submit、empty | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)、[users--filtered_empty · 1440](design/user-admin-direction-c/1440-users--filtered_empty.png) / [users--filtered_empty · 390](design/user-admin-direction-c/390-users--filtered_empty.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-RESET 清除用户筛选 / local | 2处；toolbar、filtered-empty | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)、[users--filtered_empty · 1440](design/user-admin-direction-c/1440-users--filtered_empty.png) / [users--filtered_empty · 390](design/user-admin-direction-c/390-users--filtered_empty.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OUT-ADMIN-FILTER 管理员筛选/创建（归P44） / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-ROW-WIRING 用户记录打开详情事件 / wiring | 1处；desktop-row、mobile-row | [users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-OPEN-DETAIL 打开账号详情 / read | 2处；desktop、mobile-preview-to-detail | [users--list · 1440](design/user-admin-direction-c/1440-users--list.png) / [users--list · 390](design/user-admin-direction-c/390-users--list.png)、[users--preview · 1440](design/user-admin-direction-c/1440-users--preview.png) / [users--preview · 390](design/user-admin-direction-c/390-users--preview.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-TECH 展开用户技术标识 / local | 1处；collapsed、expanded | [users--preview · 1440](design/user-admin-direction-c/1440-users--preview.png) / [users--preview · 390](design/user-admin-direction-c/390-users--preview.png)、[users--technical · 1440](design/user-admin-direction-c/1440-users--technical.png) / [users--technical · 390](design/user-admin-direction-c/390-users--technical.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-CONTAINER 账号详情原生窗口 / local | 1处；loading、ready、error | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--detail_loading · 1440](design/user-admin-direction-c/1440-users--detail_loading.png) / [users--detail_loading · 390](design/user-admin-direction-c/390-users--detail_loading.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-CLOSE 关闭账号详情 / local | 4处；escape、header、footer、error | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--detail_error · 1440](design/user-admin-direction-c/1440-users--detail_error.png) / [users--detail_error · 390](design/user-admin-direction-c/390-users--detail_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-SECTION 详情内跳转分区 / local | 3处；memberships、roles、security | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--memberships · 1440](design/user-admin-direction-c/1440-users--memberships.png) / [users--memberships · 390](design/user-admin-direction-c/390-users--memberships.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-DETAIL-RETRY 重试读取账号详情 / read | 1处；retry、loading、success | [users--detail_error · 1440](design/user-admin-direction-c/1440-users--detail_error.png) / [users--detail_error · 390](design/user-admin-direction-c/390-users--detail_error.png)、[users--detail_loading · 1440](design/user-admin-direction-c/1440-users--detail_loading.png) / [users--detail_loading · 390](design/user-admin-direction-c/390-users--detail_loading.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-MEMBERSHIP-WIRING 详情转发加入组织表单提交 / wiring | 1处；valid、error | [users--memberships · 1440](design/user-admin-direction-c/1440-users--memberships.png) / [users--memberships · 390](design/user-admin-direction-c/390-users--memberships.png)、[users--membership_error · 1440](design/user-admin-direction-c/1440-users--membership_error.png) / [users--membership_error · 390](design/user-admin-direction-c/390-users--membership_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-MEMBERSHIP-SUBMIT 提交加入组织意图 / write | 2处；valid、invalid、busy、failure | [users--memberships · 1440](design/user-admin-direction-c/1440-users--memberships.png) / [users--memberships · 390](design/user-admin-direction-c/390-users--memberships.png)、[users--membership_error · 1440](design/user-admin-direction-c/1440-users--membership_error.png) / [users--membership_error · 390](design/user-admin-direction-c/390-users--membership_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-ROLE-CHOOSE 选择固定平台角色授予或撤销 / local | 1处；grant、revoke、inactive-disabled、self-protection | [users--roles · 1440](design/user-admin-direction-c/1440-users--roles.png) / [users--roles · 390](design/user-admin-direction-c/390-users--roles.png)、[users--disabled_roles · 1440](design/user-admin-direction-c/1440-users--disabled_roles.png) / [users--disabled_roles · 390](design/user-admin-direction-c/390-users--disabled_roles.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-SESSION-CHOOSE 选择撤销单个或全部会话 / local | 2处；single、all、none、expired | [users--security · 1440](design/user-admin-direction-c/1440-users--security.png) / [users--security · 390](design/user-admin-direction-c/390-users--security.png)、[users--no_sessions · 1440](design/user-admin-direction-c/1440-users--no_sessions.png) / [users--no_sessions · 390](design/user-admin-direction-c/390-users--no_sessions.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-STATUS-CHOOSE 选择停用或恢复账号登录 / local | 1处；active-to-disabled、disabled-to-active、self-protection | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--disabled · 1440](design/user-admin-direction-c/1440-users--disabled.png) / [users--disabled · 390](design/user-admin-direction-c/390-users--disabled.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-PASSWORD-OPEN 打开强制改密窗 / local | 1处；open、cancel | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-CREATE-CONTAINER 新建用户原生窗口 / local | 1处；default、organization-selected、error | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--create_org · 1440](design/user-admin-direction-c/1440-users--create_org.png) / [users--create_org · 390](design/user-admin-direction-c/390-users--create_org.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-CREATE-CANCEL 取消新建用户 / local | 2处；escape、button | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--create_error · 1440](design/user-admin-direction-c/1440-users--create_error.png) / [users--create_error · 390](design/user-admin-direction-c/390-users--create_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-CREATE-SUBMIT 提交新建用户 / write | 2处；valid、invalid、busy、failure、success | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--create_org · 1440](design/user-admin-direction-c/1440-users--create_org.png) / [users--create_org · 390](design/user-admin-direction-c/390-users--create_org.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-PASSWORD-CONTAINER 强制改密原生窗口 / local | 1处；default、invalid、error | [users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)、[users--password_invalid · 1440](design/user-admin-direction-c/1440-users--password_invalid.png) / [users--password_invalid · 390](design/user-admin-direction-c/390-users--password_invalid.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-PASSWORD-CANCEL 取消强制改密 / local | 2处；escape、button | [users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)、[users--password_error · 1440](design/user-admin-direction-c/1440-users--password_error.png) / [users--password_error · 390](design/user-admin-direction-c/390-users--password_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-PASSWORD-SUBMIT 确认临时密码并进入原因确认 / local | 2处；valid、invalid、reason-step | [users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)、[users--password_invalid · 1440](design/user-admin-direction-c/1440-users--password_invalid.png) / [users--password_invalid · 390](design/user-admin-direction-c/390-users--password_invalid.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-REASON-CONTAINER 共享原因原生窗口 / local | 1处；11-operation-variants、invalid | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_restore · 1440](design/user-admin-direction-c/1440-users--reason_restore.png) / [users--reason_restore · 390](design/user-admin-direction-c/390-users--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-REASON-CANCEL 取消原因确认 / local | 2处；escape、button | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_restore · 1440](design/user-admin-direction-c/1440-users--reason_restore.png) / [users--reason_restore · 390](design/user-admin-direction-c/390-users--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-REASON-INPUT 编辑操作原因 / local | 1处；edit、required、minlength、maxlength | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_reset_password · 1440](design/user-admin-direction-c/1440-users--reason_reset_password.png) / [users--reason_reset_password · 390](design/user-admin-direction-c/390-users--reason_reset_password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA43-REASON-SUBMIT 确认原因并执行已选操作 / write | 2处；valid、invalid、busy、failure、write-success-read-warning、success | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_restore · 1440](design/user-admin-direction-c/1440-users--reason_restore.png) / [users--reason_restore · 390](design/user-admin-direction-c/390-users--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA43-WORKSPACE-WIRING | @apply-filters / applyFilters | PA43-FILTER |
| PA43-WORKSPACE-WIRING | @reset-filters / resetFilters | PA43-RESET |
| PA43-WORKSPACE-WIRING | @load / load | PA43-REFRESH |
| PA43-WORKSPACE-WIRING | @create-organization / openOrganizationWizard | PA43-OUT-ORG-CREATE |
| PA43-WORKSPACE-WIRING | @create-admin / openCreateUser(true) | PA43-OUT-ADMIN-FILTER |
| PA43-WORKSPACE-WIRING | @open-organization / openOrganization | PA43-OUT-ORG-DETAIL |
| PA43-WORKSPACE-WIRING | @open-user / openUserDetail | PA43-OPEN-DETAIL |
| PA43-DIALOGS-WIRING | @close-create-user / closeCreateUser | PA43-CREATE-CANCEL |
| PA43-DIALOGS-WIRING | @create-user / createUser | PA43-CREATE-SUBMIT |
| PA43-DIALOGS-WIRING | @close-password / closePassword | PA43-PASSWORD-CANCEL |
| PA43-DIALOGS-WIRING | @reset-password / resetPassword | PA43-PASSWORD-SUBMIT |
| PA43-DIALOGS-WIRING | @close-reason / cancelReason | PA43-REASON-CANCEL |
| PA43-DIALOGS-WIRING | @submit-reason / submitReason | PA43-REASON-SUBMIT |
| PA43-DIALOGS-WIRING | @update:reason-text / reasonText = $event | PA43-REASON-INPUT |
| PA43-DIALOGS-WIRING | @close-create-user / closeCreateUser | PA43-CREATE-CANCEL |
| PA43-DIALOGS-WIRING | @create-user / createUser | PA43-CREATE-SUBMIT |
| PA43-DIALOGS-WIRING | @close-password / closePassword | PA43-PASSWORD-CANCEL |
| PA43-DIALOGS-WIRING | @reset-password / resetPassword | PA43-PASSWORD-SUBMIT |
| PA43-DIALOGS-WIRING | @close-reason / cancelReason | PA43-REASON-CANCEL |
| PA43-DIALOGS-WIRING | @submit-reason / submitReason | PA43-REASON-SUBMIT |
| PA43-DIALOGS-WIRING | @update:reason-text / reasonText = $event | PA43-REASON-INPUT |
| PA43-DETAIL-WIRING | @close / closeUserDetail | PA43-DETAIL-CLOSE |
| PA43-DETAIL-WIRING | @retry / selected && openUserDetail(selected) | PA43-DETAIL-RETRY |
| PA43-DETAIL-WIRING | @toggle-status / toggleUser | PA43-STATUS-CHOOSE |
| PA43-DETAIL-WIRING | @role / role | PA43-ROLE-CHOOSE |
| PA43-DETAIL-WIRING | @add-membership / addMembership | PA43-MEMBERSHIP-SUBMIT |
| PA43-DETAIL-WIRING | @reset-password / openPassword | PA43-PASSWORD-OPEN |
| PA43-DETAIL-WIRING | @revoke-sessions / revokeSessions | PA43-SESSION-CHOOSE |
| PA43-DETAIL-WIRING | @close / closeUserDetail | PA43-DETAIL-CLOSE |
| PA43-DETAIL-WIRING | @retry / selected && openUserDetail(selected) | PA43-DETAIL-RETRY |
| PA43-DETAIL-WIRING | @toggle-status / toggleUser | PA43-STATUS-CHOOSE |
| PA43-DETAIL-WIRING | @role / role | PA43-ROLE-CHOOSE |
| PA43-DETAIL-WIRING | @add-membership / addMembership | PA43-MEMBERSHIP-SUBMIT |
| PA43-DETAIL-WIRING | @reset-password / openPassword | PA43-PASSWORD-OPEN |
| PA43-DETAIL-WIRING | @revoke-sessions / revokeSessions | PA43-SESSION-CHOOSE |
| PA43-DETAIL-ROW-WIRING | @open-user / emit('open-user', $event) | PA43-OPEN-DETAIL |
| PA43-MEMBERSHIP-WIRING | @submit / $emit('addMembership', selected.id, $event) | PA43-MEMBERSHIP-SUBMIT |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformAccountCenter.vue / query | 用户目录邮箱/组织关键词草稿 | 沿用现有URL同步和长度截断，不增设查询条件。 |
| PlatformAccountCenter.vue / status | 用户账号状态筛选草稿 | 只筛选账号状态，不混入角色权限。 |
| PlatformAccountDialogs.vue / userForm.email | 创建用户邮箱 | 继续现有必填和长度约束，由既有API校验最终确认。 |
| PlatformAccountDialogs.vue / userForm.temporary_password | 新用户临时密码 | 保持现有长度约束，不在本变更中扩展安全规则。 |
| PlatformAccountDialogs.vue / userForm.platform_role_code | 可选固定平台角色 | 仅使用当前普通用户和三种平台角色。 |
| PlatformAccountDialogs.vue / userForm.organization_id | 可选组织ID | 空值继续转null；不推导或补造组织数据。 |
| PlatformAccountDialogs.vue / userForm.organization_role_code | 组织初始角色 | 只在选择组织时按既有选项使用。 |
| PlatformAccountDialogs.vue / passwordForm.temporary_password | 强制重置的临时密码 | 关闭后敏感值清理仍列待修，不假设自动清理。 |
| PlatformUserMembershipForm.vue / form.organization_id | 目标组织ID | 仅从现有eligible组织项选择。 |
| PlatformUserMembershipForm.vue / form.role_code | 组织角色代码 | 只使用既有五种角色选项。 |
| PlatformUserMembershipForm.vue / form.reason | 加入组织审计原因 | 沿用既有2–300字符规则。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformAccountDirectoryWorkspace.vue / ResponsiveFilterDrawer.1 / p43-mobile-filter | responsive-filter / related-scene-only | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)、[users--filtered_empty · 1440](design/user-admin-direction-c/1440-users--filtered_empty.png) / [users--filtered_empty · 390](design/user-admin-direction-c/390-users--filtered_empty.png) | 图稿代表用户筛选区域，不表示所有其他页面消费者。 |
| PlatformAccountDirectoryWorkspace.vue / form.1 / p43-user-filter-form | form-container / matching-inline-form-scene | [users--filter · 1440](design/user-admin-direction-c/1440-users--filter.png) / [users--filter · 390](design/user-admin-direction-c/390-users--filter.png)、[users--filtered_empty · 1440](design/user-admin-direction-c/1440-users--filtered_empty.png) / [users--filtered_empty · 390](design/user-admin-direction-c/390-users--filtered_empty.png) | 查询行为需以父级与当前GET合同为准。 |
| PlatformUserRecords.vue / ResponsiveDataView.1 / p43-user-mobile-preview | responsive-row-detail / related-scene-only | [users--preview · 1440](design/user-admin-direction-c/1440-users--preview.png) / [users--preview · 390](design/user-admin-direction-c/390-users--preview.png)、[users--technical · 1440](design/user-admin-direction-c/1440-users--technical.png) / [users--technical · 390](design/user-admin-direction-c/390-users--technical.png) | 移动预览不是V组件的原生dialog实现。 |
| PlatformUserDetailDialog.vue / dialog.1 / p43-user-detail-dialog | native-dialog / matching-dialog-scene | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--detail_loading · 1440](design/user-admin-direction-c/1440-users--detail_loading.png) / [users--detail_loading · 390](design/user-admin-direction-c/390-users--detail_loading.png)、[users--detail_error · 1440](design/user-admin-direction-c/1440-users--detail_error.png) / [users--detail_error · 390](design/user-admin-direction-c/390-users--detail_error.png) | 加载、就绪、错误视图不代替真实权限验收。 |
| PlatformUserDetailDialog.vue / aside.1 / p43-user-identity-aside | inline-aside / related-scene-only | [users--detail · 1440](design/user-admin-direction-c/1440-users--detail.png) / [users--detail · 390](design/user-admin-direction-c/390-users--detail.png)、[users--memberships · 1440](design/user-admin-direction-c/1440-users--memberships.png) / [users--memberships · 390](design/user-admin-direction-c/390-users--memberships.png) | 样例身份不代表生产数据。 |
| PlatformUserMembershipForm.vue / form.1 / p43-membership-inline-form | form-container / matching-inline-form-scene | [users--memberships · 1440](design/user-admin-direction-c/1440-users--memberships.png) / [users--memberships · 390](design/user-admin-direction-c/390-users--memberships.png)、[users--membership_error · 1440](design/user-admin-direction-c/1440-users--membership_error.png) / [users--membership_error · 390](design/user-admin-direction-c/390-users--membership_error.png) | 真实POST与服务端拒绝状态另需生产证据。 |
| PlatformAccountDialogs.vue / dialog.1 / p43-create-user-dialog | native-dialog / matching-dialog-scene | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--create_org · 1440](design/user-admin-direction-c/1440-users--create_org.png) / [users--create_org · 390](design/user-admin-direction-c/390-users--create_org.png)、[users--create_error · 1440](design/user-admin-direction-c/1440-users--create_error.png) / [users--create_error · 390](design/user-admin-direction-c/390-users--create_error.png)、[users--create_busy · 1440](design/user-admin-direction-c/1440-users--create_busy.png) / [users--create_busy · 390](design/user-admin-direction-c/390-users--create_busy.png) | 隔离场景不证明真实创建或MFA策略。 |
| PlatformAccountDialogs.vue / form.1 / p43-create-user-form | form-container / matching-inline-form-scene | [users--create · 1440](design/user-admin-direction-c/1440-users--create.png) / [users--create · 390](design/user-admin-direction-c/390-users--create.png)、[users--create_org · 1440](design/user-admin-direction-c/1440-users--create_org.png) / [users--create_org · 390](design/user-admin-direction-c/390-users--create_org.png)、[users--create_error · 1440](design/user-admin-direction-c/1440-users--create_error.png) / [users--create_error · 390](design/user-admin-direction-c/390-users--create_error.png)、[users--create_busy · 1440](design/user-admin-direction-c/1440-users--create_busy.png) / [users--create_busy · 390](design/user-admin-direction-c/390-users--create_busy.png) | 真实重复邮箱冲突由服务器返回，不从原型推断。 |
| PlatformAccountDialogs.vue / dialog.2 / p43-password-dialog | native-dialog / matching-dialog-scene | [users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)、[users--password_invalid · 1440](design/user-admin-direction-c/1440-users--password_invalid.png) / [users--password_invalid · 390](design/user-admin-direction-c/390-users--password_invalid.png)、[users--password_error · 1440](design/user-admin-direction-c/1440-users--password_error.png) / [users--password_error · 390](design/user-admin-direction-c/390-users--password_error.png) | 隔离视觉和回执不证明内存清理或真实写入。 |
| PlatformAccountDialogs.vue / form.2 / p43-password-form | form-container / matching-inline-form-scene | [users--password · 1440](design/user-admin-direction-c/1440-users--password.png) / [users--password · 390](design/user-admin-direction-c/390-users--password.png)、[users--password_invalid · 1440](design/user-admin-direction-c/1440-users--password_invalid.png) / [users--password_invalid · 390](design/user-admin-direction-c/390-users--password_invalid.png)、[users--password_error · 1440](design/user-admin-direction-c/1440-users--password_error.png) / [users--password_error · 390](design/user-admin-direction-c/390-users--password_error.png) | 服务端安全策略和真实重置仍需独立验证。 |
| PlatformAccountDialogs.vue / dialog.3 / p43-shared-reason-dialog | native-dialog / matching-dialog-scene | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_restore · 1440](design/user-admin-direction-c/1440-users--reason_restore.png) / [users--reason_restore · 390](design/user-admin-direction-c/390-users--reason_restore.png)、[users--reason_grant_operations · 1440](design/user-admin-direction-c/1440-users--reason_grant_operations.png) / [users--reason_grant_operations · 390](design/user-admin-direction-c/390-users--reason_grant_operations.png)、[users--reason_revoke_operations · 1440](design/user-admin-direction-c/1440-users--reason_revoke_operations.png) / [users--reason_revoke_operations · 390](design/user-admin-direction-c/390-users--reason_revoke_operations.png)、[users--reason_grant_security · 1440](design/user-admin-direction-c/1440-users--reason_grant_security.png) / [users--reason_grant_security · 390](design/user-admin-direction-c/390-users--reason_grant_security.png)、[users--reason_revoke_security · 1440](design/user-admin-direction-c/1440-users--reason_revoke_security.png) / [users--reason_revoke_security · 390](design/user-admin-direction-c/390-users--reason_revoke_security.png)、[users--reason_grant_super · 1440](design/user-admin-direction-c/1440-users--reason_grant_super.png) / [users--reason_grant_super · 390](design/user-admin-direction-c/390-users--reason_grant_super.png)、[users--reason_revoke_super · 1440](design/user-admin-direction-c/1440-users--reason_revoke_super.png) / [users--reason_revoke_super · 390](design/user-admin-direction-c/390-users--reason_revoke_super.png)、[users--reason_session · 1440](design/user-admin-direction-c/1440-users--reason_session.png) / [users--reason_session · 390](design/user-admin-direction-c/390-users--reason_session.png)、[users--reason_sessions · 1440](design/user-admin-direction-c/1440-users--reason_sessions.png) / [users--reason_sessions · 390](design/user-admin-direction-c/390-users--reason_sessions.png)、[users--reason_reset_password · 1440](design/user-admin-direction-c/1440-users--reason_reset_password.png) / [users--reason_reset_password · 390](design/user-admin-direction-c/390-users--reason_reset_password.png)、[users--reason_invalid · 1440](design/user-admin-direction-c/1440-users--reason_invalid.png) / [users--reason_invalid · 390](design/user-admin-direction-c/390-users--reason_invalid.png) | 11类目标在图上呈现不等于全部服务器权限通过。 |
| PlatformAccountDialogs.vue / form.3 / p43-shared-reason-form | form-container / matching-inline-form-scene | [users--reason_disable · 1440](design/user-admin-direction-c/1440-users--reason_disable.png) / [users--reason_disable · 390](design/user-admin-direction-c/390-users--reason_disable.png)、[users--reason_restore · 1440](design/user-admin-direction-c/1440-users--reason_restore.png) / [users--reason_restore · 390](design/user-admin-direction-c/390-users--reason_restore.png)、[users--reason_grant_operations · 1440](design/user-admin-direction-c/1440-users--reason_grant_operations.png) / [users--reason_grant_operations · 390](design/user-admin-direction-c/390-users--reason_grant_operations.png)、[users--reason_revoke_operations · 1440](design/user-admin-direction-c/1440-users--reason_revoke_operations.png) / [users--reason_revoke_operations · 390](design/user-admin-direction-c/390-users--reason_revoke_operations.png)、[users--reason_grant_security · 1440](design/user-admin-direction-c/1440-users--reason_grant_security.png) / [users--reason_grant_security · 390](design/user-admin-direction-c/390-users--reason_grant_security.png)、[users--reason_revoke_security · 1440](design/user-admin-direction-c/1440-users--reason_revoke_security.png) / [users--reason_revoke_security · 390](design/user-admin-direction-c/390-users--reason_revoke_security.png)、[users--reason_grant_super · 1440](design/user-admin-direction-c/1440-users--reason_grant_super.png) / [users--reason_grant_super · 390](design/user-admin-direction-c/390-users--reason_grant_super.png)、[users--reason_revoke_super · 1440](design/user-admin-direction-c/1440-users--reason_revoke_super.png) / [users--reason_revoke_super · 390](design/user-admin-direction-c/390-users--reason_revoke_super.png)、[users--reason_session · 1440](design/user-admin-direction-c/1440-users--reason_session.png) / [users--reason_session · 390](design/user-admin-direction-c/390-users--reason_session.png)、[users--reason_sessions · 1440](design/user-admin-direction-c/1440-users--reason_sessions.png) / [users--reason_sessions · 390](design/user-admin-direction-c/390-users--reason_sessions.png)、[users--reason_reset_password · 1440](design/user-admin-direction-c/1440-users--reason_reset_password.png) / [users--reason_reset_password · 390](design/user-admin-direction-c/390-users--reason_reset_password.png)、[users--reason_invalid · 1440](design/user-admin-direction-c/1440-users--reason_invalid.png) / [users--reason_invalid · 390](design/user-admin-direction-c/390-users--reason_invalid.png) | 视觉/本地验证不代表真实审计日志持久化。 |

### 明确保留的边界

- 移动用户预览到账号详情、三路由共享父组件条件、四个原生dialog与11种原因目标仍需按真实App组合回归；静态候选和图稿不证明每条状态时序。
- 新建/密码回调的跨窗口归属与原因窗自动关闭仍按已有业务合同核验；创建/改密取消及成功清空前端临时密码已按实际Vue和定向单测实现。
- 所有图稿仅支持用户已授予的自动视觉通过；按钮六态、真实RBAC、MySQL写入、审计持久化、全站G0-G5与生产权限验收各自独立。
- 父级PlatformAccountCenter由P39–P45共享；本次只核对P43用户路由消费的工作区/详情/共享弹窗。
- ResponsiveDataView与ResponsiveFilterDrawer的其他页面调用、完整键盘/屏幕阅读器和触控设备验证仍需独立验收。
- 自动视觉批准、局部容器组合、动作审核与真实RBAC/MySQL/审计验收仍是不同证据层。

## P44 局部动作与共享消费者

[逐项机器清单](action-reviews/P44.json)：71个局部源位置 → 44组；3类写入，30组路由动作，5组转发/容器关联不重复计动作。已映射11/22个源码字段位置，0/13处调用/内嵌容器，0个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有186个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| PA44-OUT-ADMINS 权限管理入口（仅P45可达） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-ROLE-REFRESH 角色目录读取入口（仅P45可达） / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-ORG-CREATE 组织创建入口（归P41） / excluded | 2处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-CREATE-OPEN 打开新建管理员窗 / local | 1处；open、busy | [admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)、[admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-REFRESH 读取或刷新管理员目录 / read | 2处；initial、manual-refresh、retry | [admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)、[admins--error · 1440](design/user-admin-direction-c/1440-admins--error.png) / [admins--error · 390](design/user-admin-direction-c/390-admins--error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-WORKSPACE-WIRING 目录子组件到父级的事件接线 / wiring | 1处；filters、reset、load、open-user | [admins--filter · 1440](design/user-admin-direction-c/1440-admins--filter.png) / [admins--filter · 390](design/user-admin-direction-c/390-admins--filter.png)、[admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-WIZARD 组织创建向导事件（归P41） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DIALOGS-WIRING 创建、改密与原因窗父子接线 / wiring | 2处；create、password、reason | [admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)、[admins--password · 1440](design/user-admin-direction-c/1440-admins--password.png) / [admins--password · 390](design/user-admin-direction-c/390-admins--password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-ORG-DETAIL 组织详情事件（归P42） / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DETAIL-WIRING 管理员账号详情事件父级接线 / wiring | 2处；close、retry、status、role、membership、password、session | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--reason_disable · 1440](design/user-admin-direction-c/1440-admins--reason_disable.png) / [admins--reason_disable · 390](design/user-admin-direction-c/390-admins--reason_disable.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-NAVIGATION 管理员路由隐藏的工作区目录分支 / excluded | 3处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-ORG-REFRESH 组织记录刷新（归P40） / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-FILTER-DRAWER 移动端筛选抽屉容器 / local | 1处；closed、open | [admins--filter · 1440](design/user-admin-direction-c/1440-admins--filter.png) / [admins--filter · 390](design/user-admin-direction-c/390-admins--filter.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-FILTER 提交管理员邮箱/状态筛选 / read | 2处；submit、empty | [admins--filter · 1440](design/user-admin-direction-c/1440-admins--filter.png) / [admins--filter · 390](design/user-admin-direction-c/390-admins--filter.png)、[admins--filtered_empty · 1440](design/user-admin-direction-c/1440-admins--filtered_empty.png) / [admins--filtered_empty · 390](design/user-admin-direction-c/390-admins--filtered_empty.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-RESET 清除管理员筛选 / local | 1处；toolbar、filtered-empty | [admins--filter · 1440](design/user-admin-direction-c/1440-admins--filter.png) / [admins--filter · 390](design/user-admin-direction-c/390-admins--filter.png)、[admins--filtered_empty · 1440](design/user-admin-direction-c/1440-admins--filtered_empty.png) / [admins--filtered_empty · 390](design/user-admin-direction-c/390-admins--filtered_empty.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-USER-ROW-WIRING 管理员路由隐藏的用户记录事件分支 / excluded | 1处；route-specific-excluded | ；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OPEN-DETAIL 打开管理员账号详情 / read | 2处；desktop、mobile-preview-to-detail | [admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)、[admins--preview · 1440](design/user-admin-direction-c/1440-admins--preview.png) / [admins--preview · 390](design/user-admin-direction-c/390-admins--preview.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-TECH 展开管理员账号技术标识 / local | 1处；collapsed、expanded | [admins--preview · 1440](design/user-admin-direction-c/1440-admins--preview.png) / [admins--preview · 390](design/user-admin-direction-c/390-admins--preview.png)、[admins--technical · 1440](design/user-admin-direction-c/1440-admins--technical.png) / [admins--technical · 390](design/user-admin-direction-c/390-admins--technical.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DETAIL-CONTAINER 账号详情原生窗口 / local | 1处；loading、ready、error | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--detail_loading · 1440](design/user-admin-direction-c/1440-admins--detail_loading.png) / [admins--detail_loading · 390](design/user-admin-direction-c/390-admins--detail_loading.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DETAIL-CLOSE 关闭账号详情 / local | 4处；escape、header、footer、error | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--detail_error · 1440](design/user-admin-direction-c/1440-admins--detail_error.png) / [admins--detail_error · 390](design/user-admin-direction-c/390-admins--detail_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DETAIL-SECTION 详情内跳转分区 / local | 3处；memberships、roles、security | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--memberships · 1440](design/user-admin-direction-c/1440-admins--memberships.png) / [admins--memberships · 390](design/user-admin-direction-c/390-admins--memberships.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-DETAIL-RETRY 重试读取账号详情 / read | 1处；retry、loading、success | [admins--detail_error · 1440](design/user-admin-direction-c/1440-admins--detail_error.png) / [admins--detail_error · 390](design/user-admin-direction-c/390-admins--detail_error.png)、[admins--detail_loading · 1440](design/user-admin-direction-c/1440-admins--detail_loading.png) / [admins--detail_loading · 390](design/user-admin-direction-c/390-admins--detail_loading.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-MEMBERSHIP-WIRING 详情转发加入组织表单提交 / wiring | 1处；valid、error | [admins--memberships · 1440](design/user-admin-direction-c/1440-admins--memberships.png) / [admins--memberships · 390](design/user-admin-direction-c/390-admins--memberships.png)、[admins--membership_error · 1440](design/user-admin-direction-c/1440-admins--membership_error.png) / [admins--membership_error · 390](design/user-admin-direction-c/390-admins--membership_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-MEMBERSHIP-SUBMIT 提交加入组织意图 / write | 2处；valid、invalid、busy、failure | [admins--memberships · 1440](design/user-admin-direction-c/1440-admins--memberships.png) / [admins--memberships · 390](design/user-admin-direction-c/390-admins--memberships.png)、[admins--membership_error · 1440](design/user-admin-direction-c/1440-admins--membership_error.png) / [admins--membership_error · 390](design/user-admin-direction-c/390-admins--membership_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-ROLE-CHOOSE 选择固定平台角色授予或撤销 / local | 1处；grant、revoke、inactive-disabled、self-protection | [admins--roles · 1440](design/user-admin-direction-c/1440-admins--roles.png) / [admins--roles · 390](design/user-admin-direction-c/390-admins--roles.png)、[admins--disabled_roles · 1440](design/user-admin-direction-c/1440-admins--disabled_roles.png) / [admins--disabled_roles · 390](design/user-admin-direction-c/390-admins--disabled_roles.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-SESSION-CHOOSE 选择撤销单个或全部会话 / local | 2处；single、all、none、expired | [admins--security · 1440](design/user-admin-direction-c/1440-admins--security.png) / [admins--security · 390](design/user-admin-direction-c/390-admins--security.png)、[admins--no_sessions · 1440](design/user-admin-direction-c/1440-admins--no_sessions.png) / [admins--no_sessions · 390](design/user-admin-direction-c/390-admins--no_sessions.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-STATUS-CHOOSE 选择停用或恢复账号登录 / local | 1处；active-to-disabled、disabled-to-active、self-protection | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--disabled · 1440](design/user-admin-direction-c/1440-admins--disabled.png) / [admins--disabled · 390](design/user-admin-direction-c/390-admins--disabled.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-PASSWORD-OPEN 打开强制改密窗 / local | 1处；open、cancel | [admins--detail · 1440](design/user-admin-direction-c/1440-admins--detail.png) / [admins--detail · 390](design/user-admin-direction-c/390-admins--detail.png)、[admins--password · 1440](design/user-admin-direction-c/1440-admins--password.png) / [admins--password · 390](design/user-admin-direction-c/390-admins--password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-CREATE-CONTAINER 新建用户原生窗口 / local | 1处；default、organization-selected、error | [admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)、[admins--create_org · 1440](design/user-admin-direction-c/1440-admins--create_org.png) / [admins--create_org · 390](design/user-admin-direction-c/390-admins--create_org.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-CREATE-CANCEL 取消新建用户 / local | 2处；escape、button | [admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)、[admins--create_error · 1440](design/user-admin-direction-c/1440-admins--create_error.png) / [admins--create_error · 390](design/user-admin-direction-c/390-admins--create_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-CREATE-SUBMIT 提交新建用户 / write | 2处；valid、invalid、busy、failure、success | [admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)、[admins--create_org · 1440](design/user-admin-direction-c/1440-admins--create_org.png) / [admins--create_org · 390](design/user-admin-direction-c/390-admins--create_org.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-PASSWORD-CONTAINER 强制改密原生窗口 / local | 1处；default、invalid、error | [admins--password · 1440](design/user-admin-direction-c/1440-admins--password.png) / [admins--password · 390](design/user-admin-direction-c/390-admins--password.png)、[admins--password_invalid · 1440](design/user-admin-direction-c/1440-admins--password_invalid.png) / [admins--password_invalid · 390](design/user-admin-direction-c/390-admins--password_invalid.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-PASSWORD-CANCEL 取消强制改密 / local | 2处；escape、button | [admins--password · 1440](design/user-admin-direction-c/1440-admins--password.png) / [admins--password · 390](design/user-admin-direction-c/390-admins--password.png)、[admins--password_error · 1440](design/user-admin-direction-c/1440-admins--password_error.png) / [admins--password_error · 390](design/user-admin-direction-c/390-admins--password_error.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-PASSWORD-SUBMIT 确认临时密码并进入原因确认 / local | 2处；valid、invalid、reason-step | [admins--password · 1440](design/user-admin-direction-c/1440-admins--password.png) / [admins--password · 390](design/user-admin-direction-c/390-admins--password.png)、[admins--password_invalid · 1440](design/user-admin-direction-c/1440-admins--password_invalid.png) / [admins--password_invalid · 390](design/user-admin-direction-c/390-admins--password_invalid.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-REASON-CONTAINER 共享原因原生窗口 / local | 1处；11-operation-variants、invalid | [admins--reason_disable · 1440](design/user-admin-direction-c/1440-admins--reason_disable.png) / [admins--reason_disable · 390](design/user-admin-direction-c/390-admins--reason_disable.png)、[admins--reason_restore · 1440](design/user-admin-direction-c/1440-admins--reason_restore.png) / [admins--reason_restore · 390](design/user-admin-direction-c/390-admins--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-REASON-CANCEL 取消原因确认 / local | 2处；escape、button | [admins--reason_disable · 1440](design/user-admin-direction-c/1440-admins--reason_disable.png) / [admins--reason_disable · 390](design/user-admin-direction-c/390-admins--reason_disable.png)、[admins--reason_restore · 1440](design/user-admin-direction-c/1440-admins--reason_restore.png) / [admins--reason_restore · 390](design/user-admin-direction-c/390-admins--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-REASON-INPUT 编辑操作原因 / local | 1处；edit、required、minlength、maxlength | [admins--reason_disable · 1440](design/user-admin-direction-c/1440-admins--reason_disable.png) / [admins--reason_disable · 390](design/user-admin-direction-c/390-admins--reason_disable.png)、[admins--reason_reset_password · 1440](design/user-admin-direction-c/1440-admins--reason_reset_password.png) / [admins--reason_reset_password · 390](design/user-admin-direction-c/390-admins--reason_reset_password.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-REASON-SUBMIT 确认原因并执行已选操作 / write | 2处；valid、invalid、busy、failure、write-success-read-warning、success | [admins--reason_disable · 1440](design/user-admin-direction-c/1440-admins--reason_disable.png) / [admins--reason_disable · 390](design/user-admin-direction-c/390-admins--reason_disable.png)、[admins--reason_restore · 1440](design/user-admin-direction-c/1440-admins--reason_restore.png) / [admins--reason_restore · 390](design/user-admin-direction-c/390-admins--reason_restore.png)；其余见JSON | 源码与本地隔离测试不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-OUT-ORG-EMPTY-RESET 管理员路由隐藏的组织空态清筛分支 / excluded | 1处；route-specific-excluded | ；其余见JSON | 排除只界定P44，不表示P40组织列表已通过动作/运行时验收。 |
| PA44-DETAIL-ROW-WIRING 管理员记录行详情事件转发 / wiring | 1处；desktop-row、mobile-preview | [admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)、[admins--preview · 1440](design/user-admin-direction-c/1440-admins--preview.png) / [admins--preview · 390](design/user-admin-direction-c/390-admins--preview.png)；其余见JSON | 本地隔离响应与源码映射不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-EMPTY-RESET 管理员空结果清除筛选 / local | 1处；filtered-empty | [admins--filtered_empty · 1440](design/user-admin-direction-c/1440-admins--filtered_empty.png) / [admins--filtered_empty · 390](design/user-admin-direction-c/390-admins--filtered_empty.png)；其余见JSON | 本地隔离响应与源码映射不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-EMPTY-CREATE 管理员空目录打开创建窗 / local | 1处；unfiltered-empty | [admins--empty · 1440](design/user-admin-direction-c/1440-admins--empty.png) / [admins--empty · 390](design/user-admin-direction-c/390-admins--empty.png)、[admins--create · 1440](design/user-admin-direction-c/1440-admins--create.png) / [admins--create · 390](design/user-admin-direction-c/390-admins--create.png)；其余见JSON | 本地隔离响应与源码映射不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-ROLE-RESET 重置本地角色比较条件 / local | 1处；default、search、group、same-role-all | [admins--comparison · 1440](design/user-admin-direction-c/1440-admins--comparison.png) / [admins--comparison · 390](design/user-admin-direction-c/390-admins--comparison.png)、[admins--compare_all · 1440](design/user-admin-direction-c/1440-admins--compare_all.png) / [admins--compare_all · 390](design/user-admin-direction-c/390-admins--compare_all.png)；其余见JSON | 本地隔离响应与源码映射不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |
| PA44-GLOBAL-NAVIGATION 平台账号/组织全局侧栏导航 / navigation | 3处；organizations、users、admins | [admins--list · 1440](design/user-admin-direction-c/1440-admins--list.png) / [admins--list · 390](design/user-admin-direction-c/390-admins--list.png)；其余见JSON | 本地隔离响应与源码映射不证明真实RBAC、MySQL写入、审计持久化或生产权限验收。 |

### 事件转发关系（不增加业务动作）

| 关系键 | 源事件 / handler | 目标合同组 |
| --- | --- | --- |
| PA44-WORKSPACE-WIRING | @apply-filters / applyFilters | PA44-FILTER |
| PA44-WORKSPACE-WIRING | @reset-filters / resetFilters | PA44-RESET |
| PA44-WORKSPACE-WIRING | @load / load | PA44-REFRESH |
| PA44-WORKSPACE-WIRING | @create-organization / openOrganizationWizard | PA44-OUT-ORG-CREATE |
| PA44-WORKSPACE-WIRING | @create-admin / openCreateUser(true) | PA44-EMPTY-CREATE |
| PA44-WORKSPACE-WIRING | @open-organization / openOrganization | PA44-OUT-ORG-DETAIL |
| PA44-WORKSPACE-WIRING | @open-user / openUserDetail | PA44-OPEN-DETAIL |
| PA44-DIALOGS-WIRING | @close-create-user / closeCreateUser | PA44-CREATE-CANCEL |
| PA44-DIALOGS-WIRING | @create-user / createUser | PA44-CREATE-SUBMIT |
| PA44-DIALOGS-WIRING | @close-password / closePassword | PA44-PASSWORD-CANCEL |
| PA44-DIALOGS-WIRING | @reset-password / resetPassword | PA44-PASSWORD-SUBMIT |
| PA44-DIALOGS-WIRING | @close-reason / cancelReason | PA44-REASON-CANCEL |
| PA44-DIALOGS-WIRING | @submit-reason / submitReason | PA44-REASON-SUBMIT |
| PA44-DIALOGS-WIRING | @update:reason-text / reasonText = $event | PA44-REASON-INPUT |
| PA44-DIALOGS-WIRING | @close-create-user / closeCreateUser | PA44-CREATE-CANCEL |
| PA44-DIALOGS-WIRING | @create-user / createUser | PA44-CREATE-SUBMIT |
| PA44-DIALOGS-WIRING | @close-password / closePassword | PA44-PASSWORD-CANCEL |
| PA44-DIALOGS-WIRING | @reset-password / resetPassword | PA44-PASSWORD-SUBMIT |
| PA44-DIALOGS-WIRING | @close-reason / cancelReason | PA44-REASON-CANCEL |
| PA44-DIALOGS-WIRING | @submit-reason / submitReason | PA44-REASON-SUBMIT |
| PA44-DIALOGS-WIRING | @update:reason-text / reasonText = $event | PA44-REASON-INPUT |
| PA44-DETAIL-WIRING | @close / closeUserDetail | PA44-DETAIL-CLOSE |
| PA44-DETAIL-WIRING | @retry / selected && openUserDetail(selected) | PA44-DETAIL-RETRY |
| PA44-DETAIL-WIRING | @toggle-status / toggleUser | PA44-STATUS-CHOOSE |
| PA44-DETAIL-WIRING | @role / role | PA44-ROLE-CHOOSE |
| PA44-DETAIL-WIRING | @add-membership / addMembership | PA44-MEMBERSHIP-SUBMIT |
| PA44-DETAIL-WIRING | @reset-password / openPassword | PA44-PASSWORD-OPEN |
| PA44-DETAIL-WIRING | @revoke-sessions / revokeSessions | PA44-SESSION-CHOOSE |
| PA44-DETAIL-WIRING | @close / closeUserDetail | PA44-DETAIL-CLOSE |
| PA44-DETAIL-WIRING | @retry / selected && openUserDetail(selected) | PA44-DETAIL-RETRY |
| PA44-DETAIL-WIRING | @toggle-status / toggleUser | PA44-STATUS-CHOOSE |
| PA44-DETAIL-WIRING | @role / role | PA44-ROLE-CHOOSE |
| PA44-DETAIL-WIRING | @add-membership / addMembership | PA44-MEMBERSHIP-SUBMIT |
| PA44-DETAIL-WIRING | @reset-password / openPassword | PA44-PASSWORD-OPEN |
| PA44-DETAIL-WIRING | @revoke-sessions / revokeSessions | PA44-SESSION-CHOOSE |
| PA44-MEMBERSHIP-WIRING | @submit / $emit('addMembership', selected.id, $event) | PA44-MEMBERSHIP-SUBMIT |
| PA44-DETAIL-ROW-WIRING | @open-user / emit('open-user', $event) | PA44-OPEN-DETAIL |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformAccountCenter.vue / query | 管理员目录邮箱查询草稿 | 沿用现有URL同步和长度截断，不增设查询条件。 |
| PlatformAccountCenter.vue / status | 管理员目录账号状态筛选草稿 | 只筛选账号状态，不混入角色权限。 |
| PlatformAccountDialogs.vue / userForm.email | 创建用户邮箱 | 继续现有必填和长度约束，由既有API校验最终确认。 |
| PlatformAccountDialogs.vue / userForm.temporary_password | 新用户临时密码 | 保持现有长度约束，不在本变更中扩展安全规则。 |
| PlatformAccountDialogs.vue / userForm.platform_role_code | 可选固定平台角色 | 仅使用当前普通用户和三种平台角色。 |
| PlatformAccountDialogs.vue / userForm.organization_id | 可选组织ID | 空值继续转null；不推导或补造组织数据。 |
| PlatformAccountDialogs.vue / userForm.organization_role_code | 组织初始角色 | 只在选择组织时按既有选项使用。 |
| PlatformAccountDialogs.vue / passwordForm.temporary_password | 强制重置的临时密码 | 关闭后敏感值清理仍列待修，不假设自动清理。 |
| PlatformUserMembershipForm.vue / form.organization_id | 目标组织ID | 仅从现有eligible组织项选择。 |
| PlatformUserMembershipForm.vue / form.role_code | 组织角色代码 | 只使用既有五种角色选项。 |
| PlatformUserMembershipForm.vue / form.reason | 加入组织审计原因 | 沿用既有2–300字符规则。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |

### 明确保留的边界

- 管理员目录及只读比较的静态来源已逐项映射；P44与P43共享的详情/创建/改密/原因动作沿用同一组件合同，完整App生命周期仍需独立回归。
- 视觉全局自动通过不等于按钮六态、真实RBAC、MySQL写入、审计持久化或M07正式生产验收。
- P44复用P43已映射的用户详情、组织关系表单、新建/改密/原因窗；当前父级来源、P44管理员列表、全局侧栏和角色比较另行映射。
- ResponsiveFilterDrawer、ResponsiveDataView与TechnicalDetails的完整消费者及容器状态仍需全局/浏览器层验收。
- 自动视觉批准不提升动作审核、全状态、读屏、真实RBAC、MySQL或审计验收。

## P54 局部动作与共享消费者

[逐项机器清单](action-reviews/P54.json)：58个局部源位置 → 18组；4类写入，18组路由动作，0组转发/容器关联不重复计动作。已映射7/7个源码字段位置，9/9处调用/内嵌容器，14个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有26个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| DG54-VIEW 切换近期记录与证据质量 / navigation | 2处；records、quality | [records:default · 1440](design/data-composed-direction-c/1440-records-default.png) / [records:default · 390](design/data-composed-direction-c/390-records-default.png)、[quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png)；其余见JSON | 同路由history、质量工作态保留与KeepAlive读取中止已有Vue夹具回归；真实权限、真实API和生产生命周期仍未验证。 |
| DG54-ENTITY 选择四类近期数据 / read | 1处；trends、opportunities、competitors、suppliers | [records:trends · 1440](design/data-composed-direction-c/1440-records-trends.png) / [records:trends · 390](design/data-composed-direction-c/390-records-trends.png)、[records:opportunities · 1440](design/data-composed-direction-c/1440-records-opportunities.png) / [records:opportunities · 390](design/data-composed-direction-c/390-records-opportunities.png)；其余见JSON | 查询草稿保留与状态清空需跨四类逐项验证；旧快照不改变业务范围，导出等待仍可能漂移。 |
| DG54-FILTER 应用或重置近期筛选 / read | 5处；drawer-open、drawer-close、form-submit、enter、apply、reset | [records:filter · 1440](design/data-composed-direction-c/1440-records-filter.png) / [records:filter · 390](design/data-composed-direction-c/390-records-filter.png)、[records:query-draft · 1440](design/data-composed-direction-c/1440-records-query-draft.png) / [records:query-draft · 390](design/data-composed-direction-c/390-records-query-draft.png)；其余见JSON | 原生提交与Enter、抽屉submit.capture顺序、SQL LIKE和供应商字段范围尚非实际链验收。 |
| DG54-EXPORT 受控CSV导出 / write | 5处；open、ask、submit、cancel、download | [records:export · 1440](design/data-composed-direction-c/1440-records-export.png) / [records:export · 390](design/data-composed-direction-c/390-records-export.png)、[records:export-empty · 1440](design/data-composed-direction-c/1440-records-export-empty.png) / [records:export-empty · 390](design/data-composed-direction-c/390-records-export-empty.png)；其余见JSON | 真实客户端原因无最大长度；服务器2–300。请求与文件名使用可变entity；新稿固定条件/未知防重只是提案，未证真实CSV/审计/重复幂等。 |
| DG54-LOAD 读取与状态重试 / read | 1处；first、empty、error、expired、forbidden、blocked、retry、timeout | [records:loading · 1440](design/data-composed-direction-c/1440-records-loading.png) / [records:loading · 390](design/data-composed-direction-c/390-records-loading.png)、[records:empty · 1440](design/data-composed-direction-c/1440-records-empty.png) / [records:empty · 390](design/data-composed-direction-c/390-records-empty.png)；其余见JSON | 15秒abort非完整生命周期代次保护；失败保留仅有旧行时，不把空数据旧状态一概称快照保留。 |
| DG54-TECH 查看记录与展开技术标识 / local | 3处；desktop-row、mobile-detail | [records:detail · 1440](design/data-composed-direction-c/1440-records-detail.png) / [records:detail · 390](design/data-composed-direction-c/390-records-detail.png)、[records:long-detail · 1440](design/data-composed-direction-c/1440-records-long-detail.png) / [records:long-detail · 390](design/data-composed-direction-c/390-records-long-detail.png)；其余见JSON | 这是行ID展开，不是页尾TechnicalDetails复制；所有类型/长ID状态与共享复制消费者另验。 |
| DG54-PAGE 近期记录本地分页 / read | 2处；previous、next、first、last | [records:page-21 · 1440](design/data-composed-direction-c/1440-records-page-21.png) / [records:page-21 · 390](design/data-composed-direction-c/390-records-page-21.png)、[records:page-two · 1440](design/data-composed-direction-c/1440-records-page-two.png) / [records:page-two · 390](design/data-composed-direction-c/390-records-page-two.png)；其余见JSON | 同一原型场景图不证明真实浏览器history/滚动/每种实体分页。 |
| Q54-LOAD 质量状态恢复读取 / read | 2处；loading、empty、error、forbidden、expired、blocked、primary | [quality:loading · 1440](design/data-composed-direction-c/1440-quality-loading.png) / [quality:loading · 390](design/data-composed-direction-c/390-quality-loading.png)、[quality:empty · 1440](design/data-composed-direction-c/1440-quality-empty.png) / [quality:empty · 390](design/data-composed-direction-c/390-quality-empty.png)；其余见JSON | ready刷新、读取代次和未知写入解锁已有双端夹具回归；真实权限、数据库和生产恢复仍未验。 |
| Q54-TAB 切换证据问题核对 / read | 3处；evidence、issues、runs | [quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png)、[quality:issues · 1440](design/data-composed-direction-c/1440-quality-issues.png) / [quality:issues · 390](design/data-composed-direction-c/390-quality-issues.png)；其余见JSON | Tab、搜索、run与页码状态已进入URL并通过切区保留回归；浏览器前进后退和真实权限仍待生产链验证。 |
| Q54-SEARCH 检索或清除当前质量页 / local | 2处；change、clear | [quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png)、[quality:issues · 1440](design/data-composed-direction-c/1440-quality-issues.png) / [quality:issues · 390](design/data-composed-direction-c/390-quality-issues.png)；其余见JSON | 当前页检索与URL恢复已有双端夹具回归；超长输入、输入法组合和完整主题交叉仍待验。 |
| Q54-EVIDENCE 读取或关闭完整证据溯源 / read | 8处；evidence-desktop、evidence-mobile、issue-desktop、issue-mobile、native-dialog、cancel、close、retry | [quality:lineage · 1440](design/data-composed-direction-c/1440-quality-lineage.png) / [quality:lineage · 390](design/data-composed-direction-c/390-quality-lineage.png)、[quality:lineage-loading · 1440](design/data-composed-direction-c/1440-quality-lineage-loading.png) / [quality:lineage-loading · 390](design/data-composed-direction-c/390-quality-lineage-loading.png)；其余见JSON | 详情代次、中止、原生模态焦点与返焦已有双端夹具回归；真实文件、字段来源完整性和权限仍未验。 |
| Q54-DOWNLOAD 签发并访问原文下载 / write | 2处；desktop、mobile、grant、access | [quality:download-ready · 1440](design/data-composed-direction-c/1440-quality-download-ready.png) / [quality:download-ready · 390](design/data-composed-direction-c/390-quality-download-ready.png)、[quality:download-busy · 1440](design/data-composed-direction-c/1440-quality-download-busy.png) / [quality:download-busy · 390](design/data-composed-direction-c/390-quality-download-busy.png)；其余见JSON | 原入口无确认窗；稿新增说明/签发窗。签发与实际下载错误不能混为同回执，未验证真实字节、SHA、授权或访问审计。 |
| Q54-TECH 展开证据或问题技术标识 / local | 3处；evidence-mobile、issue-mobile、lineage-dialog | [quality:lineage-technical · 1440](design/data-composed-direction-c/1440-quality-lineage-technical.png) / [quality:lineage-technical · 390](design/data-composed-direction-c/390-quality-lineage-technical.png)、[quality:issue-technical · 1440](design/data-composed-direction-c/1440-quality-issue-technical.png) / [quality:issue-technical · 390](design/data-composed-direction-c/390-quality-issue-technical.png)；其余见JSON | 新完整溯源技术区不是两个原移动详情展开消费者的逐项证据；不能以复制按钮替代summary验收。 |
| Q54-RUN 当前加载问题的核对下钻 / local | 2处；drill、clear、matched、empty | [quality:run-match · 1440](design/data-composed-direction-c/1440-quality-run-match.png) / [quality:run-match · 390](design/data-composed-direction-c/390-quality-run-match.png)、[quality:run-empty · 1440](design/data-composed-direction-c/1440-quality-run-empty.png) / [quality:run-empty · 390](design/data-composed-direction-c/390-quality-run-empty.png)；其余见JSON | 不查全库异常，跨页缺问题不能伪称没有异常；切内部tab后原runId仍保留。 |
| Q54-BATCH 开放问题批处理预检与提交 / write | 3处；attribute、assign、close、preview、cancel、confirm | [quality:batch-attribute · 1440](design/data-composed-direction-c/1440-quality-batch-attribute.png) / [quality:batch-attribute · 390](design/data-composed-direction-c/390-quality-batch-attribute.png)、[quality:batch-assign · 1440](design/data-composed-direction-c/1440-quality-batch-assign.png) / [quality:batch-assign · 390](design/data-composed-direction-c/390-quality-batch-assign.png)；其余见JSON | 冻结预览、busy、写成功与后续读取失败分离及未知防重已有双端夹具回归；真实事务、成员权限与审计仍未验。 |
| Q54-SELECT 切换开放问题选择 / local | 3处；select-desktop、select-mobile、deselect、clear、disabled-closed、hidden-selected | [quality:issues · 1440](design/data-composed-direction-c/1440-quality-issues.png) / [quality:issues · 390](design/data-composed-direction-c/390-quality-issues.png)、[quality:selection-hidden · 1440](design/data-composed-direction-c/1440-quality-selection-hidden.png) / [quality:selection-hidden · 390](design/data-composed-direction-c/390-quality-selection-hidden.png)；其余见JSON | 移动等价选择、清除与批量冻结已有双端夹具回归；跨页50项边界和真实并发问题仍待验。 |
| Q54-RESOLVE 单问题原因与解决确认 / write | 9处；desktop-open、mobile-open、native-dialog、dialog-cancel、dialog-close、preview、confirm-cancel、confirm | [quality:resolve-empty · 1440](design/data-composed-direction-c/1440-quality-resolve-empty.png) / [quality:resolve-empty · 390](design/data-composed-direction-c/390-quality-resolve-empty.png)、[quality:resolve-short · 1440](design/data-composed-direction-c/1440-quality-resolve-short.png) / [quality:resolve-short · 390](design/data-composed-direction-c/390-quality-resolve-short.png)；其余见JSON | 原生原因模态、busy、写成功/重读失败双消息和未知防重已实现；真实幂等、审计、权限与生产并发仍未验。 |
| Q54-PAGE 证据与问题共享服务端页码 / read | 2处；previous、next、first、last、waiting、failed | [quality:page-first · 1440](design/data-composed-direction-c/1440-quality-page-first.png) / [quality:page-first · 390](design/data-composed-direction-c/390-quality-page-first.png)、[quality:page-last · 1440](design/data-composed-direction-c/1440-quality-page-last.png) / [quality:page-last · 390](design/data-composed-direction-c/390-quality-page-last.png)；其余见JSON | 原翻页失败保留数据但page已变；提案保留已成功页，不能当作源实现已修复。 本补稿busy截图如实保留原型按钮可用与handler防重；源refreshing禁用不同，尚未统一。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformDataCenter.vue / queryDraft | 近期查询草稿；apply时trim后才成为query | 120字符边界/Enter/提交与SQL LIKE、供应商字段差异需真实链验证。 |
| PlatformDataCenter.vue / statusDraft | 随entity状态集选择；apply提交，类型切换清空 | 四类型13状态组合与失败旧快照要分开，不按新类型解释旧行。 |
| DataQualityCenter.vue / query | 质量当前已加载集合本地检索，不trim，不提交GET；change同步quality_q | URL恢复和跨切区保留有双端夹具回归；输入法、超长文本和生产历史仍待验。 |
| DataQualityCenter.vue / batchAction | attribute/assign/close；不同动作决定成员字段适用性 | 预览后动作冻结并有双端负向回归；三种操作的真实权限/事务仍需分别验收。 |
| DataQualityCenter.vue / batchAssignee | 仅assign显示，候选来自所选问题组织活动成员 | 预览到提交冻结；fixture不编造为真实组织成员或活动状态证明。 |
| DataQualityCenter.vue / batchReason | 批量原因，maxlength500，预检trim>=2 | 冻结范围和确认busy已有双端回归；0/1/2/500、长内容与真实软键盘仍需完整交叉。 |
| DataQualityCenter.vue / reason | 单问题原因，maxlength500；每次beginResolve清空 | 字段与共享AuditedReasonDialog同名但范围不同，不能混用2–300限制。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformDataCenter.vue / aside.1 / records-entity-rail | inline-aside / related-scene-only | [records:default · 1440](design/data-composed-direction-c/1440-records-default.png) / [records:default · 390](design/data-composed-direction-c/390-records-default.png) | 当前真实Vue已有双端截图；此历史提案场景只用于源消费者登记。 |
| PlatformDataCenter.vue / ResponsiveFilterDrawer.1 / records-filter | responsive-filter / matching-dialog-scene | [records:filter · 1440](design/data-composed-direction-c/1440-records-filter.png) / [records:filter · 390](design/data-composed-direction-c/390-records-filter.png) | 原生submit/Enter关闭与返焦、所有错误/主题需每消费者验证。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / trends | responsive-row-detail / matching-dialog-scene | [records:detail · 1440](design/data-composed-direction-c/1440-records-detail.png) / [records:detail · 390](design/data-composed-direction-c/390-records-detail.png) | 仅原始热点示例详情，不代表所有状态行。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / opportunities | responsive-row-detail / matching-dialog-scene | [opportunities:detail · 1440](design/data-record-detail-direction-c/1440-opportunities-detail.png) / [opportunities:detail · 390](design/data-record-detail-direction-c/390-opportunities-detail.png)、[opportunities-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-opportunities-long-technical-footer.png) / [opportunities-long:technical-footer · 390](design/data-record-detail-direction-c/390-opportunities-long-technical-footer.png) | 合成源投影样例六组字段/标题/技术ID及双端长内容已验；不是全部状态行/主题/真实Vue。桌面详情入口为新提案。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / competitors | responsive-row-detail / matching-dialog-scene | [competitors:detail · 1440](design/data-record-detail-direction-c/1440-competitors-detail.png) / [competitors:detail · 390](design/data-record-detail-direction-c/390-competitors-detail.png)、[competitors-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-competitors-long-technical-footer.png) / [competitors-long:technical-footer · 390](design/data-record-detail-direction-c/390-competitors-long-technical-footer.png) | 合成源投影样例版本/变更语义及六组字段/技术ID、双端长内容已验；全部状态/主题/真实Vue仍待验。 |
| PlatformDataCenter.vue / ResponsiveDataView.1 / suppliers | responsive-row-detail / matching-dialog-scene | [suppliers-original:detail · 1440](design/data-record-detail-direction-c/1440-suppliers-original-detail.png) / [suppliers-original:detail · 390](design/data-record-detail-direction-c/390-suppliers-original-detail.png)、[suppliers:detail · 1440](design/data-record-detail-direction-c/1440-suppliers-detail.png) / [suppliers:detail · 390](design/data-record-detail-direction-c/390-suppliers-detail.png)、[suppliers-long:technical-footer · 1440](design/data-record-detail-direction-c/1440-suppliers-long-technical-footer.png) / [suppliers-long:technical-footer · 390](design/data-record-detail-direction-c/390-suppliers-long-technical-footer.png) | 原始隔离与合成供应商/地点、最小起订量/报价详情已分开核对，不引入币种/单位或新的零测量；全部行/主题/真实Vue仍待验。 |
| PlatformDataCenter.vue / AuditedReasonDialog.1 / export-reason | native-reason-dialog / matching-dialog-scene | [records:export · 1440](design/data-composed-direction-c/1440-records-export.png) / [records:export · 390](design/data-composed-direction-c/390-records-export.png) | 原型是新固定范围表单，真实源请求/文件名竞态未修。 |
| DataQualityCenter.vue / aside.1 / quality-audit-rail | inline-aside / related-scene-only | [quality:default · 1440](design/data-composed-direction-c/1440-quality-default.png) / [quality:default · 390](design/data-composed-direction-c/390-quality-default.png) | 静态场景仅登记消费者关系；用户对当前Vue视觉的具体审核仍待完成。 |
| DataQualityCenter.vue / ResponsiveDataView.1 / evidence-row | responsive-row-detail / matching-dialog-scene | [quality:evidence-detail · 1440](design/data-composed-direction-c/1440-quality-evidence-detail.png) / [quality:evidence-detail · 390](design/data-composed-direction-c/390-quality-evidence-detail.png) | 完整记录稿已存在；真实shared.show/close及完整溯源交接待Vue验收。 |
| DataQualityCenter.vue / ResponsiveDataView.2 / issue-row | responsive-row-detail / matching-dialog-scene | [quality:issue-detail · 1440](design/data-composed-direction-c/1440-quality-issue-detail.png) / [quality:issue-detail · 390](design/data-composed-direction-c/390-quality-issue-detail.png) | 移动选择已进入当前Vue并有夹具回归；所有已解决/缺证据/权限组合仍待验。 |
| DataQualityCenter.vue / ConfirmDialog.1 / single-confirm | confirmation-dialog / matching-dialog-scene | [quality:resolve-confirm · 1440](design/data-composed-direction-c/1440-quality-resolve-confirm.png) / [quality:resolve-confirm · 390](design/data-composed-direction-c/390-quality-resolve-confirm.png) | 当前Vue取消、busy、成功与重读失败已有夹具回归；真实POST幂等和权限待验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / attribute-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-confirm.png) / [quality:batch-confirm · 390](design/data-composed-direction-c/390-quality-batch-confirm.png) | 源使用可变选择/原因；后端全有或全无需真实SQL证据。 |
| DataQualityCenter.vue / ConfirmDialog.2 / assign-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-assign-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-assign-confirm.png) / [quality:batch-assign-confirm · 390](design/data-composed-direction-c/390-quality-batch-assign-confirm.png) | 成员为合成示例；真实组织/活动状态/版本并发未验。 |
| DataQualityCenter.vue / ConfirmDialog.2 / close-confirm | confirmation-dialog / matching-dialog-scene | [quality:batch-close-confirm · 1440](design/data-composed-direction-c/1440-quality-batch-close-confirm.png) / [quality:batch-close-confirm · 390](design/data-composed-direction-c/390-quality-batch-close-confirm.png) | 只变问题不删原文；原POST/审计/短语trim与并发未验。 |

### 明确保留的边界

- 同页静态组合已交294PNG；实际质量工作区现由父级保持挂载，并补同路由URL恢复、读取代次与迟到响应隔离。真实浏览器长历史和生产scope仍待验。
- 40个明确控件变体已有364张双端原生状态图；17组主控件81个槽有selector/scene关联，21个槽仍未映射。主控件证据不是全动态行、全部共享消费者或真实Vue验收。
- 三类实体详情已补打开/完整字段/双端长内容证据，全部状态行及逐按钮主题仍未穷尽；Q54当前URL状态与确认短语行为以真实Vue和回归为准。
- 质量ready刷新、清搜索/清选择、手机checkbox、原生详情/原因窗已进入当前Vue；14张当前实现图仍待用户具体审核。
- 共享详情窗新增停用清理，释放旧选中与背景隔离；完整壳层验证来自P38缓存返回链，不代替P54三处调用的所有业务流程。P54模板/源、原图与批准不变。
- 2026-09-11仅同步既有共享修复的当前依赖指纹：e845daca手机预览焦点隔离、fae70505复制拒绝及旧回执保护。P54页面源、原图和批准不变；共享测试不替代P54三个调用/六种内容变体的真实流程验收。
- PlatformShell及UiStatePanel内部控件、表格列显隐/冻结/密度、TechnicalDetails复制必须按调用方再映射；不在58个局部源位置内。
- ConfirmDialog共享typedText适用，acknowledged因本页destructive=false不显示；AuditedReasonDialog内部reason与质量reason分域；TableViewControls密度字段未冒充本页7个v-model。
- ResponsiveDataView的三个调用/六种内容变体不能拿一个shared测试全验；同类动态行、空字段与主题密度交叉场景还未穷尽。

## P55 局部动作与共享消费者

[逐项机器清单](action-reviews/P55.json)：23个局部源位置 → 8组；0类写入，8组路由动作，0组转发/容器关联不重复计动作。已映射2/2个源码字段位置，5/5处调用/内嵌容器，6个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有48个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| DG55-SECTION 切换五类治理目录 / read | 1处；score_rules、cost_rules、approval_templates、automation_rules、releases | [default · 1440](design/governance-direction-c/1440-default.png) / [default · 390](design/governance-direction-c/390-default.png)、[automation · 1440](design/governance-direction-c/1440-automation.png) / [automation · 390](design/governance-direction-c/390-automation.png)；其余见JSON | 当前夹具覆盖分类与保留快照；真实跨组织计数和生产缓存返回待验。 |
| DG55-PROVIDER 进入来源版本管理 / navigation | 2处；desktop、mobile | [provider-route · 1440](design/governance-direction-c/1440-provider-route.png) / [provider-route · 390](design/governance-direction-c/390-provider-route.png)；其余见JSON | 本轮只核对href与双端可达，未执行真实目标页权限或跨组织导航。 |
| DG55-LOAD 刷新或重新加载治理事实 / read | 2处；refresh、retry、first-error、retained-error、reactivation | [loading · 1440](design/governance-direction-c/1440-loading.png) / [loading · 390](design/governance-direction-c/390-loading.png)、[error · 1440](design/governance-direction-c/1440-error.png) / [error · 390](design/governance-direction-c/390-error.png)；其余见JSON | 当前Vue夹具覆盖双端与KeepAlive；真实网络重试、权限和生产生命周期待验。 |
| DG55-WORKBENCH 进入所属治理工作台 / navigation | 4处；target-header、desktop-row、mobile-detail、desktop-dialog | [score_rules-route · 1440](design/governance-direction-c/1440-score_rules-route.png) / [score_rules-route · 390](design/governance-direction-c/390-score_rules-route.png)、[automation_rules-route · 1440](design/governance-direction-c/1440-automation_rules-route.png) / [automation_rules-route · 390](design/governance-direction-c/390-automation_rules-route.png)；其余见JSON | 当前测试核对快照归属与精确href；不代表目标页有写入权限或已执行导航。 |
| DG55-FILTER 筛选与重置当前治理目录 / read | 4处；drawer、submit、apply、reset、query、status | [filter-draft · 1440](design/governance-direction-c/1440-filter-draft.png) / [filter-draft · 390](design/governance-direction-c/390-filter-draft.png)、[filter-applied · 1440](design/governance-direction-c/1440-filter-applied.png) / [filter-applied · 390](design/governance-direction-c/390-filter-applied.png)；其余见JSON | 当前夹具覆盖URL、草稿和空结果；真实SQL LIKE、全状态选项与软键盘待验。 |
| DG55-DETAIL 打开或关闭桌面治理详情 / local | 5处；open、native-dialog、cancel、top-close、footer-close | [score_rules-detail · 1440](design/governance-direction-c/1440-score_rules-detail.png) / [score_rules-detail · 390](design/governance-direction-c/390-score_rules-detail.png)、[automation_rules-detail · 1440](design/governance-direction-c/1440-automation_rules-detail.png) / [automation_rules-detail · 390](design/governance-direction-c/390-automation_rules-detail.png)；其余见JSON | 当前夹具覆盖双端字段、焦点与取消；真实长数据、全部主题和屏幕阅读器待验。 |
| DG55-TECH 展开治理技术标识 / local | 3处；desktop-row、mobile-detail、desktop-dialog | [score_rules-technical · 1440](design/governance-direction-c/1440-score_rules-technical.png) / [score_rules-technical · 390](design/governance-direction-c/390-score_rules-technical.png)、[automation_rules-technical · 1440](design/governance-direction-c/1440-automation_rules-technical.png) / [automation_rules-technical · 390](design/governance-direction-c/390-automation_rules-technical.png)；其余见JSON | 未引入复制或写入；真实长ID、读屏播报和所有空字段待验。 |
| DG55-PAGE 治理目录服务端分页 / read | 2处；previous、next、pending、first、last、failed | [page-first · 1440](design/governance-direction-c/1440-page-first.png) / [page-first · 390](design/governance-direction-c/390-page-first.png)、[page-last · 1440](design/governance-direction-c/1440-page-last.png) / [page-last · 390](design/governance-direction-c/390-page-last.png)；其余见JSON | 当前夹具覆盖0/1/20/21/100边界；真实大表性能和历史返回待验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformGovernanceCenter.vue / queryDraft | 当前分类的搜索草稿，maxlength 120；提交trim后进入URL与GET | 真实输入法、超长服务错误和跨分类草稿策略待人工验。 |
| PlatformGovernanceCenter.vue / statusDraft | 当前分类允许的状态草稿；切分类后清空 | 五类全部真实状态组合待生产数据验证。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformGovernanceCenter.vue / aside.1 / governance-directory | inline-aside / related-scene-only | [default · 1440](design/governance-direction-c/1440-default.png) / [default · 390](design/governance-direction-c/390-default.png) | 静态场景登记目录关系；当前Vue图另行审核。 |
| PlatformGovernanceCenter.vue / ResponsiveFilterDrawer.1 / governance-filter | responsive-filter / matching-dialog-scene | [filter-draft · 1440](design/governance-direction-c/1440-filter-draft.png) / [filter-draft · 390](design/governance-direction-c/390-filter-draft.png) | 当前Vue夹具覆盖开关/提交；静态图不是运行验收。 |
| PlatformGovernanceCenter.vue / form.1 / governance-filter-form | form-container / matching-inline-form-scene | [filter-applied · 1440](design/governance-direction-c/1440-filter-applied.png) / [filter-applied · 390](design/governance-direction-c/390-filter-applied.png) | 只对应当前分类筛选，不代表跨分类搜索。 |
| PlatformGovernanceCenter.vue / ResponsiveDataView.1 / score-rules | responsive-row-detail / matching-dialog-scene | [score_rules-detail · 1440](design/governance-direction-c/1440-score_rules-detail.png) / [score_rules-detail · 390](design/governance-direction-c/390-score_rules-detail.png) | 评分规则代表场景。 |
| PlatformGovernanceCenter.vue / ResponsiveDataView.1 / automation-rules | responsive-row-detail / matching-dialog-scene | [automation_rules-detail · 1440](design/governance-direction-c/1440-automation_rules-detail.png) / [automation_rules-detail · 390](design/governance-direction-c/390-automation_rules-detail.png) | 自动化完整字段及0频控边界已夹具覆盖；真实数据待验。 |
| PlatformGovernanceCenter.vue / dialog.1 / governance-desktop-detail | native-dialog / matching-dialog-scene | [automation_rules-detail · 1440](design/governance-direction-c/1440-automation_rules-detail.png) / [automation_rules-detail · 390](design/governance-direction-c/390-automation_rules-detail.png) | 当前Vue已有夹具；静态场景仅为设计关联。 |

### 明确保留的边界

- 12张当前Vue图覆盖目录、默认、自动化详情、筛选无结果、权限拒绝和保留快照失败；不是每个动态行与六态的穷尽。
- 真实MySQL、RBAC、目标工作台导航、生产KeepAlive历史和全局共享外壳仍待验。
- ResponsiveDataView与ResponsiveFilterDrawer只新增可选governance外观，默认消费者保持原样；其他页面仍需各自回归。
- TableViewControls和TechnicalDetails内部控件不纳入本页23个局部源位置，仍按共享消费者单独验收。

## P56 局部动作与共享消费者

[逐项机器清单](action-reviews/P56.json)：13个局部源位置 → 7组；1类写入，7组路由动作，0组转发/容器关联不重复计动作。已映射4/4个源码字段位置，3/3处调用/内嵌容器，3个明确变体。共享源页面记录允许显式标注局部子集，不表示其余字段或容器已审阅；此处不是全页共享源的去重分母，原静态导入关联数不与本数相减当缺失按钮。

尚有42个视觉状态槽未映射；已登记状态见逐项JSON，仍须判断所有变体适用性。有场景关联不等于每个按钮六态已验收，也不表示缺少同数量图片。

| 合同组 / 性质 | 源位置 / 动态变体 | 已有场景入口 | 剩余核对 |
| --- | --- | --- | --- |
| CT56-LOAD 刷新或重新加载内容台账 / read | 2处；refresh、retry、first-error、reactivation | [default · 1440](design/content-direction-c/1440-default.png) / [default · 390](design/content-direction-c/390-default.png)、[first-error · 1440](design/content-direction-c/1440-first-error.png) / [first-error · 390](design/content-direction-c/390-first-error.png)；其余见JSON | 真实网络、生产权限与长时间缓存恢复仍待验。 |
| CT56-FILTER 应用、重置或清除内容筛选 / read | 2处；dialog、apply、reset、filtered-empty | [filter-draft · 1440](design/content-direction-c/1440-filter-draft.png) / [filter-draft · 390](design/content-direction-c/390-filter-draft.png)、[filter-empty · 1440](design/content-direction-c/1440-filter-empty.png) / [filter-empty · 390](design/content-direction-c/390-filter-empty.png)；其余见JSON | 真实 MySQL LIKE、中文输入法和浏览器长历史仍待验。 |
| CT56-REVIEW 从内容记录进入展示状态审核 / local | 2处；desktop-row、mobile-detail、active、irrelevant、stale、same-status | [review-active · 1440](design/content-direction-c/1440-review-active.png) / [review-active · 390](design/content-direction-c/390-review-active.png)、[review-irrelevant · 1440](design/content-direction-c/1440-review-irrelevant.png) / [review-irrelevant · 390](design/content-direction-c/390-review-irrelevant.png)；其余见JSON | 真实动态记录、全部主题与辅助技术仍待验。 |
| CT56-PAGE 内容台账服务端分页 / read | 1处；previous、next、zero、first、last | [page-first · 1440](design/content-direction-c/1440-page-first.png) / [page-first · 390](design/content-direction-c/390-page-first.png)、[page-last · 1440](design/content-direction-c/1440-page-last.png) / [page-last · 390](design/content-direction-c/390-page-last.png)；其余见JSON | 真实大表页码收束、性能与历史返回待验。 |
| CT56-TRACE 展开内容读取追踪 / local | 1处；collapsed、expanded | [technical · 1440](design/content-direction-c/1440-technical.png) / [technical · 390](design/content-direction-c/390-technical.png)；其余见JSON | 真实请求编号、读屏播报和复制策略仍待验；本批不新增复制。 |
| CT56-CANCEL 取消或关闭内容审核 / local | 3处；escape、top-close、footer-cancel、pending-close | [cancelled · 1440](design/content-direction-c/1440-cancelled.png) / [cancelled · 390](design/content-direction-c/390-cancelled.png)、[closed-pending · 1440](design/content-direction-c/1440-closed-pending.png) / [closed-pending · 390](design/content-direction-c/390-closed-pending.png)；其余见JSON | 真实慢网、移动软键盘和跨浏览器返焦仍待验。 |
| CT56-CONFIRM 确认内容状态审核 / write | 2处；valid、invalid、pending、success、error、unknown、refresh-failed | [reason-min · 1440](design/content-direction-c/1440-reason-min.png) / [reason-min · 390](design/content-direction-c/390-reason-min.png)、[review-pending · 1440](design/content-direction-c/1440-review-pending.png) / [review-pending · 390](design/content-direction-c/390-review-pending.png)；其余见JSON | 真实同源、会话、platform:operate、幂等事务、MySQL 审计和未知结果人工核对待验。 |

### 字段绑定（不重复计算为提交动作）

| 本地字段 | 含义 | 未验事项 |
| --- | --- | --- |
| PlatformContentCenter.vue / query | 热点标题、分类或市场的筛选草稿；应用后 trim 并进入 URL/GET。 | 真实输入法、120字服务校验与长历史待验。 |
| PlatformContentCenter.vue / status | active、irrelevant、stale、archived 四种读取状态筛选草稿。 | 四状态真实数据分布与权限待验。 |
| PlatformContentReviewDialog.vue / status | active、irrelevant、stale 三种审核目标；不提供 archived 写入。 | 真实冲突、同状态审计与权限待验。 |
| PlatformContentReviewDialog.vue / reason | 审核依据，前端和服务端合同均为 trim 后 2–300 字。 | 真实输入法、服务错误与审计落库待验。 |

### 弹窗与详情消费者（有图不自动等价）

| 来源容器 / 变体 | 源形态 / 图证据性质 | 图册 | 未验事项 |
| --- | --- | --- | --- |
| PlatformContentCenter.vue / aside.1 / content-governance-rail | inline-aside / related-scene-only | [default · 1440](design/content-direction-c/1440-default.png) / [default · 390](design/content-direction-c/390-default.png) | 当前 Vue 图独立待审，静态场景只登记设计关系。 |
| PlatformContentReviewDialog.vue / dialog.1 / content-review | native-dialog / matching-dialog-scene | [review-stale · 1440](design/content-direction-c/1440-review-stale.png) / [review-stale · 390](design/content-direction-c/390-review-stale.png)、[review-error · 1440](design/content-direction-c/1440-review-error.png) / [review-error · 390](design/content-direction-c/390-review-error.png) | 当前 Vue 已覆盖代表成功前状态与请求归属，不等于生产写入。 |
| PlatformContentReviewDialog.vue / form.1 / content-review-form | form-container / matching-dialog-scene | [reason-min · 1440](design/content-direction-c/1440-reason-min.png) / [reason-min · 390](design/content-direction-c/390-reason-min.png)、[review-pending · 1440](design/content-direction-c/1440-review-pending.png) / [review-pending · 390](design/content-direction-c/390-review-pending.png) | 只覆盖三目标审核，不扩展正文编辑或归档写入。 |

### 明确保留的边界

- 当前 Vue 代表图覆盖默认、手机记录、审核、空结果、权限拒绝和写成功/刷新失败；不是每条动态记录与全部六态穷尽。
- 共享 NavigationShell 仍保留旧外壳视觉，需在后续壳层批次统一重构；本页批准不得外推到全站。
- 真实 MySQL、platform:operate、幂等、审计、全主题、读屏/软键盘和生产部署仍待验。
- PlatformManagementFilter、PlatformManagementRecordList、PlatformContentPagination、ResponsiveDataView 与 ResponsiveFilterDrawer 只由当前页面调用并保持既有业务合同；共享内部按钮另按消费者验证。
- 当前 Vue 路由夹具覆盖桌面和手机代表状态，不等于真实 MySQL、RBAC、审计或生产签收。
