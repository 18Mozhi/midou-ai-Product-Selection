# P57 通知管理 · PLATFORM-NOTIFICATIONS-C-r1

状态：C 方向首轮具体稿，待用户审核。全站Vue实施、真实发布与部署签收未完成。

[打开交互图稿](index.html)

## 设计与范围

蓝色三分区导航、白色消息选择/阅读面，手机消息进入完整阅读窗；人工消息、投递观测和系统事实独立。新建按钮改名为“新建草稿”，不冒充发布。正文保留纯文本/换行、三行预览和完整展开，已发布/已取消仍可读。投递六列/完整详情/筛选，20条投递与10条消息分页不混用。系统模板、渠道、订阅和前6条告警只读。

新建/编辑各三受众；标题2–200、正文2–2000，编辑/发布/取消原因2–300；无口令/影响勾选，新建不新增人工原因合同。邮件保持禁用，没有真实投递/SQL/审计。发布人数只采用模拟返回，不用订阅/候选数量估算。

## 证据边界

原 UI2-PN57 三状态全文响应和旧投递夹具分别展示，绝不拼成同一实测快照。旧投递夹具缺双分页、模板active与当前system_fixed、偏好字段差异明确保留。默认完整快照与边界分页是通过实际仓储无网络适配器生成的合成数据，不执行SQL；原始与合成行均无客户信息。

源函数验证复现单飞丢第二请求/URL归属漂移、stop晚响应、首错声称保留、重复保存、旧保存关闭新窗、原因等待期间版本漂移及写成功掩盖刷新失败。图稿独立草稿/快照、实例归属、单飞、表单冻结、窗内错误、未知不重试、双结果与空时配置可读均是待审提案，未改生产。发布受众按活动用户/成员/组织/默认工作区与最早有效成员去重，人工发布不读订阅，不通过Worker；惰性SQL谓词检查不能证明真实收件人去重。

## 验证与使用

生成：`node scripts/verify-ui-phase2-platform-notifications-c.mjs --capture`；复验：`node scripts/verify-ui-phase2-platform-notifications-c.mjs`。页面底部场景选择及模拟响应按钮仅供审核。所有配置只在内存，关闭页面即清除，不需要重启或部署。

后续须审核具体图并实施Vue，再验证会话/同源/权限/幂等、真实MySQL5.7/成员去重/审计、KeepAlive/返回、软键盘、六角色与全部主题密度生命周期。历史合同指纹保留，相关源码单独绑定，两份既有E2E焦点修改精确追溯，不宣称33项联合合同全部未变。

## 正式图册

<!-- GALLERY:START -->
正式PNG：230张；87场景。

