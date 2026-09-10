# P38 实际 Vue C 方向独立预览

状态：待审核，未接入生产。2026-09-11，起点 main / df4b7263。

本次使用 frontend-design 技能实现桌面蓝色观察控制栏、白色内容分区和手机纵向阅读，再使用 Playwright 核对实际组件。直接挂载未经改写的 `PlatformDashboard.vue`、`ResponsiveDataView.vue`、`TableViewControls.vue`、`TechnicalDetails.vue` 和 API client；仅额外加载带 `body.p38-vue-preview` 前缀的预览样式。不是独立 HTML 控制器代验，也不是生产路由/导航壳验收。

## 审核材料

- [全部实际 Vue 图及索引](../../output/playwright/p38-vue-c-preview/index.html)
- [桌面整体](../../output/playwright/p38-vue-c-preview/1440-normal.png)
- [手机整体](../../output/playwright/p38-vue-c-preview/390-normal.png)
- [手机详情窗](../../output/playwright/p38-vue-c-preview/390-drawer.png)
- [桌面列设置](../../output/playwright/p38-vue-c-preview/1440-columns.png)
- [机器证据](../../output/playwright/p38-vue-c-preview/evidence.json)
- [隔离预览样式](implementation/platform-overview-preview.css)

26 张永久审核图：桌面和手机分别覆盖正常、刷新中、刷新失败保留旧结果、全部来源、初次 401/403/429/500、空数据、无成功率样本和 0%；另含手机详情关闭/展开技术信息、桌面列设置和紧凑表格。全部数据取自已有 E2E 测试样例，页面中的 MySQL 描述是原组件文案，不代表本次读取了真实数据库。

原 91 张 C 提案及 16 张来源局部图不变。它们的 HTML 提案、此次实际 Vue 和生产实现是三种不同证据，不互相替代；先前待答复的手机来源局部审核不因此自动通过。整页及本次截图也不默认获批。

## 实际检查与边界

390、760、761、1440 四个宽度，共 16 组浏览器检查：

- 四个时间窗请求及保留其他 query；核对两个问题入口 href 和运营角色的组织/用户只读提示；正常页面无整页横向溢出。
- 刷新期间禁用查看范围与刷新，保留事实；刷新失败、重新刷新；来源 8 → 15 → 8。
- 手机打开详情时聚焦关闭按钮，展开技术详情，Escape/关闭后回到原按钮。
- 桌面四列选择和最后一列保护、首列冻结开关；密度切换后等待实际渲染并检查计算行距变小，不仅断言 select 的值。
- 初次 401/403/429/500、空数据、null 与 0 成功率区分；无页面异常，无外部及非预期 API 请求。

请求仅在本机随机端口拦截 `GET /api/v1/platform/dashboard`，未调用真正后端。真正 GET 会写观测及审计记录，不可表述为后端零写入。未验证 MySQL、真实 RBAC、历史/KeepAlive、系统剪贴板、完整导航壳、三主题、全局密度、200% 缩放、软键盘或生产服务。本次只检查页面自带表格密度，并不代表全局密度策略通过。

## 保留的真实组件问题

1. 已有数据后刷新收到 403 仍展示旧快照；新时间窗已进入 URL/控件但读取失败时仍是旧窗数据。此次只是复现，不能算权限或数据时效通过。
2. 手机详情窗 Shift+Tab 可以落到窗外遮罩，尚无完整焦点循环和背景 inert。关闭及焦点返回通过，不等于模态隔离通过。
3. 先前源代码检查还发现仅趋势有值仍可能判空、URL 回看监听缺失、复制拒绝未捕获。这些未在本次浏览器矩阵中新增验证，也没有借样式修改业务逻辑。

这些是正式接入前的未完成事项；本次不改变权限撤销、请求范围或共享弹窗行为。涉及业务/安全策略的选择仍需确认后另行实现。

## 复验与清理

在仓库根目录运行：

```powershell
node scripts/verify-ui-phase2-platform-overview-vue-preview.mjs
node --test tests/unit/ui-phase2-platform-overview-vue-preview.test.mjs
```

需要重新生成本批审核图时加 `--capture`，会重写本批输出目录中的同名交付图及证据；不修改生产源文件。无新增依赖、环境变量、API、路由或数据库变更，OpenAPI/feature-map/运维重启不适用。浏览器与随机端口 Vite 在 finally 关闭，无常驻预览地址；图片、索引、证据与脚本均为永久交付，非临时测试垃圾。不部署、不重启生产服务。

本轮结果：浏览器 16 组通过；新增定向单元测试 3/3，完整 UI 第二阶段单元测试 572/572；文档门 153 文件、路由 73 条及格式门通过。主设计包审计仍为 102 包/15069 图且无来源或图片漂移，本次 26 张独立实际 Vue 图另计，不扩充主提案包或整页批准数。未改生产代码，未重复执行生产构建或部署测试。
