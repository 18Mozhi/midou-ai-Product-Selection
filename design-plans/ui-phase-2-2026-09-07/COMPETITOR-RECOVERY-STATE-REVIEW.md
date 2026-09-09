# P19/P20 恢复与空结果按钮 · C 方向审核

状态：新增离线图稿待审；不改变任何既有批准范围。P16只有整体布局通过；此前待审的采集busy和删除focus两图不在本批替换。

## 这次请看什么

补齐读取失败的主次操作、P20独立会话/权限/依赖异常、管理者和只读者的空目录/搜索无匹配。沿用C方向蓝主按钮、白底次按钮、3px键盘焦点和按下反馈；恢复区主次按钮间距12px，可换行。不是沿用旧页布局，也不是新增业务入口。

- “重新读取 / 稍后重试”跟随真实load()：两页均先读竞品目录，再读规则，有对象时读详情。离线仅记录首个GET并显示loading，**不宣称已恢复，也不伪造后续响应**。
- “返回上一页”记录history.back()，不固定到某个地址；无上一条历史时的真实浏览器行为未在本稿模拟。
- 重新登录保留各自页面；P20另有competitor查询样本。过期态无次按钮，未提交写入不重放，不保证草稿持久化。
- 实际UiStatePanel的权限次按钮文案为“申请权限”、受阻次按钮为“查看影响”，但本组件都跳/home。离线稿分别改成“离开此页”和“返回工作台”；**只是准确文案提案，真实Vue未改，未实现申请权限/影响分析**。权限态两个入口均到工作台，保留源主次事件以供逐按钮审核。
- 空目录：管理者添加/刷新；只读者刷新/返回。只读“刷新数据”纠正源默认“开始创建”的误导文案，不改变load去向。搜索无匹配：主按钮清空搜索，次按钮按权限添加或刷新。
- P20空规则数组实际是ready，不借用P19空目录恢复分支；正常“创建第一条规则”入口不在本批细化。
- 源loading隐藏恢复footer，因此本批只制作default/hover/focus/pressed，不编造独立disabled/busy按钮；读取中用完整loading场景表示，不视为按钮灰化验收。

## 每个控件的双端四态

以下所有控件均为单独的页面/selector变体；不是一张异常图在两页重复计数。

### 桌面1440px

