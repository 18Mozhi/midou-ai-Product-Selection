# P39 关键词与账号状态 · C方向筛选组合 r1

状态：具体组合待用户审核。起点 `main/54ec4736`；没有生产导入或部署，不扩大已有批准，也不宣称整页重设计完成。

[打开18张双端图册](../../output/playwright/p39-filter-preview/index.html) · [来源与检查清单](../../output/playwright/p39-filter-preview/evidence.json)

## 本次设计

用两个明确的字段组替代未标注的横向控件：关键词与账号状态各有就近说明，操作区独立分隔。手机单列、搜索和重置上下排列；桌面两字段并排、底部操作靠右。白色阅读面、蓝色主操作/键盘焦点、灰色不透明禁用，沿用用户选择的C方向，不继承旧衬线标题或朱砂操作色。技能 `frontend-design` 用于层级、字体、状态与响应式组合；浏览器检查发现并修正了预览中的旧字体/禁用透明度渗入。

本批不是纯HTML模拟，也不是“未修改模板的实际Vue”。Vite独立审核宿主加载当前 `PlatformAccountCenter.vue` 的完整脚本和子组件，仅在内存中为原筛选表单增加label/说明/操作容器及展示属性，再加载独立CSS。原v-model、submit/click、禁用条件、选项和表单外模板保持不变；生产组件及运行入口不导入这些文件。外围旧界面仅作宿主，不作为C整页设计展示。

## 图与覆盖边界

| 组合 | 手机390 | 桌面1440 |
| --- | --- | --- |
| 默认字段、重置禁用 | [图](../../output/playwright/p39-filter-preview/390-default.png) | [图](../../output/playwright/p39-filter-preview/1440-default.png) |
| 关键词键盘焦点 | [图](../../output/playwright/p39-filter-preview/390-query-focus.png) | [图](../../output/playwright/p39-filter-preview/1440-query-focus.png) |
| 状态键盘焦点 | [图](../../output/playwright/p39-filter-preview/390-status-focus.png) | [图](../../output/playwright/p39-filter-preview/1440-status-focus.png) |
| 已填关键词与已停用组织 | [图](../../output/playwright/p39-filter-preview/390-selected.png) | [图](../../output/playwright/p39-filter-preview/1440-selected.png) |
| 搜索悬停 | [图](../../output/playwright/p39-filter-preview/390-search-hover.png) | [图](../../output/playwright/p39-filter-preview/1440-search-hover.png) |
| 搜索键盘焦点 | [图](../../output/playwright/p39-filter-preview/390-search-focus.png) | [图](../../output/playwright/p39-filter-preview/1440-search-focus.png) |
| 搜索原生按下 | [图](../../output/playwright/p39-filter-preview/390-search-pressed.png) | [图](../../output/playwright/p39-filter-preview/1440-search-pressed.png) |
| 读取中、两按钮禁用 | [图](../../output/playwright/p39-filter-preview/390-pending.png) | [图](../../output/playwright/p39-filter-preview/1440-pending.png) |
| 重置键盘焦点 | [图](../../output/playwright/p39-filter-preview/390-reset-focus.png) | [图](../../output/playwright/p39-filter-preview/1440-reset-focus.png) |

390图是桌面Chromium的窄视口，悬停用于控件态核对，不是触屏悬停能力证明。未画原生select下拉菜单或虚构新选项。图仅截取字段与操作区，不包含外层抽屉标题/关闭按钮、顶部、列表、创建用户、权限或整页；不代表其他主题、200%原生缩放或手机软键盘通过。

## 真实合同与保留行为

- 两字段绑定为 `query`、`status`；关键词原占位文字保留，新帮助明确概览只展示组织记录，用户邮箱结果需到用户管理查看。不增加混合结果列表或新跳转按钮。
- 四个状态值保持 `""`、`active`、`disabled`、`archived`，对应全部状态、正常使用、已停用、已停用组织；后两者不合并。
- 只输入不发请求；搜索提交和重置使用当前父方法，其他URL参数保持。没有添加maxlength、required、错误判定或字段禁用。121字符仍可输入，不能把这条前端观察当服务端接受121字符。
- 读取中仅搜索和重置禁用，输入和选择仍可改；手机提交会关闭抽屉，本批读取中图通过真实入口重新打开。未决定在途新筛选的后续处理策略。
- GET只由本地浏览器拦截返回已有E2E概览样例，三个请求依次为无筛选、关键词米豆/archived、重置无筛选；每次返回同一个样例，不据此证明后端过滤、真实数据、MySQL或RBAC。未知请求与写入均阻止，没有真实创建、剪贴板或数据库操作。

## 验证与使用

永久命令（使用已有依赖，不安装）：

```text
node scripts/verify-ui-phase2-account-filter-preview.mjs
node scripts/verify-ui-phase2-account-filter-preview.mjs --capture
node --test tests/unit/ui-phase2-account-filter-preview.test.mjs
```

第一条只运行浏览器检查；第二条有意重生成本批18张正式图和清单。源指纹覆盖当前组件本地导入图、全局CSS、审核变换器与脚本；永久单测逐项核对脚本/指令不变、源漂移、图片散列以及原86图和生产父组件未变。首次定位失败没有通过删除断言或放宽边界绕过，修正了可访问名称、焦点/按下样式和移动抽屉重开检查。

本批最终通过四宽度82项浏览器检查、4项永久单测、153文件文档门及格式检查。总设计索引核对102包/15069张旧图，来源与图像漂移均为0；这只证明关联/文件完整，不是这些页面全部通过。本批18图另由自己的清单与单测核对，不重复计入旧主图数量。生产源和依赖未改，不重复执行此前已通过且输入未变的全量构建。

浏览器与临时Vite服务由finally关闭。创建的图片、清单与图册均是用户要求保留的正式审核交付物，无本轮临时文件。上轮 `output/playwright/p38-shell-lifecycle/` 根下7个忽略诊断文件不属于本轮，仍按其原报告记录，不擅自清理。

没有生产Vue/API/OpenAPI、Node/Python消费方、数据库、权限、配置、环境变量、依赖或部署改动；这些运行面与本次独立审核稿无关，无重启要求。新模板和CSS待用户审核后再按明确范围接入生产。

## 待审核与后续

请先审手机默认组合的两个字段、就近帮助和底部操作层级。桌面、焦点/按下/等待等状态单独列出，不随默认图自动通过。P39其他控件与创建/详情组合、真实页接入、父级完整生命周期、全73页C实施及宝塔部署仍未完成；本轮不把包数、图数或绿色检查替代验收。
