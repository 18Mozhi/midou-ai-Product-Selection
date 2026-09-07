# R01：54个目录外候选的逐动作归属复核

日期：2026-09-07。配套机器清单：[source-scope-review.json](source-scope-review.json)。本记录补足原source-reconciliation的文件级分类，不修改自动生成的actions/dialogs/coverage，不冻结G0，不新增产品路由。

e1f7a92读取修复后的清单复核：全局源指纹变化仅来自TaskWorkspace，54项目录外候选逐对象对照前一清单完全相同，13份本范围来源哈希继续由只读验证器核验。机器记录只更新所关联的全局指纹，不改逐项语义、测试结论或审批状态；这不是再次执行54项运行验收。

## 结论与范围

54项由53个控件/事件候选和1个原生确认调用组成，位于9个组件。48项属于8个开发查询视图，6项来自没有显式渲染消费者的OpportunityMobileShell。逐项归并得到42个语义动作ID；同一表单及提交按钮、同义重试、确认调用可关联同一个动作，不以源码位置重复计算行为。另5个无handler的当前/禁用Tab保留为非动作占位，不删除源码、不计为可执行业务动作。

| 组件 / 开发view | 候选数 | 已核对的动作语义 | 边界 |
| --- | --- | --- | --- |
| ApiFoundation / api | 1 | 重新检查→GET /health/ready | 成功恢复只证明隔离响应驱动，非真实依赖恢复 |
| AuditSecurityCenter / audit-security | 12 | 导航、范围切换、筛选、失败/空态重载、选记录、游标加载更多 | 读取路径分平台与组织；query保持limit/action/outcome/resource_type/cursor |
| AuthorizationCenter / authorization | 8 | 导航/选范围、失败及空目录重载、选角色 | /me/authorization与组织roles只读；不允许由浏览器推导权限 |
| DeploymentFoundation / deployment | 2 | 本地切换回滚说明；重新读ready/version | 回滚模式只在非健康结果区出现；按钮不执行部署或数据库回滚 |
| FileAuditFoundation / file-audit | 3 | protected/denied/redacted本地预演 | 无API写入，不是文件保护或脱敏执行证明 |
| MySqlFoundation / mysql | 3 | available/blocked/rollback本地预演 | 无数据库连接或迁移，不是生产MySQL验收 |
| RedisFoundation / redis | 3 | available/unavailable/recovering本地预演 | 无缓存读写或队列操作，不是生产Redis恢复 |
| ResourceGrantCenter / resource-grants | 16 | 导航、创建展开、类型切换、筛选/选中、读取、创建/延期/撤销与原生确认 | POST创建、PATCH expiry、POST revoke；原因、版本锁、幂等键按当前源码；取消确认不提交 |
| OpportunityMobileShell / 无 | 6 | 返回机会链接与5个无handler的当前/禁用Tab | 未找到显式渲染入口；禁止为了凑执行覆盖虚构路由或删除组件 |

## 真实装配依据

App.vue的requestedInternalView只解析query。DEV判断实际在selectedView中：只有开发模式且view在internalViews集合中才选中查询视图；否则沿用route.meta.view。不能将解析query本身说成DEV门。以上8个view不在73条目录的独立route.view中。

NavigationShell仍使用受排除列表限制的广泛Vue glob，surfaceComponents没有OpportunityMobileShell入口。没有显式调用不等于不打包；本批不声称这些组件已从生产bundle剔除，也没有执行生产query不可达验收。生产边界必须用当时构建和真实URL另证。

source-scope-review.json逐条保留candidateId、条件、事件、handler、目标链接、API引用、语义ID、源文件哈希和部分测试入口。读写分类描述动作完整调用链，原生撤销确认本身不写入，只有接受确认后的revoke流程才可能POST。所有runtimeStatus保持partial或不可执行；不能把sourceReview=reviewed当成用户设计通过或真实权限/数据库通过。

## 运行验证及未覆盖项

沿用现有M00/M01的隔离夹具；新增3个状态预演用例与授权事务合同、审计筛选/游标用例，扩展API重试、部署恢复读取、角色空态/拒绝后重试。首次新增用例暴露测试错误：部署入口仅在受阻区、授权glob未覆盖子路径、select关联label匹配失准；修正为真实入口、完整子路径拦截与combobox定位后定向复测通过。授权用例同时拒绝未匹配写请求，防止夹具漏拦截。

没有声称54项全部逐个执行：导航目标仍部分为源/href证据，开发授权所有错误分支、并发/防重复、不同角色与外部真实后端尚未全覆盖。生产版本、全站73页按钮分母、用户视觉签收均不由本批证明。原清单unmappedCandidates=54保留原始含义，本补充记录说明归属，不通过改计数制造0漏项。

复验（仓库根目录，现有依赖）：

```text
node scripts/verify-ui-phase2-source-scope.mjs
node --test tests/unit/ui-phase2-source-scope.test.mjs
```

验证器只读，无参数；检查54个ID无漏项/重复、事件与条件仍对应源清单、42个动作的占位边界、确认调用不丢失、源哈希/清单指纹有效以及测试文件存在。它不是自动执行业务测试的替代品；测试执行见PROGRESS中本批结果。
