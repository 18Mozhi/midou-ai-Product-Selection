# P59 安全中心 · SECURITY-C-r1

状态：C方向已选择，**本页具体稿待审**。离线调查工作区原型和双端全场景图；不修改生产代码或权限，不执行生产GET读取审计。

## 设计结构

蓝色调查分类导航 → 白色匹配记录 → 独立证据详情。四分类为事件、会话、访问与凭证、平台审计；访问与凭证始终保留凭证和组织令牌两个集合，不把它们压成一个混合表。六项全平台背景摘要与匹配记录数量、已读取时点分离，不制造威胁评分、风险等级或“一键处置”。

导航蓝#102A63、操作蓝#1748B5、纸白#FFFFFF、背景灰#F3F6FA、正文墨蓝#17253C、警示棕#9A5800。微软雅黑/苹方中文正文16px、元信息13px、标题30/21px、44px热区，全部左对齐。用调查分类与证据层级建立识别性，不使用通用仪表卡阵列、装饰渐变或密钥展示器。

## 全部动作、详情和输入

| 合同 | 新稿范围 | 边界 |
| --- | --- | --- |
| SO59-WINDOW | 24小时/7天/30天选择并读取 | 时间窗只过滤事件/审计，生命周期按观察时点 |
| SO59-LOAD | 刷新/首次错误重试 | 原Vue手动刷新500ms去抖与单飞；原型明确在途和旧快照 |
| SO59-VIEW | 四分类导航，手机2×2常显 | 切分类清查询/状态/双页，保留时间窗；无新增路由 |
| SO59-FILTER/RESET | 120字符搜索、每视图三状态与全部、重置 | 事件/审计succeeded/failed/blocked；生命周期active/expired/revoked |
| SO59-PAGE/TOKEN-PAGE | 五集合各20条主/令牌分页 | 凭证page与令牌token_page独立，不复用一个页码 |
| ResponsiveDataView ×5 | 事件、会话、凭证、令牌、审计完整详情及技术展开 | 桌面也给完整阅读入口是展示提案；无业务确认/写入窗 |
| TableViewControls ×5 | 各集合独立列选择、至少一列、首个可见列冻结、标准/紧凑 | 只影响桌面展示，不删响应字段或手机详情；不是共享全局设置 |
| SO59-MANAGE | 凭证管理入口预览 | 真实目标/platform-admin/credentials需独立授权；原型只解释，不跳生产 |
| TechnicalDetails | 页面请求/时点及五记录技术标识 | 不是查看密钥；不增加复制或下载接口 |

原页三个v-model均保留。五类详情保留已有正文与技术字段；额外展开响应内记录version/updated_at及审计id，是显示已有返回值，不新增接口。事件/操作/类型/权限中文映射从真实Vue函数转译，不把未知值包装为已知风险。组织令牌report:read不等同于开放平台Client的status:read。

## 事实来源与改进边界

原始E2E夹具通过AST提取，original图明确五集合同时非空、事件1行/41计数与真实按view读取不同；不用于证明分页。正常原型是明确合成的每集合三条及20/21分页样例；无真实客户记录、原始IP/UA、会话token/hash、凭证密文/nonce/auth tag。会话设备仅粗粒度系统/浏览器，令牌仅前缀、凭证仅指纹与密钥版本。

七组永久源检查隔离执行实际Vue、服务与仓储函数：快速route watcher切换遭单飞早退、activeView与响应view不一致；跨路由watch、忽略abort后的卸载迟到写ref；首401/403/429/5xx/其他映射、首次超时错误文案与已有403保留事实；URL默认省略/切分类清筛选、五详情消费者、三个字段；48组时间窗/视图/状态服务校验与参数/依赖边界；仓储四view分支、独立分页压尾、设备摘要、scopes_json剥离、有效状态SQL谓词、转义搜索及先读后两条审计INSERT意图；GET能力和cache静态合同。

SQL由惰性适配器返回固定样例，不执行MySQL，因此有效状态CASE、真实过滤/排序、字段投影及审计事务都只证明代码与查询意图，不是实库安全/权限验收。成功读取真实服务会写security_operations_views和platform_audit_events，不能把“只读页面”称为数据库零写；本包无HTTP、SQL或生产副作用。

