# P46 来源设置 C 方向完整样式接入

2026-09-23，接续 P45 生产版本 `e098b13a88244d3b0aeebf8300934a2910c9a5db`。用户已明确本阶段其余设计自动通过。本批将此前已批准的 P46 记录/详情/状态/桌面编辑组合接入真实 Vue 页面；仅覆盖 `/platform-admin/providers`。

## 实际改动

- 新增 `apps/web/src/styles/provider-registry-c-completion.css`，并在 `ProviderRegistry.vue` 的已批准结构样式之后引入。
- 为桌面表格、列设置/冻结/密度工具栏、七列表头与记录、准入状态、分页，以及手机白底记录条目补齐 C 方向蓝白样式。
- 将共享组件 Teleport 到 `body` 的来源详情抽屉限定在 Registry 路由下，应用蓝色身份栏、白色事实、灰色技术详情；不改共享 `ResponsiveDataView`。
- 完成空列表/筛选空结果、loading/error/forbidden/expired/blocked 状态的页面样式，状态主按钮用准确的“重新读取来源”，隐藏该页未绑定回调的通用次级按钮。
- 桌面编辑窗在 761px 起接入蓝色步骤栏、白色字段和粘性底栏；761–1023px字段单列，1024px起双列。手机编辑继续沿用此前已批准的生产结构样式。
- 表格空白动作表头改为有语义的“操作”列名。

没有改变来源列表数据、字段/校验、模板、筛选/排序/分页行为、读取/保存流程、API、RBAC、审计、数据库、环境变量、依赖、共享组件合同或平台外壳。没有改动 OpenAPI、后端、Python、插件或宝塔对象定义。

## 验证

- `node --test tests/unit/provider-registry-c-completion.test.mjs`：2/2 通过；断言完整样式入口、路由作用域、详情 Teleport、空/错误态和桌面/手机断点。
- `node scripts/run-playwright-projects.mjs tests/e2e/m03-01-provider-registry.spec.ts --grep 'M03-01'`：桌面 Chromium 2/2、390px 手机 2/2；使用本地固定数据，POST/PUT 不执行真实写入。
- `npm run build:web`：通过，449 modules。
- `npm run verify:docs`：通过，73路由、60保护路由、6角色及153份必需文档。
- 选取旧 P46 历史图证/哈希合同运行时，它们按设计绑定早期 Vue、共享文件和截图的不可变哈希；对当前源码的旧指纹检查不再代表本批。历史图证未覆盖或改写；当前变更由新增结构合同、Web 构建和真实路由双端 E2E 验证。旧全局色板合同也有与本批无关的现行样式硬编码失败，需另行治理。

## 发布边界

本批仅静态前端，不需要重启 Node API、Worker 或 Python Crawler。部署使用项目唯一允许的 `python scripts/deploy-baota.py`，并按固定对象范围与既有发布/恢复门执行。真实生产 RBAC、来源配置持久化、审计和采集执行没有由本地夹具证明，也不是该 CSS/UI 发布的验证结论。全73页阶段仍在继续，不能将本页部署等同全项目收官。
