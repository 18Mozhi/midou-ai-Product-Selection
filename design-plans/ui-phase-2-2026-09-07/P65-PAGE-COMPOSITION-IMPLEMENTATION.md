# P65 发布证据中心 C 方向生产 Vue 接入

## 实施范围

将已审核的 C 方向落实到真实 `/platform-admin/releases`：蓝色页内阅读目录与白色证据区、生产/本地/远端完整 SHA、配置指纹折叠、当前构建匹配记录、历史观察策略与六列指标、迁移/回滚耗时及最近历史记录。旧七卡与进度环不再渲染；服务返回的 `stopped` 与 `rolled_back` 仅作中性说明，不推断自动停止或已审计稳定回滚。

共享表格在 P65 实例中使用原生 `label` 和就近“至少保留一列”帮助，其余消费者缺省行为不变。Shell 只在 P65 隐藏重复页标题。页内目录使用原生锚点。

组件职责：`ReleaseRolloutCenter.vue` 持有既有只读请求/快照状态并组合证据分区；`ResponsiveDataView.vue` 继续提供桌面表格、手机摘要与详情抽屉；`TableViewControls.vue` 仅接收可选列标签/帮助文案，不改变其他调用者默认外观或行为。

## 保持不变

没有改 API、服务端、OpenAPI、数据库、环境变量、依赖、权限或发布运行合同。GET、单飞、15 秒超时、快照保留、失败与快照追踪 ID 分离、401/403 清理、焦点交接、共享桌面表格和手机详情抽屉保持原行为。页面不添加发布、停止、回滚、迁移、签名写探针或旧双槽流程入口。

## 验证

- `node --test tests/unit/release-page-preview.test.mjs`：10/10。
- `node scripts/verify-release-page-preview.mjs`：桌面 33 项、390px 手机 69 项，共 102 项；12 次本地 GET，无出图运行。
- `node scripts/run-playwright-projects.mjs tests/e2e/m07-05-release-rollout.spec.ts --update-snapshots`：桌面 3/3、390px 手机 3/3；更新两张 approved C 截图基线。
- Web 类型检查在首次调整后通过；提交前仍需复跑格式、目标单测、完整 Web 构建、文档/静态与发布矩阵。

本地夹具/E2E 不证明生产权限、MySQL 审计、真实发布/回滚或正式 M07-03 签收。宝塔部署与线上资源/版本核验待提交推送后进行。
