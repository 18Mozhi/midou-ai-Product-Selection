# M00-05 API 基座范围

## 目标与边界

API 基座统一安全 request_id/trace_id、成功/错误信封、Fastify JSON Schema 错误映射、可注入认证 Guard、Idempotency-Key 校验和同步 readiness。`/health/live` 永不访问依赖；`/health/ready` 只检查必需配置、MySQL 与 Redis，不因 Worker、Crawler 或第三方来源暂时不可用而误判 API 副本。

认证占位不是模拟登录：只有受信 `TokenVerifier` 返回 subject、organization、workspace（适用时）和 scopes 后才放行；缺少 Token、组织范围或 capability 分别返回稳定 401/403。写接口的幂等记录只保存哈希，并按组织/工作区 scope hash、路由、方法与幂等键共同唯一。

## 数据、状态与非目标

迁移 `0005_m00_05_api_idempotency` 兼容 MySQL 5.7/utf8mb4，保留组织、工作区、request_id、trace_id、状态、过期时间和回滚。M00-05 不实现真实会话签发、用户/角色库、业务 API、Worker 健康或异步消费；它们由下游模块接入。

页面依据 `images-html/01_72_page_concepts/64_系统监控.jpg` 实现 checking、ready、unavailable 和重试状态，覆盖桌面与 390px。页面只显示依赖类别与请求标识，不显示连接、凭证、SQL、库表、键或其他组织数据。
