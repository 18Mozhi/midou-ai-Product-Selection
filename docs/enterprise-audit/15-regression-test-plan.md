# 《回归测试计划》

## 1. 每批最小回归

1. 目标页面：所有入口逐项操作，正常/空/加载/失败/超时/无权/校验/重复/刷新/返回/四档分辨率。
2. 目标接口：正常、缺参、类型、边界、未登录、无权、跨租户、重复、并发、适用依赖失败。
3. 数据：前后行、版本、审计、幂等、outbox/队列、清理结果。
4. 联动：上游创建→Worker/爬虫→入库→目标页→导出/审计。
5. 控制台、网络、服务端日志和临时文件检查。

## 2. 提交前完整回归

建议顺序：

```text
npm run typecheck:web
npm run build
npm run test:contract
npm run test:integration
npm run test:python
npm run verify:docs
npm run verify:frontend-budget
npm run verify:e2e-realism
npm run verify:security-gate
npm run verify:crawler-chain
npm run test:e2e
```

`test:unit` 与 `verify:static-analysis` 必须运行；在 GAP-012 关闭前，只允许用户明确接受的既有失败，不允许新增失败。

## 3. 发布回归

- 宝塔对象身份、目录、版本、配置 fingerprint。
- `/health/live/ready/available/version/nodes`。
- 登录、租户选择、首页、趋势、机会、采集、供应链、任务、报表、审计。
- 平台 status/logs/topology/redis/mysql/files/crawler/capacity。
- 404 代理状态码、刷新和静态资源缓存。
- 回滚前后数据库/文件/队列一致性。

## 4. 证据与退出条件

每个用例记录 case_id、时间、环境、角色、请求/trace、截图/日志、预期/实际、数据前后、结论。任何无证据“通过”退回“未验证”；所有临时服务、浏览器和测试档案在结束后关闭或明确交接。
