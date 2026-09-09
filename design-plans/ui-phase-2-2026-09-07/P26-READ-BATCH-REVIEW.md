# P26 真实读取批次归属修复

后续进展：P16色值门禁已按原外观不变的局部令牌整理处理，见[P16说明](P16-COLOR-TOKEN-REVIEW.md)。下方445/446与暂不提交为上一轮真实记录；最终全量测试/提交状态以新说明和本轮回复为准。

## 范围与依据

在 main / 2b5a8898 的干净工作树继续通知中心实施。原 `loadGeneration` 只保护 `Promise.all` 后的赋值，但 `api` 会提前写入请求编号、列表 total 和页面错误。旧列表仍可把新列表分页改为99，旧错误可覆盖新成功，同批失败后的兄弟请求也可改写错误编号；销毁后读取仍可落地。

使用 investigate 的根因、红绿回归方法；专用冻结脚本不可用，未引入全局配置、遥测或依赖。先前4项红测失败后才修复真实组件。

## 实现

`NotificationCenter.vue` 的三项并行读取共享当前代次、active 与组件存活检查。内部 api 的可选 owner 回调同时保护 meta、requestId、错误状态/提示；首个失败立即使同批其他请求失效。最终结果仍在同一检查后应用。onUnmounted 失效所有读取，新 load 不再发请求；普通 KeepAlive 离开不视为销毁。

不改变 template、CSS、API路径/方法/body、page_size=20、权限、邮件禁用和通知业务规则。没有新开关，不需用户调参；OpenAPI、后端、Worker、Python、数据库、环境示例无对应合同变化，因此不修改。

## 验证边界

- 12项源码回归中，7项验证读取保护与正常行为；其余5项记录仍存在的写入/草稿边界，不是全部修复证明。
- 新增真实Vue页面的旧成功/旧失败晚到回归，使用受控接口响应；不冒充真实生产API、SQL或SSE验收。
- 四套基础/写按钮/导航/字段图册重新运行捕获验证，98+60+240+70=468张，布局与数量保持；重新绑定源码及测试夹具指纹，不只替换哈希。
- 最终测试与交付命令结果见本文件末尾的收尾记录。

## 未完成与上线

自动已读A回执串入B、workflow局部回执混合A/B、刷新覆盖偏好草稿、旧保存关闭重开窗口及深链绕过普通busy入口的边界仍需分别处理。当前没有实现完整C布局，P26具体审核未通过；P16布局批准不外推。

本轮未部署。此修复将来随本地 `npm run build:web` 和项目正常宝塔上传进入生产，用户刷新页面使用；无需修改运行配置或重启后端/Worker/Python。全站73路由实施、完整状态组合与生产验收继续，不能因本轮回归通过提升批准门。

## 收尾记录

- `node --test tests/unit/ui-phase2-notification-ownership.test.mjs`：12/12，通过边界见上文。
- `npm run test:unit`：445/446，唯一失败为既有 `theme-and-icon-completion.test.mjs:81` 的 P16 `selection-journey.css` 直接颜色检查；不重建依赖的整套复测结果一致。该CSS和测试相对HEAD均无差异，没有为本轮扩大修改或跳过门禁；另记根目录 BACKLOG.md。
- `node scripts/run-playwright-projects.mjs m05-03-notifications.spec.ts m05-04-realtime.spec.ts --output=output/playwright/p26-read-batch-20260910`：桌面9、390手机9，共18通过。
- 四个 `verify-ui-phase2-notification-*-c.mjs --capture`（含基础 `verify-ui-phase2-notification-c.mjs`）：98/60/240/70图通过，无HTTP请求、浏览器已关闭。
- `build:web`（含类型检查）、`verify:frontend-budget`、`verify:docs`、`verify:runtime-docs`、`verify:static-analysis`、`format:check` 通过。
- 动作覆盖审计仍为27页语义核对、46页待核对；设计审计85包/11725图，源码和图片漂移均0，全页完成仍未证明。图库重新捕获包含部分焦点/悬停PNG字节更新，未改样式或布局。
- 双端测试服务4101/5173均已停止。仅本轮临时目录 `output/playwright/p26-read-batch-20260910` 内 `.last-run.json` 留存；已核对精确目录后执行删除，但工具策略拒绝，未重试绕过。四套正式图稿、审核证据与项目构建产物保留。
- 全量门禁未通过，按项目规则暂不提交、不部署。commit hash 不适用；不是第二阶段完成声明。
