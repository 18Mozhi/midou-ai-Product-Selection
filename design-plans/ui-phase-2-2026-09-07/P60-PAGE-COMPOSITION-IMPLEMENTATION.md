# P60 开放平台 C 方向生产 Vue 接入

状态：P60 C 方向已接入生产页面组件和路由懒加载样式；用户已授权完成页面自动同意。局部设计通过不替代真实接口、权限、密钥或外发验收。

## 页面实现

- `OpenPlatformCenter.vue`：蓝色三工作区入口、组织范围、独立筛选台账、一个页面 H1；保留三个集合的摘要、读取、查询、分页和原有详情字段/行操作。
- `open-platform-c.css`：P60 作用域蓝白 C 样式；桌面保持白色记录台账，手机三工作区横向导航、字段单列和详情抽屉；菜单标题只在本路由隐藏，不改共享导航。
- `OpenCreateDialog.vue`：Client/Webhook 原字段移入原生填写窗，继续调用原 `createClient`/`createWebhook` 和共享 `ConfirmDialog`。组织 UUID、现有默认/验证、事件选择、提交按钮与原请求体边界保留；新增字段错误关联。
- `OpenActionReasonDialog.vue`：行操作先填写本次原因，再进入原共享影响确认窗；初值沿用已有原因默认值，继续按钮校验1–500字符。取消不发业务写入，最终 POST/PATCH 路径、版本字段、幂等键、审计原因字段与结果处理沿用原逻辑。
- 创建/行操作原因弹窗均使用原生 dialog、背景隔离、键盘 Tab/Escape、关闭/取消还焦；ConfirmDialog 仍负责最后确认与危险撤销勾选。

## 保留的产品合同

- `/api/v1/platform/open` 一次读取三集合；Client/Webhook/delivery 独立查询、状态、排序和分页不变。组织输入仍是读取范围与创建目标共用的 UUID；摘要仍只按实际 organization_id 统计。
- 原九类动作及路径、请求体、字段名、用户确认影响、幂等与审计合同不变；queued/202仍只表示进入队列，不表示外部回调成功。
- 密钥只在真实首次成功回执出现，复制失败/关闭后清除、幂等重放不返回密钥的现有处理不变；本批验证未生成、复制真实密钥或访问外部回调地址。
- 无 API/OpenAPI、数据库、Worker、权限、环境变量、依赖或运行参数变更；无需额外重启后端/Python服务。

## 本地验证

- P60 结构/编译/来源单测和详情回归：12项通过。
- `node scripts/verify-open-page-preview.mjs`：桌面1440与手机390各67项，共134项；无图片输出。
- `node scripts/verify-open-page-preview.mjs --details`：390/768/1440/320与两种动效模式，共8组1556项。
- `node scripts/verify-open-page-preview.mjs --read-states`：1440/390与两种动效模式，4组708项。
- `node scripts/verify-open-page-preview.mjs --action-results`：1440/390与两种动效模式，4组192项。
- `node scripts/verify-open-page-preview.mjs --action-keyboard`：1440/768/390/320与两种动效模式，8组744项。
- `tests/e2e/m06-05-open-platform.spec.ts`：desktop Chromium 与390px手机各3项通过；样例 API 全拦截，仅验证布局、创建/原因/确认取消、查询、详情与读取错误，无写入。
- `npm run typecheck:web`、`npm run build:web`：通过；P60 JS 31.20 kB、页面 CSS 独立懒加载。`npm run format:check`、`verify:docs`、`verify:plans`、`verify:runtime-docs`、`verify:static-analysis`、`verify:release-matrix`：通过。
- `npm run verify:frontend-budget`：未通过既有共享资源上限；本次实测入口 CSS 129451/122880 bytes、NavigationShell JS 52297/51200 bytes。P60 样式仍独立延迟加载，未修改共享 NavigationShell 源码；此预算失败不表示页面构建失败。
- 22工作区发布构建、宝塔部署、线上 build SHA 与页面资产核验将在本批发布后补记。正式 M07-03 生产证据门仍以当前提交对应证据文件为准。

## 未声明完成的边界

本地夹具不证明真实MySQL、RBAC、加密/凭证保管、幂等持久化、Worker投递、目标站点收件或生产数据。正式 M07-03 仍依赖 `.artifacts/verification/baota-production-evidence.json`；其缺失时不能宣称生产签收完成。全73页及剩余系统/平台页面继续。
