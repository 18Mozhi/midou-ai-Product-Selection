# P58 当前 Vue C 组合 · 批111

状态：待用户审核；不是生产实现完成、真实配额验收或全 73 页签收。

## 本次复核范围

复核已保留的实际 Vue 审核宿主：`/platform-admin/commercial` 的 App / Router / NavigationShell / CommercialOperationsCenter 转换层。C 方向将“方案目录”和“组织配额”分为两个工作区：前者只展示全局方案统计、筛选及目录，后者才展示组织读取、分配、周期用量与人工调整。原 UUID 输入、字段校验、业务脚本、请求地址和三个 Teleport 弹窗均未在本批改写。

本批只登记并复验既有 r1 图包；不重新捕获、不覆盖旧图、不触发真实读取或写入。

## 可审核图

| 视图           | 图                                                                                                                                                                        | 审核重点                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 桌面方案目录   | [1440](../../output/playwright/p58-page-composition-r1/P58-1440-plans.png)                                                                                                | 蓝色任务导航、全局统计、目录筛选与方案记录的层级 |
| 桌面组织配额   | [1440](../../output/playwright/p58-page-composition-r1/P58-1440-organization.png)                                                                                         | 组织读取入口、分配、周期用量与调整记录的独立范围 |
| 手机方案目录   | [全页](../../output/playwright/p58-page-composition-r1/P58-390-plans.png) / [首屏](../../output/playwright/p58-page-composition-r1/P58-390-plans-first.png)               | 单列目录、标题、工作区切换与统计                 |
| 手机组织配额   | [全页](../../output/playwright/p58-page-composition-r1/P58-390-organization.png) / [首屏](../../output/playwright/p58-page-composition-r1/P58-390-organization-first.png) | 单列组织工作区与读取入口                         |
| 手机未读取组织 | [390](../../output/playwright/p58-page-composition-r1/P58-390-organization-unselected.png)                                                                                | 未选择组织时不伪造配额、周期或调整数据           |

图片中的 `o1`、`p1`、`a1` 均为原 E2E 本地样例值，不是可手填的真实业务 UUID。全页图带有固定底栏，不能作为真机整屏比例证明。

## 当前复验证据

- `node --test tests/unit/platform-commercial-page-preview.test.mjs`：5/5 通过，覆盖 CommercialOperationsCenter 与 NavigationShell 的原脚本/合同/样式保留及 SFC 编译、Teleport 位置与 CLI 参数拒绝。
- 已逐张计算并比对 [r1 清单](../../output/playwright/p58-page-composition-r1/manifest.json) 中 7 张 PNG 的 SHA-256；全部与清单一致。
- 本轮没有启动常驻审核宿主、没有访问生产地址，也没有发生 API 写请求、数据库写入或截图覆盖。

## 明确未覆盖

- 真实会话、RBAC、组织 UUID 有效性和真实配额读取。
- 创建、编辑、分配、暂停、恢复、结束、调整、撤销与所有确认窗的写入生命周期；“创建响应丢失后如何冻结原内容/幂等键”仍需单独产品决定。
- 全部 hover/disabled/焦点、读屏、触控、断点、主题、错误/空态以及生产验收。

已确认的其他 P58 局部弹窗/反馈审核范围保持原样；本批不把它们扩大为整页通过。
