# P55–P57 页面配色令牌复核

后续增量已完成 important 清理，见 [样式优先级复核](P54-P57-STYLE-PRIORITY-REVIEW.md)。
以下逐字还原验证和未处理范围描述的是当时配色整理增量，不是后续样式优先级改动。

2026-09-12：按 baseline-ui 的令牌复用约束，沿用项目已有页面级调色板做法。
将治理、内容、通知三页中的固定颜色分别移入 design/governance-tokens.css、
content-tokens.css、platform-notification-tokens.css，分别为 13、18、22 个令牌。
调色板只在所属页面和明确的脱离页面容器的窗口边界生效，不修改全局主题。
内容页包含审核窗、筛选抽屉和记录详情；通知页包含编辑、阅读和动作窗口。

## 不变的范围

没有重新选择颜色，没有改变页面结构、字号、按钮行为、字段、状态、权限、API、
配置、数据库、依赖或生产数据。OpenAPI 和后端消费方不涉及本次纯 CSS 整理。
三份样式将变量还原为对应原色并去除新增 import 后，与本次整理前逐字一致。
本次不处理另有来源的 important 覆盖，也不以放宽普通 CSS 检查来消除失败。

## 当前证据

- 页面令牌与可读性定向单测：7/7 通过。
- 现有数据质量、平台管理、消息管理双端浏览器回归：72 通过、2 跳过。
  跳过的是两个已由桌面覆盖的旧回执归属用例的手机重复版本。
- 实际 Vue 图册重新拍摄 81 PNG/JSON 对；81 张 PNG 均与本次整理前的图片
  SHA256 完全一致。JSON 绑定了新增调色板及最新 CSS 的指纹，不是手改图片哈希。
- 81 份证据均通过当前源码/CSS 指纹、testStatus、pending 审核标记和无横向溢出检查。
- 前端类型检查与构建通过；保持原预算，252 个构建文件通过体积门禁。
- 全站语义颜色检查仍失败于 provider-adapters-c-detail.css（P47）；此外仍有
  important、旧源码断言和历史证据门禁待处理。本轮没有重跑未受本次改动影响的全库检查，
  不提供推算后的全库通过数。整体计划未完成，未提交、未部署。

## 审核与运行

当前图片没有视觉变化，不重复请求同一像素的批准；原有用户批准范围保持不变，
pending 的整页、组合和真实业务验收仍然 pending。

- [P55 手机治理事实](design/governance-direction-c/vue-implementation/P55-390-governance-default.png)
- [P56 手机审核窗口](design/content-direction-c/vue-implementation/P56-390-content-review-stale.png)
- [P57 Vue 图册](design/platform-notifications-direction-c/vue-implementation)

以后如需调节配色，只修改上述页面令牌，再执行定向检查、双端截图和前端构建。
本次不需要新增环境变量或服务重启；未来发布需按既有宝塔流程上传前端构建并刷新浏览器。
测试进程由测试框架结束；临时结果文件在本轮收尾删除，正式截图、证据和正常构建产物保留。
