# P51 · 采集任务 / COLLECTION-TASKS-C-r1

状态：C 方向首轮具体稿的视觉已按用户 2026-09-24 全局授权通过。基线 main/b3039224；本图册仍为设计证据，不代表真实重放、权限或生产验收。

[离线交互原型](index.html) · [验证证据](evidence.json) · [事实规格](../../page-specs/P51.md)

## 构图与审核重点

frontend-design 指导蓝色查询范围与白色队列、详情中的来源事实与恢复路径；四个当前页摘要放进蓝色范围区，不再是顶部四张卡片。手机筛选与摘要按需展开，队列记录先预览，再进入完整任务详情，返回原任务按钮。既有七列和列设置/冻结/密度保留。

使用 C 的蓝 `#254a9c`、白 `#ffffff`、底色 `#edf1f6`、正文 `#202c3d`、辅助 `#58677b`、风险 `#8c3c32`。中文系统字体；标题24–32px、控件16px、说明至少13px、44px热区。复用 P50 已交付的 C 基础 CSS（纳入源指纹），本页布局独立；没有修改 P50 或生产样式。

重点请审：蓝色筛选与“当前页”摘要是否清晰；逐来源事实/缺失与恢复动作是否易找；手机两级详情与确认是否顺畅；重放的“新任务”含义和未知结果是否足够明确。

## 事实与图稿边界

原始 E2E 三任务为部分完成38条、死信0条、运行中0条，当前页摘要1/1/1/38。原始独立50/1分页夹具总数51；RSS三分类夹具与死信详情分开，不拼成真实任务。原重放返回夹具虽status=scheduled/attempt_count=0，却仍带旧四尝试和死信，本稿保留并提示，不冒充真实事务产物。

20种任务状态分别出合成状态图；当前下拉只有19种，缺automatically_replayed，草稿列表标签回退draft但选项为“草稿”。这些差异公开记录，未擅自补产品状态规则。状态图空子查询/事件明确未返回，不借其他任务数据填充。

| 操作面 / 控件 | 原合同与本稿 |
| --- | --- |
| 查询与翻页 | page/page_size=50/status发GET；文本只在当前响应页按任务/组织/工作区ID及错误码过滤，大小写不敏感且不trim，不搜索名称/来源/全库。摘要不随文本筛选变化 |
| 七列任务队列 | 状态、覆盖、优先级、次数、子查询、证据/缺失、更新时间/错误与查看；完整ID放技术详情。列设置至少一列、冻结首个可见列、标准/紧凑仅桌面 |
| 空/错误/刷新 | 首次各状态、显式刷新保留快照、15秒超时；空服务端结果保留筛选入口是提案，原界面空状态会隐藏筛选。修正状态面不符实际动作的文案，不伪造重新登录/申请权限接口 |
| 手机记录 | 预览状态/覆盖/子查询/证据/缺失/更新时间、技术展开、完整详情入口、关闭回原记录按钮；不叠加新的业务抽屉 |
| 完整详情 | 常驻标题、描述和关闭；loading/error/loaded，错误重试精确task ID。逐来源必需性、结果/缺失、真实起止及耗时、三result_kind、robots规则及版本、任务级重试时间；尝试/事件按需展开，死信和关联ID可读 |
| 恢复入口 | dead_letter进入原因；blocked_login/captcha到凭证；blocked_robots/source_changed到来源；failed_terminal/partial警告到总览；仅路由意图，不等于依赖已恢复 |
| 原因与确认 | trim后≥2、原始≤500；POST只有reason，幂等键由生产client维护。原ConfirmDialog未传destructive，默认false，只输入“确认重放”，没有影响勾选框；本次更正规格，不改变共享确认 |
| 写入结果 | 复制内部子查询，新建scheduled，旧任务manually_replayed，历史保留。未知不能称未执行；成功与随后列表失败分开。快照固定目标/原因和关闭/新任务归属仅提案 |
| 共享导航 | 采集总览/任务队列/浏览器运行，及详情恢复链接，均只记录路径；不打开外部服务 |

三个模态变体：移动记录预览、完整任务详情、嵌套重放确认。确认取消先回原因按钮，详情关闭回队列。原生details、审核工具不算新增业务弹窗。没有创建普通任务、取消后台任务、绕过来源限制或批量重放按钮（批量属于P52）。

