# P49 1688 启用检查 · 1688-ACCEPTANCE-C-r1

2026-09-09，基线 main/0bd8127。**具体图稿待审，不是生产上线或全站完成。**

67 个场景，桌面 1440×1000 / 手机 390×844，共 134 张完整页面 PNG（含 2 张非业务审核工具图），零业务弹窗。所有页面底部、表单和技术详情都在完整页面图中，不用截断的首屏图抵扣。图、原型、数据与永久验证器为本次正式交付物。

[打开交互审核原型](index.html?review=1) · [验证证据](evidence.json) · [P49 事实规格](../../page-specs/P49.md)

## 设计与审核顺序

先查看默认桌面/手机，再看结论展开、全部证据、原始全待验收、已排队但重读失败、无活动组织、解析版本过旧、来源已启用但门禁受阻。最后检查各状态图。

frontend-design 技能用于重新组织为蓝色结论栏和白色证据/操作阅读面：来源身份、服务端整体结论与下一步入口在左侧；右侧依次给三项独立证据、运行范围、最近运行、覆盖观测。三项门禁不是先后步骤，不使用编号进度条，不继续旧等权卡片墙。手机结论压缩，说明与下一步可展开；已通过证据默认收起，待处理原因直接展开，全部证据可达。

固定 C 色板、中文系统字体、16px 表单与按钮、最小 13px 次要信息、44px 控件热区。证据展开/收起以原生 details 实现；没有加载装饰动画。重绘保留展开状态、输入光标和合理焦点，异步读取完成不抢走用户移到关键词框的焦点。当前图册只有 C 色板，不宣称完整三主题两密度验收。

## 逐控件与结果边界

| 控件 / 区域 | 原型行为 | 保留的实际合同 |
| --- | --- | --- |
| 当前结论 / 来源状态 / 通过数 | 服务端 overall 与 source_status 分开展示 | 三门全过＋enabled 才 production_ready；全过未 enabled 是 ready_for_enable；其他是 setup_required，不由前端重算 |
| 刷新 / 首次失败重读 | 单飞，旧证据保留，读取失败独立提示 | GET /platform/provider-sources/1688-acceptance；原读取12秒超时、卸载abort；没有轮询 |
| 登录过期 / 权限拒绝 | 分别导航登录或平台概览 | /login、/platform-admin；检查路由与GET要求 platform:superadmin |
| 结论说明与下一步 | 手机展开，桌面常显 | 同来源 provider_id 的 P50 mode=login、P48 过滤定位；不自动打开样本窗或创建凭证 |
| 三项证据展开 | 名称、状态、原因、后续动作、证据时间 | 登录态/验证码/解析分别取返回值；无证据不补时间；不显示 Cookie 或账号秘密 |
| 组织 | 读取 memberships，只保留组织和成员关系均 active | 选首个活动组织，变化读取其工作区；读取或提交时禁用 |
| 工作区 | 仅 active，优先该组织默认工作区，否则首个 | 没有活动范围不能提交；范围错误不是来源门禁错误 |
| 范围失败重试 | “重新读取运行范围”重复既有两个GET | 这是待审恢复入口提案，不新增API或自动换组织规则 |
| 验收关键词 | maxlength 200，空白不可提交，提交时禁用 | query.trim()；UI无URL或持久化承诺 |
| 发起登录验收运行 | 冻结三个字段，记录精确意图；排队与检查重读分开 | POST /platform/provider-sources/{id}/replays，body仅 organization_id/workspace_id/query/acceptance_run:true；真实API要求 collection:replay、Origin与幂等键 |
| 运行详情 | 展开返回的 task_id | 202 scheduled仅排队；没有停止、直达、取消、自动启用或定时轮询按钮 |
| 最近运行 | 原九种状态名称及开始/结束/错误分类 | 这是独立最近记录，不推定为本次新任务；完成时间null沿源函数“尚无证据” |
| 覆盖记录 | 搜索、详情、翻页的合同、状态、原因、计数和观测时间 | 三行不直接参与 overall；“12/3/1”是原夹具，不是门禁数量或三次成功 |
| 技术详情 | overall、provider_id、request_id | 可展开但不新增秘密、下载或任务控制能力 |
| 未知提交 | 提醒可能已创建任务，暂不重复提交 | 待审本地保护，不证明后端幂等、取消或任务完成；普通检查刷新也不自动清除此保护 |