| 页面 / 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| P19 读取失败 / 重新读取 | [查看](design/competitor-direction-c/1440-control-p19-retry-default.png) | [查看](design/competitor-direction-c/1440-control-p19-retry-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-retry-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-retry-pressed.png) |
| P19 读取失败 / 返回上一页 | [查看](design/competitor-direction-c/1440-control-p19-back-default.png) | [查看](design/competitor-direction-c/1440-control-p19-back-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-back-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-back-pressed.png) |
| P19 会话过期 / 重新登录 | [查看](design/competitor-direction-c/1440-control-p19-login-default.png) | [查看](design/competitor-direction-c/1440-control-p19-login-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-login-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-login-pressed.png) |
| P19 权限拒绝 / 返回工作台 | [查看](design/competitor-direction-c/1440-control-p19-forbidden-primary-default.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-primary-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-primary-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-primary-pressed.png) |
| P19 权限拒绝 / 离开此页 | [查看](design/competitor-direction-c/1440-control-p19-forbidden-secondary-default.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-secondary-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-secondary-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-forbidden-secondary-pressed.png) |
| P19 依赖受阻 / 稍后重试 | [查看](design/competitor-direction-c/1440-control-p19-blocked-retry-default.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-retry-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-retry-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-retry-pressed.png) |
| P19 依赖受阻 / 返回工作台 | [查看](design/competitor-direction-c/1440-control-p19-blocked-home-default.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-home-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-home-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-blocked-home-pressed.png) |
| P20 读取失败 / 重新读取 | [查看](design/competitor-direction-c/1440-control-p20-retry-default.png) | [查看](design/competitor-direction-c/1440-control-p20-retry-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-retry-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-retry-pressed.png) |
| P20 读取失败 / 返回上一页 | [查看](design/competitor-direction-c/1440-control-p20-back-default.png) | [查看](design/competitor-direction-c/1440-control-p20-back-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-back-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-back-pressed.png) |
| P20 会话过期 / 重新登录 | [查看](design/competitor-direction-c/1440-control-p20-login-default.png) | [查看](design/competitor-direction-c/1440-control-p20-login-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-login-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-login-pressed.png) |
| P20 权限拒绝 / 返回工作台 | [查看](design/competitor-direction-c/1440-control-p20-forbidden-primary-default.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-primary-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-primary-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-primary-pressed.png) |
| P20 权限拒绝 / 离开此页 | [查看](design/competitor-direction-c/1440-control-p20-forbidden-secondary-default.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-secondary-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-secondary-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-forbidden-secondary-pressed.png) |
| P20 依赖受阻 / 稍后重试 | [查看](design/competitor-direction-c/1440-control-p20-blocked-retry-default.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-retry-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-retry-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-retry-pressed.png) |
| P20 依赖受阻 / 返回工作台 | [查看](design/competitor-direction-c/1440-control-p20-blocked-home-default.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-home-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-home-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-blocked-home-pressed.png) |
| P20 带competitor查询 / 重新登录 | [查看](design/competitor-direction-c/1440-control-p20-login-query-default.png) | [查看](design/competitor-direction-c/1440-control-p20-login-query-hover.png) | [查看](design/competitor-direction-c/1440-control-p20-login-query-focus.png) | [查看](design/competitor-direction-c/1440-control-p20-login-query-pressed.png) |
| P19 空目录 / 添加竞品 | [查看](design/competitor-direction-c/1440-control-p19-empty-create-default.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-create-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-create-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-create-pressed.png) |
| P19 空目录 / 刷新数据 | [查看](design/competitor-direction-c/1440-control-p19-empty-refresh-default.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-refresh-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-refresh-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-refresh-pressed.png) |
| P19 只读空目录 / 刷新数据 | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-refresh-default.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-refresh-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-refresh-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-refresh-pressed.png) |
| P19 只读空目录 / 返回工作台 | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-home-default.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-home-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-home-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-empty-readonly-home-pressed.png) |
| P19 无匹配 / 清空搜索 | [查看](design/competitor-direction-c/1440-control-p19-search-clear-default.png) | [查看](design/competitor-direction-c/1440-control-p19-search-clear-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-search-clear-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-search-clear-pressed.png) |
| P19 无匹配 / 添加竞品监控 | [查看](design/competitor-direction-c/1440-control-p19-search-create-default.png) | [查看](design/competitor-direction-c/1440-control-p19-search-create-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-search-create-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-search-create-pressed.png) |
| P19 只读无匹配 / 刷新数据 | [查看](design/competitor-direction-c/1440-control-p19-search-readonly-refresh-default.png) | [查看](design/competitor-direction-c/1440-control-p19-search-readonly-refresh-hover.png) | [查看](design/competitor-direction-c/1440-control-p19-search-readonly-refresh-focus.png) | [查看](design/competitor-direction-c/1440-control-p19-search-readonly-refresh-pressed.png) |

### 手机390px

