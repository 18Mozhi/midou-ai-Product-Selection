# M00-01 仓库骨架范围

## 目标

建立后续模块可复用、可构建的四个逻辑边界：Vue Web、Node API、Node Worker、采集执行器，以及唯一共享 DTO 包。逻辑边界用于代码隔离和本地测试，不对应四个生产项目；生产由宝塔中的“ai选品”统一 Node 后端监督 API 与 Worker，由独立的“ai选品-python”项目消费 Worker 创建的登录型浏览器作业并调用固定 Node Playwright runner。

## 非目标

- 不实现登录、组织成员、业务页面、Provider、真实队列或生产调度。
- 不把 Redis 当作事件真相，不让浏览器读取 DB、Redis、AI 或密钥。
- 不建立宝塔面板外生产服务，不声称 S1/S2、多节点或 10,000 用户能力。

## 输入、输出与失败条件

- 输入：总纲、P00 计划、OpenAPI、Feature Map、`config/env.example`、图片包总览与 64 号系统监控概念图。
- 输出：`apps/*`、`packages/contracts`、迁移/回滚、模块测试和 M00-01 Runbook。
- 失败：任一运行边界不可构建；组织任务缺少 `organization_id`/`workspace_id` 仍可执行；健康响应缺少 request/trace 标识；页面没有加载、成功、错误或 390px 状态；迁移不兼容 MySQL 5.7。

## 数据与权限

`outbox_events` 是本模块唯一持久化对象。组织事件必须包含 `organization_id`；工作区事件按业务适用性包含 `workspace_id`。公开存活检查不读取组织数据，其他后台工作在进入执行器前调用共享范围断言。后续 M00-03、M00-04、M00-05 和 M00-06 将分别补齐真实迁移执行、Redis、API 安全中间件和审计持久化。