原型只登记离线意图。点击后不会自行等待几秒伪造成功；审核工具用于切换明确标注的结果图。可用浏览器控制台中的 ACCEPTANCE_C.complete 演示在途阶段，但它只结算内存请求，不访问 API。真实来源执行、会话、审计、幂等与权限不能据此验证。

## 事实夹具与已复现问题

原始 E2E 的 2/3 门禁、12 条搜索/3 条详情/1 页未演练，与另一个全 pending、无运行、无观测夹具分别从 AST 提取；没有拼接成同一真实成功链。原夹具的 3 条详情与“计划最多打开一个详情”的当前蓝图限制并不一致，保留为旧夹具，不宣称当前执行器确会产生该结果。固定最近读取时刻为 2026-09-09 10:00（Asia/Shanghai）；它不是浏览器观测时刻。

24 个门禁/来源状态变体由实际仓储 read1688Acceptance 方法处理合成 SQL 行产生。覆盖函数在该适配器中刻意返回“无观测”；这些变体不冒充真实数据库查询、解析器或覆盖测试。源 SQL 文本对同来源有效档案、活动样本、当前解析版本和最近回放时间一致性的约束有核对，但未运行 SQL。

实际 Vue 脚本在惰性桥接环境执行，验证活动范围选择、默认工作区、canSchedule、精确四字段 POST、重复提交抑制、只读一次检查、八种初次/已有数据错误、单飞、12秒定时回调和卸载abort。没有挂载 Vue，也没有真的等待12秒外部超时。

复现 SC49 提示问题：POST 返回任务后，GET 503 会先写危险提示，随后被“已提交”的成功 notice 覆盖，旧证据仍保留。原型把排队确认和证据刷新消息分开；未知结果、重绘焦点/展开状态、范围恢复按钮都是提案，未改生产组件。

另一个事实边界：仓储可以返回 source_status=enabled 且 overall=setup_required，而源 conclusion 文案声称任一待验收会保持停用。本稿明确按返回状态展示，不冒称已自动停用。分页不足时当前 coverageMatrix 返回 not_observed，而蓝图文字提到“未演练”；本稿不重写接口枚举，状态名/文案差异在真实实施前仍需收口。这里不改变启用、停用或分页判定业务规则。

## 验证、使用与未完成事项

运行 `node scripts/verify-ui-phase2-1688-acceptance-c.mjs` 可复核原数据、派生脚本、源/PNG指纹、精确图清单和交互。仅在原型修改后追加 `--capture` 重建正式图片及 evidence.json。复用已安装依赖，无开发服务，浏览器/context 在 finally 关闭。

双端67场景、零模态、24源方法组合、四提交结果、五刷新结果、三范围读取结果、组织切换、精确请求意图、未知不重试、两深链、原生展开/键盘、光标/焦点、切审核场景后迟到结果、320/759/760/761/768/1024长文案与200字输入、CSS zoom2通过。HTTP、console、pageerror及本地存储均为0。CSS zoom2不等于原生浏览器缩放、软键盘或读屏证明。

仍待：具体图审核；SC49全组合和上述文案/状态差异；真正Vue/路由/KeepAlive与范围请求生命周期；真实API/权限/MySQL/隔离浏览器作业/登录档案/验证码/当前解析器样本/双人复核；完整主题密度与辅助技术；全73页实现、宝塔部署及用户签收。P50凭证页不由这里的导航替代交付。

本批没有生产API、环境变量、依赖、数据库迁移、配置或运行时改动；Vue、后端、Python、OpenAPI与宝塔未改，无需重启。下一设计项 P50 凭证资产。

