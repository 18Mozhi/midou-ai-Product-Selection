# P66 保活读取与返页诊断 · 批次60

起点main/6025c198、621项在途变化、索引为空。批59有实质代码/图稿/验证进展，本批继续P66生命周期缺口，不把自动继续当作视觉或策略批准；完整73页目标保持。

## 结论与事实链

P66在普通运维路由切换时被KeepAlive缓存，不是卸载。离开后当前读取继续执行，成功/失败/拒绝响应仍更新缓存；返回原实例，不自动重新读取。只有离开整个壳层导致真正卸载时，才触发前端中止。该现状已经取证，但是否符合新界面的返页新鲜度要求仍待用户决定，不能把复现成功叫作策略验收通过。

依据AGENTS→Feature Map runtimeTopology→总纲M08-01/P66规格→实际路由、壳层、Vue和后端路由。实际目录标记preserve；NavigationShell按路由名称生成缓存键，KeepAlive max=12。RuntimeTopologyCenter只在onMounted读取、onBeforeUnmount递增序号和abort，没有onActivated/onDeactivated读取管理；缓存停用不触发卸载回调。服务路由调用service.read并写查看审计，没有将浏览器AbortSignal传入本页服务/仓储的取消链，不能据浏览器取消宣称后台查询或审计已停止。

fixing-accessibility技能用于核对可见键盘焦点、缓存页面不可见性和背景inert状态。本批用真实二级导航链接的Enter切换P66/P61，不用强行点击不可见背景。真正卸载一项通过实际shell:null兜底路由做程序性替换，明确不同于普通点击或KeepAlive容量淘汰。未改任何生产行为、模板或样式，也没有新的设计图。

## 双端实际观察

命令：`node scripts/diagnose-topology-read-lifecycle.mjs`。运行当前实际Vue C预览与原App/壳层/路由，1440和390宽、减少动效模式，所有响应为本地替身。每端9次拓扑GET，共18次；另有本地导航、会话和系统状态请求，不计入这18次。没有数据库、真实权限/审计、生产、业务写入、下载或真实剪贴板操作。

| 场景 | 离开期间 | 返回P66 | 本地拓扑累计GET/端 |
| --- | --- | --- | --- |
| 已读成功 | 原根节点移出DOM，ready与展开状态保留 | 相同实例；全部队列、策略和追踪仍展开，不自动读取 | 1 |
| 请求未结束就返回 | busy仍为true，无requestfailed | 继续等待同一请求；成功后换为local-pending-return | 2 |
| 离开后成功 | 缓存快照编号更新为local-late-success | 显示新编号，不再读取 | 3 |
| 离开后普通失败 | 旧快照与local-late-failure分开保留 | ready旧事实加失败提示 | 4 |
| 离开后403 | 缓存变forbidden，旧事实/快照编号清除 | 显示拒绝区域，不重新读取 | 5 |
| 先手动恢复，再离开等待超时 | 真实15秒后requestfailed，旧事实与本次失败编号分离 | 保留超时提示，不自动重读 | 7 |
| 请求中真正卸载壳层 | 两端约26ms出现net::ERR_ABORTED；旧引用仍是已卸载对象，迟到响应不改其快照 | 新实例发起第9次读取，实际可见状态ready、busy=false、local-topology-seed | 9 |

最终两个超时事件距路由拦截记录分别为14,996ms/14,992ms；与前端15秒计时起点存在几毫秒差值，没有加速时钟。源码序号保护与实际卸载后请求中止分别核对，未将保活离开误称卸载。诊断同时输出旧引用和当前可见实例，避免把已卸载对象残留的busy=true误当成新页面仍在加载。

普通二级导航往返时，焦点保持在相应的可见导航链接，具有focus-visible，未落入已移出DOM的P66；背景inert子元素始终为空。程序性兜底导航不等同菜单/浏览器后退/全部读屏验收；没有改变路由全局焦点策略。共享TechnicalDetails自身有停用反馈清理，但这不意味着P66父级读取已取消。