| 页面 / 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 |
| --- | --- | --- | --- | --- |
| P19 读取失败 / 重新读取 | [查看](design/competitor-direction-c/390-control-p19-retry-default.png) | [查看](design/competitor-direction-c/390-control-p19-retry-hover.png) | [查看](design/competitor-direction-c/390-control-p19-retry-focus.png) | [查看](design/competitor-direction-c/390-control-p19-retry-pressed.png) |
| P19 读取失败 / 返回上一页 | [查看](design/competitor-direction-c/390-control-p19-back-default.png) | [查看](design/competitor-direction-c/390-control-p19-back-hover.png) | [查看](design/competitor-direction-c/390-control-p19-back-focus.png) | [查看](design/competitor-direction-c/390-control-p19-back-pressed.png) |
| P19 会话过期 / 重新登录 | [查看](design/competitor-direction-c/390-control-p19-login-default.png) | [查看](design/competitor-direction-c/390-control-p19-login-hover.png) | [查看](design/competitor-direction-c/390-control-p19-login-focus.png) | [查看](design/competitor-direction-c/390-control-p19-login-pressed.png) |
| P19 权限拒绝 / 返回工作台 | [查看](design/competitor-direction-c/390-control-p19-forbidden-primary-default.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-primary-hover.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-primary-focus.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-primary-pressed.png) |
| P19 权限拒绝 / 离开此页 | [查看](design/competitor-direction-c/390-control-p19-forbidden-secondary-default.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-secondary-hover.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-secondary-focus.png) | [查看](design/competitor-direction-c/390-control-p19-forbidden-secondary-pressed.png) |
| P19 依赖受阻 / 稍后重试 | [查看](design/competitor-direction-c/390-control-p19-blocked-retry-default.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-retry-hover.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-retry-focus.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-retry-pressed.png) |
| P19 依赖受阻 / 返回工作台 | [查看](design/competitor-direction-c/390-control-p19-blocked-home-default.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-home-hover.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-home-focus.png) | [查看](design/competitor-direction-c/390-control-p19-blocked-home-pressed.png) |
| P20 读取失败 / 重新读取 | [查看](design/competitor-direction-c/390-control-p20-retry-default.png) | [查看](design/competitor-direction-c/390-control-p20-retry-hover.png) | [查看](design/competitor-direction-c/390-control-p20-retry-focus.png) | [查看](design/competitor-direction-c/390-control-p20-retry-pressed.png) |
| P20 读取失败 / 返回上一页 | [查看](design/competitor-direction-c/390-control-p20-back-default.png) | [查看](design/competitor-direction-c/390-control-p20-back-hover.png) | [查看](design/competitor-direction-c/390-control-p20-back-focus.png) | [查看](design/competitor-direction-c/390-control-p20-back-pressed.png) |
| P20 会话过期 / 重新登录 | [查看](design/competitor-direction-c/390-control-p20-login-default.png) | [查看](design/competitor-direction-c/390-control-p20-login-hover.png) | [查看](design/competitor-direction-c/390-control-p20-login-focus.png) | [查看](design/competitor-direction-c/390-control-p20-login-pressed.png) |
| P20 权限拒绝 / 返回工作台 | [查看](design/competitor-direction-c/390-control-p20-forbidden-primary-default.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-primary-hover.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-primary-focus.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-primary-pressed.png) |
| P20 权限拒绝 / 离开此页 | [查看](design/competitor-direction-c/390-control-p20-forbidden-secondary-default.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-secondary-hover.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-secondary-focus.png) | [查看](design/competitor-direction-c/390-control-p20-forbidden-secondary-pressed.png) |
| P20 依赖受阻 / 稍后重试 | [查看](design/competitor-direction-c/390-control-p20-blocked-retry-default.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-retry-hover.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-retry-focus.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-retry-pressed.png) |
| P20 依赖受阻 / 返回工作台 | [查看](design/competitor-direction-c/390-control-p20-blocked-home-default.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-home-hover.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-home-focus.png) | [查看](design/competitor-direction-c/390-control-p20-blocked-home-pressed.png) |
| P20 带competitor查询 / 重新登录 | [查看](design/competitor-direction-c/390-control-p20-login-query-default.png) | [查看](design/competitor-direction-c/390-control-p20-login-query-hover.png) | [查看](design/competitor-direction-c/390-control-p20-login-query-focus.png) | [查看](design/competitor-direction-c/390-control-p20-login-query-pressed.png) |
| P19 空目录 / 添加竞品 | [查看](design/competitor-direction-c/390-control-p19-empty-create-default.png) | [查看](design/competitor-direction-c/390-control-p19-empty-create-hover.png) | [查看](design/competitor-direction-c/390-control-p19-empty-create-focus.png) | [查看](design/competitor-direction-c/390-control-p19-empty-create-pressed.png) |
| P19 空目录 / 刷新数据 | [查看](design/competitor-direction-c/390-control-p19-empty-refresh-default.png) | [查看](design/competitor-direction-c/390-control-p19-empty-refresh-hover.png) | [查看](design/competitor-direction-c/390-control-p19-empty-refresh-focus.png) | [查看](design/competitor-direction-c/390-control-p19-empty-refresh-pressed.png) |
| P19 只读空目录 / 刷新数据 | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-refresh-default.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-refresh-hover.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-refresh-focus.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-refresh-pressed.png) |
| P19 只读空目录 / 返回工作台 | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-home-default.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-home-hover.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-home-focus.png) | [查看](design/competitor-direction-c/390-control-p19-empty-readonly-home-pressed.png) |
| P19 无匹配 / 清空搜索 | [查看](design/competitor-direction-c/390-control-p19-search-clear-default.png) | [查看](design/competitor-direction-c/390-control-p19-search-clear-hover.png) | [查看](design/competitor-direction-c/390-control-p19-search-clear-focus.png) | [查看](design/competitor-direction-c/390-control-p19-search-clear-pressed.png) |
| P19 无匹配 / 添加竞品监控 | [查看](design/competitor-direction-c/390-control-p19-search-create-default.png) | [查看](design/competitor-direction-c/390-control-p19-search-create-hover.png) | [查看](design/competitor-direction-c/390-control-p19-search-create-focus.png) | [查看](design/competitor-direction-c/390-control-p19-search-create-pressed.png) |
| P19 只读无匹配 / 刷新数据 | [查看](design/competitor-direction-c/390-control-p19-search-readonly-refresh-default.png) | [查看](design/competitor-direction-c/390-control-p19-search-readonly-refresh-hover.png) | [查看](design/competitor-direction-c/390-control-p19-search-readonly-refresh-focus.png) | [查看](design/competitor-direction-c/390-control-p19-search-readonly-refresh-pressed.png) |

