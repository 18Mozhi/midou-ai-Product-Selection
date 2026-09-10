# P39 组织与账号概览 · C整页组合 r1

具体整页构图待用户审核。起点 `main/6e01d1cf`。这次把真实父组件、筛选、组织记录与创建弹窗组合在同一浏览器页面；不是把各张局部PNG拼接，也不是生产接入。

[打开28张组合图册](../../output/playwright/p39-page-composed/index.html) · [源/图/检查清单](../../output/playwright/p39-page-composed/evidence.json)

## 设计内容

使用 `frontend-design` 按已选C方向分开全局规模和组织结果。宽屏为蓝色规模/管理目录＋白色组织结果区；1024px及以下把目录改为上方紧凑汇总，避免761px表格被侧区挤窄；原组件仍在760px及以下转移动记录与筛选层，没有改它的运行断点。标题与创建入口组成紧凑白色头部，原刷新按钮移到结果标题旁，不重复新增刷新动作。

筛选复用上一批模板帮助/标签和CSS；创建弹窗复用上一批原Vue模板/逻辑及CSS。原两份样式文件和146张已展示图片（86提案＋18筛选＋42创建）均不重写。组合后的可用宽度、外围颜色与滚动上下文不同，不能用文件未变推定局部视觉已获批。

预览只在内存中对 `PlatformAccountCenter.vue` 增加目录/结果容器、更新标题说明并移动原刷新按钮；脚本以及全部原生Vue指令按编译AST逐项保留，原事件、字段与条件不变。未更改生产文件或入口。空数组不能等同于全平台无组织，因此待审空态文案改为“当前没有组织记录”，说明本次返回与平台汇总分开；这是预览文案，不是后台结果判定变更。

## 实图与验证范围

| 组合 | 手机390 | 桌面1440 |
| --- | --- | --- |
| 原始单条组织/独立汇总 | [图](../../output/playwright/p39-page-composed/390-normal.png) | [图](../../output/playwright/p39-page-composed/1440-normal.png) |
| 长组织名称 | [图](../../output/playwright/p39-page-composed/390-long.png) | [图](../../output/playwright/p39-page-composed/1440-long.png) |
| 三条明确合成组织 | [图](../../output/playwright/p39-page-composed/390-multiple.png) | [图](../../output/playwright/p39-page-composed/1440-multiple.png) |
| 首次读取中 | [图](../../output/playwright/p39-page-composed/390-loading.png) | [图](../../output/playwright/p39-page-composed/1440-loading.png) |
| 首次失败 | [图](../../output/playwright/p39-page-composed/390-first-failure.png) | [图](../../output/playwright/p39-page-composed/1440-first-failure.png) |
| 后台读取 | [图](../../output/playwright/p39-page-composed/390-refreshing.png) | [图](../../output/playwright/p39-page-composed/1440-refreshing.png) |
| 刷新失败保留快照 | [图](../../output/playwright/p39-page-composed/390-refresh-failed.png) | [图](../../output/playwright/p39-page-composed/1440-refresh-failed.png) |
| 本次返回无组织 | [图](../../output/playwright/p39-page-composed/390-empty.png) | [图](../../output/playwright/p39-page-composed/1440-empty.png) |
| 筛选无结果样例 | [图](../../output/playwright/p39-page-composed/390-no-results.png) | [图](../../output/playwright/p39-page-composed/1440-no-results.png) |
| 同页打开新建用户 | [图](../../output/playwright/p39-page-composed/390-create-user.png) | [图](../../output/playwright/p39-page-composed/1440-create-user.png) |

另外4张正常页：[759](../../output/playwright/p39-page-composed/759-normal.png)、[760](../../output/playwright/p39-page-composed/760-normal.png)、[761](../../output/playwright/p39-page-composed/761-normal.png)、[1024](../../output/playwright/p39-page-composed/1024-normal.png)。移动另有[筛选层](../../output/playwright/p39-page-composed/390-filters.png)、[记录预览](../../output/playwright/p39-page-composed/390-record-preview.png)、[技术展开](../../output/playwright/p39-page-composed/390-record-technical.png)；桌面另有[列设置](../../output/playwright/p39-page-composed/1440-columns.png)，共28张。不为桌面伪造移动专有弹层。

57项浏览器检查包括六宽度正常布局、交互控件44px/16px、蓝区白字、无页面横向溢出、手机首条记录在900px测试视口内开始可见、原始全局计数2/3、16/18、2独立于一条组织记录、三个原管理链接、刷新唯一性、读取/失败事实及移动预览返回焦点。临界宽度表格可在自己的容器横向滚动，不强挤每个单元格。

标准图为整页截图；弹层用视口截图，避免把固定层拼成全页。图中时间固定为测试时钟。长名称、三行及无结果是明确合成变体；GET均由浏览器拦截，没有真实过滤、SQL、鉴权或写入。当前父组件在失败时保留上次数据；本批不决定401/403快照策略。

## 复验与交付边界

```text
node scripts/verify-ui-phase2-account-page-preview.mjs
node scripts/verify-ui-phase2-account-page-preview.mjs --capture
node --test tests/unit/ui-phase2-account-page-preview.test.mjs tests/unit/ui-phase2-account-filter-preview.test.mjs tests/unit/ui-phase2-account-create-preview.test.mjs
```

只读检查与有意重生成图片分开。最后11项永久测试核对脚本/指令、当前来源/图片散列及旧图/样式未变。预览源、永久测试、图册及文档为本轮交付物；没有临时文件，Vite和浏览器均在finally关闭。此前P38根下7个忽略诊断文件不是本轮产物，仍按其原报告记录。

未修改生产Vue、API/OpenAPI、Node/Python消费方、数据库、权限、配置、依赖或部署，无重启要求；这些面与本轮独立审核稿无关。未将新模板和CSS加入生产main入口，不重复执行输入未变的生产构建。

“整页组合”仅指P39父组件内容，不包含完整App/NavigationShell、实际目的页渲染、浏览器历史缓存、所有控件状态、组织创建/组织详情路由、真实账号写入、三主题/软键盘或生产验收。默认构图待审核，前两批局部问题未答继续待；本批不替用户批准它们。全73页C实现、真实环境验证、宝塔部署及最终签收仍未完成。
