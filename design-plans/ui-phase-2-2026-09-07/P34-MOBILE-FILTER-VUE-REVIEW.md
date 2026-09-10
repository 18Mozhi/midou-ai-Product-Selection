# P34 手机模板筛选区域 · 真实 Vue 局部实施

2026-09-10，基线 main / `7a147e6f65083cd63042a9c6b2d0a03ac8968b87`。

## 范围与依据

按 [用户局部批准](P34-MOBILE-FILTER-COMPOSITION-APPROVAL.md)，仅在 `OrganizationApprovalPanel.vue` 模板筛选区增加手机单列排列、五字段帮助、搜索长度文字和底部重置样式。760px及以下使用白底、C色值、16px/44px原生输入控件、18px字段间距；更宽屏幕不展示帮助文字，不改变原布局。保留原输入可访问名称，并用 aria-describedby 关联说明；这些说明在桌面虽视觉隐藏，辅助技术仍可读取，不声称桌面无障碍描述完全未变。

颜色按既有P31/P32惯例放在组件加载的 `design/approval-filter-tokens.css`，只向 `.org-approval-template-filters-c` 声明五个 `--so-approval-filter-*` 令牌，不改变全局主题。主题规则测试仍拒绝普通组件硬编码颜色，并严格限制该令牌文件的选择器及声明类型；首轮完整测试发现组件内颜色声明问题后已据此修复。

无 script 改动：搜索范围、工作区按名称合并、真实状态、版本号排序、分页、查询200 UTF-16单位初读/220单位可输入、重置及双视图状态保持原合同。没有增加maxlength、校验规则、禁用字段、折叠筛选、API或写操作。模板目录、详情、空结果容器、焦点视觉仍沿用现有实现，不能把整页视为C重构完成。

## 本轮验证

- [五张真实子组件截图与86项检查](../../output/playwright/p34-mobile-template-filters/evidence.json)：390/760/761/1440四宽度；单列、尺寸、实际计算色值、帮助ID、键盘顺序、Enter重置、URL保留与长度恢复、无横向溢出、零API/外部请求/浏览器错误。
- 在同一隔离宿主中加载基线Git版本SFC，在内存中逐像素对比：四宽度审批记录视图、761/1440模板视图共6项完全一致；没有向磁盘写入基线副本或对比临时截图。
- [匹配组合](../../output/playwright/p34-mobile-template-filters/matching-390.png)、[无匹配结果](../../output/playwright/p34-mobile-template-filters/no-result-390.png)、[重置键盘焦点](../../output/playwright/p34-mobile-template-filters/reset-focus-390.png)。后两者是当前实现证据，不代表对应视觉已批准。
- `tests/unit/ui-phase2-org-approvals-mobile-filters.test.mjs` 防止脚本合同误改，校验实图来源及刷新边界；原字段测试继续钉住用户批准图的SHA256。独立查询恢复验证重新运行38项并更新8张功能证据图。

隔离夹具只覆盖真实子Vue，不是父组件请求、API、SQL、权限、线上及完整生命周期证明。本次使用 frontend-design 限定已批准区域，复用项目Playwright验证方式；未安装新技能CLI或依赖。

## 使用、证据维护与部署

打开原 `/org-admin/approvals`，切换审批模板；手机宽度显示该区域，五条件仍即时筛选已返回数组，重置只清该视图条件。

```powershell
node scripts/verify-ui-phase2-org-approvals-mobile-filters.mjs --capture
node scripts/verify-ui-phase2-org-approvals-mobile-filters.mjs
node scripts/verify-ui-phase2-org-approvals-query.mjs --capture
```

`--capture`输出永久交付图，默认只校验来源/图片并重放；隔离Vite探测空闲端口，绑定127.0.0.1，finally关闭浏览器与服务。无新增生产配置、环境变量、查询键、依赖、数据库或API合同，因此 `.env.example`、OpenAPI及后端消费方不变。没有上线，本轮无需重启；后续仍须本地构建并按既有宝塔部署流程发布。

原三包90/244/150张提案图保留，不重采。仅当真实子组件/验证器变化且提案renderer、数据、其他来源不变时，允许以下顺序重验并更新来源指纹：

```powershell
node scripts/verify-ui-phase2-org-approvals-c.mjs --refresh-sources
node scripts/verify-ui-phase2-org-approvals-controls-c.mjs --refresh-sources
node scripts/verify-ui-phase2-org-approvals-fields-c.mjs --refresh-sources
```

该选项与capture/smoke互斥：先校验原PNG哈希，再完整重放并对比原检查结果，字段还对比去除可访问描述后的源属性，全部通过后才写evidence；不写PNG、不更新批准状态，也不允许用它掩盖提案renderer变化。修改提案须另建修订并重新审核，尤其不可覆盖已批准图。

后续用户已[批准空结果区域](P34-MOBILE-EMPTY-COMPOSITION-APPROVAL.md)，其真实Vue落地仍待后续。剩余：刷新/其他控件组合审核、模板目录及详情、父级异常、全页C和全73页实施/验收/部署。两份批准均为局部，不能据此宣布整页或第二阶段完成。

最终验证：26项定向、701/701完整单测、类型检查与前端构建、251资源预算、静态检查、153文档/73路由及运行文档门通过；四宽度86项实Vue与双端38项查询恢复通过。三组提案完整重验，101包14995PNG审计零源/图片漂移；双端审核入口通过。两次审核下载临时目录及单测临时fixture已清理，隔离Vite/浏览器已关闭。5张新增实图、8张查询功能图与证据为永久交付；构建输出及既有依赖缓存保留。
