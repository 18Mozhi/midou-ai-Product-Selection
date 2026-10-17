# 商品建议区布局重制

依据用户整体UI重制和Ecom168式紧凑数据工作区要求，商品详情的建议、五项评分条件、当前处理状态和补证阻断改为同一区域内的紧凑行。桌面建议与进度并排，手机单列；去掉重复色块、绿色大标题、红色侧边卡片与重复分隔留白。展开明细、质量门通过文字、历史任务链接和所有决策控件保留。

删除 automatic-selection.css 与 opportunities.css 中86个旧规则，保留混合规则里其他控件的选择器；同时删除已无Vue使用的 opportunity-blocker-summary 样式。统一样式由 OpportunityDecisionPanel.vue 引用 opportunity-decision-panel.css，复用现有颜色变量。组件script和template已与5c69110f逐字比对完全一致，仅增加style引用；没有新增控件、业务动作或决定规则。

浏览器检查在原交互流程中验证紧凑布局、18px建议标题、透明阻断背景及既有字体和焦点行为；固定夹具下建议区域桌面低于360px、手机低于520px，不代表任意长文案的固定高度。已查看实际桌面与390px新截图，两张 compact-recommendation-detail-20261017 基线作为长期回归资料保留，旧基线不覆盖。

首轮完整回归127通过、1失败：手机公开评价区域裁剪高度由683px变684px。实际查看原图与本轮实际图，评价文字、字段、控件及字号保持，位置随上方布局变化。另存两张 compact-recommendation-review-samples-20261017 布局上下文基线并进行严格重放，不改原图，不放宽比较阈值。四张新PNG均为长期交付物，不是待删除的临时截图。

7项最小回归、Web类型检查通过后，扩大82项相关Node回归通过。Web构建14.70秒通过，静态496文件、体积199资源、73路由/153必需文档、运行说明和真实性检查通过。最终整套128项桌面/手机浏览器回归通过，包含四张本次基线的严格重放，不沿用前一提交的通过数代替本轮结果。

使用方式：进入选品库任一商品详情，查看紧凑建议区并展开质量门及阻断明细。本次仅前端样式，单独发布后刷新生效，无新增配置、依赖、API、事件或数据库变化；OpenAPI、后端、Worker、Python、环境示例无对应变更。此前累计未发布的后端改动仍按各自发布说明执行，不能将本次无需后端重启扩展为整个版本无需重启。未部署，整体UI及每日100个真实整链商品仍需继续验收。

测试服务已退出。自动审批策略以 blocked by policy 拒绝本轮临时目录清理，未重试或绕过；保留 C:/Users/23136/AppData/Local/Temp/scoutops-compact-recommendation-baseline-20261017、C:/Users/23136/AppData/Local/Temp/scoutops-compact-recommendation-full-20261017、C:/Users/23136/AppData/Local/Temp/scoutops-compact-recommendation-review-20261017、C:/Users/23136/AppData/Local/Temp/scoutops-compact-recommendation-final-20261017。仅保留为诊断产物，不提交。原 verification/state.json 哈希及内容未变、不提交。
