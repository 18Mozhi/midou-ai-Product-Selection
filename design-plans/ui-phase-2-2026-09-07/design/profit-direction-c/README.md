# P18 利润与成本：C 方向图稿

版本：PROFIT-C-r1。50 场景 × 桌面 1440×1000 / 手机 390×844，共 **100 张永久全页 PNG**。具体稿待审核，不是生产页面或数据库验收。

[打开交互稿](index.html) · [源码/图片哈希](evidence.json) · [P18完整规格](../../page-specs/P18.md) · [上一批核心图稿](../opportunity-detail-direction-c/README.md)

## 布局与本批范围

使用 frontend-design 技能沿 C 方向重构：目录蓝 #254a9c、深蓝 #193b80，白色工作面、冷灰 #edf1f6、正文 #202c3d、分隔 #dbe1e9。中文使用微软雅黑 UI/微软雅黑/等线，正文及输入16px、元数据13px。信息左对齐，不使用旧纸色/朱砂/账页布局。

本页的主要任务是核对“哪些金额已生效、哪些还在等待复核、当前利润是哪一次运行的结果”。因此拆成计算快照、已生效输入、成本复核、提交成本四个内部工作面；手机使用四个完整文字入口，切换保留成本草稿。内部切换仅是UI提案，不新增API或持久化字段。

快照用售价/总成本/净利润对照与七分项依据展开；输入列表区分human_review与automatic_evidence；复核卡保留两人的身份、期限、输入版本、复核版本与证据；九字段表单按金额/来源/指定复核人分组。新提交在模拟队列中显示为pending，不替换当前输入或利润快照。不是在浏览器计算ROI。

**零业务弹窗**：提交成本和通过/驳回原因均为内联表单，与当前合同一致。截图不虚增“弹窗完成数”。P18结论/证据/历史见上一批；市场、竞争、风险、AI、血缘、经营复盘及相关未交付动作仍待接续。全页装配、主题密度、真实Vue、完整73页与部署均未完成。

## 九字段与操作合同

| 字段或操作 | 实际来源与本稿行为 |
| --- | --- |
| 平台 | required，≤80；成本提交与重算共用costForm.platform。发送原值，服务端规范为小写 |
| 类型 | sale_price / purchase_price / logistics，三种body分别验证 |
| 金额 | number，原生min0、step0.000001；服务端售价必须>0，采购/物流可为0；不能把空数据当零 |
| 币种 | required，≤3；发送原大小写，服务端三字母校验并转大写；不宣称浏览器已验证完整ISO货币目录 |
| 来源类型 | required，≤80；保留实际服务端字符约束，不推断来源 |
| 来源标识 | required，≤255；前端原值发送，后端trim |
| 证据ID | required，≤36；真实后端还需验证UUID和机会/工作区归属，本稿不冒充该验收 |
| 观测时间 | required datetime-local；显式说明本机时区，提交转ISO。输入样例12:00中国时间发04:00Z |
| 指定复核人 | 必须选另一名有权限且可访问范围的成员；读取中/失败/确认空名单分别展示，不默认选中 |
| 提交双人复核 | POST cost-inputs，九字段+当前机会expected_version；成功重读，仍未生效；失败保留草稿且无自动重发 |
| 复核通过 / 驳回 | can_review与成本权限投影；开始清原因、取消归还焦点、trim后2–1000字；POST actions用复核单version，不是机会version |
| 已超时复核 | 源仓库仍允许指定成员处理pending单。超时不等于失效；本稿保留该操作，没有新增过期禁止规则 |
| 已通过 / 已驳回 / 他人单 | 无复核按钮，保留历史原因与版本；审批生效不改写旧利润快照 |
| 重新计算 | POST profit-runs，只发platform/机会version；排队不是已计算，无活动规则不编默认费率 |
| 费用规则入口 | /sourcing/cost-rules；本稿仅导航意图，P22的创建/发布等操作不在此批 |
| 分项依据 | 七分项逐项展开原始/换算金额、来源、证据和汇率快照；缺失原因保留原字段，不造数 |
| 读取恢复 | 复核人失败显示未知并重读名单；利润失败仍阻断主详情，不擅改成局部成功。图稿只模拟相关GET意图，不执行真实主加载链 |

## 真实源码证据与已知缺口

