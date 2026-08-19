# ai选品

企业级跨境电商选品与运营平台。产品范围、边界和验收标准见 [总计划](new-product-enterprise-blueprint.md)。

## 当前状态

这是面向选品团队的完整业务系统，覆盖账号与组织权限、来源采集、趋势机会、竞品、供应链与利润、任务审批、通知报表以及平台运维。项目已按“单一宝塔后端、真实业务首页、稳定启动、P00–P08 全功能”标准完成软件验收；容量、磁盘、PVE、多节点和其他服务器设备不属于软件完成条件。

## 已锁定运行基线

- Vue 3 + TypeScript；生产只创建一个名为 `ai选品` 的宝塔 Node 后端，内部统一监督 API 与 Worker。
- MySQL 5.7、Redis、Playwright；生产服务均由宝塔面板管理。
- 生产与当前备份恢复均使用广东惠州现有单机；同机加密副本与逻辑隔离恢复不保护整机、磁盘或机房故障。
- AI：OpenAI 兼容服务，已验证模型查询端点为 `/v1/models`，模型 `Qwen3.5-9B-AWQ-4bit`。

## 常用命令

```powershell
npm install
npm run build
npm run start:backend
npm run verify:all
npm run verify:production-product
npm run locate:flow -- "trends"
npm run verify:docs
npm run test:e2e
```

生产根目录固定为 `/www/wwwroot/ai选品`：前端、Node 后端、Python 采集器分别部署到 `frontend`、`backend`、`python`，受限配置、运行数据和本机备份分别保存在 `config`、`runtime`、`backups`。Node 启动命令为 `node --env-file=/www/wwwroot/ai选品/config/product_scout.env --env-file=/www/wwwroot/ai选品/config/release.env apps/backend/dist/server.js`；不得创建 `current`、`releases`、独立 API、Worker 或 Canary 常驻项目。完整部署与回滚见 `infra/baota/README.md`。

管理员与普通成员的实际入口、业务页面和截图操作说明见 [ai选品上线使用指南](docs/user-guide-ai-selection.md)。生产浏览器验收账号通过环境变量临时注入，验收完成后必须删除账号、会话、组织、工作区及其关联数据。

首次本地启动以 `config/env.example` 与 `infra/docker-compose.dev.yml` 为准。真实凭证只能写入本地 `.env` 或宝塔受限配置，禁止提交。
