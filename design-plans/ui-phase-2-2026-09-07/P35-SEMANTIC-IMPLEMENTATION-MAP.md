# P35 正式交互与实施证据关联

状态：source-reviewed-not-runtime-accepted，整页批准仍 pending-user-review。本登记不修改运行代码、不部署，也不能授予任何局部或全页批准。

后续父级证据：[实际App双视图读取矩阵](P35-PARENT-READ-STATES-REVIEW.md)112故障恢复场景、1624检查、128整页图已独立关联；证明所列读取/保留/替换规则，不改变下文旧控件图的覆盖范围，也不授予父级C批准。

[父级C独立设计](P35-PARENT-C-STATE-REVIEW.md)另关联17场景/276图/1272检查；新区域全部待审，未修改实际Vue，不将独立图片提升为通用六态槽已映射。

## 本页与他页边界

从当前 OrganizationAdminCenter.vue → OrganizationDataPanel.vue 路径核对全部23个源码入口，形成9组本页动作、5组排除。父子都参与源码扫描；不按列表行数重复计算按钮，不把其他页面的共享调用算成本页行为。

| 本页动作      | 实际行为                                      | 对应设计来源                                 |
| ------------- | --------------------------------------------- | -------------------------------------------- |
| OG-REFRESH    | 原load后台刷新；已有data及summary时保留旧内容 | refresh、refresh-loading                     |
| OG-RETRY      | 原load重新读取summary与data                   | error/forbidden/expired/rate_limited重试变体 |
| OG-D-REPORT   | 固定/reports导航，无新建/下载                 | reports                                      |
| OG-D-VIEW     | 工作区比较与导出履历；各自筛选保留            | 两视图已选/未选                              |
| OG-D-W-FILTER | 重置工作区三个条件，回第一页                  | workspace-reset                              |
| OG-D-W-PAGE   | 本地8行分页，首尾禁用                         | workspace-previous/next                      |
| OG-D-E-FILTER | 重置导出五条件，回第一页                      | export-reset                                 |
| OG-D-E-PAGE   | 本地10条分页，不扩大服务端最近100条范围       | export-previous/next                         |
| OG-TECH       | 原生details展示记录ID，无请求或弹窗           | technical-open/closed                        |

五组排除：P34专有首次500/429重试转发、P29资料表单、P30成员转发、P31资源授权转发、其他页共享原因窗发起与提交/取消。P35使用原父错误分支，不搬用P34已批准恢复白区。

父组件只传data和format-time两个prop，子组件无emit/fetch，也不接收busy参数。源状态条件、精确prop值和两个P34转发的approvals路由条件通过AST和合同校验。

## 字段、容器与全部图

8个本页v-model逐项登记，另6个父资料字段明确排除。工作区搜索只查名称；导出搜索只查工作区名称/中文类型/中文状态，不搜ID。枚举、名称去重和排序沿真实源。220字本地输入/初读URL截200单位的现有差异不改，完整URL恢复仍待验。

4个结构容器不是4个弹窗：父form和AuditedReasonDialog属于他页或无本页发起入口；子组件两个aside分别是观测时间、数据质量说明，均是行内区域。P35本地业务弹窗为0，跨页已经打开的共享窗口终态仍待生命周期验证。

- [正式登记JSON](action-reviews/P35.json)：精确源码签名、显式语义、字段/容器、控件与截图路径/宽度/SHA。
- [原94图](design/org-data-direction-c/README.md)：通用登记中的相关场景引用，不视为整动作的六态验收。
- [192张控件图](../../output/playwright/p35-controls-review/index.html)：19个现有控件变体关联12个本页源码入口，6个提案控件无源码入口；188控件图逐状态/双端核对，另4组合不冒充按钮状态。
- [140张字段图](../../output/playwright/p35-fields-review/index.html)：124字段图、16双端组合图均精确关联；8个字段而非新增8个提交动作。
- [24张实际子Vue图](../../output/playwright/p35-export-detail-vue/index.html)：仅手机导出详情实施证据，原548检查与14排除区基线对比的范围不变。
- [局部批准记录](P35-MOBILE-EXPORT-DETAIL-APPROVAL.md)：已批原手机详情组合和390px“尚未生成”/“0行”。生成/重试及新筛选组合待答，不扩为全页或24张全部通过。

控件和字段包在独立output目录，清单结构不等于统一设计包schema。本批用专用验证器精确关联，不改写旧清单或虚构规范化状态证据。通用审计的六态槽保留not-mapped；独立证据已关联与统一六态未映射是不同维度，不掩盖剩余登记工作。

## 验证与收尾

```powershell
node scripts/build-ui-phase2-org-data-review.mjs --check
node --test tests/unit/ui-phase2-org-data-review.test.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

生成登记使用同一脚本的--write，仅在真实源/图证据审查后运行。校验拒绝漏源入口、把待审改批准、错误控件归属、遗漏图片、提案手机范围扩为桌面、错误字段选择器、遗漏组合或真实Vue图。源、旧截图及所有证据清单不改。

首次定向检查抓出登记遗漏的两个子aside，以及生成器复用数组导致负向测试互相污染；已补完整容器并使用独立克隆，4项定向测试通过。没有改变生产样式、字段、路由、API/OpenAPI、后端/Worker/Python、权限、数据库、环境或依赖，因此无生产重启、迁移或配置调节要求。不重复无变化的浏览器采图或前端构建。

待完成：父级blocked/conflict等完整错误与刷新组合、真实父级生命周期、URL历史、主题密度/缩放、其他区域C实施与具体批准、真实后端/生产验证，以及全73页交付。本页正式登记不是本页已完成。

收尾：全部ui-phase2单测、153文档/73路由、运行说明、格式门通过；通用动作审计为36已登记页、745唯一源入口、719语义组、598路由动作，整页批准仍0。102原设计包/15069PNG源图零漂移；统一入口仅增加P35登记指纹，原4项真实Vue关联不变。生成JSON已格式化并重建下游指纹。未创建临时图片、下载、脚本或测试服务，无清理遗留；已有审核图和记录全部保留。
