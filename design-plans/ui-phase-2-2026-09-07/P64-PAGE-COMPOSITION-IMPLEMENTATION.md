# P64 备份与恢复 C 方向生产 Vue 接入

日期：2026-09-23<br>
范围：`/platform-admin/operations` 的只读页面构成与样式；不扩展备份、还原、审计或权限行为。

## 实施

- 已批准的 C 方向应用于生产 `BackupRecoveryCenter.vue`：顶部保留读取按钮，蓝色“仅限当前主机”目录提供三个原生页内锚点；白色内容按事实结论、RPO/RTO目标与实际、恢复证据、资产、阻断项排列。
- 资产表保留七列、原行字段和手机摘要/详情插槽。`TableViewControls` 增加可选 `columnLabels` 展示模式，P64单页开启，其他消费者保持原span表现。
- 保留当前API、读取/超时/单飞/快照与失败编号所有权、焦点交接和受控恢复边界；未新增服务端动作或真实数据声明。没有证据时仅显示未记录/未核验，不宣称加密强度。导航壳只在此路由隐藏重复页标题。
- 审核宿主只增加 `backup-center--review` 标记；审核页面、列控件、目录和样式均挂载真实生产 Vue，不再在审核转换中改写页面结构。

## 验证

部署前通过：P64定向单测48/48；C页面实际Vue桌面1440px/手机390px共101项浏览器检查；表格控件332、九态478、读取反馈256、焦点80、追踪132项浏览器检查；M07-04 E2E桌面5/5、手机5/5；`npm run typecheck:web`、`npm run build:web`、格式、文档/73路由制品、静态分析、release矩阵和宝塔部署预检通过。

`npm run verify:frontend-budget`仍失败：`index-3FlW1W8G.css` 129451/122880 bytes，`NavigationShell-Ch5luoU4.js` 53609/51200 bytes。它是独立的全局资产预算告警，不是P64定向测试失败；已保留实际值供后续全局预算工作处理，没有借本次任务重构无关全局样式/导航。离线fixture、浏览器拦截请求或HTTP资源200不能证明主机权限、审计写入、数据库完整性或真实隔离恢复演练。

## 发布记录

实施提交 `72ba3c6d84c7a9f9f96dcea0dcb528ea4a9d1af5` 已推送至 `origin/main`，并通过 `python scripts/deploy-baota.py` 发布。部署器执行22工作区构建、既有迁移集合检查/执行及固定宝塔发布流程；本任务没有新增迁移。宝塔受控停启Node并重载Nginx，Python crawler代码未改。上传临时包已删除。

线上 `GET /api/v1/health/live`、`ready`、`version`、`/platform-admin/operations` 均返回HTTP 200；version的`build_sha`为 `72ba3c6d84c7a9f9f96dcea0dcb528ea4a9d1af5`。本页资源 `/assets/BackupRecoveryCenter-BH-tvTVe.js`（12363 bytes）和 `/assets/BackupRecoveryCenter-Da8SN1ub.css`（16145 bytes）均返回HTTP 200。线上验证只证明发布版本与静态入口/资源可达，不等于受限账号权限、生产备份数据、审计或隔离恢复演练验收。

全局 `verify:frontend-budget` 本次仍报告主CSS和 `NavigationShell` JS分别超过预算；它们不阻断本次定向页面构建/发布，细节已记录在“验证”。
