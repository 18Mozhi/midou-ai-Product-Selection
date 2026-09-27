# P19 竞品目录与事实详情 C 方向生产实施

## 范围

本批将蓝白竞品工作区迁移到真实 `/competitors` 与 `CompetitorMonitor(mode="list")`：目录、当前快照、变化、告警任务、采集历史和帮助说明。

## 保留运行合同

- 保留 `GET /competitors`、`GET /competitors/{id}`、`GET /competitor-monitor-rules` 读取路径。
- `current_price === null` 继续显示“价格未采到”；无首个快照继续显示“等待首次采集”，不把缺失补为零。
- `competitor:manage` 继续控制采集、启停、删除和新增；`task:create` 独立控制验证任务。
- 只有命中显式阈值的真实变化才关联告警与任务；“等待人工验证”不被解释为自动决策。

## 实施内容

- 复用 `competitor-monitor--review` 作用域，重构竞品准备度、搜索、目录、快照事实、变化时间轴和帮助区。
- 以蓝色标题、白色/浅蓝事实台账、桌面双栏和手机单列实现生产布局与键盘焦点。
- 保留真实数据绑定、读取顺序、能力判断、采集与验证任务入口，不新增 API 或权限规则。

## 验证

- `node --test tests/unit/competitor-page-preview.test.mjs`：2/2 通过。
- `node scripts/verify-competitor-page-preview.mjs --capture-review r2`：1440/390、reduced/no-preference 共 32 项检查，0 次写入，6 张截图。
- 类型检查、格式检查、生产构建、发布归属校验和宝塔部署在本批提交前完成。

## 未覆盖边界

本批不等同于创建/删除/规则弹窗、真实采集、真实外部来源、RBAC、屏幕阅读器/真机验收或正式 M07-03 证据。

## 后续补充：CP-G01 三弹窗键盘与焦点

将创建、规则、删除三处自定义 `role=dialog` 切换为项目现有 `useModalDialog` 原生模态生命周期；保留原字段、事件、请求体、权限与关闭语义。补齐关闭/取消/Escape返焦、创建步骤推进后的首字段焦点、三个弹窗的可访问名称及写入失败后弹窗内错误焦点；URL query 直接打开时聚焦首字段并在关闭时回到页面入口。双向 Tab 边界由实际 Vue 键盘回归锁定。此项只关闭 CP-G01，不关闭 CP-G02–G07，也不证明真实写入、RBAC、读屏或 M07-03。

### CP-G01 验证记录（2026-09-27）

完整 `tests/e2e/m04-05-competitors.spec.ts` 桌面 Chromium 与390px手机各21/21通过；新增焦点专项桌面/手机各3/3，modal可访问性单测2/2。Web类型检查、格式/文档/运行文档/静态分析/发布矩阵/来源动作覆盖与全22 workspace构建通过。实现提交 `d56b78df655738decf6fdea01bf15cb4ce5b5d38`，部署记录提交 `a7ddb5219fad7e899ee219185d01e0a5e795ab33`；部署基线 `a7ddb521` 已推送并部署。生产 live/ready/available/version、首页、竞品目录和规则路由均返回200；线上版本 SHA 一致，JS/CSS 静态资源 SHA-256 与本地构建一致。测试采用本地受控 fixture，线上探针只证明公开运行与静态资产交付，不证明真实后端写入、RBAC、公开采集、辅助技术或正式 M07-03；CP-G02–G07仍未关闭。