| 场景 | 桌面1440 | 手机390 |
| --- | --- | --- |
| 人工消息工作台 (default) | [主图](1440-default.png) | [主图](390-default.png) |
| 投递观测 (deliveries) | [主图](1440-deliveries.png) | [主图](390-deliveries.png) |
| 系统配置事实 (configuration) | [主图](1440-configuration.png) | [主图](390-configuration.png) |
| 原始草稿全文夹具 (original-draft) | [主图](1440-original-draft.png) | [主图](390-original-draft.png) |
| 原始已发布全文夹具 (original-published) | [主图](1440-original-published.png) | [主图](390-original-published.png) |
| 原始已取消全文夹具 (original-cancelled) | [主图](1440-original-cancelled.png) | [主图](390-original-cancelled.png) |
| 原始投递旧夹具（字段差异保留） (original-operations) | [主图](1440-original-operations.png) | [主图](390-original-operations.png) |
| 首次读取中 (loading) | [主图](1440-loading.png) | [主图](390-loading.png) |
| 首次读取失败 (first-error) | [主图](1440-first-error.png) | [主图](390-first-error.png) |
| 首次读取超时 (first-timeout) | [主图](1440-first-timeout.png) | [主图](390-first-timeout.png) |
| 保留快照刷新 (refreshing) | [主图](1440-refreshing.png) | [主图](390-refreshing.png) |
| 刷新失败保留 (retained-error) | [主图](1440-retained-error.png) | [主图](390-retained-error.png) |
| 两种记录均空 · 辅助配置仍可读 (all-empty) | [主图](1440-all-empty.png) | [主图](390-all-empty.png) |
| 人工消息为空 (messages-empty) | [主图](1440-messages-empty.png) | [主图](390-messages-empty.png) |
| 投递为空不影响人工消息 (deliveries-empty) | [主图](1440-deliveries-empty.png) | [主图](390-deliveries-empty.png) |
| 投递筛选草稿 (filter-draft) | [主图](1440-filter-draft.png) | [主图](390-filter-draft.png) |
| 120字搜索边界 (filter-long) | [主图](1440-filter-long.png) | [主图](390-filter-long.png) |
| 筛选等待 · 保留旧范围 (filter-pending) | [主图](1440-filter-pending.png) | [主图](390-filter-pending.png) |
| 筛选失败 · 保留旧范围 (filter-error) | [主图](1440-filter-error.png) | [主图](390-filter-error.png) |
| 人工消息10条第一页 (message-page-first) | [主图](1440-message-page-first.png) | [主图](390-message-page-first.png) |
| 人工消息第二页 (message-page-last) | [主图](1440-message-page-last.png) | [主图](390-message-page-last.png) |
| 投递20条第一页 (delivery-page-first) | [主图](1440-delivery-page-first.png) | [主图](390-delivery-page-first.png) |
| 投递第二页 (delivery-page-last) | [主图](1440-delivery-page-last.png) | [主图](390-delivery-page-last.png) |
| 双分页独立 · 消息翻页等待 (page-pending) | [主图](1440-page-pending.png) | [主图](390-page-pending.png) |
| 消息翻页失败保留 (page-error) | [主图](1440-page-error.png) | [主图](390-page-error.png) |
| 完整消息阅读 (message-reader) | [主图](1440-message-reader.png) | [主图](390-message-reader.png) |
| 正文展开 (body-expanded) | [主图](1440-body-expanded.png) · [局部1](1440-body-expanded-part1.png) | [主图](390-body-expanded.png) · [局部1](390-body-expanded-part1.png) |
| 2000字完整正文 (body-max) | [主图](1440-body-max.png) · [局部1](1440-body-max-part1.png) · [局部2](1440-body-max-part2.png) · [局部3](1440-body-max-part3.png) · [局部4](1440-body-max-part4.png) · [局部5](1440-body-max-part5.png) · [局部6](1440-body-max-part6.png) | [主图](390-body-max.png) · [局部1](390-body-max-part1.png) · [局部2](390-body-max-part2.png) · [局部3](390-body-max-part3.png) · [局部4](390-body-max-part4.png) · [局部5](390-body-max-part5.png) · [局部6](390-body-max-part6.png) · [局部7](390-body-max-part7.png) |
| 正文纯文本安全边界 (body-plain-text) | [主图](1440-body-plain-text.png) | [主图](390-body-plain-text.png) · [局部1](390-body-plain-text-part1.png) |
| 已发布只读阅读 (published-reader) | [主图](1440-published-reader.png) | [主图](390-published-reader.png) |
| 已取消只读阅读 (cancelled-reader) | [主图](1440-cancelled-reader.png) | [主图](390-cancelled-reader.png) |
| 投递详情 (delivery-detail) | [主图](1440-delivery-detail.png) | [主图](390-delivery-detail.png) |
| 投递技术信息 (delivery-technical) | [主图](1440-delivery-technical.png) | [主图](390-delivery-technical.png) · [局部1](390-delivery-technical-part1.png) |
| 缺失渠道不补造 (delivery-missing) | [主图](1440-delivery-missing.png) | [主图](390-delivery-missing.png) |
| 历史多渠道状态 (delivery-mixed) | [主图](1440-delivery-mixed.png) | [主图](390-delivery-mixed.png) |
| 六列视图设置 (settings) | [主图](1440-settings.png) | [主图](390-settings.png) |
| 至少保留一列 (one-column) | [主图](1440-one-column.png) | [主图](390-one-column.png) |
| 紧凑密度 (compact) | [主图](1440-compact.png) | [主图](390-compact.png) |
| 首列冻结 (frozen) | [主图](1440-frozen.png) | [主图](390-frozen.png) |
| 深色主题 (dark) | [主图](1440-dark.png) | [主图](390-dark.png) |
| 高对比主题 (contrast) | [主图](1440-contrast.png) | [主图](390-contrast.png) |
| 键盘焦点 (focus) | [主图](1440-focus.png) | [主图](390-focus.png) |
| 悬停 (hover) | [主图](1440-hover.png) | [主图](390-hover.png) |
| 按下 (pressed) | [主图](1440-pressed.png) | [主图](390-pressed.png) |
| 新建草稿 · 全部活动用户 (new-all) | [主图](1440-new-all.png) | [主图](390-new-all.png) · [局部1](390-new-all-part1.png) |
| 新建草稿 · 指定组织 (new-organization) | [主图](1440-new-organization.png) · [局部1](1440-new-organization-part1.png) | [主图](390-new-organization.png) · [局部1](390-new-organization-part1.png) |
| 新建草稿 · 指定用户 (new-user) | [主图](1440-new-user.png) · [局部1](1440-new-user-part1.png) | [主图](390-new-user.png) · [局部1](390-new-user-part1.png) |
| 编辑草稿 · 全部活动用户 (edit-all) | [主图](1440-edit-all.png) · [局部1](1440-edit-all-part1.png) | [主图](390-edit-all.png) · [局部1](390-edit-all-part1.png) |
| 编辑草稿 · 指定组织 (edit-organization) | [主图](1440-edit-organization.png) · [局部1](1440-edit-organization-part1.png) | [主图](390-edit-organization.png) · [局部1](390-edit-organization-part1.png) |
| 编辑草稿 · 指定用户 (edit-user) | [主图](1440-edit-user.png) · [局部1](1440-edit-user-part1.png) | [主图](390-edit-user.png) · [局部1](390-edit-user-part1.png) |
| 空标题正文校验 (editor-empty) | [主图](1440-editor-empty.png) · [局部1](1440-editor-empty-part1.png) | [主图](390-editor-empty.png) · [局部1](390-editor-empty-part1.png) |
| 标题正文2字边界 (editor-min) | [主图](1440-editor-min.png) | [主图](390-editor-min.png) · [局部1](390-editor-min-part1.png) |
| 标题200正文2000边界 (editor-max) | [主图](1440-editor-max.png) | [主图](390-editor-max.png) · [局部1](390-editor-max-part1.png) |
| 程序赋值越界防护 (editor-over) | [主图](1440-editor-over.png) · [局部1](1440-editor-over-part1.png) | [主图](390-editor-over.png) · [局部1](390-editor-over-part1.png) |
| 未选择受众 (editor-no-target) | [主图](1440-editor-no-target.png) · [局部1](1440-editor-no-target-part1.png) | [主图](390-editor-no-target.png) · [局部1](390-editor-no-target-part1.png) |
| 候选列表为空 (editor-no-options) | [主图](1440-editor-no-options.png) · [局部1](1440-editor-no-options-part1.png) | [主图](390-editor-no-options.png) · [局部1](390-editor-no-options-part1.png) |
| 未启用站内渠道 (editor-no-channel) | [主图](1440-editor-no-channel.png) · [局部1](1440-editor-no-channel-part1.png) | [主图](390-editor-no-channel.png) · [局部1](390-editor-no-channel-part1.png) |
| 编辑原因不足 (editor-reason-short) | [主图](1440-editor-reason-short.png) · [局部1](1440-editor-reason-short-part1.png) | [主图](390-editor-reason-short.png) · [局部1](390-editor-reason-short-part1.png) |
| 编辑原因300字 (editor-reason-max) | [主图](1440-editor-reason-max.png) · [局部1](1440-editor-reason-max-part1.png) | [主图](390-editor-reason-max.png) · [局部1](390-editor-reason-max-part1.png) |
| 保存中 · 冻结表单 (editor-pending) | [主图](1440-editor-pending.png) · [局部1](1440-editor-pending-part1.png) | [主图](390-editor-pending.png) · [局部1](390-editor-pending-part1.png) |
| 保存失败保留内容 (editor-error) | [主图](1440-editor-error.png) · [局部1](1440-editor-error-part1.png) | [主图](390-editor-error.png) · [局部1](390-editor-error-part1.png) |
| 编辑版本冲突 (editor-conflict) | [主图](1440-editor-conflict.png) · [局部1](1440-editor-conflict-part1.png) | [主图](390-editor-conflict.png) · [局部1](390-editor-conflict-part1.png) |
| 保存结果不明 (editor-unknown) | [主图](1440-editor-unknown.png) · [局部1](1440-editor-unknown-part1.png) | [主图](390-editor-unknown.png) · [局部1](390-editor-unknown-part1.png) |
| 草稿保存成功但尚未发布 (editor-success) | [主图](1440-editor-success.png) | [主图](390-editor-success.png) |
| 保存成功但列表刷新失败 (editor-refresh-error) | [主图](1440-editor-refresh-error.png) | [主图](390-editor-refresh-error.png) |
| 发布草稿确认 (publish) | [主图](1440-publish.png) | [主图](390-publish.png) |
| 取消草稿确认 (cancel) | [主图](1440-cancel.png) | [主图](390-cancel.png) |
| 发布原因不足 (action-reason-short) | [主图](1440-action-reason-short.png) | [主图](390-action-reason-short.png) |
| 发布原因300字 (action-reason-max) | [主图](1440-action-reason-max.png) | [主图](390-action-reason-max.png) |
| 发布原因超长 (action-reason-over) | [主图](1440-action-reason-over.png) | [主图](390-action-reason-over.png) |
| 发布请求中 (publish-pending) | [主图](1440-publish-pending.png) | [主图](390-publish-pending.png) |
| 发布失败保留原因 (publish-error) | [主图](1440-publish-error.png) | [主图](390-publish-error.png) |
| 发布状态或版本冲突 (publish-conflict) | [主图](1440-publish-conflict.png) | [主图](390-publish-conflict.png) |
| 有效收件人为空 (publish-empty) | [主图](1440-publish-empty.png) | [主图](390-publish-empty.png) |
| 发布权限错误提示 (publish-forbidden) | [主图](1440-publish-forbidden.png) | [主图](390-publish-forbidden.png) |
| 发布结果不明不重试 (publish-unknown) | [主图](1440-publish-unknown.png) | [主图](390-publish-unknown.png) |
| 发布成功 · 返回计数 (publish-success) | [主图](1440-publish-success.png) | [主图](390-publish-success.png) |
| 发布成功但列表未刷新 (publish-refresh-error) | [主图](1440-publish-refresh-error.png) | [主图](390-publish-refresh-error.png) |
| 草稿已取消不是撤回 (cancel-success) | [主图](1440-cancel-success.png) | [主图](390-cancel-success.png) |
| 取消原因窗 · 零提交 (reason-cancelled) | [主图](1440-reason-cancelled.png) | [主图](390-reason-cancelled.png) |
| 关闭编辑不取消请求 (closed-pending) | [主图](1440-closed-pending.png) | [主图](390-closed-pending.png) |
| 旧结果不关闭新编辑 (new-editor-old-result) | [主图](1440-new-editor-old-result.png) | [主图](390-new-editor-old-result.png) · [局部1](390-new-editor-old-result-part1.png) |
| 告警仅显示前6条 (routes-limited) | [主图](1440-routes-limited.png) | [主图](390-routes-limited.png) |
| 候选上限不是受众预检 (audience-limit) | [主图](1440-audience-limit.png) · [局部1](1440-audience-limit-part1.png) | [主图](390-audience-limit.png) · [局部1](390-audience-limit-part1.png) |
| 个人偏好入口说明 (personal-route) | [主图](1440-personal-route.png) | [主图](390-personal-route.png) |
| 规则总览入口说明 (governance-route) | [主图](1440-governance-route.png) | [主图](390-governance-route.png) |
| 源码事实与提案边界 (source-boundary) | [主图](1440-source-boundary.png) | [主图](390-source-boundary.png) · [局部1](390-source-boundary-part1.png) |
<!-- GALLERY:END -->
