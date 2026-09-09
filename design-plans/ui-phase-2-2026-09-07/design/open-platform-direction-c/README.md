# P60 开放平台 · OPEN-PLATFORM-C-r1

状态：C方向已选，本页具体稿待审。蓝色组织导航、白色接入管理与投递调查；仅离线原型，无生产请求、真实密钥或外发。

## 设计与操作合同

三个任务工作区：接口账号、事件回调、投递记录。导航保留组织范围统计，列表筛选独立；组织输入草稿与已读取范围分别标注。创建移至专用填写窗口，行操作先填写本次原因，再核对冻结的对象、版本、请求与影响。详情→原因→确认使用单一原生模态逐步呈现，避免叠层争抢焦点。此前共享原因在投递视图不可见的问题在提案中消除。

frontend-design指导本稿围绕接入任务组织层级，不以相同统计卡片铺满工作区。导航蓝#102A63、操作蓝#1748B5、纸白#FFFFFF、灰#F3F6FA、墨蓝#17253C、警示棕#9A5800；微软雅黑/苹方正文16px、辅助13px，44px热区。蓝色只用于导航和操作锚点，操作影响贴近确认。

| 实际动作 | 本稿覆盖 | 不扩大内容 |
| --- | --- | --- |
| 组织读取/刷新/重试 | 草稿、在途、成功快照、保留失败 | 一次GET读三集合；切视图不发GET |
| 搜索/状态/排序/10、20、50分页 | 三套独立过滤；空与超界页 | 摘要仅按组织；服务不自动压末页；示例排序不冒称稳定SQL |
| Client创建 | 组织/名称/额度/原因与固定status:read | UI1–1000、默认60；服务上限来自配置 |
| Client轮换/撤销 | active行入口、权限/配额/旧密钥后果 | 仅撤销需影响勾选，无输入短语 |
| Webhook创建 | 组织/名称/HTTPS443/四事件/原因 | 不新增scope/事件，至少一项 |
| Webhook启停/测试/轮换 | 保留原值PATCH、active才可测试 | 不伪造完整编辑功能；202不代表外部成功 |
| 投递重放 | 仅succeeded/dead_letter、明确原因 | 新delivery保留旧历史；无尝试历史读取接口 |
| 三类详情及列设置 | 完整字段/技术展开、最少一列/冻结/密度 | 只展示元数据，无密钥下载 |
| 一次性密钥 | 创建/轮换首次回执、复制拒绝、保存关闭 | 仅说明性占位，不生成或复制真实密钥 |

## 来源与证据边界

原E2E数据通过AST提取，原始c1/w1/d1不是合法UUID，单行夹具不能证明分页。正常图使用明确合成的四Client、两Webhook、五投递状态；分页另用21行示例，无客户数据。中文状态、事件、scope和确认请求内容来自实际Vue函数；Webhook active在本页语境显示“启用”。

七组源码隔离检查复现读取单飞丢请求、URL/组织输入与旧快照不一致、卸载迟到写入、首超时误称保留、写成功覆盖读取失败、secret跨视图/卸载未清理；核对创建字段及行操作body、50组服务状态/排序、范围计数和超界页、首次密钥响应与幂等重放去密钥。服务使用惰性仓储与封装替身；生成的测试材料不输出、不持久化。查询只交给惰性适配器，不执行SQL、审计、加密实库或外发。Worker和权限/同源/幂等/202为静态约束，不是SSRF审计或投递验收。

图中的明确组织归属、独立操作原因、快照/迟到保护、原生模态与密钥关闭清理是待审提案，生产Vue未修复。取消未提交确认不会发请求；已提交事务不能靠关闭窗口撤销。结果未知不得直接重复创建；幂等重放不会补发首次明文。当前原型操作成功只显示模拟回执，不伪造已持久化的新账号或Worker状态。

## 使用与待办

[打开离线原型](index.html)，底部切换全部场景。确认后的在途窗提供明确标注的审核工具，用于模拟成功、失败、无密钥重放和写成功读失败。生成命令：`node scripts/verify-ui-phase2-open-platform-c.mjs --capture`；复验不带参数。仅复用现有依赖。

