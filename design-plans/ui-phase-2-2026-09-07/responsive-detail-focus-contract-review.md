# 共享手机详情窗：当前动作归属增量

2026-09-11 停用清理增量：实际壳层的浏览器返回复现旧窗阻挡目标页，现增加onDeactivated清空选择/旧触发器并释放背景；模板、样式、五个候选身份不变，行号后移5行。见 [缓存切页修复](P38-SHELL-LIFECYCLE-REVIEW.md)。以下原焦点修复说明保留。

2026-09-11；实际修复与测试见 [共享焦点报告](SHARED-MOBILE-DETAIL-FOCUS-REVIEW.md)。以下只更新共享 `ResponsiveDataView.vue` 的源码位置归属，不把共享原语等同于 20 个消费组件的全部业务变体。

此次添加 ref、Tab 处理器和遮罩 tabindex，导致三个静态候选签名变化：旧 Escape 4fa7deb3456a41ae.1、遮罩 53d89072117d7eda.1、详情定义 e23893d134b1daa1.1 分别由下表对应新位置接续；打开/页首关闭身份不变但行号移动。`platform-account`、`provider-definition`、`log-backup-release` 三份旧合同的原始表及其指纹保留为历史快照，不能用那些旧身份或未改的表头声称当前组件尚未修复；本表是该组件当前归属，其他组件结论不变。

## 当前源码候选与语义归属

| 稳定候选 ID | 当前行 | 类型 | 语义动作 | 范围 |
| --- | --- | --- | --- | --- |
| apps/web/src/components/ResponsiveDataView.vue#6da4dad42cb34c8d.1 | 124 | control | shared.detail.open | 手机记录按钮；保存触发器，按 rowKey 打开，初焦点与背景隔离 |
| apps/web/src/components/ResponsiveDataView.vue#c182428cb2c0ed66.1 | 131 | event-binding | shared.detail.keyboard | 既有 Escape 关闭和新增 Tab/Shift+Tab 循环；不是业务提交 |
| apps/web/src/components/ResponsiveDataView.vue#988131834dc4bd6f.1 | 138 | control | shared.detail.scrim.close | 遮罩仍可点击关闭，但不再进入键盘 Tab 序列 |
| apps/web/src/components/ResponsiveDataView.vue#a3c9be2acacfd788.1 | 145 | dialog-definition | shared.detail.dialog | 来自 detailTitle 的命名详情；并非原生 dialog；各消费详情内容独立 |
| apps/web/src/components/ResponsiveDataView.vue#847801b2ac6e7a17.1 | 157 | control | shared.detail.header.close | 初焦点关闭按钮，关闭后返焦；记录移除时列表回退 |

## 本次当前源码指纹

| 文件 | LF SHA-256 |
| --- | --- |
| apps/web/src/components/ResponsiveDataView.vue | b9e635a3708a3733fd66ead2be6ac840fd70872e0b5af94b3fab171407245d99 |

全量单测首次发现三处新候选未入归属表（两个审计测试共同检查同一缺口）；本表补齐真实候选，不改扫描器、不屏蔽遗漏检查，也不重新定义完成分母。业务 API、权限、生产验收和页面批准均未扩大。
