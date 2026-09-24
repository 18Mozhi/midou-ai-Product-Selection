# P61 系统状态中心当前源码合同

范围：`/platform-admin/status` 下由`PlatformManagementCenter`装载的状态视图及其子组件。Feature Map 将页面路由列在 M06-02；P61 当前 C 方向生产 Vue 组合、数据所有权与部署证据见[实施记录](P61-PAGE-COMPOSITION-IMPLEMENTATION.md)，页面与路线边界见[P61规格](page-specs/P61.md)。本文件记录`PlatformStatusCenterView`的当前静态来源位置，不扩写状态查询或业务动作合同。

## 1. 父级事实与页面分区

`PlatformManagementCenter`持有状态GET与返回数据，并将状态事实和导航目标作为属性传给`PlatformStatusCenterView`；该视图按四个named slot装配依赖、传播核查、当前标签页会话和业务汇总内容，`PlatformStatusWorkspace`负责本地分区切换。视图自身不发起新的请求、不写URL或浏览器存储。链接只使用固定路径或父级事实中的`href`，不在本文件推导任何未核实的业务副作用。

## 2. 当前候选与LF指纹

### apps/web/src/components/PlatformStatusCenterView.vue

| 当前candidateId | 行 | 类型 | 当前语义归属 |
| --- | ---: | --- | --- |
| apps/web/src/components/PlatformStatusCenterView.vue#528025bcfd01008c.1 | 29 | control | P61-STATUS-CURRENT-TOPOLOGY / 导航至实时拓扑页面 |
| apps/web/src/components/PlatformStatusCenterView.vue#5ec3f86a53bdd26b.1 | 37 | control | P61-STATUS-CURRENT-NODE / 单个拓扑节点按父级提供的href打开相应详情 |
| apps/web/src/components/PlatformStatusCenterView.vue#1c29b9e693b1be23.1 | 75 | control | P61-STATUS-CURRENT-PROPAGATION / 对当前传播核查项使用其父级提供的href进入处理页 |
| apps/web/src/components/PlatformStatusCenterView.vue#4c8c3c0ab5222aee.1 | 140 | control | P61-STATUS-CURRENT-COLLECTION / 导航至采集任务概览 |
| apps/web/src/components/PlatformStatusCenterView.vue#0e70539c0b003023.1 | 149 | control | P61-STATUS-CURRENT-PROVIDER / 导航至来源配置目录 |

| 当前源文件 | 当前LF SHA-256 |
| --- | --- |
| apps/web/src/components/PlatformStatusCenterView.vue | 6ce3255def9689fd88051da43680d5eb53b50699c4f229901871b267cacab9c7 |

这五项登记视图中的导航源码身份，不等于去重后的五个独立业务动作，也不证明目标页的读取/权限、传播状态判断、真实生产观测或生产RBAC已验收。静态映射不改变父级GET、P61页面结构、M06-02路由能力和既有七个目标范围。
