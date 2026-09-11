# P44 手机角色比较控件 · 生产源码局部接入

2026-09-11。本批接入[已批准的比较控件区域](P44-MOBILE-COMPARISON-CONTROLS-APPROVAL.md)，不把目录、无差异结果的局部批准或单张截图扩为整页通过。UI技能用于延续已选C方向；没有重新选择风格或改变权限规则。

## 实际修改与边界

`PlatformAccountCenter.vue` 仅追加 `PlatformAdminComparisonMobile.css` 导入，原脚本、模板与既有样式逐字保持。新CSS只在既有 `signal-ledger` 设计标记、管理员管理当前导航、宽度不超过760px时生效：蓝色说明栏、20px复选框/44px点击区、两角色选择、搜索、分组、重置和键盘焦点。760px是实现断点，不是新增用户批准；390px局部是批准依据。

权限页同用比较组件，但不命中当前导航选择器。桌面、角色资料、结果列表和其他页面不接入此样式。下方与外围仍可能呈现旧主题；本批不是完整C页面，也没有用截图遮掉旧区域。审核宿主与完整App的外层宽度不同，不宣称局部接入截图与原审核整图像素相同。目录及已批准无差异结果的生产接入仍待，搜索无结果等未答审核保持待定。

## 前后对照与使用

- [旧版图册](../../output/playwright/p44-mobile-controls-implementation/baseline/index.html)：父组件精确取自 `c489ebf0`，不导入新CSS。
- [当前源码图册](../../output/playwright/p44-mobile-controls-implementation/current/index.html)：真实当前父组件和生产CSS，无审核CSS、无模板替换。
- [当前390px控件](../../output/playwright/p44-mobile-controls-implementation/current/390-admins-default.png) / [键盘焦点](../../output/playwright/p44-mobile-controls-implementation/current/390-admins-keyboard-focus.png)。均为本地实际Vue和拦截HTTP测试数据，未部署。

两条真实路径 `/platform-admin/admins`、`/platform-admin/permissions`，390/760/761/1440四宽度，默认/键盘焦点各一图：前后各16PNG，合计32PNG、两图册和两清单。基线92项、当前110项浏览器检查；基线35源/当前36源逐项LF指纹固定，新增来源仅生产CSS。全部正式文件保留用于审核，不是临时输出。

P44保留6项差异→同角色0项→显示全部3项→搜索0项→重置6项；比较不写URL，每宽度2GET。P45保留比较筛选同步URL与父层读取，每宽度5GET。所有请求均拦截，只允许真实accounts/roles路径的GET，禁止真实写入；这些计数不是生产性能或权限结论。

原重置按钮只在已有筛选条件下启用，不能把“只切换角色”假定为可重置条件。验证先输入搜索再点原本启用的重置，不强制点击禁用按钮，不改变产品规则。

初次像素检查发现原生焦点环边缘在不同浏览器实例中有少量栅格差异；短暂等待后仍不能可靠保证焦点PNG逐字相等。因此默认状态保留严格像素一致校验，焦点状态严格比较真实焦点目标、几何和计算样式，所有PNG仍各自校验原始SHA，未修改图像或冒充焦点像素零差异。P45和桌面的区域样式、默认截图以及焦点几何/样式不变；P44手机下方资料/结果/矩阵的本身样式保持，控件高度变化引起位置后移不算下方布局批准。

## 复验命令

```powershell
node scripts/verify-ui-phase2-platform-account-contract.mjs
node --test tests/unit/ui-phase2-admin-mobile-controls-implementation.test.mjs tests/unit/ui-phase2-platform-current-contract.test.mjs
node scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs --baseline
node scripts/verify-ui-phase2-admin-mobile-controls-implementation.mjs
```

需要有意重新制作本批正式图时在后两条命令追加 `--capture`；默认不写图。服务器使用空闲本地端口、仅拦截GET，脚本finally关闭浏览器和服务。不安装依赖、不接触生产。历史设计图经精确c489父指纹关联，未知父源仍失败关闭；当前静态合同直接核对真实35源，不用旧Git源码替代当前通过。旧批准PNG和原图包均不覆盖。

## 交付与未覆盖

本批修改生产前端源码，需要前端重新构建并通过既定宝塔部署流程发布后，线上才可见；本轮不部署、不重启。没有新增环境变量、运行开关、依赖、API/OpenAPI、数据库、鉴权或请求参数；后端、Python、插件和部署配置不涉及本次样式链，无需变更。

定向回归、相关UI完整回归、前端构建、文档/格式/差异门禁及Git提交结果以本批最终收尾记录为准。完整App、其他主题密度、真实RBAC/导出/审计、其他字段/按钮/弹窗、整页审图与全部73页宝塔验收仍未完成，不因局部接入而删减。

收尾验证：31项直接相关检查、800项相关UI回归均通过；前端类型检查与Vite生产构建通过，73路由/153必需文档与格式门禁通过。旧模板保护测试此前把尾部style标签误算为template，现用Vue解析器精确取完整template，保留业务断言；新测试另严格约束父文件只能追加本CSS导入。历史102包15069PNG的源/图片漂移为0，不重跑旧制图或改旧批准。

验证浏览器及临时服务均由finally关闭，已核对本轮使用的13个端口无监听；无新增验证用临时文件。32PNG及图册/清单为正式审核交付物保留，既有构建输出按项目用途保留。提交hash在最终回复提供，不把本段技术通过作为视觉或生产批准。
