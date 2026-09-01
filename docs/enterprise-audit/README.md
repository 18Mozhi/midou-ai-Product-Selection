# ScoutOps 企业级全量盘点交付索引

审计基线：2026-09-01，代码基线 `edc2bb1`。本目录只汇总真实仓库、真实运行验收、逐页截图、OpenAPI、迁移、测试和阻塞事实，不包含密码、Cookie、Token、密钥或完整隐私数据。

## 交付物

1. [《系统资产清单》](./01-system-asset-inventory.md)
2. [《页面与路由清单》](./02-page-route-inventory.md)
3. [《逐页面 UI 与功能审计报告》](./03-page-ui-function-audit.md)
4. [《前端功能测试用例与结果》](./04-frontend-test-results.md)
5. [《接口清单及逐接口测试报告》](./05-api-test-report.md)
6. [《爬虫完整测试报告》](./06-crawler-lifecycle-report.md)
7. [《角色权限矩阵》](./07-role-permission-matrix.md)
8. [《页面—功能—接口—数据库关联矩阵》](./08-page-function-api-db-matrix.md)
9. [《端到端联合流程测试报告》](./09-e2e-workflow-report.md)
10. [《性能与容量风险报告》](./10-performance-capacity-risks.md)
11. [《安全与数据隔离风险报告》](./11-security-isolation-risks.md)
12. [《企业级能力缺口清单》](./12-enterprise-gaps.md)
13. [《完整优化升级方案》](./13-optimization-plan.md)
14. [《分阶段实施计划》](./14-phased-implementation-plan.md)
15. [《回归测试计划》](./15-regression-test-plan.md)
16. [《无法测试项与阻塞项清单》](./16-blocked-items.md)

## 结论词典

- `通过`：存在可复验的命令、页面截图、日志、接口响应或数据库事实证据。
- `部分通过`：已验证范围明确，剩余范围列为阻塞或未验证。
- `阻塞`：缺少真实第三方账号、验证码、生产权限、生产部署或不可安全制造的故障。
- `未验证`：当前材料不足；即使代码或合同存在，也不能写成通过。
- `不适用`：该页面或功能从设计上不依赖对应层，不把“不适用”冒充通过。

## 证据入口

- 路由真相源：`config/route-catalog.json`、`apps/web/src/route-catalog.generated.json`
- 页面实现：`apps/web/src/App.vue`、`apps/web/src/components/NavigationShell.vue`
- 接口合同：`docs/openapi.yaml`
- 数据库：`database/migrations/*.up.sql`
- Worker/队列：`apps/worker/src/worker-queue-registry.ts`
- 爬虫：`apps/crawler/scoutops_crawler/`
- 自动化验证：`tests/`、`scripts/verify-*.mjs`
- 逐页截图：`output/playwright/`
- 已形成的详细页面记录：`docs/audits/`
