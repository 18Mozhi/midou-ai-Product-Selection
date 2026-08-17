# M00-04 Redis 基座范围

## 目标与边界

Redis 只承担缓存、队列/租约、限流和 SSE 协调，不是业务事实源或事件唯一存储。所有来自组织业务的键必须由 `buildScopedRedisKey` 生成，强制包含 `organization_id`；工作区数据同时包含 `workspace_id`。模块不提供任意原始键 API，也不允许浏览器读取地址、密码、实际键或队列内容。

键版本固定为 `scoutops:v1`。默认/最大 TTL 分别为：缓存 300/3600 秒、队列 86400/604800 秒、限流 60/3600 秒、SSE 86400/86400 秒。超出范围拒绝写入；MySQL 迁移 `0004_m00_04_redis_namespace_catalog` 记录平台全局的命名版本和 TTL 合同，回滚只删除该目录表，不扫描或删除来源不明的 Redis 键。

## 服务、状态与权限

`ScopedRedisStore` 提供有限 JSON 读写、删除、限流计数和脱敏健康结果。它不接受调用方拼接的完整键；异常结果只包含 `available/unavailable`、延迟、时间、request_id 与 trace_id。M00-04 的前端依据图片 `images-html/01_72_page_concepts/64_系统监控.jpg` 实现基础状态预览，明确标记“非实时监控”；真实 `/health/ready`、认证中间件和运维授权由依赖 MySQL 的 M00-05 接入。

## 非目标与失败条件

- 不在本模块创建业务队列、消费规则或重试业务语义。
- 不创建宝塔面板外生产服务，不把本机 Redis 进程当作生产部署证据。
- Redis 不可连接时真实验收返回 blocked；跨组织键、永久键、密钥回显均为失败。
- S1/S2 Sentinel、多节点和容量承诺不属于当前软件交付范围，任何阶段完成都不得据此宣称具备。