## 新增完整场景

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| P19只读搜索无匹配 | [查看](design/competitor-direction-c/1440-search-empty-readonly.png) | [查看](design/competitor-direction-c/390-search-empty-readonly.png) |
| P19只读空目录 | [查看](design/competitor-direction-c/1440-empty-readonly.png) | [查看](design/competitor-direction-c/390-empty-readonly.png) |
| P19目录依赖受阻 | [查看](design/competitor-direction-c/1440-recovery-blocked.png) | [查看](design/competitor-direction-c/390-recovery-blocked.png) |
| P20会话过期 | [查看](design/competitor-direction-c/1440-rules-expired.png) | [查看](design/competitor-direction-c/390-rules-expired.png) |
| P20会话过期保留查询 | [查看](design/competitor-direction-c/1440-rules-expired-query.png) | [查看](design/competitor-direction-c/390-rules-expired-query.png) |
| P20权限拒绝 | [查看](design/competitor-direction-c/1440-rules-forbidden.png) | [查看](design/competitor-direction-c/390-rules-forbidden.png) |
| P20依赖受阻 | [查看](design/competitor-direction-c/1440-rules-blocked.png) | [查看](design/competitor-direction-c/390-rules-blocked.png) |

## 覆盖口径与未完成项

22恢复/搜索变体×4状态×双端＝176新图，7独立整页场景×双端＝14新图，共190新PNG；包从396到586PNG、60整页场景、49控件变体226状态/452双端实例。

本批全部登记additionalControlVariants并验证精确pageId/actionId/selector/state/双端图；两个页面使用同一CP-STATE-RECOVERY语义键但按独立变体键分开，避免覆写代表证据。本批**不提升代表槽计数**：P19仍24/P20仍30，共54，不能把额外图数算成业务动作或批准数。此前整页图只是场景关联，更新为完整恢复操作后旧版从984f41df追溯。

未覆盖全部主题/密度/语言长文、所有路由查询组合、登录页面真正回跳、真实浏览器历史/实际异步恢复、RBAC/生命周期或完整Vue实施。全站其余52页同级语义细化及每页批准仍待；完整页面批准仍0。

## 依据与复验

当前CompetitorMonitor.vue的handleStatePrimary/Secondary、clearSearch、load、P19/P20分支；UiStatePanel.vue的loading/footer条件和state-contract.ts默认文案。两份共享源文件纳入本包来源指纹；未修改它们。

最小验证：`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`；完整只读复验不带参数；仅主动重画本包时使用`--capture`。动作和额外变体对应关系用`node scripts/audit-ui-phase2-action-coverage.mjs`。复用既有Playwright依赖/浏览器截图链，不新增测试框架、服务或安装包。

[交互原型](design/competitor-direction-c/index.html) · [完整图册](design/competitor-direction-c/gallery.html) · [对象按钮](COMPETITOR-OBJECT-STATE-REVIEW.md) · [语义合同](COMPETITOR-SEMANTIC-REVIEW.md) · [进度](PROGRESS.md)

## 运行与清理边界

本轮最小smoke和完整capture均通过：60场景586PNG、452双端控件实例，既有9组源码/5组边界检查及12屏宽×5代表场景保留；HTTP/页面错误0，最低文字对比5.33419。只目检390-control-p19-search-create-focus和1440-rules-blocked，不声称586图全人工审阅。前批390-control-collect-busy与1440-control-delete-focus同HEAD 984f41df逐字节哈希一致。

仅离线HTML/CSS/JS、永久验证器、PNG及审核文档/映射。生产Vue/CSS、API/OpenAPI、后端/Worker/Python、数据库/迁移、env/配置、依赖、安全和权限均未改，未部署，无调参或重启要求。所有新增图片为用户要求的永久交付，不是临时测试图；没有新临时文件/服务。浏览器由验证器finally关闭。此前临时目录output/playwright/ui-phase2-competitor-races-20260909清理曾被拒，保留并按进度记录，不绕过。