永久助手 scripts/lib/ui-phase2-profit-design-data.mjs 通过AST提取当前函数，在VM内执行confirmCost、reviewCost、queueProfit、beginReview/submitReview、后端成本验证、ProfitService.recordCost和主加载复核人失败分支。使用无数据库连接的适配器执行真实MySqlProfitRepository.reviewCost，确认超时pending单可被指定成员驳回。它是源函数证据，不是SQL事务或权限集成验收。

实际复现与提案区分：

- 表单默认值使用UTC字符串截断，之后当作本地时间解析；在中国时区造成8小时偏移。本稿以固定审核时钟展示正确本地20:00默认值；生产源码未修复，跨时区/夏令时未认证。
- 复核成功时，父级重读没有清理子级review.id/reason，旧内联表单状态会保留。本稿成功收起表单，是待审保护，未改Vue。
- 复核人读取失败被现有load()吞掉并设为空数组，主页面仍ready。本稿分出失败/空名单与重试，是待审展示提案。
- 旧M04-04夹具同时把448设为可处理复核的人、又放入可选复核人。真实服务拒绝自审；本稿新提交改选另一个已有隔离ID451，服务函数验证448自审拒绝、451提交进入适配器。此投影不证明两人当前真实账号/权限可用。
- 现有队列依据can_review显示按钮，读取投影只检查pending/指定actor。图稿同时按成本权限投影隐藏已失去权限时的操作，遵循实际写API的cost:confirm边界；不是生产RBAC已修复。

主运行样本直接来自历史M04-04测试；零利润、亏损、缺字段、当前输入、超时、长文与提交终态为明确合成布局样例。自动输入来源类型依据现有Worker的automatic_crawler_evidence；不声称本稿执行了自动采集。没有AI替代事实、默认费率、浏览器收益计算、自动通过或自动决定。

## 验证与使用

本批实际结果：最终capture与无参数复验均通过50场景双端；100张PNG和manifest相符、104个审核链接有效。文档/运行文档/静态分析/格式门通过，未修改生产源码，不推导真实Vue或生产验收通过。

打开index.html，用顶部场景选择器审核；所有业务导航只记录内存意图。名单恢复、重读、提交、复核和排队用固定隔离结果演示；浏览器HTTP=0、真实storage=0、数据库写入=0。

仓库根目录执行：

```powershell
node scripts/verify-ui-phase2-profit-c.mjs --capture
node scripts/verify-ui-phase2-profit-c.mjs
```

第一条重新生成本目录永久图片和哈希证据；第二条校验源码/图片哈希及双端交互。覆盖三种成本提交准确body、默认时区、服务自审拒绝、零价差异、未来时间拒绝、名单恢复、通过/驳回失败草稿、只读/指定人/超时、复核版本、不可变快照、排队状态、切换保留草稿以及控件≥16px/主要热区≥44px/正文≥13px/无横向溢出。

未认证：真实Vue整合、SQL幂等与回滚、成员撤权、源证据归属、服务端完整错误矩阵、迟到响应、提醒送达、200%缩放/软键盘、三主题两密度及生产验收。没有新增API、配置、环境变量、依赖、权限规则或数据库迁移，OpenAPI/.env.example无需变更；无部署/重启要求。

本批未创建临时文件或服务，浏览器在finally关闭；100PNG/data.js/evidence.json和两项永久验证脚本属于交付物，应保留。历史临时产物未触碰。

## 全部图稿

