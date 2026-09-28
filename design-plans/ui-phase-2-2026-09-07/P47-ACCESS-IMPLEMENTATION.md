# P47 访问状态与恢复动作实施记录

日期：2026-09-28  
范围：`/platform-admin/providers/adapters`（P47 C 页面），仅页面状态呈现与已有读取/路由动作。

## 实施内容

- `401` / expired：以温和文案说明需要重新登录；主按钮“重新登录”进入现有 `/login`。不因点击再发 provider-adapters GET。
- `403` / forbidden 与 `429`、`503` / blocked：使用页面专属状态说明与追踪号展示。保留原错误分类、安全 GET 重试次数与请求超时；点击前把焦点移至持续存在的 P47 标题，避免状态面板被卸载后焦点落到 body。
- 普通 `500` / error：继续使用原有错误文案和读取重试行为。
- 新 CSS 只作用于 `.adapter-center--c` 的访问状态，不修改共享 `UiStatePanel`、其他页面、API/OpenAPI、权限规则、重试/限流算法或探针写入。
- 更新历史审核测试的边界：归档图片及其哈希、尺寸、场景检查仍作为不可变历史证据验证；当前生产 SFC 与交互改由源码合同测试和真实 Vue 浏览器用例验证，避免把当时未提交的历史工作树源指纹误当作当前源代码。

## 验证

- `node --test tests/unit/ui-phase2-provider-adapter-access.test.mjs`：4/4。
- `node scripts/run-playwright-projects.mjs tests/e2e/m03-03-provider-adapter.spec.ts`：桌面 16/16、390px 手机 16/16。包括401跳登录、403/429/503读取重试与焦点、500原行为、刷新快照、筛选/空态及目录交互。响应由测试拦截，未触发真实身份、权限或外部探针。
- 完整 Web 构建、代码格式、文档/路由、静态分析、发布归属和宝塔部署结果在本记录的最终部署更新中补充。

## 边界

这不是身份认证、真实 RBAC、真实限流/依赖故障、外部来源健康或 M07-03 生产验收。登录后 return-to 行为保持路由现状；没有添加新策略。全站 73 页交付目标仍在进行。

## 提交与部署

- 代码提交：`ca9a939f2af1695dd6dff2f2e3e76d41cc39a4fc`（`完成P47访问状态交互闭环`），已推送至 `origin/main`。
- `python scripts/deploy-baota.py` 成功：22 个工作区构建通过，M07-03 preflight 通过，固定宝塔站点/Node/Python 对象部署完成；临时部署包由脚本清理。没有新增迁移或服务配置。
- 线上 `/api/v1/health/ready` 为 `ready`，MySQL/Redis 为 `available`；`/api/v1/health/available` 为 `available`；`/api/v1/health/version` build SHA 与提交一致。
- `/platform-admin/providers/adapters` 返回 HTTP 200。`ProviderAdapterCenter-BDJR-94k.js` 与 `ProviderAdapterCenter-DLTEsj8P.css` 均 HTTP 200，线上字节 SHA-256 与本地生产构建一致。
- M07-03 preflight 和静态/UI fixture smoke 不等于正式 M07-03业务验收，亦不证明真实 RBAC、会话过期路径中的外部身份提供方、限流策略、来源权限或健康探针。
