# P56 当前 Vue 证据

由 `tests/e2e/m06-02-platform-dashboard.spec.ts` 通过 `captureUiPhase2Evidence` 生成。文件名中的1440/390为视口宽度，状态包括：

- `content-default`：默认内容审核工作台；
- `content-records`：手机完整记录区域；
- `content-filtered-empty`：筛选无结果且保留同查询统计；
- `content-forbidden`：首次权限拒绝；
- `content-review-stale`：标记过期审核窗；
- `content-success-refresh-failed`：写入成功、列表刷新失败的双结果。

每张PNG对应一份同名JSON，记录真实Vue路由、视口、断言、源码哈希与水平溢出检查。数据为本地夹具，不代表真实MySQL、RBAC、审计写入或生产验收。

复验：

```powershell
node scripts/run-playwright-projects.mjs tests/e2e/m06-02-platform-dashboard.spec.ts --grep="UI2-PN56"
```

只有设置项目既有证据捕获环境后才会更新本目录；普通复验不应改图。用户审核状态：pending。