| 场景键（选择器有中文名称） | 桌面 | 手机 |
| --- | --- | --- |
| snapshot | [查看](1440-snapshot.png) | [查看](390-snapshot.png) |
| missing | [查看](1440-missing.png) | [查看](390-missing.png) |
| no-run | [查看](1440-no-run.png) | [查看](390-no-run.png) |
| zero | [查看](1440-zero.png) | [查看](390-zero.png) |
| loss | [查看](1440-loss.png) | [查看](390-loss.png) |
| no-currency | [查看](1440-no-currency.png) | [查看](390-no-currency.png) |
| components | [查看](1440-components.png) | [查看](390-components.png) |
| missing-component | [查看](1440-missing-component.png) | [查看](390-missing-component.png) |
| long-proof | [查看](1440-long-proof.png) | [查看](390-long-proof.png) |
| inputs | [查看](1440-inputs.png) | [查看](390-inputs.png) |
| auto-inputs | [查看](1440-auto-inputs.png) | [查看](390-auto-inputs.png) |
| mixed-inputs | [查看](1440-mixed-inputs.png) | [查看](390-mixed-inputs.png) |
| no-inputs | [查看](1440-no-inputs.png) | [查看](390-no-inputs.png) |
| reviews | [查看](1440-reviews.png) | [查看](390-reviews.png) |
| review-empty | [查看](1440-review-empty.png) | [查看](390-review-empty.png) |
| other-reviewer | [查看](1440-other-reviewer.png) | [查看](390-other-reviewer.png) |
| overdue | [查看](1440-overdue.png) | [查看](390-overdue.png) |
| done-approved | [查看](1440-done-approved.png) | [查看](390-done-approved.png) |
| done-rejected | [查看](1440-done-rejected.png) | [查看](390-done-rejected.png) |
| review-long | [查看](1440-review-long.png) | [查看](390-review-long.png) |
| permissions-lost | [查看](1440-permissions-lost.png) | [查看](390-permissions-lost.png) |
| form | [查看](1440-form.png) | [查看](390-form.png) |
| sale | [查看](1440-sale.png) | [查看](390-sale.png) |
| purchase | [查看](1440-purchase.png) | [查看](390-purchase.png) |
| logistics | [查看](1440-logistics.png) | [查看](390-logistics.png) |
| form-busy | [查看](1440-form-busy.png) | [查看](390-form-busy.png) |
| form-failed | [查看](1440-form-failed.png) | [查看](390-form-failed.png) |
| reviewers-loading | [查看](1440-reviewers-loading.png) | [查看](390-reviewers-loading.png) |
| reviewers-error | [查看](1440-reviewers-error.png) | [查看](390-reviewers-error.png) |
| reviewers-empty | [查看](1440-reviewers-empty.png) | [查看](390-reviewers-empty.png) |
| invalid-zero | [查看](1440-invalid-zero.png) | [查看](390-invalid-zero.png) |
| invalid-time | [查看](1440-invalid-time.png) | [查看](390-invalid-time.png) |
| form-success | [查看](1440-form-success.png) | [查看](390-form-success.png) |
| queue-busy | [查看](1440-queue-busy.png) | [查看](390-queue-busy.png) |
| queue-failed | [查看](1440-queue-failed.png) | [查看](390-queue-failed.png) |
| queue-queued | [查看](1440-queue-queued.png) | [查看](390-queue-queued.png) |
| queue-no-rule | [查看](1440-queue-no-rule.png) | [查看](390-queue-no-rule.png) |
| readonly | [查看](1440-readonly.png) | [查看](390-readonly.png) |
| loading | [查看](1440-loading.png) | [查看](390-loading.png) |
| read-error | [查看](1440-read-error.png) | [查看](390-read-error.png) |
| approved-empty | [查看](1440-approved-empty.png) | [查看](390-approved-empty.png) |
| approved-edited | [查看](1440-approved-edited.png) | [查看](390-approved-edited.png) |
| approved-busy | [查看](1440-approved-busy.png) | [查看](390-approved-busy.png) |
| approved-failed | [查看](1440-approved-failed.png) | [查看](390-approved-failed.png) |
| approved-success | [查看](1440-approved-success.png) | [查看](390-approved-success.png) |
| rejected-empty | [查看](1440-rejected-empty.png) | [查看](390-rejected-empty.png) |
| rejected-edited | [查看](1440-rejected-edited.png) | [查看](390-rejected-edited.png) |
| rejected-busy | [查看](1440-rejected-busy.png) | [查看](390-rejected-busy.png) |
| rejected-failed | [查看](1440-rejected-failed.png) | [查看](390-rejected-failed.png) |
| rejected-success | [查看](1440-rejected-success.png) | [查看](390-rejected-success.png) |

## 审核与接续

请审核四个工作面的布局、手机九字段表单、两种内联原因和失败提示。C方向已选定，具体稿仍待审核；本稿不注销OP07–OP10、P18完整交付或全73页发布门。下一批接续市场/竞争/风险及采集、评分动作；AI、血缘、复盘继续待办。P16采纳规则未替用户决定。
