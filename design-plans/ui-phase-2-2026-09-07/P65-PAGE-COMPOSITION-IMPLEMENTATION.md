# P65 发布证据中心 C 方向生产 Vue 接入

## 实施范围

将已审核的 C 方向落实到真实 `/platform-admin/releases`：蓝色页内阅读目录与白色证据区、生产/本地/远端完整 SHA、配置指纹折叠、当前构建匹配记录、历史观察策略与六列指标、迁移/回滚耗时及最近历史记录。旧七卡与进度环不再渲染；服务返回的 `stopped` 与 `rolled_back` 仅作中性说明，不推断自动停止或已审计稳定回滚。

共享表格在 P65 实例中使用原生 `label` 和就近“至少保留一列”帮助，其余消费者缺省行为不变。Shell 只在 P65 隐藏重复页标题。页内目录使用原生锚点。

组件职责：`ReleaseRolloutCenter.vue` 持有既有只读请求/快照状态并组合证据分区；`ResponsiveDataView.vue` 继续提供桌面表格、手机摘要与详情抽屉；`TableViewControls.vue` 仅接收可选列标签/帮助文案，不改变其他调用者默认外观或行为。

## 保持不变

没有改 API、服务端、OpenAPI、数据库、环境变量、依赖、权限或发布运行合同。GET、单飞、15 秒超时、快照保留、失败与快照追踪 ID 分离、401/403 清理、焦点交接、共享桌面表格和手机详情抽屉保持原行为。页面不添加发布、停止、回滚、迁移、签名写探针或旧双槽流程入口。

## 验证

- `node --test tests/unit/release-page-preview.test.mjs tests/m07-05/release-rollout.test.mjs`：27/27。
- `node scripts/verify-release-page-preview.mjs`：桌面 33 项、390px 手机 69 项，共 102 项；12 次本地 GET，无出图运行。
- `node scripts/run-playwright-projects.mjs tests/e2e/m07-05-release-rollout.spec.ts --update-snapshots`：桌面 3/3、390px 手机 3/3；更新四张桌面/手机批准 C 截图基线。
- Web 类型检查、生产 Web 构建、格式、文档、运行文档一致性、静态分析、发布矩阵全部通过；22 工作区部署构建通过。

## 部署结果

基础 C 内容提交 `6fd36ca62d214c5c9b00a5dfe22313dc08119582` 和随后完成的批准蓝白外壳提交 `0f982d4f49588d83698a3d2bac845c95c39a8b5c` 均已推送；最终运行版本由 `python scripts/deploy-baota.py` 部署，build SHA 为 `0f982d4f49588d83698a3d2bac845c95c39a8b5c`。部署器报告成功且临时上传包已删除；宝塔固定 Node 项目受控更新/启动，Python 项目配置更新，Nginx 配置检查与 reload 完成。独立公网核验的 live/ready/available/version、`/platform-admin/releases`、P65 专属 JS/CSS 资源均 HTTP 200，`/api/v1/health/version` 返回该部署 SHA；专属 JS 含 C 布局标记和“运行身份与部署捕获”文案，专属 CSS 含 C 页面作用域。新增 E2E 断言覆盖桌面网格与 240px 侧栏、手机隐藏侧栏/折叠上下文/固定快捷栏。

本地夹具/E2E/静态资源可达不证明生产权限、MySQL 审计、真实发布/回滚或正式 M07-03 签收；没有触发写探针、历史双槽流程、数据库迁移或发布操作。P65 已部署不等于 M07-05 正式生产签收，也不等于全73页阶段完成。