## 已复现问题与验证层级

永久辅助脚本通过AST提取真实夹具与Vue脚本，惰性ref/computed、显式调用watch、受控请求验证当前页指标/完整过滤序列、十种首次/保留读取失败、15秒abort回调、越界回退、task移除后的迟到成功/失败保护，以及服务端原因和状态验证。不是挂载Vue或真实时钟、SQL、路由生命周期、权限、幂等/审计或Worker执行。

复现了快速状态变更被单飞忽略、旧全部状态响应覆盖新选择；确认未冻结目标/原因；旧重放成功覆盖新详情/草稿/URL。原型中的进行中锁定、结果归属、确认快照、未知不重复、常驻关闭/标题、焦点循环和保留快照提示是待审提案，不是生产修复。

真实接口仍校验collection:replay、Origin、Idempotency-Key，仓储仅dead_letter且存在子查询才创建新任务；本稿不执行SQL或外部任务。来源合同中31个LF指纹保持不变，业务状态机与安全边界不改。

## 使用与剩余验收

直接打开index.html，底部审核工具可切场景并模拟结果。运行 `node scripts/verify-ui-phase2-collection-tasks-c.mjs --capture` 生成正式图/证据；无参数校验派生数据/源逻辑/指纹/精确清单与交互。复用现有依赖，无安装或配置修改。

双端检查包括分页、当前页筛选、三模态、嵌套确认、精确重放意图、迟到结果、真实浏览器history返回/前进（静态原型）、长文本、额外断点与CSS zoom2。CSS zoom不冒充浏览器菜单缩放或辅助技术验收；初始深链重载、VueRouter/page-status历史/KeepAlive、六角色、真实API/MySQL/Redis/幂等/任务执行、完整三主题两密度仍待CL-G01–07。原型启动及审核工具切场景会重置URL；已验证的history操作不包含重载恢复。

全部图片、原型、数据和脚本是正式交付；无一次性测试文件或常驻服务，无需重启/部署。具体图需审核后才能进入Vue实施。下一P52采集总览；全73页重构、部署和用户签收未完成。

## 完整图册

part图片从长操作面顶部连续向下滚动，覆盖被视口截断的字段、历史和底部动作；不是新增业务场景。

<!-- GALLERY:START -->

正式 PNG：202 张。

