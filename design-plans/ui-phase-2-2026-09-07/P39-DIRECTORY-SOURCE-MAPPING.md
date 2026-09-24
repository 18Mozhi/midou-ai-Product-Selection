# P39/P40/P43/P44 账号目录渲染源映射

2026-09-24。`PlatformAccountCenter.vue` 将组织、用户、管理员目录的渲染委托给本组件；父级继续拥有路由/筛选、请求、权限数据、弹窗和写入。下表只登记当前组件内19个扫描候选，不把组件调用、表单提交或事件转发重复算作独立业务动作。候选签名按文件唯一；路由挂载和运行时变体仍以实际页面为准。

| 源文件 | 当前源码候选 | 语义合同 / 当前行为 |
| --- | --- | --- |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 29448f61eb8ffc80.1 | PA-NAV-ORG · 管理员目录分支的组织管理导航 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | ffed2dd7f439c4b0.1 | PA-NAV-USER · 管理员目录分支的用户管理导航 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | e400286c7cd59e44.1 | PA-NAV-ADMIN · 管理员目录分支的管理员管理导航 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 29448f61eb8ffc80.2 | PA-NAV-ORG · 非管理员目录分支的同一组织管理路径 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | ffed2dd7f439c4b0.2 | PA-NAV-USER · 非管理员目录分支的同一用户管理路径 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | e400286c7cd59e44.2 | PA-NAV-ADMIN · 非管理员目录分支的同一管理员管理路径 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | e9658d470d4cbeaf.1 | PA-FILTER · 搜索按钮触发表单提交，与表单读取归并 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 20080e701de7f5cb.1 | PA-RESET · 重置 query/status；无筛选或读取中时禁用 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 322a4ac62ce3a305.1 | PA-REFRESH · 首次读取失败时发出 load 重试 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 9c9141422bfd2c11.1 | PA-REFRESH · 组织记录区触发 load；刷新中或父级 busy 时禁用 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 03d32a05b1b3fd19.1 | PA-FILTER-DRAWER · ResponsiveFilterDrawer 组件调用，承载筛选字段，不另计业务动作 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 2d610959fc00fb96.1 | PA-FILTER · 表单 submit 转发 `apply-filters`，接线至父级既有筛选处理 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 86ea70e081f1f8e3.1 | PA-RESET · 组织空结果清除筛选 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | f68d2406f8c1db70.1 | PA-ORG-CREATE · 组织列表空态发出 create-organization |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 8871f6d994e9fced.1 | PA-ORG-DETAIL · 组织记录的 open-organization 事件转发，不生成第二个打开动作 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 44e761922e1da1d0.1 | PA43-DETAIL · 用户记录的 open-user 事件转发 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 86ea70e081f1f8e3.2 | PA-RESET · 管理员空结果清除筛选 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 38003e3f7b002f71.1 | PA-USER-CREATE · 管理员空态发出 create-admin |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | 103fa7d7798d62d6.1 | PA43-DETAIL · 管理员记录转发至同一用户详情入口 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 6923b73e52535ef3.1 | PA-ORG-DETAIL · 桌面组织记录详情入口，busy 时禁用 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 2a07373cb016b4b5.1 | PA-ORG-DETAIL · 移动预览中打开详情并关闭预览 |
| apps/web/src/components/PlatformOrganizationRecords.vue | 1c008f867673db60.1 | PA-ORG-TECH · 展开组织记录技术详情 |

普通组织/账号查询框的原生可见标签属于字段名称，不是独立业务动作；账号与组织筛选沿用父组件既有 query/status 和 apply/reset handlers。上表覆盖静态源位置，不等于每个动作六态、屏幕阅读器、全壳层/KeepAlive、真实 RBAC、MySQL 写入或生产验收。

## 当前源码指纹

| 文件 | LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | efb7e5343143c028294505450b8fb9b3b82867cf84576a0ce1ff83c23acb25d1 |

由 `scripts/audit-ui-phase2-contracts.mjs` 的只读合同扫描验证精确候选身份与源码哈希。源变更后必须按真实模板和 handler 更新映射；不可只刷新哈希。

### 历史候选（不计入当前覆盖）

以下两个签名来自组件旧源码，当前版本已分别由筛选抽屉调用和表单提交转发候选替代，不作为现行源码覆盖或额外业务动作计数。

| 源文件 | 历史源码候选 | 当前对应 |
| --- | --- | --- |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | d773d9dd7a465b72.1 | 旧 ResponsiveFilterDrawer 调用；由当前筛选抽屉候选替代 |
| apps/web/src/components/PlatformAccountDirectoryWorkspace.vue | d539742db4335e89.1 | 旧表单提交转发；由当前筛选提交候选替代 |
