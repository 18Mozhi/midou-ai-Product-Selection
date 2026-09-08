# 三类共享导航 · C方向待审稿

版本 SHELL-C-nav-r1。用户选择C方向，但本批尚未获审。范围是NavigationShell的成员/组织/平台导航、菜单、当前范围和访问状态；不是新增Pxx，也不是全站壳层/主题/发现已完成。

[交互稿](index.html) · [证据清单](evidence.json) · [原共享入口合同](../../shared-shell-role-state-contract-review.md)

## 新结构与50张图

使用frontend-design技能将旧横向账页模块索引换成蓝色授权目录、白色身份栏与工作面，去除旧大编号标题。菜单仍按真实路由目录分组，当前分组默认展开，菜单数量至少8时提供按名称/分组的搜索。移动端提供原生模态导航抽屉、固定的最多四项加更多；页面自身工作面在截图中明确标为装配位，不以解释区冒充完整业务页面。

1440×1000与390×844各25场景。页面截图fullPage，移动抽屉截图仅当前视口，长菜单在抽屉内部滚动。50图不是全站146槽位的替代；顶部场景选择和底部审核说明不进入生产。

| 场景                 | 桌面                                | 手机                               |
| -------------------- | ----------------------------------- | ---------------------------------- |
| 成员任务中心         | [图](1440-member.png)               | [图](390-member.png)               |
| 组织角色权限入口     | [图](1440-organization.png)         | [图](390-organization.png)         |
| 平台系统运维入口     | [图](1440-platform.png)             | [图](390-platform.png)             |
| 平台安全最小菜单     | [图](1440-security.png)             | [图](390-security.png)             |
| 审计员仅审计派生边界 | [图](1440-auditor.png)              | [图](390-auditor.png)              |
| 成员进入平台的入口   | [图](1440-member-platform.png)      | [图](390-member-platform.png)      |
| 成员完整菜单         | [图](1440-member-menu.png)          | [图](390-member-menu.png)          |
| 平台完整菜单         | [图](1440-platform-menu.png)        | [图](390-platform-menu.png)        |
| 菜单名称搜索         | [图](1440-menu-query.png)           | [图](390-menu-query.png)           |
| 菜单分组搜索         | [图](1440-menu-group.png)           | [图](390-menu-group.png)           |
| 菜单无匹配           | [图](1440-menu-empty.png)           | [图](390-menu-empty.png)           |
| 上下文展开           | [图](1440-context-open.png)         | [图](390-context-open.png)         |
| 运维二级导航         | [图](1440-operations-secondary.png) | [图](390-operations-secondary.png) |
| 任务二级路由         | [图](1440-task-detail.png)          | [图](390-task-detail.png)          |
| 首次核验中           | [图](1440-loading.png)              | [图](390-loading.png)              |
| 登录失效             | [图](1440-expired.png)              | [图](390-expired.png)              |
| 壳层被拒绝           | [图](1440-forbidden.png)            | [图](390-forbidden.png)            |
| 拒绝后的故障详情     | [图](1440-forbidden-technical.png)  | [图](390-forbidden-technical.png)  |
| 缺少组织工作区       | [图](1440-context_required.png)     | [图](390-context_required.png)     |
| 读取限流             | [图](1440-rate_limited.png)         | [图](390-rate_limited.png)         |
| 导航服务不可用       | [图](1440-blocked.png)              | [图](390-blocked.png)              |
| 壳层获准但路由无权   | [图](1440-route-forbidden.png)      | [图](390-route-forbidden.png)      |
| 已授权路由组件缺失   | [图](1440-surface-missing.png)      | [图](390-surface-missing.png)      |
| 重新检查中           | [图](1440-recheck-busy.png)         | [图](390-recheck-busy.png)         |
| 重新检查成功         | [图](1440-recheck-recovered.png)    | [图](390-recheck-recovered.png)    |

## 事实来源