| 场景 | 桌面 1440 | 移动 390 |
| --- | --- | --- |
| 原始三任务队列 | [主图](1440-default.png) | [主图](390-default.png) |
| 独立50/1分页夹具 | [主图](1440-paged.png) | [主图](390-paged.png) |
| 第二页与服务端总量 | [主图](1440-page-two.png) | [主图](390-page-two.png) |
| 当前页匹配 | [主图](1440-filtered.png) | [主图](390-filtered.png) |
| 当前页无匹配 | [主图](1440-filter-empty.png) | [主图](390-filter-empty.png) |
| 空格不作trim | [主图](1440-filter-space.png) | [主图](390-filter-space.png) |
| 首次读取 | [主图](1440-loading.png) | [主图](390-loading.png) |
| 服务端空结果 | [主图](1440-empty.png) | [主图](390-empty.png) |
| 首次401 | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次403 | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次依赖受阻 | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次读取失败 | [主图](1440-error.png) | [主图](390-error.png) |
| 保留快照刷新 | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 刷新失败保留快照 | [主图](1440-refresh-error.png) | [主图](390-refresh-error.png) |
| 15秒超时保留快照 | [主图](1440-refresh-timeout.png) | [主图](390-refresh-timeout.png) |
| 七列设置 | [主图](1440-columns.png) | [主图](390-columns.png) |
| 紧凑密度 | [主图](1440-compact.png) | [主图](390-compact.png) |
| 移动记录预览 | [主图](1440-preview.png) | [主图](390-preview.png) |
| 移动记录技术详情 | [主图](1440-preview-technical.png) | [主图](390-preview-technical.png) · [连续 1](390-preview-technical-part1.png) |
| 详情读取中可关闭 | [主图](1440-detail-loading.png) | [主图](390-detail-loading.png) |
| 详情读取失败留窗 | [主图](1440-detail-error.png) | [主图](390-detail-error.png) |
| 原始死信详情 | [主图](1440-detail.png) · [连续 1](1440-detail-part1.png) | [主图](390-detail.png) · [连续 1](390-detail-part1.png) · [连续 2](390-detail-part2.png) |
| 独立RSS三分类夹具 | [主图](1440-detail-rss.png) · [连续 1](1440-detail-rss-part1.png) · [连续 2](1440-detail-rss-part2.png) | [主图](390-detail-rss.png) · [连续 1](390-detail-rss-part1.png) · [连续 2](390-detail-rss-part2.png) · [连续 3](390-detail-rss-part3.png) |
| robots判定展开 | [主图](1440-detail-robots.png) · [连续 1](1440-detail-robots-part1.png) · [连续 2](1440-detail-robots-part2.png) | [主图](390-detail-robots.png) · [连续 1](390-detail-robots-part1.png) · [连续 2](390-detail-robots-part2.png) · [连续 3](390-detail-robots-part3.png) |
| 执行尝试和事件 | [主图](1440-detail-history.png) · [连续 1](1440-detail-history-part1.png) · [连续 2](1440-detail-history-part2.png) | [主图](390-detail-history.png) · [连续 1](390-detail-history-part1.png) · [连续 2](390-detail-history-part2.png) · [连续 3](390-detail-history-part3.png) |
| 完整技术标识 | [主图](1440-detail-technical.png) · [连续 1](1440-detail-technical-part1.png) | [主图](390-detail-technical.png) · [连续 1](390-detail-technical-part1.png) · [连续 2](390-detail-technical-part2.png) · [连续 3](390-detail-technical-part3.png) |
| 重放原因未填写 | [主图](1440-reason-empty.png) · [连续 1](1440-reason-empty-part1.png) | [主图](390-reason-empty.png) · [连续 1](390-reason-empty-part1.png) · [连续 2](390-reason-empty-part2.png) |
| 重放原因不足两字 | [主图](1440-reason-one.png) · [连续 1](1440-reason-one-part1.png) | [主图](390-reason-one.png) · [连续 1](390-reason-one-part1.png) · [连续 2](390-reason-one-part2.png) |
| 重放原因可提交 | [主图](1440-reason-filled.png) · [连续 1](1440-reason-filled-part1.png) | [主图](390-reason-filled.png) · [连续 1](390-reason-filled-part1.png) · [连续 2](390-reason-filled-part2.png) |
| 重放原因500字符 | [主图](1440-reason-limit.png) · [连续 1](1440-reason-limit-part1.png) | [主图](390-reason-limit.png) · [连续 1](390-reason-limit-part1.png) · [连续 2](390-reason-limit-part2.png) |
| 重放确认预览 | [主图](1440-confirm.png) | [主图](390-confirm.png) |
| 确认短语已满足 | [主图](1440-confirm-typed.png) | [主图](390-confirm-typed.png) |
| 正在创建新任务 | [主图](1440-replaying.png) · [连续 1](1440-replaying-part1.png) | [主图](390-replaying.png) · [连续 1](390-replaying-part1.png) · [连续 2](390-replaying-part2.png) |
| 重放明确拒绝 | [主图](1440-replay-error.png) · [连续 1](1440-replay-error-part1.png) | [主图](390-replay-error.png) · [连续 1](390-replay-error-part1.png) · [连续 2](390-replay-error-part2.png) |
| 重放结果未知 | [主图](1440-replay-unknown.png) · [连续 1](1440-replay-unknown-part1.png) | [主图](390-replay-unknown.png) · [连续 1](390-replay-unknown-part1.png) · [连续 2](390-replay-unknown-part2.png) |
| 新任务已创建（原返回夹具） | [主图](1440-replay-success.png) · [连续 1](1440-replay-success-part1.png) | [主图](390-replay-success.png) · [连续 1](390-replay-success-part1.png) |
| 创建成功与列表重读失败分开 | [主图](1440-replay-refresh-error.png) · [连续 1](1440-replay-refresh-error-part1.png) | [主图](390-replay-refresh-error.png) · [连续 1](390-replay-refresh-error-part1.png) |
| 缺少子查询与历史 | [主图](1440-missing-detail.png) · [连续 1](1440-missing-detail-part1.png) | [主图](390-missing-detail.png) · [连续 1](390-missing-detail-part1.png) · [连续 2](390-missing-detail-part2.png) |
| 长来源和缺失字段 | [主图](1440-long-content.png) · [连续 1](1440-long-content-part1.png) | [主图](390-long-content.png) · [连续 1](390-long-content-part1.png) · [连续 2](390-long-content-part2.png) |
| 键盘焦点 | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 审核工具面板 | [主图](1440-tools.png) | [主图](390-tools.png) |
| 独立状态变体 / draft | [主图](1440-state-draft.png) | [主图](390-state-draft.png) · [连续 1](390-state-draft-part1.png) |
| 独立状态变体 / 待调度 | [主图](1440-state-scheduled.png) | [主图](390-state-scheduled.png) · [连续 1](390-state-scheduled-part1.png) |
| 独立状态变体 / 已排队 | [主图](1440-state-queued.png) | [主图](390-state-queued.png) · [连续 1](390-state-queued-part1.png) |
| 独立状态变体 / 已租约 | [主图](1440-state-leased.png) | [主图](390-state-leased.png) · [连续 1](390-state-leased-part1.png) |
| 独立状态变体 / 执行中 | [主图](1440-state-running.png) | [主图](390-state-running.png) · [连续 1](390-state-running-part1.png) |
| 独立状态变体 / 解析中 | [主图](1440-state-parsing.png) | [主图](390-state-parsing.png) · [连续 1](390-state-parsing-part1.png) |
| 独立状态变体 / 校验中 | [主图](1440-state-validating.png) | [主图](390-state-validating.png) · [连续 1](390-state-validating-part1.png) |
| 独立状态变体 / 已持久化 | [主图](1440-state-persisted.png) | [主图](390-state-persisted.png) · [连续 1](390-state-persisted-part1.png) |
| 独立状态变体 / 等待重试 | [主图](1440-state-retry_scheduled.png) | [主图](390-state-retry_scheduled.png) · [连续 1](390-state-retry_scheduled-part1.png) |
| 独立状态变体 / 登录受阻 | [主图](1440-state-blocked_login.png) | [主图](390-state-blocked_login.png) · [连续 1](390-state-blocked_login-part1.png) |
| 独立状态变体 / 验证码受阻 | [主图](1440-state-blocked_captcha.png) | [主图](390-state-blocked_captcha.png) · [连续 1](390-state-blocked_captcha-part1.png) |
| 独立状态变体 / 网站规则限制 | [主图](1440-state-blocked_robots.png) | [主图](390-state-blocked_robots.png) · [连续 1](390-state-blocked_robots-part1.png) |
| 独立状态变体 / 限流等待 | [主图](1440-state-rate_limited.png) | [主图](390-state-rate_limited.png) · [连续 1](390-state-rate_limited-part1.png) |
| 独立状态变体 / 成功 | [主图](1440-state-succeeded.png) | [主图](390-state-succeeded.png) · [连续 1](390-state-succeeded-part1.png) |
| 独立状态变体 / 无可用结果 | [主图](1440-state-succeeded_empty.png) | [主图](390-state-succeeded_empty.png) · [连续 1](390-state-succeeded_empty-part1.png) |
| 独立状态变体 / 部分完成 | [主图](1440-state-completed_with_warnings.png) | [主图](390-state-completed_with_warnings.png) · [连续 1](390-state-completed_with_warnings-part1.png) |
| 独立状态变体 / 终止失败 | [主图](1440-state-failed_terminal.png) | [主图](390-state-failed_terminal.png) · [连续 1](390-state-failed_terminal-part1.png) |
| 独立状态变体 / 死信 | [主图](1440-state-dead_letter.png) · [连续 1](1440-state-dead_letter-part1.png) | [主图](390-state-dead_letter.png) · [连续 1](390-state-dead_letter-part1.png) · [连续 2](390-state-dead_letter-part2.png) |
| 独立状态变体 / 已人工重放 | [主图](1440-state-manually_replayed.png) | [主图](390-state-manually_replayed.png) · [连续 1](390-state-manually_replayed-part1.png) |
| 独立状态变体 / 凭证续期后已自动重放 | [主图](1440-state-automatically_replayed.png) | [主图](390-state-automatically_replayed.png) · [连续 1](390-state-automatically_replayed-part1.png) |

<!-- GALLERY:END -->
