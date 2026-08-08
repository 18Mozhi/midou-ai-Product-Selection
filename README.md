# ScoutOps / MidouAI 实时选品运营平台

企业级跨境电商选品与运营平台。产品范围、边界和验收标准见 [总计划](new-product-enterprise-blueprint.md)。

## 当前状态

P00 基础框架已通过 M00-01 至 M00-08 模块门禁和 P00 阶段门禁，阶段报告 run/trace ID 为 `eaa5665f-4c7c-4108-8168-a336763eff7c`。仓库现按依赖进入 P01 的 M01-01“本地账号与会话”；P01 其余模块尚未完成。以上不是业务功能全部完成或生产发布声明。

## 已锁定运行基线

- Vue 3 + TypeScript；Node.js API/Worker；Python Crawler。
- MySQL 5.7、Redis、Playwright；生产服务均由宝塔面板管理。
- 生产与当前备份恢复均使用广东惠州现有单机；同机加密副本与逻辑隔离恢复不保护整机、磁盘或机房故障。
- AI：OpenAI 兼容服务，已验证模型查询端点为 `/v1/models`，模型 `Qwen3.5-9B-AWQ-4bit`。

## 常用命令

```powershell
npm install
npm run verify:module -- M00-01
npm run verify:phase -- P00
npm run verify:all
npm run locate:flow -- "trends"
npm run verify:docs
npm run test:e2e
```

模块执行证据登记在 `verification/modules/`；M00-07 提供的模块、阶段和全量执行器会把脱敏报告写入 `.artifacts/verification`，缺少前置或注册表时明确 blocked 并返回非零。开发启动及回滚见 `docs/runbooks/`。

首次本地启动以 `config/env.example` 与 `infra/docker-compose.dev.yml` 为准。真实凭证只能写入本地 `.env` 或宝塔受限配置，禁止提交。
