# P40 组织管理列表 · 实际Vue组合审核 r1

具体组合待审核。起点 `main/4cfea9db`。本批从原离线P40–P42提案继续到P40真实父子组件的浏览器组合；不是生产接入，也没有替用户批准前批P39。

[打开36张审核图](../../output/playwright/p40-list-preview/index.html) · [源、图片与检查证据](../../output/playwright/p40-list-preview/evidence.json)

## 改了什么

按 `frontend-design` 与已选C方向，把蓝色平台全局/对象目录和白色组织工作区组合；创建在页头、刷新在结果区。1024px及以下上下排列，原Vue的760px移动筛选/记录断点不变。P39局部模板/CSS直接复用且不改旧文件，P40有独立来源校验与局部样式。

P40输入明确为组织名称或标识，状态仍是空/active/archived三个原值，没有邮箱筛选或用户disabled选项。手机记录把原点分隔摘要改为名称、状态、成员/工作区两个有标签数量；0不补成1，未知状态原文显示。桌面保留五列及原列显示、冻结、密度操作，紧凑行确实缩短而查看按钮仍至少44px。移除了新手机状态类误命中旧Signal Ledger通用选择器所带的边线。

仅审核宿主在内存变换 `PlatformAccountCenter.vue` 和 `PlatformOrganizationRecords.vue` 模板。两个完整script、全部原生指令不变，记录动态表达式逐项相同；未修改生产Vue及main导入。无筛选空态沿P39提案说明本次返回与全局汇总独立，保留本页原“新建组织”按钮。

## 36张图与验证

正常页六宽度：[390](../../output/playwright/p40-list-preview/390-normal.png)、[759](../../output/playwright/p40-list-preview/759-normal.png)、[760](../../output/playwright/p40-list-preview/760-normal.png)、[761](../../output/playwright/p40-list-preview/761-normal.png)、[1024](../../output/playwright/p40-list-preview/1024-normal.png)、[1440](../../output/playwright/p40-list-preview/1440-normal.png)。

其余30张位于图册：390/1440各有筛选、12条合成记录、超长名称/标识、0关系计数、未知状态、新建用户、后台刷新、刷新失败、空数组、筛选无结果、首次失败、首次读取中；另手机预览/技术展开2张，桌面列设置/最后一列禁用/紧凑/不冻结4张。原始夹具仅一条组织，全局汇总为2/3、16/18、2；12行和其他异常数据只用于布局验证，超长标识不表示创建接口允许该长度。

97项浏览器检查覆盖六宽度基本结构/44px与16px控件/无整页横向溢出，并在390/1440实点筛选、reset、预览、创建/详情路由、列设置和读状态。P40筛选确实执行原Vue的trim、query/status请求及保留其他URL键；返回仍是拦截夹具，不能证明MySQL过滤或排序。表格自身允许横向滚动，不以强挤列宽代替响应式。

真实点击到 `/platform-admin/organizations/new` 和 `/platform-admin/organizations/{id}`，宿主把响应式route.path传入原父组件。原P41/P42子组件可打开，但没有把其旧样式截图计作新C完成，也没有提交任何写入。新建用户只核对同页打开原弹窗，提交合同沿前批P39，当前不重做真实账号创建。

验证过程中固定Date.now令Vue事件时间戳判断丢弃冒泡submit，表现为原生导航丢失查询。依据本地Vue runtime的 `_vts <= invoker.attached` 分支，把本批测试时钟改为从指定时间正常推进后，实际搜索及重置通过。此为验证宿主问题，没有为它修改生产业务代码；截图时间不是固定不走的时钟。P39历史图/清单保持原状，本轮并未把其未覆盖的筛选操作宣称通过。

## 复验与使用

```text
node scripts/verify-ui-phase2-organization-list-preview.mjs
node scripts/verify-ui-phase2-organization-list-preview.mjs --capture
node --test tests/unit/ui-phase2-organization-list-preview.test.mjs tests/unit/ui-phase2-account-page-preview.test.mjs tests/unit/ui-phase2-account-filter-preview.test.mjs tests/unit/ui-phase2-account-create-preview.test.mjs
```

默认命令仅浏览器检查，不重写图；`--capture`有意重生成当前36图/清单/图册。15项定向测试包括父子脚本/指令不变、漂移失败关闭、当前来源/PNG散列，以及P39和原P40–P42共130张相关旧图不变。浏览器GET拦截在导航前建立，其他业务方法和外部请求全部拒绝；不是生产RBAC、安全验收或真实数据库证明。

本批新文件均为永久审核交付物/可复用宿主/回归测试，无临时文件。每次运行在finally关闭浏览器context/browser及Vite；端口由本机临时空闲端口分配，不新增产品端口或配置。原P38根下7个历史忽略诊断文件不是本轮产物，未触碰。

## 未完成范围与下一步

本批总体构图待用户审核；不包含完整App/NavigationShell/KeepAlive、浏览器历史恢复、P41/P42新C实现、全部按钮键盘/悬停/等待组合、三主题/200%缩放/软键盘、真实权限及数据库、生产验收。后台失败仍按原父逻辑保留快照，没有决定401/403策略。

没有修改API/OpenAPI、Node/Python消费方、数据库、权限、环境配置或依赖，没有部署和重启要求；这些面与隔离审核稿无关。生产构建输入不变，本轮使用真实Vue编译与浏览器、定向测试及文档/格式门，不重复生产构建。下一继续P41/P42实际创建/详情C组合及获批区域实施，完整73页重构、宝塔部署和最终签收仍未完成。
