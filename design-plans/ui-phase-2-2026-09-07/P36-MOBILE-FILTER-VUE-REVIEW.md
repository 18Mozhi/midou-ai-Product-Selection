# P36 手机筛选区域 · 真实 Vue 局部实施

后续状态：[查询历史恢复修复](P36-QUERY-RESTORATION-REVIEW.md)仅新增query同步script；下文“script不变”为首次展示实装的历史边界。原10PNG未动，290实际检查重新通过后明确更新来源关联，不将本批局部批准扩大到历史交互或整页。

基线 `main / c380b995b3a6d55d7f1742dc42baf9479be0e8e7`，开始时工作树干净。依据 [局部批准](P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md)，使用 frontend-design 对齐已批字段组合，Playwright 复用仓库依赖验证；未安装新工具或依赖。

## 实际改动

`OrganizationTokenPanel.vue` 只增加四个筛选字段的标题/帮助关联、底部帮助、区域标记及手机样式。760px及以下采用单列、16px输入与标签、46px输入高度、蓝色文字重置按钮、白底与就近说明；桌面帮助不展示，但 aria-describedby 描述可被辅助技术读取，不宣称桌面可访问描述完全未变。

颜色仅由组件加载的 `design/token-filter-tokens.css` 向 `.org-token-filters-c` 声明6个局部令牌。全局颜色门对这份文件只允许限定选择器和令牌声明，没有放开普通CSS硬编码颜色。旧全局最小尺寸和次级按钮规则在首轮验证中覆盖新稿，已仅提高该区域的尺寸约束与按钮选择器优先级；没有 `!important` 或全局覆盖。

业务 script 逐字不变，完整模板在移除精确允许的展示增量后，与基线 AST 一致。七个模型、全部选项、搜索字段、排序、6条分页、创建/轮换/撤销/明文处理均未改变。没有增加折叠筛选、禁用草稿或共享原因长度规则。

实际 `resetFilters` 只重置四个条件，条件变化的 watcher 才归第1页；条件已默认时点击重置不强制翻页。实装帮助准确写作“仅重置筛选和排序，不更改令牌。”，没有把原提案“返回第1页”的绝对承诺变为新产品规则。批准的原PNG保留；本轮文字校正不意味着其他视觉状态获批。

## 验证证据

- [实际 Vue 证据清单](../../output/playwright/p36-mobile-filters-vue/evidence.json)：390/760/761/1440四宽度，290项检查，10张手机实图。
- 56项像素对比：手机顶部、汇总、安全说明、创建区、目录标题及列表/空区，覆盖正常、无匹配、等待、无返回数据；桌面整子组件同四场景。测试先将区域纵坐标对齐整数像素，再顺序采图，避免帮助增高的子像素裁切及同页并发滚动干扰；不修改生产数据或样式文件，不在磁盘留基线图。
- 真实原生Tab/Enter重置、中文输入/光标、各选项、五排序完整双页ID序列、状态计数、技术ID不搜索、忙碌仍可筛选、URL其他参数保留及220输入/200初读上限均核对。
- 零业务回调、API/外部请求、系统剪贴板、cookies或local/sessionStorage写入；测试样例不是有效凭据。父级/API/MySQL/权限/幂等/审计/真实明文与完整生命周期未验收。
- P36相关14项单测通过；全局主题文件的另外4项通过，颜色门1项失败：既有 `org-data-export-detail.css` 的P35直接色值在基线中已存在，本轮未改，已询问是否允许单独修复。不得将18/19写为全通过，也未据此提交。

可查看 [默认](../../output/playwright/p36-mobile-filters-vue/default-390.png)、[匹配](../../output/playwright/p36-mobile-filters-vue/matching-390.png)、[重置焦点](../../output/playwright/p36-mobile-filters-vue/reset-focus-390.png)。这些是实际子Vue实图，不代替整页或生产批准。

## 原图与来源维护

`assertTokenFilterDelta` 只接受精确四帮助/标题关联、底部帮助、局部标记和样式引入；拒绝脚本、模型、字段上限、其他容器及帮助内容变化。新单测包括六种变异拒绝、四宽度检查、来源/PNG和旧批准范围。

`refresh-ui-phase2-token-filter-bindings.mjs --write` 先验证真实子组件差分和本轮实图来源，再从基线重建三个清单，仅更新该Vue来源指纹、依赖清单指纹和明确的sourceAssociation。其他来源必须完全相同；原112/354/196共662张PNG及原批准、模型捕获快照不改。执行后已重放原54场景双端、344控件状态/82点击和156字段状态/10流程，全部通过。旧模型属性属于捕获时快照，新增可访问描述不悄然写进原记录。

```powershell
node scripts/verify-ui-phase2-org-token-mobile-filters.mjs --smoke
node scripts/verify-ui-phase2-org-token-mobile-filters.mjs --capture
node scripts/verify-ui-phase2-org-token-mobile-filters.mjs
node scripts/refresh-ui-phase2-token-filter-bindings.mjs
node --test tests/unit/ui-phase2-org-token-mobile-filters.test.mjs
```

## 使用、收尾与未完成

在 `/org-admin/tokens` 的760px及以下宽度查看生命周期筛选，仍即时筛选已返回数组。没有新增生产参数、配置、env、API/OpenAPI、权限或数据库结构，后端/Worker/Python及其消费方不适用本展示改动。尚未部署，无当前重启要求；未来须通过完整门禁、本地前端构建和既有宝塔发布流程。

10张PNG及清单、后续源码登记生成的[图册](../../output/playwright/p36-mobile-filters-vue/index.html)共12个永久交付文件位于 `output/playwright/p36-mobile-filters-vue`。调试用两张临时图及 `output/playwright/p36-mobile-filter-debug` 目录已删除，未保留基线源文件或日志；隔离Vite使用临时空闲127.0.0.1端口，浏览器/服务finally关闭，既有缓存保留。新增图册通过正式登记关联统一审核入口，不改变既有PNG或批准范围。

当前未自动提交：全局颜色门失败，P35修复授权待答。P36创建组合/其他控件审核、父接线与其他C区域、全73页测试/部署/签收继续待完成；本局部落地不等于整页完成。

收尾补充：`typecheck:web`、153项文档/73路由/60受保护/6角色、运行文档、格式及diff空白检查通过；没有在已知全局门失败时继续宣称完整测试或生产构建通过。端口56571已无监听，当前改动均未暂存，commit hash不适用。
