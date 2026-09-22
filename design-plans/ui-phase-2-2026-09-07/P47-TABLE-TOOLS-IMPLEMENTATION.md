# P47 桌面表格工具 C 方向样式接入

## 范围

把[P47 桌面列设置、冻结与密度审核稿](P47-TABLE-TOOLS-REVIEW.md)中已通过的工具轨视觉应用到生产来源适配器页面。`ProviderAdapterCenter.vue` 新增页面专属样式导入；`provider-adapters-c-table-tools.css` 只匹配正在挂载的 `.adapter-center--c`，不改变 `TableViewControls` 及共享 `ResponsiveDataView` 的 API 或状态逻辑。

生产样式包含：桌面工具轨与表格合为一体；列设置弹层的层级、白底、细分隔和标题；冻结按钮的 `aria-pressed` 已选态；标准/紧凑原生选择框；44px 控件热区及键盘焦点轮廓。手机端的桌面控件继续由现有响应式组件隐藏，390px 卡片目录不受影响。

## 验证

- `node --test tests/unit/p47-provider-adapter-table-tools-production.test.mjs`：2/2 通过。
- `node scripts/run-playwright-projects.mjs --config=playwright.config.ts --output=output/playwright/p47-production-table-tools-temp tests/e2e/m03-03-provider-adapter.spec.ts`：桌面 Chromium 9/9、390px 手机 9/9 通过。覆盖原页面状态与筛选回归、新工具控件及手机隔离；接口均由本地 fixture 拦截。
- `npm run build:web`：Vue 类型检查和生产 Vite 构建通过。
- `npm run verify:docs`：路由工件和 153 项必需文档通过。
- `npm run verify:frontend-budget`：全局入口 CSS 仍为 129451/122880，超过既有上限；本批新增 CSS 随 P47 路由加载，不在入口 CSS 中。本轮未扩大到其他页面的公共 CSS 优化。

E2E 过程中同步修正了三处旧断言，使其准确定位页面内的多个 `role=status` 状态节点并匹配已经批准的手机空态文案；不改变产品运行逻辑。

## 未覆盖边界

未运行真实健康探针/外部写请求；未更改 API、RBAC、数据库、环境变量或依赖。此批不等于 P47 全部运行交互、真实权限或 M07-03 正式生产验收，也不完成第二阶段其余页面。部署后只需发布静态前端文件，不需重启 Node/Python 服务。