请求序号/快照归属、正确首超时文案和原生模态焦点保护只在待审原型，不宣称生产修复。共享详情源码目前缺完整Tab圈定；新原型五消费者分别验证。实际Vue挂载、KeepAlive、浏览器前进后退、最小权限、原始设备搜索与脱敏响应、三主题两密度全部组合、软键盘及辅助技术仍待实施验收。安全对象撤销/轮换规则没有扩大。

## 验证与使用

[打开离线交互审核原型](index.html)，使用底部场景选择器审阅。生成：`node scripts/verify-ui-phase2-security-c.mjs --capture`；复验：相同命令不带参数。只复用已有依赖；源LF哈希、历史B2c相关10项指纹、每张PNG哈希、链接及交互同时校验，不覆盖历史合同表。

1440×1000/390×844全场景，长详情按连续滚动主图＋局部分图保留到底部；320/759/760/761/768/1024边界和CSS 200%缩放检查，44px/16px/13px指标、Tab/ShiftTab/Escape、遮罩关闭/返焦、独立列选择/分页、旧响应忽略。CSS缩放不是原生浏览器缩放；代表深色/高对比/紧凑图不是全组合验收。

全站目标仍为73页图稿审核、真实Vue重构、完整测试与宝塔部署签收。本包不部署、无需重启；未改API/OpenAPI/env/schema/依赖/运行参数，Worker/Python无关不改。正式图、证据、原型及永久生成验证脚本是交付物；没有临时服务器，验证浏览器在finally关闭。下一P60开放平台；本页具体审核未通过前不称完成全站风格重构。

