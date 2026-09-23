# P61 系统状态 C 方向生产 Vue 接入

## 实施范围

将已审核的 STATUS-C 构图落实到真实 `/platform-admin/status` 页面：P61 主标题和运行观测范围、蓝色四分区目录、白色单一内容面、状态事实与技术编号。四个目录项分别呈现需核查关系、六项依赖、当前浏览器标签页会话指标、管理接口返回的业务汇总。手机使用两列目录按钮与单列白色内容面；不缩小桌面布局。

`PlatformManagementCenter` 继续拥有原 GET、状态、摘要及真实内容；新增 `PlatformStatusWorkspace` 只负责本地面板选择，属性为 warningCount/observedAt，四个具名插槽承载既有事实展示。选择目录不发请求、不改 URL、不写浏览器存储。P61 路由隐藏外层重复标题；此样式与页面标记只作用于 P61。

## 保持不变

- `/platform/management?domain=status`、`platform:operate` 权限、六项真实拓扑定义与现有七个导航目标不变。
- 状态 GET 单飞、15 秒等待、离页停止、读取失败保留旧成功数据、成功重试清除读取反馈等既有逻辑不变。
- 浏览器会话重连率仍只来自当前标签页指标；关联服务仅提示核查，不表述为已发生故障。
- 未增加启停/修复/重放动作、业务弹窗、API/OpenAPI、数据库/环境配置/依赖或服务。

## 验证

- `node --test tests/unit/platform-status-page-preview.test.mjs tests/unit/platform-status-read-feedback.test.mjs`：14/14。
- `node scripts/verify-status-page-preview.mjs`：1440 与 390 两组各 49 项，共 98 项；0 张截图输出，201 个来源指纹。
- `node scripts/run-playwright-projects.mjs tests/e2e/m06-02-platform-dashboard.spec.ts --grep "system status aggregates real operations observations and management links"`：桌面与 mobile-390 各 1/1。
- `npm run typecheck:web` 通过。发布前再执行格式、文档、静态分析与 22 workspace 构建。

本地浏览器验证使用测试夹具并拦截 API；其结果不证明生产服务健康、真实 SQL/RBAC 或正式 M07-03。

## 部署

已提交并推送：`8c00661010d2eb4a4b21f6b2efff8119d83f1bf0`；按固定 `python scripts/deploy-baota.py` 部署至宝塔既定网站、Node 与 Python 项目。线上 `/api/v1/health/live`、`ready`、`version` 和 `/platform-admin/status` 均 HTTP 200，版本接口返回相同 build SHA；页面主 JS/CSS、状态视图与工作区懒加载 JS 均 HTTP 200。部署器报告上传临时产物已删除。部署脚本中的格式、发布矩阵、发布归属、22 工作区构建及宝塔预检均通过。

全量单测 `npm run test:unit` 为 2,277 项中 1,902 通过、375 失败；已观察到的失败包括既有 ResponsiveDataView、组织管理、供应商等源码指纹或视觉基线不匹配，未将其归因于 P61，也未修改无关基线。P61 专项 21/21、桌面与 390px 定向 E2E 各 1/1 通过。正式 M07-03 仍需受限生产证据文件，静态资源可达性、健康端点及本地夹具不能代替真实 RBAC、SQL 或正式验收。