## 全场景图册

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 原始2/3门禁与12/3/1覆盖 | [查看](1440-default.png) | [查看](390-default.png) |
| 原始全部待验收 | [查看](1440-pending.png) | [查看](390-pending.png) |
| 手机结论与下一步展开 | [查看](1440-context.png) | [查看](390-context.png) |
| 三项证据全部展开 | [查看](1440-gates.png) | [查看](390-gates.png) |
| 技术详情 | [查看](1440-technical.png) | [查看](390-technical.png) |
| 初次读取 | [查看](1440-loading.png) | [查看](390-loading.png) |
| 登录过期 | [查看](1440-expired.png) | [查看](390-expired.png) |
| 权限拒绝 | [查看](1440-forbidden.png) | [查看](390-forbidden.png) |
| 首次读取失败 | [查看](1440-error.png) | [查看](390-error.png) |
| 刷新保留原证据 | [查看](1440-refreshing.png) | [查看](390-refreshing.png) |
| 刷新失败 | [查看](1440-refresh-error.png) | [查看](390-refresh-error.png) |
| 刷新超时 | [查看](1440-refresh-timeout.png) | [查看](390-refresh-timeout.png) |
| 刷新登录失效 | [查看](1440-refresh-expired.png) | [查看](390-refresh-expired.png) |
| 刷新权限拒绝 | [查看](1440-refresh-forbidden.png) | [查看](390-refresh-forbidden.png) |
| 组织读取中 | [查看](1440-scope-loading.png) | [查看](390-scope-loading.png) |
| 组织读取失败 | [查看](1440-scope-error.png) | [查看](390-scope-error.png) |
| 无活动组织 | [查看](1440-scope-empty.png) | [查看](390-scope-empty.png) |
| 工作区读取中 | [查看](1440-workspace-loading.png) | [查看](390-workspace-loading.png) |
| 无活动工作区 | [查看](1440-workspace-empty.png) | [查看](390-workspace-empty.png) |
| 工作区读取失败 | [查看](1440-workspace-error.png) | [查看](390-workspace-error.png) |
| 已填写运行范围 | [查看](1440-query-filled.png) | [查看](390-query-filled.png) |
| 200字关键词 | [查看](1440-query-limit.png) | [查看](390-query-limit.png) |
| 提交进行中 | [查看](1440-submitting.png) | [查看](390-submitting.png) |
| 已排队未完成 | [查看](1440-scheduled.png) | [查看](390-scheduled.png) |
| 已排队但重读失败 | [查看](1440-scheduled-read-error.png) | [查看](390-scheduled-read-error.png) |
| 提交失败保留输入 | [查看](1440-submit-error.png) | [查看](390-submit-error.png) |
| 提交结果未知 | [查看](1440-submit-unknown.png) | [查看](390-submit-unknown.png) |
| 已创建任务编号 | [查看](1440-task-detail.png) | [查看](390-task-detail.png) |
| 合成覆盖合同异常 | [查看](1440-coverage-invalid.png) | [查看](390-coverage-invalid.png) |
| 合成长原因 | [查看](1440-long-content.png) | [查看](390-long-content.png) |
| 键盘焦点 | [查看](1440-focus.png) | [查看](390-focus.png) |
| 悬停 | [查看](1440-hover.png) | [查看](390-hover.png) |
| 按下 | [查看](1440-pressed.png) | [查看](390-pressed.png) |
| 非业务审核工具 | [查看](1440-review-tools.png) | [查看](390-review-tools.png) |
| 合成门禁组合 无有效档案-草稿 | [查看](1440-no-profile-draft.png) | [查看](390-no-profile-draft.png) |
| 合成门禁组合 无有效档案-停用 | [查看](1440-no-profile-disabled.png) | [查看](390-no-profile-disabled.png) |
| 合成门禁组合 无有效档案-启用 | [查看](1440-no-profile-enabled.png) | [查看](390-no-profile-enabled.png) |
| 合成门禁组合 无最近运行-草稿 | [查看](1440-no-run-draft.png) | [查看](390-no-run-draft.png) |
| 合成门禁组合 无最近运行-停用 | [查看](1440-no-run-disabled.png) | [查看](390-no-run-disabled.png) |
| 合成门禁组合 无最近运行-启用 | [查看](1440-no-run-enabled.png) | [查看](390-no-run-enabled.png) |
| 合成门禁组合 登录失效-草稿 | [查看](1440-login-expired-draft.png) | [查看](390-login-expired-draft.png) |
| 合成门禁组合 登录失效-停用 | [查看](1440-login-expired-disabled.png) | [查看](390-login-expired-disabled.png) |
| 合成门禁组合 登录失效-启用 | [查看](1440-login-expired-enabled.png) | [查看](390-login-expired-enabled.png) |
| 合成门禁组合 验证码受阻-草稿 | [查看](1440-captcha-blocked-draft.png) | [查看](390-captcha-blocked-draft.png) |
| 合成门禁组合 验证码受阻-停用 | [查看](1440-captcha-blocked-disabled.png) | [查看](390-captcha-blocked-disabled.png) |
| 合成门禁组合 验证码受阻-启用 | [查看](1440-captcha-blocked-enabled.png) | [查看](390-captcha-blocked-enabled.png) |
| 合成门禁组合 旧解析版本-草稿 | [查看](1440-old-parser-draft.png) | [查看](390-old-parser-draft.png) |
| 合成门禁组合 旧解析版本-停用 | [查看](1440-old-parser-disabled.png) | [查看](390-old-parser-disabled.png) |
| 合成门禁组合 旧解析版本-启用 | [查看](1440-old-parser-enabled.png) | [查看](390-old-parser-enabled.png) |
| 合成门禁组合 解析差异-草稿 | [查看](1440-parser-changed-draft.png) | [查看](390-parser-changed-draft.png) |
| 合成门禁组合 解析差异-停用 | [查看](1440-parser-changed-disabled.png) | [查看](390-parser-changed-disabled.png) |
| 合成门禁组合 解析差异-启用 | [查看](1440-parser-changed-enabled.png) | [查看](390-parser-changed-enabled.png) |
| 合成门禁组合 待第二人审批-草稿 | [查看](1440-review-pending-draft.png) | [查看](390-review-pending-draft.png) |
| 合成门禁组合 待第二人审批-停用 | [查看](1440-review-pending-disabled.png) | [查看](390-review-pending-disabled.png) |
| 合成门禁组合 待第二人审批-启用 | [查看](1440-review-pending-enabled.png) | [查看](390-review-pending-enabled.png) |
| 合成门禁组合 三门通过-草稿 | [查看](1440-all-passed-draft.png) | [查看](390-all-passed-draft.png) |
| 合成门禁组合 三门通过-停用 | [查看](1440-all-passed-disabled.png) | [查看](390-all-passed-disabled.png) |
| 合成门禁组合 三门通过-启用 | [查看](1440-all-passed-enabled.png) | [查看](390-all-passed-enabled.png) |
| 合成最近运行 scheduled | [查看](1440-run-scheduled.png) | [查看](390-run-scheduled.png) |
| 合成最近运行 leased | [查看](1440-run-leased.png) | [查看](390-run-leased.png) |
| 合成最近运行 running | [查看](1440-run-running.png) | [查看](390-run-running.png) |
| 合成最近运行 succeeded | [查看](1440-run-succeeded.png) | [查看](390-run-succeeded.png) |
| 合成最近运行 succeeded_empty | [查看](1440-run-succeeded_empty.png) | [查看](390-run-succeeded_empty.png) |
| 合成最近运行 failed | [查看](1440-run-failed.png) | [查看](390-run-failed.png) |
| 合成最近运行 blocked | [查看](1440-run-blocked.png) | [查看](390-run-blocked.png) |
| 合成最近运行 cancelled | [查看](1440-run-cancelled.png) | [查看](390-run-cancelled.png) |
| 合成最近运行 dead_letter | [查看](1440-run-dead_letter.png) | [查看](390-run-dead_letter.png) |
