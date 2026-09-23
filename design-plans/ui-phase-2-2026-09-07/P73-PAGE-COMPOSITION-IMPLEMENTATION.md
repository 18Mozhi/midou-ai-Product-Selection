# P73 页面不存在 C 方向实施与部署

## 结果

依据用户“剩下的全部通过，你无需暂停”的明确授权，将批71审核构图迁入公开 fallback `NotFoundPage.vue`。旧圆轨道、渐变和巨型 404 装饰已移除，改为蓝色恢复说明、当前路径工作区、安全恢复目标与公开兜底边界。桌面宽屏保持阅读区聚焦，手机改为完整单列与纵向可达链接。

保留未知 path 的 96 字符展示限制、`title` 完整路径、query/hash 不展示、导航记忆 `recentDestination.fullPath`、已注销/非法目标回退与 route 变化后 h1 焦点；不改变路由注册、导航存储、会话或权限合同。页内不发起业务 API 请求。点击恢复目标后会由目标页继续自身会话/权限流程。

## 验证

- `node --test tests/unit/not-found-page-preview.test.mjs`：2/2。
- `node --experimental-strip-types --test tests/m02-04/ui-state-contract.test.mjs`：5/5。
- `node scripts/verify-not-found-page-preview.mjs`：1440/390 × reduced/no-preference 共 44 项；核验标题对比、路径截断、query/hash 隐去、焦点与触控高度；零 API 请求、零页面异常、无横向溢出。
- `node scripts/run-playwright-projects.mjs tests/e2e/m02-04-not-found.spec.ts`：桌面 6/6、手机 6/6。
- Web 类型检查、生产构建、格式/文档/计划门与部署后线上核验将在闭环中补记。

## 边界

此变更重设计的是 SPA 的恢复页面，不改变服务器对未知路径返回的 HTTP 状态码；不宣称生产 HTTP 404、用户目标页会话/权限、真实浏览器 storage 异常或正式 M07-03 签收。生产构建应包含这个公开 fallback 组件和专属样式；不需重启服务定义或修改配置。
