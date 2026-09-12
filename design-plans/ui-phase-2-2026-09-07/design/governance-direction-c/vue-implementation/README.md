# P55 当前 Vue 证据

由 `tests/e2e/m06-02-platform-dashboard.spec.ts` 通过 `captureUiPhase2Evidence` 生成。文件名中的1440/390为视口宽度，六个状态分别为：

- `governance-directory`：五分类目录；
- `governance-default`：默认评分规则工作区；
- `governance-automation-detail`：自动化完整详情；
- `governance-filtered-empty`：筛选无结果；
- `governance-forbidden`：首次权限拒绝；
- `governance-retained-failed`：读取失败保留成功快照。

每张PNG对应一份同名JSON，记录真实Vue路由、视口、断言、源码哈希与水平溢出检查。数据为本地夹具，不代表真实MySQL、RBAC、目标工作台导航或生产验收。

复验：

```powershell
npm run test:e2e -- tests/e2e/m06-02-platform-dashboard.spec.ts --project=desktop-chromium --project=mobile-chromium
```

只有设置项目既有证据捕获环境后才会更新本目录；普通复验不应改图。用户审核状态：pending。
