# P27 真实读取归属修复

2026-09-10，基于干净main/03113937。此批落实自动化合同AR-G02的列表、成员、详情及组件销毁后的只读回包保护，不是P27完整C视觉实施、用户批准或生产部署。

## 原因与修改

原 `api()` 不区分请求归属，任何回包都写 requestId/notice/state；`load()` 无条件应用列表/成员，并在返回后重新套用路由。详情也直接赋值给 selected。因此先发后到的旧请求能覆盖新规则、重新弹出已关闭详情，刷新还能清掉用户刚输入的名称或原因。

新增22项实际setup与Vue ref/watch测试。修改前其中19项失败，证明过期列表、错误、详情、销毁及草稿覆盖；其余正常路径与后补首次深链兼容检查不是新缺陷数。修复后22/22通过。

生产改动仅 `apps/web/src/components/AutomationRuleCenter.vue` 的script：

- 列表与成员共享读取批次。新批次取代旧批次；任一子请求失败立即使同批后续元信息失效，不等Promise.all的外层catch才拦截。
- 详情绑定视图代次与发起路径。打开另一规则、创建/编辑、关闭、清query或销毁后，旧详情成功/失败均不写页面。
- 列表仍更新当前事实，但只有视图和草稿没有在读取期间改变时才重新套用路由。初次加载期间改变query仍能打开最新深链；离开原路由则不套用原页路由。
- onUnmounted失效读取、详情与只读预览；销毁后不再启动这些读取。普通KeepAlive停用不当作销毁，也不新增轮询或取消服务端任务。

`api()`增加的owner回调只在组件内部使用，不是网络API参数。既有写入不传owner，创建/编辑/启停请求和成功流程本批保持不变。

## 浏览器与图证

`node scripts/verify-ui-phase2-automation-read-ownership.mjs`在严格端口5175临时Vite中挂载原组件和真实Vue Router，1440/390各9场景，共18项：较新列表、读取期间创建草稿、详情A迟到/B成功或旧错误、清链接、创建新窗、编辑草稿、销毁和初次深链。使用隔离HTTP，包含原按钮点击与真实输入；测试宿主仅提供导航/刷新/销毁和只读状态观察，不是新产品能力。没有生产路由、真实API/MySQL、业务写入或Cookie/存储修改；server/browser在finally关闭。

旧C父包122图、按钮包208图、字段包114图随新源码重新核对生成，控制器/模板/CSS/夹具数据没有换版，不把重拍计为新增图或用户批准。`scripts/lib/ui-phase2-automation-design-data.mjs`仅补惯用的惰性onUnmounted适配，不模拟真实销毁证明；真实销毁证据来自新增测试。

可复验命令：

```text
node --test tests/unit/ui-phase2-automation-read-ownership.test.mjs
node scripts/verify-ui-phase2-automation-read-ownership.mjs
node scripts/verify-ui-phase2-automation-c.mjs
node scripts/verify-ui-phase2-automation-controls-c.mjs
node scripts/verify-ui-phase2-automation-forms-c.mjs
```

## 未改变和未关闭

未改template/CSS、字段、HTTP路径/方法/body、幂等/权限、数据库、依赖、环境变量、Worker或Python。OpenAPI无新契约，故不改；Feature Map同步本批实现与验证范围。原必填/预览循环保护、原因UI500/服务1000和编辑版本语义不变。

AR-G01的生产窗内错误可达与视觉、AR-G03真实服务/成员失效以及写入成功/失败回执归属、写后重读、重复提交早退、跨范围/多缓存实例仍待；本批没有将这些问题改称已修。P27图稿及P16按钮仍分别待具体审核，全站73路由与G0–G5目标不收缩。

## 使用、部署与清理

无需新增设置。后续发布须本地重新构建前端，再走现有宝塔固定目录部署流程并刷新浏览器；本批未部署、未执行迁移/生产重启。标准部署器可能维护窗口停止Node并处理迁移白名单，不宣称纯静态零停机发布。

新增源码测试与验证器为永久交付。图包是既有交付物；构建目录/依赖缓存按项目保留。临时浏览器/服务已关闭，4101/5173/5175无监听；审核导出临时下载已删除。本批E2E输出只剩45字节的 `output/playwright/p27-read-ownership-20260910/.last-run.json`，删除被执行策略拦截，未重试绕过、未提交；可由用户在资源管理器删除该本批目录。旧批来源不明或先前被拒绝清理的文件未动。

原自动化E2E套件1440/390共14/14通过，前端类型检查/构建、格式、静态分析、路由文档、运行文档及前端体积门禁通过；三套既有图包只读复验共444张通过。全站审计保持87包/12047PNG、来源与图片漂移0、未登记PNG0，审核台两端通过；这些不是新增整页批准或生产验收。
