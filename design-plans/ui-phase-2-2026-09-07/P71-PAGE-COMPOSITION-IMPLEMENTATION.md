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

代码提交/build SHA、宝塔部署与线上只读核验待完成。全 73 页阶段目标继续；本地夹具与部署预检不证明真实测量、签认、生产权限/审计或正式 M07-03 容量验收。
