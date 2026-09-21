# P67 读取状态语义 · 批次64

起点 `main/6025c198`，工作区已有其他在途改动且索引为空。批61资源占位、批62追踪归属、批63焦点按钮和旧验证门的既有审核问题仍保持待审；本批不将任何未回答的问题视为批准，也不改旧检查。

## 事实、问题与最小修复

依据 `AGENTS.md`、Feature Map、总纲 M08-02、P67规格和实际 `RedisResilienceCenter.vue`：路由仍为 `/platform-admin/redis`，GET仍需 `platform:operate`，真实读取会写观测、查看和平台审计；本地验证只拦截请求。

批63已让重试的焦点连续；但首次读取、保留快照后的刷新失败区域只有 `aria-live` 与粗体文字，读屏不能以区域名称关联标题，也没有明确的区域忙碌状态。使用 `ui-skills-root` 选择的 accessibility 上下文与 `fixing-accessibility` 做最小改动：

- 首次读取/错误区改为 `h3#redis-read-title`，保留快照失败区改为独立 `h3#redis-refresh-title`；两个区域以 `aria-labelledby` 建立名称，并以 `:aria-busy="refreshing"` 告知读取中状态。
- 保留原生按钮、15秒超时、GET、单飞守卫、追踪编号、权限清空与快照保留规则；不新增业务操作或角色能力。
- 生产CSS为新标题清除浏览器默认外边距，C审核样式已有`h3`归零，视觉尺寸不因语义替换漂移。

新增永久 `tests/unit/redis-read-regions.test.mjs`；现有焦点/追踪实际Vue回放同时断言命名区域、忙碌状态和标题可见性。

## 验证与审核图

- 44项P67读取、焦点、追踪、页面和共享技术复制合同测试通过。
- 实际Vue：默认页面1342项/148次本地GET；追踪220项/40次本地GET；焦点132项/28次本地GET。均覆盖1440/390与`reduce`/`no-preference`，合计1694项检查、216次仅本地GET。
- `p67-trace-ownership-r3`为双端22PNG/173来源指纹；首个失败、保留快照失败、超时、401/403、空读取和复制反馈均可见且控件未被遮挡。无外部请求、写请求、下载或页面错误。
- `npm run build:web`（含 `vue-tsc`）及 `node scripts/verify-frontend-budget.mjs`已在本批开始前后的生产样式改动后通过，预算253个资源；本批无依赖、配置、API、OpenAPI、数据库或后端变更。

本批只提请审核手机首次失败白色区域的标题、说明、失败追踪和底部“重新核验”排列；不包含整页、所有状态、真实读屏、权限、Redis、审计或生产验收。

## 运行、范围与收尾

复验：

```powershell
node --test tests/unit/redis-read-regions.test.mjs tests/unit/redis-read-focus.test.mjs tests/unit/redis-trace-ownership.test.mjs tests/unit/redis-page-preview.test.mjs tests/unit/ui-phase2-technical-copy.test.mjs
node scripts/verify-redis-read-focus.mjs
node scripts/verify-redis-trace-ownership.mjs --capture-review r3
node scripts/verify-redis-page-preview.mjs
npm run build:web
node scripts/verify-frontend-budget.mjs
```

无环境变量、重启或部署要求；未来更新静态构建后浏览器重新加载即可，不重启Redis或Node。既有API覆盖225/258对旧223/256、M08旧图名和历史外壳图册指纹问题尚待用户授权，故不暂存、不提交、未部署。图册、测试和验证器是永久交付物，非临时文件；Vite与Chromium均已关闭。此前P65清理策略阻塞的两组文件仍未绕过。