1440×1000、390×844主图及连续长窗局部；邻界断点与CSS200%缩放、焦点/Tab/Escape/返回及字段错误检查。已覆盖三桌面表格冻结首个可见列/独立密度、三集合最少一列、非法组织不应用范围、首次失败不称保留，以及关窗后的迟到回执不重新显示密钥。CSS zoom不等于原生浏览器缩放，代表深色/高对比/紧凑不代表全部主题密度、软键盘、辅助技术或Vue缓存生命周期通过。

按计划分包，下一继续W07的P63接口覆盖证据；P61已有代表设计稿，不重复计数，随后推进W08。

不改生产Vue/API/OpenAPI/env/schema/依赖/权限/Worker/Python，不部署、不重启。真实MySQL5.7、密钥存储/轮换/nonce/配额、最小角色、外部接收与签名、用户具体图审核及全73页实现部署签收仍待办。正式图与永久验证文件为交付物；浏览器在finally关闭，无临时服务器。

<!-- GALLERY:START -->
正式PNG：224张；103场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 接口账号工作区 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 事件回调工作区 (webhooks) | [主图](1440-webhooks.png) | [主图](390-webhooks.png) |
| 投递调查工作区 (deliveries) | [主图](1440-deliveries.png) | [主图](390-deliveries.png) |
| 原始E2E夹具（非真实ID） (original) | [主图](1440-original.png) | [主图](390-original.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 会话过期401 (expired) | [主图](1440-expired.png) | [主图](390-expired.png) |
| 权限拒绝403 (forbidden) | [主图](1440-forbidden.png) | [主图](390-forbidden.png) |
| 读取限流429 (rate_limited) | [主图](1440-rate_limited.png) | [主图](390-rate_limited.png) |
| 依赖受阻503 (blocked) | [主图](1440-blocked.png) | [主图](390-blocked.png) |
| 首次读取失败 (error) | [主图](1440-error.png) | [主图](390-error.png) |
| 首次超时无旧快照 (timeout) | [主图](1440-timeout.png) | [主图](390-timeout.png) |
| 组织输入尚未读取 (org-draft) | [主图](1440-org-draft.png) | [主图](390-org-draft.png) |
| 跨组织读取中 (org-pending) | [主图](1440-org-pending.png) | [主图](390-org-pending.png) |
| 跨组织失败保留旧范围 (org-error) | [主图](1440-org-error.png) | [主图](390-org-error.png) |
| 筛选草稿未应用 (query-draft) | [主图](1440-query-draft.png) | [主图](390-query-draft.png) |
| 筛选读取中 (query-pending) | [主图](1440-query-pending.png) | [主图](390-query-pending.png) |
| 筛选失败保留旧快照 (query-error) | [主图](1440-query-error.png) | [主图](390-query-error.png) |
| 写入成功但读取失败 (write-read-error) | [主图](1440-write-read-error.png) | [主图](390-write-read-error.png) |
| 幂等重放不再返回密钥 (replay-no-secret) | [主图](1440-replay-no-secret.png) | [主图](390-replay-no-secret.png) |
| 一次性密钥复制拒绝 (copy-denied) | [主图](1440-copy-denied.png) | [主图](390-copy-denied.png) |
| 密钥关闭后清除 (secret-cleared) | [主图](1440-secret-cleared.png) | [主图](390-secret-cleared.png) |
| 操作结果未知 (unknown-result) | [主图](1440-unknown-result.png) | [主图](390-unknown-result.png) · [局部1](390-unknown-result-part1.png) |
| 版本冲突409 (conflict) | [主图](1440-conflict.png) | [主图](390-conflict.png) · [局部1](390-conflict-part1.png) |
| 操作权限拒绝403 (write-forbidden) | [主图](1440-write-forbidden.png) | [主图](390-write-forbidden.png) · [局部1](390-write-forbidden-part1.png) |
| 操作限流429 (write-rate-limit) | [主图](1440-write-rate-limit.png) | [主图](390-write-rate-limit.png) · [局部1](390-write-rate-limit-part1.png) |
| 操作依赖受阻503 (write-blocked) | [主图](1440-write-blocked.png) | [主图](390-write-blocked.png) · [局部1](390-write-blocked-part1.png) |
| 深色代表场景 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比代表场景 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 紧凑代表场景 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 刷新悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 刷新按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 接口账号完整详情 (detail-clients) | [主图](1440-detail-clients.png) | [主图](390-detail-clients.png) |
| 接口账号技术展开 (tech-clients) | [主图](1440-tech-clients.png) | [主图](390-tech-clients.png) · [局部1](390-tech-clients-part1.png) |
| 接口账号列设置 (columns-clients) | [主图](1440-columns-clients.png) | [主图](390-columns-clients.png) |
| 接口账号空集合 (empty-clients) | [主图](1440-empty-clients.png) | [主图](390-empty-clients.png) |
| 接口账号21条第一页 (page-clients) | [主图](1440-page-clients.png) | [主图](390-page-clients.png) |
| 接口账号21条末页 (page2-clients) | [主图](1440-page2-clients.png) | [主图](390-page2-clients.png) |
| 接口账号状态：active (status-clients-active) | [主图](1440-status-clients-active.png) | [主图](390-status-clients-active.png) |
| 接口账号状态：expired (status-clients-expired) | [主图](1440-status-clients-expired.png) | [主图](390-status-clients-expired.png) |
| 接口账号状态：revoked (status-clients-revoked) | [主图](1440-status-clients-revoked.png) | [主图](390-status-clients-revoked.png) |
| 接口账号状态：rotated (status-clients-rotated) | [主图](1440-status-clients-rotated.png) | [主图](390-status-clients-rotated.png) |
| 事件回调完整详情 (detail-webhooks) | [主图](1440-detail-webhooks.png) | [主图](390-detail-webhooks.png) |
| 事件回调技术展开 (tech-webhooks) | [主图](1440-tech-webhooks.png) | [主图](390-tech-webhooks.png) · [局部1](390-tech-webhooks-part1.png) |
| 事件回调列设置 (columns-webhooks) | [主图](1440-columns-webhooks.png) | [主图](390-columns-webhooks.png) |
| 事件回调空集合 (empty-webhooks) | [主图](1440-empty-webhooks.png) | [主图](390-empty-webhooks.png) |
| 事件回调21条第一页 (page-webhooks) | [主图](1440-page-webhooks.png) | [主图](390-page-webhooks.png) |
| 事件回调21条末页 (page2-webhooks) | [主图](1440-page2-webhooks.png) | [主图](390-page2-webhooks.png) |
| 事件回调状态：active (status-webhooks-active) | [主图](1440-status-webhooks-active.png) | [主图](390-status-webhooks-active.png) |
| 事件回调状态：disabled (status-webhooks-disabled) | [主图](1440-status-webhooks-disabled.png) | [主图](390-status-webhooks-disabled.png) |
| 投递记录完整详情 (detail-deliveries) | [主图](1440-detail-deliveries.png) | [主图](390-detail-deliveries.png) |
| 投递记录技术展开 (tech-deliveries) | [主图](1440-tech-deliveries.png) | [主图](390-tech-deliveries.png) · [局部1](390-tech-deliveries-part1.png) |
| 投递记录列设置 (columns-deliveries) | [主图](1440-columns-deliveries.png) | [主图](390-columns-deliveries.png) |
| 投递记录空集合 (empty-deliveries) | [主图](1440-empty-deliveries.png) | [主图](390-empty-deliveries.png) |
| 投递记录21条第一页 (page-deliveries) | [主图](1440-page-deliveries.png) | [主图](390-page-deliveries.png) |
| 投递记录21条末页 (page2-deliveries) | [主图](1440-page2-deliveries.png) | [主图](390-page2-deliveries.png) |
| 投递记录状态：dead_letter (status-deliveries-dead_letter) | [主图](1440-status-deliveries-dead_letter.png) | [主图](390-status-deliveries-dead_letter.png) |
| 投递记录状态：succeeded (status-deliveries-succeeded) | [主图](1440-status-deliveries-succeeded.png) | [主图](390-status-deliveries-succeeded.png) |
| 投递记录状态：queued (status-deliveries-queued) | [主图](1440-status-deliveries-queued.png) | [主图](390-status-deliveries-queued.png) |
| 投递记录状态：leased (status-deliveries-leased) | [主图](1440-status-deliveries-leased.png) | [主图](390-status-deliveries-leased.png) |
| 投递记录状态：retry_scheduled (status-deliveries-retry_scheduled) | [主图](1440-status-deliveries-retry_scheduled.png) | [主图](390-status-deliveries-retry_scheduled.png) |
| 请求页超过末页，不自动纠页 (page-outside) | [主图](1440-page-outside.png) | [主图](390-page-outside.png) |
| 创建接口访问账号填写 (form-create-client) | [主图](1440-form-create-client.png) | [主图](390-form-create-client.png) |
| 创建接口访问账号影响确认 (confirm-create-client) | [主图](1440-confirm-create-client.png) | [主图](390-confirm-create-client.png) |
| 创建事件回调地址填写 (form-create-webhook) | [主图](1440-form-create-webhook.png) · [局部1](1440-form-create-webhook-part1.png) | [主图](390-form-create-webhook.png) · [局部1](390-form-create-webhook-part1.png) |
| 创建事件回调地址影响确认 (confirm-create-webhook) | [主图](1440-confirm-create-webhook.png) | [主图](390-confirm-create-webhook.png) |
| 轮换接口访问密钥填写 (form-client-rotate) | [主图](1440-form-client-rotate.png) | [主图](390-form-client-rotate.png) |
| 轮换接口访问密钥影响确认 (confirm-client-rotate) | [主图](1440-confirm-client-rotate.png) | [主图](390-confirm-client-rotate.png) |
| 撤销接口访问账号填写 (form-client-revoke) | [主图](1440-form-client-revoke.png) | [主图](390-form-client-revoke.png) |
| 撤销接口访问账号影响确认 (confirm-client-revoke) | [主图](1440-confirm-client-revoke.png) | [主图](390-confirm-client-revoke.png) · [局部1](390-confirm-client-revoke-part1.png) |
| 停用事件回调填写 (form-webhook-disable) | [主图](1440-form-webhook-disable.png) | [主图](390-form-webhook-disable.png) |
| 停用事件回调影响确认 (confirm-webhook-disable) | [主图](1440-confirm-webhook-disable.png) | [主图](390-confirm-webhook-disable.png) |
| 启用事件回调填写 (form-webhook-enable) | [主图](1440-form-webhook-enable.png) | [主图](390-form-webhook-enable.png) |
| 启用事件回调影响确认 (confirm-webhook-enable) | [主图](1440-confirm-webhook-enable.png) | [主图](390-confirm-webhook-enable.png) |
| 发送测试回调填写 (form-webhook-test) | [主图](1440-form-webhook-test.png) | [主图](390-form-webhook-test.png) |
| 发送测试回调影响确认 (confirm-webhook-test) | [主图](1440-confirm-webhook-test.png) | [主图](390-confirm-webhook-test.png) |
| 轮换回调签名密钥填写 (form-webhook-rotate) | [主图](1440-form-webhook-rotate.png) | [主图](390-form-webhook-rotate.png) |
| 轮换回调签名密钥影响确认 (confirm-webhook-rotate) | [主图](1440-confirm-webhook-rotate.png) | [主图](390-confirm-webhook-rotate.png) |
| 重新投递回调填写 (form-replay) | [主图](1440-form-replay.png) | [主图](390-form-replay.png) |
| 重新投递回调影响确认 (confirm-replay) | [主图](1440-confirm-replay.png) | [主图](390-confirm-replay.png) |
| 创建接口访问账号字段错误 (invalid-create-client) | [主图](1440-invalid-create-client.png) | [主图](390-invalid-create-client.png) · [局部1](390-invalid-create-client-part1.png) |
| 创建接口访问账号长字段与原因 (long-create-client) | [主图](1440-long-create-client.png) | [主图](390-long-create-client.png) |
| 创建事件回调地址字段错误 (invalid-create-webhook) | [主图](1440-invalid-create-webhook.png) · [局部1](1440-invalid-create-webhook-part1.png) | [主图](390-invalid-create-webhook.png) · [局部1](390-invalid-create-webhook-part1.png) |
| 创建事件回调地址长字段与原因 (long-create-webhook) | [主图](1440-long-create-webhook.png) · [局部1](1440-long-create-webhook-part1.png) | [主图](390-long-create-webhook.png) · [局部1](390-long-create-webhook-part1.png) |
| 创建接口访问账号一次性密钥响应 (secret-create-client) | [主图](1440-secret-create-client.png) | [主图](390-secret-create-client.png) |
| 创建事件回调地址一次性密钥响应 (secret-create-webhook) | [主图](1440-secret-create-webhook.png) | [主图](390-secret-create-webhook.png) |
| 轮换接口访问密钥一次性密钥响应 (secret-client-rotate) | [主图](1440-secret-client-rotate.png) | [主图](390-secret-client-rotate.png) |
| 轮换回调签名密钥一次性密钥响应 (secret-webhook-rotate) | [主图](1440-secret-webhook-rotate.png) | [主图](390-secret-webhook-rotate.png) |
| 写入在途防重复 (pending-write) | [主图](1440-pending-write.png) | [主图](390-pending-write.png) · [局部1](390-pending-write-part1.png) |
| 测试202排队结果 (queued-test) | [主图](1440-queued-test.png) | [主图](390-queued-test.png) |
| 重放202排队结果 (queued-replay) | [主图](1440-queued-replay.png) | [主图](390-queued-replay.png) |
| 完整长网址与事件详情 (long-webhook-detail) | [主图](1440-long-webhook-detail.png) | [主图](390-long-webhook-detail.png) · [局部1](390-long-webhook-detail-part1.png) |
| 接口账号排序：最近更新 (sort-clients-updated_desc) | [主图](1440-sort-clients-updated_desc.png) | [主图](390-sort-clients-updated_desc.png) |
| 接口账号排序：最早更新 (sort-clients-updated_asc) | [主图](1440-sort-clients-updated_asc.png) | [主图](390-sort-clients-updated_asc.png) |
| 接口账号排序：名称升序 (sort-clients-name_asc) | [主图](1440-sort-clients-name_asc.png) | [主图](390-sort-clients-name_asc.png) |
| 接口账号排序：名称降序 (sort-clients-name_desc) | [主图](1440-sort-clients-name_desc.png) | [主图](390-sort-clients-name_desc.png) |
| 事件回调排序：最近更新 (sort-webhooks-updated_desc) | [主图](1440-sort-webhooks-updated_desc.png) | [主图](390-sort-webhooks-updated_desc.png) |
| 事件回调排序：最早更新 (sort-webhooks-updated_asc) | [主图](1440-sort-webhooks-updated_asc.png) | [主图](390-sort-webhooks-updated_asc.png) |
| 事件回调排序：名称升序 (sort-webhooks-name_asc) | [主图](1440-sort-webhooks-name_asc.png) | [主图](390-sort-webhooks-name_asc.png) |
| 事件回调排序：名称降序 (sort-webhooks-name_desc) | [主图](1440-sort-webhooks-name_desc.png) | [主图](390-sort-webhooks-name_desc.png) |
| 投递记录排序：最近更新 (sort-deliveries-updated_desc) | [主图](1440-sort-deliveries-updated_desc.png) | [主图](390-sort-deliveries-updated_desc.png) |
| 投递记录排序：最早更新 (sort-deliveries-updated_asc) | [主图](1440-sort-deliveries-updated_asc.png) | [主图](390-sort-deliveries-updated_asc.png) |
| 投递记录排序：尝试次数最多 (sort-deliveries-attempts_desc) | [主图](1440-sort-deliveries-attempts_desc.png) | [主图](390-sort-deliveries-attempts_desc.png) |
<!-- GALLERY:END -->
