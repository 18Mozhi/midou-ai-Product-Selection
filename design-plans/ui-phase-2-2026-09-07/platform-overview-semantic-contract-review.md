# P38 当前来源到交互的对应合同

范围：四个实际Vue文件；待用户审核，不代表全部按钮状态、父壳、权限或生产通过。由build-ui-phase2-platform-overview-review.mjs生成；业务含义人工明确，签名仅作来源身份。

## 来源哈希

| 文件 | LF SHA256 |
| --- | --- |
| apps/web/src/components/PlatformDashboard.vue | b9b433afb9d39cf77aaf7dde1f153a5b689c19734ba32c022831b9587313e498 |
| apps/web/src/components/ResponsiveDataView.vue | b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99 |
| apps/web/src/components/TableViewControls.vue | d0611b8367773f915a885c6c09f34c958fed67e7b99110abec20bb0febeea9ff |
| apps/web/src/components/TechnicalDetails.vue | 4e2443f3f7f901c3d1cf14243523956e8705bbd39aed8e0a19d54063220fe82d |

## 逐来源位置

| 来源身份 | 行 | 类别 | 含义 | 合同组 |
| --- | --- | --- | --- | --- |
| apps/web/src/components/PlatformDashboard.vue#41083a84c60ec185.1 | 241 | event-binding | 切换查看范围 | PA38-WINDOW |
| apps/web/src/components/PlatformDashboard.vue#15e83f4e8898e4d7.1 | 247 | control | 刷新与两类重试 | PA38-REFRESH |
| apps/web/src/components/PlatformDashboard.vue#17f7411f1727355d.1 | 256 | control | 刷新与两类重试 | PA38-REFRESH |
| apps/web/src/components/PlatformDashboard.vue#5587941412d5210f.1 | 262 | control | 重新登录入口 | PA38-LOGIN |
| apps/web/src/components/PlatformDashboard.vue#3569d8f0f015857e.1 | 267 | control | 刷新与两类重试 | PA38-REFRESH |
| apps/web/src/components/PlatformDashboard.vue#65c09ba74ca8870b.1 | 270 | control | 等待处理与查看任务 | PA38-COLLECTION |
| apps/web/src/components/PlatformDashboard.vue#d1c0b626714a7ff9.1 | 274 | control | 需要关注入口 | PA38-ROOTCAUSE |
| apps/web/src/components/PlatformDashboard.vue#52444eba9c2a98bc.1 | 290 | control | 查看组织与管理组织和用户 | PA38-ORGANIZATIONS |
| apps/web/src/components/PlatformDashboard.vue#c4dfc8f822a18263.1 | 298 | control | 查看用户 | PA38-USERS |
| apps/web/src/components/PlatformDashboard.vue#06b4b917d7a90e96.1 | 306 | control | 来源导航的三处变体 | PA38-SOURCES |
| apps/web/src/components/PlatformDashboard.vue#348b42f6f4eb388b.1 | 310 | control | 等待处理与查看任务 | PA38-COLLECTION |
| apps/web/src/components/PlatformDashboard.vue#9ae1b37e258dde35.1 | 314 | control | 查看数据 | PA38-DATA |
| apps/web/src/components/PlatformDashboard.vue#f84b8209be451866.1 | 324 | control | 查看组织与管理组织和用户 | PA38-ORGANIZATIONS |
| apps/web/src/components/PlatformDashboard.vue#5074531b9e5b8a16.1 | 328 | control | 来源导航的三处变体 | PA38-SOURCES |
| apps/web/src/components/PlatformDashboard.vue#1ce54f6253c32ad1.1 | 330 | control | 采集进度与无趋势恢复 | PA38-QUEUE |
| apps/web/src/components/PlatformDashboard.vue#ba487bb14816185a.1 | 346 | control | 来源导航的三处变体 | PA38-SOURCES |
| apps/web/src/components/PlatformDashboard.vue#2e8c2f831b1b02a5.1 | 348 | control | 采集进度与无趋势恢复 | PA38-QUEUE |
| apps/web/src/components/PlatformDashboard.vue#1c008f867673db60.1 | 458 | control | 来源与告警原生技术折叠 | PA38-TECH |
| apps/web/src/components/PlatformDashboard.vue#d604390773d9cd06.1 | 472 | control | 来源展开收起 | PA38-PROVIDERS |
| apps/web/src/components/PlatformDashboard.vue#1c008f867673db60.2 | 538 | control | 来源与告警原生技术折叠 | PA38-TECH |
| apps/web/src/components/ResponsiveDataView.vue#6da4dad42cb34c8d.1 | 129 | control | 手机记录预览 | PA38-PREVIEW-OPEN |
| apps/web/src/components/ResponsiveDataView.vue#c182428cb2c0ed66.1 | 136 | event-binding | 关闭与焦点循环 | PA38-PREVIEW-CLOSE |
| apps/web/src/components/ResponsiveDataView.vue#988131834dc4bd6f.1 | 143 | control | 关闭与焦点循环 | PA38-PREVIEW-CLOSE |
| apps/web/src/components/ResponsiveDataView.vue#a3c9be2acacfd788.1 | 150 | dialog-definition | 共享预览容器关联 | PA38-PREVIEW-DIALOG |
| apps/web/src/components/ResponsiveDataView.vue#847801b2ac6e7a17.1 | 162 | control | 关闭与焦点循环 | PA38-PREVIEW-CLOSE |
| apps/web/src/components/TableViewControls.vue#e2fd0d02cbd9f684.1 | 78 | control | 列设置展开 | PA38-COLUMNS |
| apps/web/src/components/TableViewControls.vue#921f4be18a3fe814.1 | 82 | event-binding | 切换来源显示列 | PA38-COLUMN-TOGGLE |
| apps/web/src/components/TableViewControls.vue#d09cd5524db7bee5.1 | 95 | control | 冻结首个可见列 | PA38-FREEZE |
| apps/web/src/components/TechnicalDetails.vue#b3ffca8eb967d682.1 | 62 | control | 共享请求技术详情 | PA38-REQUEST-DETAILS |
| apps/web/src/components/TechnicalDetails.vue#c19091da9e2471f1.1 | 69 | control | 复制请求编号 | PA38-REQUEST-COPY |

## 口径

30个源位置归并20组：19组页面交互、1组预览定义关联、0类页面写入。另有windowCode/density两处模型；密度没有显式事件签名，不因此遗漏。共享预览包含打开、关闭、Esc、Tab循环及返焦；不是新增业务确认。P38只传共享requestId，来源和告警原生技术折叠不带复制。

[机器映射](action-reviews/P38.json)保存条件、handler、模型、3个来源容器变体和全部待验项。[本轮实际入口图与验证](P38-SEMANTIC-IMPLEMENTATION-MAP.md)保留独立证据类型，不自动填满六态。
