# C 方向页面颜色角色收口与当前图证据复核

2026-09-12。此记录只收口现有 C 样式中的颜色声明，不代表全站重构、用户审核或生产验收完成。
承接 P47 两种手机空态的局部通过；不扩大为焦点修复、整页或真实登记/探针批准。

## 改动范围

使用 baseline-ui 的现有颜色角色优先原则，保持已展示的颜色和构图。

| 调色板 | 既有颜色角色 | 生效范围 |
| --- | ---: | --- |
| `design/provider-registry-tokens.css` | 20 | 原 `html:has(#app .provider-registry)`；原 17 个角色及 3 个保存后刷新失败颜色 |
| `design/platform-admin-mobile-tokens.css` | 11 | signal-ledger 的 P44 管理员页，且宽度不超过 760px |
| `design/platform-data-tokens.css` | 27 | `.platform-data`，保留原主题覆盖、焦点和透明度 |
| `design/platform-overlay-tokens.css` | 10 | P55/P56 四个现有详情/筛选浮层类，不扩大为所有共享浮层 |

共集中 68 个已有颜色角色，不是新增 68 种颜色。通知编辑器复用已有通知调色板的阴影角色。
P46 两份 CSS、P44 两份 CSS、数据中心与两个共享 Vue 浮层的样式、通知编辑器 CSS，
共 8 个文件在变量展开后与整理前文本完全相同。P44 调色板随后仅经 Prettier 换行；
格式化后重新运行实际页面捕获和当前指纹校验。没有变动这些文件的脚本、字段或事件。
共享浮层原正文与弱文本颜色不同于 P56 页面颜色，仍保留原值，未按名称相似强行替换。

全局主题检查仅对四个精确调色板文件开放相应作用域下的自定义属性声明，仍检查普通
CSS/Vue 样式中的字面颜色，不忽略整个目录。颜色、作用域、引用和原有 P47 样式合同均保留。

## 当前图证据

新增 `scripts/lib/ui-imported-style-sources.mjs`：只递归追踪已观察到的 CSS/Vue 内字面相对
`@import`，检查来源不能越出 `apps/web/src`，并防止循环。Vite module graph 不包含
PostCSS 折入所有者的样式，必须把这些实际依赖加入证据，而非手填新哈希。
P44 结果运行器原来误登记了比较控件运行器，现登记自身；不修改原图的审核状态。

| 当前包 | 检查 | PNG | 源文件 | 边界 |
| --- | ---: | ---: | ---: | --- |
| P44 可授权账号目录 | 134 | 30 | 40 | 实际父组件隔离实例 |
| P44 比较控件 | 110 | 16 | 40 | 实际父组件隔离实例 |
| P44 权限结果 | 234 | 48 | 40 | 实际父组件隔离实例 |
| P44 角色资料 | 352 | 24 | 40 | 实际父组件隔离实例 |
| P46 整体结构 | 452 | 132 | 173 | 未变换实际 App，390/760/761/840/841/1440 |
| P46 保存反馈 | 244 | 40 | 53 | 实际 Vue 隔离实例及审核参照，不是完整 App |
| P47 C 整合 | 430 | 20 | 174 | 未变换实际 App，390/760/1440 |

上述 310 张图连同 P54/P55/P56/P57 的 81 张当前 Vue 图，共 391 张正式复核产物。
不是 391 个独立业务状态，也不等于这些页面获批。P44 四组在格式化后重拍；未受该
文件影响的 P46/P47 包不重复运行，当前原始源码与图片哈希仍逐一通过。
历史 baseline 图和历史指纹没有为通过测试而重写。当前包新增独立严格校验。

- [P44 目录](../../output/playwright/p44-mobile-directory-implementation/current/index.html)
- [P46 整体](../../output/playwright/p46-approved-structure-implementation/current/index.html)
- [P47 整合](../../output/playwright/p47-c-integration/index.html)
- [P57 当前通知图](design/platform-notifications-direction-c/vue-implementation/)

## 验证结果与仍未通过项

- 定向颜色、无 important、导入依赖、6 组当前证据及 P47 原合同：27/27 单测通过。
- P46 原结构/反馈 CSS 合同分别通过，未删除其历史源或像素断言。
- P47 原桌面/手机功能回归 16/16；关联五份 E2E 为 88 通过、2 跳过。
- 最后 P44 调色板格式化后，仅重跑受影响的三份双端 E2E：72 通过、2 跳过；
  81 份 JSON 的测试结果、图片、当前源码/CSS、测试文件及辅助程序指纹均通过，
  `pageOverflow=false`，`userReview=pending`。
- 前端类型检查/构建、原 252 资产预算及 402 项静态分析通过；格式门禁通过。
- 全库单测最近完整运行：1308 项，1117 通过、191 失败。不能宣布全库通过。
  其中大量历史源码/图片关联需要逐项处理，不能批量更新哈希冒充重新验证。
  两个定向复现失败分别是旧父组件内要求出现“审核热点内容”、旧数据质量实现要求
  `params.get("evidence_id")`；当前实现已拆分组件并使用 `queryValue`，后续需要核对
  实际调用链后调整相应测试，不能只删除断言。生产只读预检单独复测通过，但不抵扣
  完整运行中的失败，也没有验证真实生产。其他失败尚未全部归因。

复核入口：`node --test tests/unit/theme-and-icon-completion.test.mjs tests/unit/platform-palette-contract.test.mjs tests/unit/ui-imported-style-sources.test.mjs tests/unit/ui-current-palette-evidence.test.mjs tests/unit/ui-phase2-provider-adapters-c.test.mjs`。
重拍继续使用相应既有 `verify-ui-phase2-*-implementation.mjs --capture` 和 E2E 的
`SCOUTOPS_UI_PHASE2_CAPTURE=1`，仅允许本地测试样例，不连接生产写接口。

## 使用、审核和运维交接

调色只在对应调色板修改，必须保持页面/浮层/断点作用域；同步重拍受到源码指纹影响
的当前图，并重新运行定向检查。无需添加配置开关、环境变量或依赖。
API、OpenAPI、后端/Worker/Python 消费方、权限、数据库、探针与发布规则均未改变，
此次纯样式整理不涉及这些契约，不修改 `.env` 或生产数据。

未提交、未部署，commit hash 不适用。全库门禁、其余页面/控件具体审核与真实验收
仍需继续；未来按原宝塔流程本地构建并上传前端、刷新浏览器，无新增后端重启要求。
正式 PNG/JSON 保留供审核；测试临时 last-run 文件与自建服务在收尾清理。
本记录的当前验证结果取代先前配色报告中“全局颜色门禁仍失败”的进度描述，
不改写旧批次的历史验证结果、像素比较或用户批准范围。
