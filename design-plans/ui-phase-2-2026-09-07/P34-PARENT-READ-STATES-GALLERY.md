# P34 父级读取状态 · 全部实图

这些是现有真实 Vue 页面在本地隔离 HTTP 响应下的截图，不是新 C 风格设计稿，也不是生产验收。保留旧父级视觉是取证边界，不代表认可或沿用旧风格。顶部刷新提案仍待审核。

截图包含当前页面与固定导航叠层；长图不是单屏构图，不用于评判最终手机整页布局。所有错误文案中的“隔离”及追踪值均来自测试夹具，不是建议上线的文案。

[验证说明](P34-PARENT-READ-STATES-REVIEW.md) · [机器证据](../../output/playwright/p34-parent-read-states/evidence.json)

| 状态 | 手机 390 | 桌面 1440 |
| --- | --- | --- |
| 首次加载 | [查看](../../output/playwright/p34-parent-read-states/initial-loading-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-loading-1440.png) |
| 读取成功 | [查看](../../output/playwright/p34-parent-read-states/ready-390.png) | [查看](../../output/playwright/p34-parent-read-states/ready-1440.png) |
| 后台刷新中 | [查看](../../output/playwright/p34-parent-read-states/background-refreshing-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-refreshing-1440.png) |
| 刷新成功 | [查看](../../output/playwright/p34-parent-read-states/refresh-success-390.png) | [查看](../../output/playwright/p34-parent-read-states/refresh-success-1440.png) |
| 首次 · 组织摘要 · 500 服务错误 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-server-error-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-server-error-1440.png) |
| 首次 · 组织摘要 · 503 暂不可用 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-service-blocked-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-service-blocked-1440.png) |
| 首次 · 组织摘要 · 409 客户端冲突分类 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-version-conflict-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-version-conflict-1440.png) |
| 首次 · 组织摘要 · 429 限流 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-rate-limited-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-rate-limited-1440.png) |
| 首次 · 组织摘要 · 401 会话失效 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-session-expired-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-session-expired-1440.png) |
| 首次 · 组织摘要 · 403 权限拒绝 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-permission-forbidden-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-permission-forbidden-1440.png) |
| 首次 · 组织摘要 · 网络中断 | [查看](../../output/playwright/p34-parent-read-states/initial-summary-network-unavailable-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-summary-network-unavailable-1440.png) |
| 首次 · 审批读取 · 500 服务错误 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-server-error-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-server-error-1440.png) |
| 首次 · 审批读取 · 503 暂不可用 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-service-blocked-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-service-blocked-1440.png) |
| 首次 · 审批读取 · 409 客户端冲突分类 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-version-conflict-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-version-conflict-1440.png) |
| 首次 · 审批读取 · 429 限流 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-rate-limited-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-rate-limited-1440.png) |
| 首次 · 审批读取 · 401 会话失效 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-session-expired-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-session-expired-1440.png) |
| 首次 · 审批读取 · 403 权限拒绝 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-permission-forbidden-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-permission-forbidden-1440.png) |
| 首次 · 审批读取 · 网络中断 | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-network-unavailable-390.png) | [查看](../../output/playwright/p34-parent-read-states/initial-approvals-network-unavailable-1440.png) |
| 后台刷新 · 组织摘要 · 500 服务错误 | [查看](../../output/playwright/p34-parent-read-states/background-summary-server-error-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-server-error-1440.png) |
| 后台刷新 · 组织摘要 · 503 暂不可用 | [查看](../../output/playwright/p34-parent-read-states/background-summary-service-blocked-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-service-blocked-1440.png) |
| 后台刷新 · 组织摘要 · 409 客户端冲突分类 | [查看](../../output/playwright/p34-parent-read-states/background-summary-version-conflict-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-version-conflict-1440.png) |
| 后台刷新 · 组织摘要 · 429 限流 | [查看](../../output/playwright/p34-parent-read-states/background-summary-rate-limited-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-rate-limited-1440.png) |
| 后台刷新 · 组织摘要 · 401 会话失效 | [查看](../../output/playwright/p34-parent-read-states/background-summary-session-expired-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-session-expired-1440.png) |
| 后台刷新 · 组织摘要 · 403 权限拒绝 | [查看](../../output/playwright/p34-parent-read-states/background-summary-permission-forbidden-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-permission-forbidden-1440.png) |
| 后台刷新 · 组织摘要 · 网络中断 | [查看](../../output/playwright/p34-parent-read-states/background-summary-network-unavailable-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-summary-network-unavailable-1440.png) |
| 后台刷新 · 审批读取 · 500 服务错误 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-server-error-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-server-error-1440.png) |
| 后台刷新 · 审批读取 · 503 暂不可用 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-service-blocked-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-service-blocked-1440.png) |
| 后台刷新 · 审批读取 · 409 客户端冲突分类 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-version-conflict-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-version-conflict-1440.png) |
| 后台刷新 · 审批读取 · 429 限流 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-rate-limited-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-rate-limited-1440.png) |
| 后台刷新 · 审批读取 · 401 会话失效 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-session-expired-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-session-expired-1440.png) |
| 后台刷新 · 审批读取 · 403 权限拒绝 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-permission-forbidden-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-permission-forbidden-1440.png) |
| 后台刷新 · 审批读取 · 网络中断 | [查看](../../output/playwright/p34-parent-read-states/background-approvals-network-unavailable-390.png) | [查看](../../output/playwright/p34-parent-read-states/background-approvals-network-unavailable-1440.png) |