<!-- GALLERY:START -->
正式PNG：177张；84场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 事件调查默认工作区 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 原始E2E夹具 / 计数与集合不当分页事实 (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 活动与历史会话 (sessions) | [主图](1440-sessions.png) | [主图](390-sessions.png) |
| 凭证与令牌双列表 (credentials) | [主图](1440-credentials.png) | [主图](390-credentials.png) |
| 平台审计 (audit) | [主图](1440-audit.png) | [主图](390-audit.png) |
| 7天事件范围 (window-7d) | [主图](1440-window-7d.png) | [主图](390-window-7d.png) |
| 30天审计范围 (window-30d) | [主图](1440-window-30d.png) | [主图](390-window-30d.png) |
| 生命周期不受事件时间窗筛选 (lifecycle-window) | [主图](1440-lifecycle-window.png) | [主图](390-lifecycle-window.png) |
| 查询草稿未应用 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 120字符查询上界 (filter-max) | [主图](1440-filter-max.png) | [主图](390-filter-max.png) |
| 应用筛选在途 (filter-pending) | [主图](1440-filter-pending.png) | [主图](390-filter-pending.png) |
| 筛选失败保留旧范围 (filter-error) | [主图](1440-filter-error.png) | [主图](390-filter-error.png) |
| 跨视图读取中 (switch-pending) | [主图](1440-switch-pending.png) | [主图](390-switch-pending.png) |
| 跨视图失败 / 旧事实不换标题 (switch-error) | [主图](1440-switch-error.png) | [主图](390-switch-error.png) |
| 全局摘要与全部记录为空 (empty) | [主图](1440-empty.png) | [主图](390-empty.png) |
| 凭证和令牌各自空态 (empty-credentials) | [主图](1440-empty-credentials.png) | [主图](390-empty-credentials.png) |
| 凭证空但令牌仍有记录 (credentials-empty-only) | [主图](1440-credentials-empty-only.png) | [主图](390-credentials-empty-only.png) |
| 令牌空但凭证仍有记录 (tokens-empty-only) | [主图](1440-tokens-empty-only.png) | [主图](390-tokens-empty-only.png) |
| 零摘要仍有过期历史会话 (history-sessions) | [主图](1440-history-sessions.png) | [主图](390-history-sessions.png) |
| 零摘要仍有过期历史凭证 (history-credentials) | [主图](1440-history-credentials.png) | [主图](390-history-credentials.png) |
| 零摘要仍有审计记录 (history-audit) | [主图](1440-history-audit.png) | [主图](390-history-audit.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次登录失效 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 首次缺少权限 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 首次请求受限 (rate-limited) | [主图](1440-rate-limited.png) | [主图](390-rate-limited.png) |
| 首次依赖受阻 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次通用错误 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 首次超时无旧快照 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 刷新失败保留成功快照 (refresh-error) | [主图](1440-refresh-error.png) | [主图](390-refresh-error.png) |
| 刷新403保留旧事实的源边界 (refresh-forbidden) | [主图](1440-refresh-forbidden.png) | [主图](390-refresh-forbidden.png) |
| 未知事件代码保持可查 (unknown-event) | [主图](1440-unknown-event.png) | [主图](390-unknown-event.png) |
| 未知凭证类型 (unknown-kind) | [主图](1440-unknown-kind.png) | [主图](390-unknown-kind.png) |
| 未知令牌权限 / 未授予权限 (unknown-scope) | [主图](1440-unknown-scope.png) | [主图](390-unknown-scope.png) |
| 未知平台操作/对象 (unknown-audit) | [主图](1440-unknown-audit.png) | [主图](390-unknown-audit.png) |
| 匿名事件 (anonymous) | [主图](1440-anonymous.png) | [主图](390-anonymous.png) |
| 无到期和最近使用时间 (no-expiry) | [主图](1440-no-expiry.png) | [主图](390-no-expiry.png) |
| 长名称与字段换行 (long-name) | [主图](1440-long-name.png) | [主图](390-long-name.png) |
| 凭证管理入口预览 (manage) | [主图](1440-manage.png) | [主图](390-manage.png) |
| 来源问题与原型边界 (source-boundary) | [主图](1440-source-boundary.png) | [主图](390-source-boundary.png) · [局部1](390-source-boundary-part1.png) |
| 页面读取技术信息 (technical) | [主图](1440-technical.png) | [主图](390-technical.png) |
| 按钮键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 按钮悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按钮按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 读取中禁用 (disabled) | [主图](1440-disabled.png) | [主图](390-disabled.png) |
| 深色审核 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比审核 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 紧凑密度审核 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 登录与风险事件 / 成功 (status-events-succeeded) | [主图](1440-status-events-succeeded.png) | [主图](390-status-events-succeeded.png) |
| 登录与风险事件 / 失败 (status-events-failed) | [主图](1440-status-events-failed.png) | [主图](390-status-events-failed.png) |
| 登录与风险事件 / 已阻止 (status-events-blocked) | [主图](1440-status-events-blocked.png) | [主图](390-status-events-blocked.png) |
| 活动与历史会话 / 可用 (status-sessions-active) | [主图](1440-status-sessions-active.png) | [主图](390-status-sessions-active.png) |
| 活动与历史会话 / 已过期 (status-sessions-expired) | [主图](1440-status-sessions-expired.png) | [主图](390-status-sessions-expired.png) |
| 活动与历史会话 / 已撤销 (status-sessions-revoked) | [主图](1440-status-sessions-revoked.png) | [主图](390-status-sessions-revoked.png) |
| 访问与凭证 / 可用 (status-credentials-active) | [主图](1440-status-credentials-active.png) | [主图](390-status-credentials-active.png) |
| 访问与凭证 / 已过期 (status-credentials-expired) | [主图](1440-status-credentials-expired.png) | [主图](390-status-credentials-expired.png) |
| 访问与凭证 / 已撤销 (status-credentials-revoked) | [主图](1440-status-credentials-revoked.png) | [主图](390-status-credentials-revoked.png) |
| 平台审计 / 成功 (status-audit-succeeded) | [主图](1440-status-audit-succeeded.png) | [主图](390-status-audit-succeeded.png) |
| 平台审计 / 失败 (status-audit-failed) | [主图](1440-status-audit-failed.png) | [主图](390-status-audit-failed.png) |
| 平台审计 / 已阻止 (status-audit-blocked) | [主图](1440-status-audit-blocked.png) | [主图](390-status-audit-blocked.png) |
| 登录与风险事件 / 完整详情 (detail-security_events) | [主图](1440-detail-security_events.png) | [主图](390-detail-security_events.png) |
| 登录与风险事件 / 技术字段展开 (tech-security_events) | [主图](1440-tech-security_events.png) | [主图](390-tech-security_events.png) · [局部1](390-tech-security_events-part1.png) |
| 登录与风险事件 / 独立列设置 (settings-security_events) | [主图](1440-settings-security_events.png) | [主图](390-settings-security_events.png) |
| 登录与风险事件 / 首20条 (page-security_events-first) | [主图](1440-page-security_events-first.png) | [主图](390-page-security_events-first.png) |
| 登录与风险事件 / 末页1条 (page-security_events-last) | [主图](1440-page-security_events-last.png) | [主图](390-page-security_events-last.png) |
| 活动与历史会话 / 完整详情 (detail-sessions) | [主图](1440-detail-sessions.png) | [主图](390-detail-sessions.png) · [局部1](390-detail-sessions-part1.png) |
| 活动与历史会话 / 技术字段展开 (tech-sessions) | [主图](1440-tech-sessions.png) | [主图](390-tech-sessions.png) · [局部1](390-tech-sessions-part1.png) |
| 活动与历史会话 / 独立列设置 (settings-sessions) | [主图](1440-settings-sessions.png) | [主图](390-settings-sessions.png) |
| 活动与历史会话 / 首20条 (page-sessions-first) | [主图](1440-page-sessions-first.png) | [主图](390-page-sessions-first.png) |
| 活动与历史会话 / 末页1条 (page-sessions-last) | [主图](1440-page-sessions-last.png) | [主图](390-page-sessions-last.png) |
| 凭证生命周期 / 完整详情 (detail-credential_assets) | [主图](1440-detail-credential_assets.png) | [主图](390-detail-credential_assets.png) · [局部1](390-detail-credential_assets-part1.png) |
| 凭证生命周期 / 技术字段展开 (tech-credential_assets) | [主图](1440-tech-credential_assets.png) | [主图](390-tech-credential_assets.png) · [局部1](390-tech-credential_assets-part1.png) |
| 凭证生命周期 / 独立列设置 (settings-credential_assets) | [主图](1440-settings-credential_assets.png) | [主图](390-settings-credential_assets.png) |
| 凭证生命周期 / 首20条 (page-credential_assets-first) | [主图](1440-page-credential_assets-first.png) | [主图](390-page-credential_assets-first.png) |
| 凭证生命周期 / 末页1条 (page-credential_assets-last) | [主图](1440-page-credential_assets-last.png) | [主图](390-page-credential_assets-last.png) |
| 组织访问令牌 / 完整详情 (detail-organization_tokens) | [主图](1440-detail-organization_tokens.png) | [主图](390-detail-organization_tokens.png) · [局部1](390-detail-organization_tokens-part1.png) |
| 组织访问令牌 / 技术字段展开 (tech-organization_tokens) | [主图](1440-tech-organization_tokens.png) | [主图](390-tech-organization_tokens.png) · [局部1](390-tech-organization_tokens-part1.png) |
| 组织访问令牌 / 独立列设置 (settings-organization_tokens) | [主图](1440-settings-organization_tokens.png) | [主图](390-settings-organization_tokens.png) |
| 组织访问令牌 / 首20条 (page-organization_tokens-first) | [主图](1440-page-organization_tokens-first.png) | [主图](390-page-organization_tokens-first.png) |
| 组织访问令牌 / 末页1条 (page-organization_tokens-last) | [主图](1440-page-organization_tokens-last.png) | [主图](390-page-organization_tokens-last.png) |
| 平台审计 / 完整详情 (detail-audit_events) | [主图](1440-detail-audit_events.png) | [主图](390-detail-audit_events.png) |
| 平台审计 / 技术字段展开 (tech-audit_events) | [主图](1440-tech-audit_events.png) | [主图](390-tech-audit_events.png) · [局部1](390-tech-audit_events-part1.png) |
| 平台审计 / 独立列设置 (settings-audit_events) | [主图](1440-settings-audit_events.png) | [主图](390-settings-audit_events.png) |
| 平台审计 / 首20条 (page-audit_events-first) | [主图](1440-page-audit_events-first.png) | [主图](390-page-audit_events-first.png) |
| 平台审计 / 末页1条 (page-audit_events-last) | [主图](1440-page-audit_events-last.png) | [主图](390-page-audit_events-last.png) |
<!-- GALLERY:END -->