- 菜单/标题/面包屑/运维二级导航以config/route-catalog.json、route-catalog.ts、navigation-shell-permissions.ts、navigation-shell-route-state.ts为准。永久数据助手直接执行现有纯权限/路由辅助函数；没有手写另一组导航清单。data.js与当前源推导结果深比较，漂移即失败，不能静默重采当作一致。
- 三壳层基准从m02-03-navigation-shell.spec.ts的summary函数抽取；成员平台角色来自同文件返回链用例；平台安全配置来自M02-03单元安全主体的能力投影。审计员/audit:read为显式派生边界，不是真实账号证明。基准菜单数9/7/15，安全与审计派生各1；这些是样本能力的结果，不代表生产角色永远只有这些菜单。
- 名称未在导航summary样本返回，严格展示“未命名组织 · 默认工作区”；不能从其他API对象或不同样本借名，也不显示UUID片段。
- 平台返回链接仍是/select-context，return_to使用该用例的/opportunities?status=watching，from为当前路径；组织返回使用原用例/trends?market=US&page=2。它们是本地样本，不读写真实导航记忆。
- 请求与错误分支依据NavigationShell及ApiClientError已有分类；本稿只模拟本地读取过渡，不请求/me/navigation或新增鉴权。forbidden技术编号为实际M02-03测试包m02-03-forbidden与m02-03-trace；其他派生错误不伪造编号。
- 组织邀请按钮依guard.roles包含organization_admin显示；平台新建组织依platform:superadmin；搜索/创建选品/通知仅成员壳层。点击邀请/新建只记录既有导航目标，不提交邀请或组织。
- 现有请求成功后再出现授权菜单，加载/失败不泄漏上一组菜单；壳层获准但路由缺能力仍单独显示页面拒绝。缺失组件的装配故障单独演示，不与公开404混算。

## 本批动作及未完成项

| 动作族                      | 本批行为                                                                              | 边界                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 品牌/菜单项/面包屑/二级导航 | 保留实际href，同壳层在内存中更新当前路径，菜单入口清查询并关闭抽屉                    | 不改地址栏，不发HTTP，非Vue Router验收；跨壳层只报告目标                             |
| 菜单分组                    | 原生details开合，当前分组/搜索结果展开                                                | 搜索只匹配名称与分组，不查业务对象                                                   |
| 手机导航/更多/关闭          | 至多四个授权主入口+更多；关闭、Escape、首尾Tab循环、返回触发焦点                      | 新模态抽屉是提案，不是当前Vue已具备；桌面宽度恢复时关闭并还原唯一导航DOM             |
| 当前范围                    | 名称与当前角色/任务域披露                                                             | 不把导航成功描述为已检测API、Redis等服务健康；旧“已连接·可复核”不作为新健康指标      |
| 壳层恢复                    | expired→/login；context_required→/select-context；forbidden→/home；限流/阻断→重新检查 | 重新登录文案不再承诺自动返回，现有/login链接并无return_to；本批不改目标契约          |
| 路由拒绝                    | 首个可达菜单/home；/me?section=permissions                                            | 只导航，不自动申请或修改权限                                                         |
| 故障详情                    | 原生details披露已知关联/链路编号                                                      | 不复制凭证或服务日志                                                                 |
| 主题/成员搜索/创建选品      | 本批保留真实可见条件与位置，点击明确提示“待独立C方向图稿”                             | **未实现对应浮层/弹窗或成功状态，不计这些动作完成**；Ctrl/Meta+K也只在成员显示此提示 |

移动二级路由只将更多标为当前，不同时把某个一级快捷项标为当前；侧栏依然指示父模块。这是本批明确的高亮提案，尚未改动Vue。上方个人中心在手机显示“我的”，可访问名称仍为“个人中心”，避免快捷动作额外换行。

下一批必须继续主题浮层/三主题映射/保存回退、发现搜索/快捷创建及其状态和焦点链；AccountShell单独设计，不能把本批三壳层覆盖算作四壳层全完成。具体稿获审后再装配真实页面、处理与各页蓝色范围区的关系，验证缓存、切壳、全部角色和生产链。当前装配说明区不能拿去代替任务、权限或系统状态业务工作面。

## 验证与重用

```text
node scripts/verify-ui-phase2-shell-c.mjs --capture
node scripts/verify-ui-phase2-shell-c.mjs
```

第一条经源码复核后更新永久图像/evidence；不自动重生成data.js。第二条只读核对数据推导、源/图哈希与双端交互。复用现有TypeScript与Playwright依赖，未新增依赖或启动本地服务；浏览器finally关闭。

验证包括25场景、5种菜单配置每个授权入口逐项点击、分组与菜单搜索、当前范围、七类访问/恢复分支、二级导航高亮、安全返回URL参数、模态焦点/Escape/跨断点还原、异步演示防旧结果覆盖、无API/存储写入/控制台错误。控件16px、正文最小13px、44px触控和页面无横溢出。截图目检发现蓝底容器继承导致输入文字/关闭按钮对比不足，已改为C正文墨色并增加定向断言；手机个人入口已压缩为一行快捷区。

上述是本地提案证据，不是全角色真实权限、全部主题/缩放/无障碍、实际接口/缓存/保存或部署成功。未改apps/packages/API/OpenAPI、数据库、环境变量、依赖、生产运行或旧图审批；无需重启。全部新增文件均为永久交付，没有新临时测试文件或服务；旧历史受限材料未操作。完整73页目标与原验收门保持不变。