普通失败使用本地400响应避免额外安全重试干扰本次生命周期观察；503/429的重试合同沿用批57已验证结果，本批没有将400冒充后端依赖错误。初始/恢复数据沿用现有部分E2E样例，不据此证明真实运行健康或容量。

## 可复核性与范围

诊断仅输出JSON，记录每步连接状态、同一实例标记、当前可见状态、快照/失败编号、busy、展开项、焦点、请求失败和耗时。最后输出196个当前来源SHA；没有写临时日志、图片、profile或测试输出。它是诊断器，不把观察到的现状固化成“正确业务策略”测试。

| 关键来源 | SHA-256 |
| --- | --- |
| apps/web/src/components/RuntimeTopologyCenter.vue | aedf6a1e9a83b11ba8376aad116fe6e048261b79c6bbe92063e185d76cd3a7a3 |
| apps/web/src/components/NavigationShell.vue | 0819cf432ed5432267631555c156d47be7487140b5ae8650adcfb327f68832eb |
| apps/web/src/router.ts | 67dc541e1856fd5bd30688f9bf64d9e32d66491bb9a1a19d8ce5ef81679162f4 |
| apps/web/src/route-catalog.generated.json | 9c9db80601fb72ce97188908e24e4a6e73b0f4b80f6ec32f079bcfc914357b74 |
| apps/web/src/api-client.ts | 953c3da783121a797a86ff82e03a968067ae2c694a4fb5f883187b04569fa9ff |
| apps/api/src/runtime-topology-routes.ts | 850d8148baab86f20bad5bff10f5bec4b85f7f3802560c3adb9be7d94aae2de6 |
| scripts/lib/topology-page-preview.mjs | 4e7bbb5c8434ced259dcc56d59af461b4744aed22b5b8d9e7bbbfe03a1db8545 |
| scripts/diagnose-topology-read-lifecycle.mjs | 466d5abd0504c7708b9c7b595a96f0df0c42f9feb854c42926635e7d7db0751b |

生产及既有审核代码相对批59的173来源全部未变，复用其64相关测试、构建和资源预算证据，不重复无关构建或全库测试。本批直接运行双端生命周期诊断；补齐“旧引用/当前可见实例”区分后复测完成。无页面异常，外部/无关API请求防线未触发。

## 待决定的策略

建议新界面在离页时中止前端等待、废弃迟到响应；返回时自动重新核验，保留旧快照时明确标注这是上次观测，直到新读取完成。不改变已有15秒/权限清除/失败保留等规则；具体实施仍需按用户选择确认。

这一变化会增加返页的GET及相应查看审计次数，也不保证后端已发出的读取/审计停止。因此本批没有默认实施，也不把此前P62/P64的未答策略选择视为P66授权。若保留当前策略，则仍为离页继续读取、返回复用缓存和手动刷新。

## 交付闭环

新增永久诊断器及本报告，同步P66规格、计划/审核索引、README、Feature Map和运维说明。无生产代码、API、数据库、依赖、环境变量、配置、权限、超时/重试/缓存政策变化，OpenAPI和各后端/Worker/Python消费者无需修改，无重启或部署需求。

本批没有需清理的新增临时文件；服务与浏览器均finally关闭，结束前复核。前批`output/playwright/p65-read-states-r1`及`output/playwright/p65-table-controls-r1`仍因工具策略无法清理，未绕过。既有HEAD覆盖断言223/256与实际225/258的两项输入未变，处理决定仍缺，不重复失败、不暂存提交，commit hash不适用。

P66离页策略、主题密度/完整读屏与真实环境验收仍未完成；此前各待审图不自动批准，其他页面和全73页实施继续，未将本次诊断描述为全站交付。

收尾复核：批59的173来源仍全部匹配，格式、JSON解析和相关diff空白检查通过；两个诊断端口及相关浏览器/Node进程无残留。索引为空，623项在途变化保留未暂存。两处前批受阻临时目录仍在，本批未新增需清理的临时产物。
