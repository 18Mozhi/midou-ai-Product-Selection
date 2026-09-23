# P53 网页采集运行中心 · C 方向部署闭环

日期：2026-09-24

## 当前状态

P53 C 方向样式已接入实际 `CollectionRuntimeCenter`（代码提交 `240740910`），读取、过期租约回收结果归属和焦点保护已在真实 Vue 实现（`P53-INTERACTION-OWNERSHIP-IMPLEMENTATION.md`）。用户于 2026-09-24 授权剩余页面/状态视觉自动通过，因此本页 C 视觉审核通过。实现包含于整站线上构建 `06ae38230de2b5b7a35b89727aa22432387030d5`；本次只补验证与记录，没有再次部署或改生产业务代码。

## 合同与范围

- 保留 `GET /platform/crawler-runtime` 的筛选、分页与统计口径，以及 `POST /platform/crawler-runtime/recover-expired` 的原始空对象 body、Origin、幂等及权限边界。
- 档案启用、登录期限、租约占用、运行状态各自呈现；页面不新增浏览器启动、凭证管理或下载功能。
- 仅说明回收接口的过期租约结果，不宣称 OS 浏览器进程已停止或业务采集已恢复。
- 未改 API/OpenAPI、数据库、权限、环境配置或依赖；未执行真实租约回收、Python 采集或外部站点登录。

## 验证与线上证据

- `node scripts/run-playwright-projects.mjs tests/e2e/m03-04-playwright-crawler.spec.ts`：桌面 8/8、390px 手机 8/8。
- `node --test tests/unit/browser-runtime-page-preview.test.mjs`：1/1；页面 `verify:docs`、格式和差异门另见本次提交记录。
- 线上 `/api/v1/health/ready` 与 `/platform-admin/collection/browser-runtime` 均 HTTP 200；版本接口 `build_sha` 为 `06ae38230de2b5b7a35b89727aa22432387030d5`。
- `CollectionRuntimeCenter-CUw-N79a.js` SHA-256：`fbfe46404f9101629525bae89029d7b22ae34ee5a00154b67f5026e5fcfa1ff8`；`CollectionRuntimeCenter-DHXNfvny.css` SHA-256：`0f935cacdbb3f35e399eff93e53b0a900666aec238256a0a716fdbf216bef423`。两者线上 HTTP 200，哈希均与本地构建一致。

## 尚未证明

上述浏览器夹具与静态资源核验不证明真实会话/RBAC、MySQL 租约、Origin/幂等审计、Python/OS 浏览器状态、真实回收结果或正式 M07-03 签收；这些仍按各自生产门禁验证。本页没有运行时配置或服务重启要求。
