# P71 容量边界 C 方向生产 Vue 实施

## 范围

已将自动通过的 CAPACITY-C-r1 接入真实 `/platform-admin/capacity`：蓝色单机运行边界与白色容量证据工作区，拆分当前结论、通过档位/停止事实、性能参考、归档恢复签认、资源绝对值与逐项告警处置；手机端单列呈现。`CapacityBoundaryCenter` 继续独占数据读取、状态/错误、确认弹窗与写入；展示区抽为 typed-props `CapacityBoundaryEvidence`。

保留原 GET/15 秒单飞、失败快照与追踪、权限处理、操作结果播报、确认词及原签认 POST/body/幂等键。未把签认改成压测/恢复操作；没有改变 API、容量规则、阈值、审计、权限、数据库、配置或依赖。资源以原始绝对值呈现，不画有伪容量比例暗示的进度条。

## 本地验证

- `node --test tests/unit/capacity-page-preview.test.mjs`：3/3。
- `node --test tests/m08-06/capacity-boundary-closure.test.mjs tests/m08-06/software-completion-contract.test.mjs`：16/16。
- `node scripts/verify-capacity-page-preview.mjs`：1440/390px × 两种动效共 144 项、52 次本地 GET，0 次写请求、无截图。
- `node scripts/run-playwright-projects.mjs tests/e2e/m08-06-capacity-boundary.spec.ts`：桌面 5/5、390px 手机 5/5。
- `npm run typecheck:web` 通过。

## 提交与部署

代码提交/build SHA：`defcbe4f11274d83d7ec4700023f06b021226b93`，已推送 `main`。

- `python scripts/deploy-baota.py`：成功；22 个工作区构建通过，M07-03 六对象预检通过，上传临时包已删除。
- 线上 `/api/v1/health/ready=ready`、`/api/v1/health/available=available`，`/api/v1/health/version.build_sha` 与提交一致。
- `/platform-admin/capacity` 返回 HTTP 200；专属页面 JS（7,449 bytes）、CSS（17,777 bytes）及证据子组件 JS（4,950 bytes）均 HTTP 200。
- 部署由固定宝塔脚本完成；无需用户手工重启。本次未调用受保护容量读/写 API，未触发真实测量、签认或恢复。

全 73 页阶段目标继续；部署预检不证明真实测量、签认、生产权限/审计或正式 M07-03 容量验收。
