# P44 可授权账号 C 方向生产实施

## 已实施

- 将批准的桌面 C 结构接入真实 `/platform-admin/admins`：左侧蓝色全局汇总与对象导航，右侧可授权账号目录、状态筛选及只读角色比较；1200px 以下汇总导航上移，手机单列。
- 补充筛选字段标签和就近帮助，保留全局管理员数与筛选结果的区别、搜索 URL 合同和已有空/错状态。
- 账号、角色与权限比较继续使用现有 Vue 组件/API/数据；角色比较选择维持页内只读状态，不进入 URL。不新增 API、字段、权限规则或依赖。
- 预览适配器识别当前已上线的真实 C 组件后直接验证，不再把归档时期的结构变换套用到生产模板；既有审核图与来源清单未修改。

## 验证

- `m06-01-platform-accounts.spec.ts`：桌面 Chromium 48/48、390px mobile 48/48。P44新增用例核验桌面/1200px/390px栏位顺序、横向溢出、标签关联、搜索查询、全局汇总稳定及比较状态不进入URL；写入均由本地夹具拦截。
- 相关 P43/P44 页面预览和目录回归测试 14/14、Web 类型、格式、文档/路由图、静态分析、M07-01发布矩阵及 Web 生产构建通过。
- `verify:frontend-budget` 仍失败：入口 CSS `index-3FlW1W8G.css` 为 129451/122880 bytes，与既有 P43 记录的超限一致；未修改预算或绕过该门。
- 宝塔部署成功，build SHA 为 `2b99cf75b55cf257b6a6ffd5a511664fd2511ff0`；部署器确认网站、Node、Python运行包更新完成，上传临时包已删除。
- 线上 `/api/v1/health/live`、`ready`、`available` 及 `/platform-admin/admins` 深链均 HTTP 200；health/live 返回相同 build SHA。入口 JS/CSS、`PlatformAccountCenter`、`PlatformAdminRecords`、`PlatformRoleComparison` 引用资源均 HTTP 200；管理员组件 JS 与 CSS 含预期目录标题及 `.account-page-layout--admins` 样式。
- 线上入口 CSS 仍为 129451 bytes，超过现有 122880 bytes 门限；门禁已记录为未通过，不扩大 CSS 预算或声称全局门禁通过。

## 未覆盖

不改 API/OpenAPI、数据库、环境变量、RBAC、数据处理和服务拓扑。深链 HTTP 200 只证明静态入口可达，不证明账号授权；夹具不能证明生产账号权限、真实写入或正式 M07-03 验收；全 73 页交付继续推进。
