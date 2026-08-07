# ScoutOps / MidouAI 实时选品运营平台

企业级跨境电商选品与运营平台。产品范围、边界和验收标准见 [总计划](new-product-enterprise-blueprint.md)。

## 当前状态

仓库正在执行 P00 基础框架。M00-01 仓库骨架、M00-07 验收框架与 M00-02 配置边界已通过模块自动验收；当前进入 M00-03 MySQL 基座，它不是业务功能完成或生产发布声明。实现前先阅读 `AGENTS.md`、`docs/feature-map.json` 和对应阶段文档。

## 已锁定运行基线

- Vue 3 + TypeScript；Node.js API/Worker；Python Crawler。
- MySQL 5.7、Redis、Playwright；生产服务均由宝塔面板管理。
- 生产主机房：广东惠州；备份恢复目标：广东深圳。
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
