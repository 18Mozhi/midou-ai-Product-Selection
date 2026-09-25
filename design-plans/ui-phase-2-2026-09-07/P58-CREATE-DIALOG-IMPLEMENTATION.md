# P58 创建配额方案窗 · C 方向真实 Vue 实施

## 实施结果

用户已将未完成页面视觉统一授权为通过。本批把既有 P58 C 方向创建窗审核稿接入
`CommercialOperationsCenter.vue`：深蓝草稿身份标题，桌面填写说明侧栏与白色资料/额度/原因区，
手机改为单列；对话框仍保留原七字段、三按钮和直接创建草稿动作。没有把配额描述为价格、收费或
自动启用，也没有增加字段、业务确认步骤或外部选择器。

修复内部标识的浏览器原生 `pattern` 连字符编码。规则与后端 `^[a-z0-9][a-z0-9_-]{0,79}$`
等价，定向浏览器用例确认空格、大写、下划线起始不通过，而小写字母/数字起始、下划线和连字符可用。

提交等待期间，窗内 `role=status` 说明、字段与关闭操作禁用，Escape 不退出；明确拒绝在窗内显示原
`actionHint`、请求编号和可展开技术详情，表单内容保留。提交时焦点移至持续标题。页面原有 notice
仍然写入，业务 POST/body、`Idempotency-Key`、单飞守卫、成功查询/重置、只读重读与重试策略均未改。
尤其没有选择“未知结果时冻结原 body/key”或其它重提规则：诊断指出的幂等键重放风险仍需产品决定。

## 验证

- `node --test tests/unit/ui-phase2-commercial-create-review.test.mjs tests/unit/ui-phase2-commercial-create-write-review.test.mjs`：8/8 通过。两个旧图册继续按原始 P58 组件版本 `655a99686a170c1e98d2aea3cf69eb71cac69342` 复验，不把旧预览当作当前生产源；截图与原清单不变。
- `npm run typecheck:web`：通过。
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-06-commercial.spec.ts`：桌面 Chromium 4/4、390px 手机 4/4。新增用例覆盖创建窗布局/溢出、7 字段、标识原生约束、挂起 POST 时防关闭/禁编辑、模拟 403 的窗内提示/编号/草稿保留，以及模拟 201 的原请求、成功关闭、列表定位与草稿重置；所有 POST 都由本地浏览器拦截，不产生真实写入。
- E2E 临时 API/Vite 进程在测试结束后退出。生产未连接、未写入、未部署；真实会话/RBAC、MySQL/审计和未知 POST 结果策略不由本地测试证明。

## 影响边界

只改创建原生 dialog 的 Vue、样式与该路径 E2E；复用原 API，不改调用字段、OpenAPI、服务端校验、数据库、权限、环境、依赖或宝塔对象。无配置调节项，无独立后端重启需求；正式发布仍使用唯一的 `python scripts/deploy-baota.py` 固定流程，并按统一 W09 发布门核对线上 SHA、提交归属、预检、备份及维护窗口。本批不据局部 P58 完成宣布全 73 页或 M07-03 通过。
