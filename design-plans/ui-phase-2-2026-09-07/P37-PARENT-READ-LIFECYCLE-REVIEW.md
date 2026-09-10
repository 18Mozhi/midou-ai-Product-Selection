# P37 实际父子读取与生命周期核对

2026-09-11后续：旧分页追加已作[局部响应归属修复](P37-PAGINATION-OWNERSHIP-REVIEW.md)，当前父子读取请运行verify-ui-phase2-org-audit-read-r2.mjs（192检查/40图）。本页四问题及原28图不改，旧验证器固定回放修复前父子源，不再代表当前分页或复制行为。URL/缓存返回两问题仍待。

后续状态：P37-LATE-COPY已在[复制归属局部修复](P37-COPY-OWNERSHIP-REVIEW.md)处理。本文与28图保留为修复前历史证据；原验证命令现在显式回放固定基线，不验证当前复制行为，当前实现用新copy验证器。其余问题未因此通过，以下“当前/未修复”均指本批采集时。

状态：当前实现问题证据，不是C设计稿，不是生产或整页验收。真实 OrganizationAdminCenter、OrganizationAuditPanel 和 api-client 在隔离 Router/KeepAlive 宿主中运行；没有替换业务组件或修改生产代码。

[28张实际观察图](../../output/playwright/p37-parent-read-vue/index.html) · [精确检查/请求/问题记录](../../output/playwright/p37-parent-read-vue/evidence.json)

## 已验证的运行行为

手机390、桌面1440共116项检查；先手机58项最小检查，再双端捕获。审计初始只请求当前组织audit-events一次，不请求治理摘要；所有请求均为带request/trace ID的GET。首次500/403/401/409/429/503分别进入真实父状态，原安全重试次数1/1/1/1/3/3保持，恢复后显示50条测试记录。返回空items的对象在父层仍是ready，由子组件显示空结果，不能伪称父empty状态。

后台500保留50条，401/403隐藏子组件；仅证明DOM行为，不证明数据内存清理或真实授权。真实筛选trim后发送action、重置回limit50、已加载失败搜索不发请求。数据库时间筛选、生产重试、守卫、跨组织与原生剪贴板不在此证据范围。

## 双端复现的四类问题

| 标识 | 具体证据 | 下一修复范围 |
| --- | --- | --- |
| P37-HISTORY-01 | 同实例URL含org_audit_query=失败和新的action，输入仍为空，新增请求0 | 前后历史/同实例查询恢复，区分草稿与已应用服务器条件 |
| P37-HISTORY-02 | KeepAlive离页再返回带“成功”搜索的URL，输入仍为空 | 激活时恢复与离页状态归属，不擅自决定缓存刷新政策 |
| P37-LATE-PAGE | 旧cursor响应等待中，刷新先返回10条；旧响应再把5条追加成15条 | loadAuditPage与load共用正确的读取归属/失效机制 |
| P37-LATE-COPY | 实际复制request-001，切到request-002后旧完成仍显示“已复制” | 复制反馈归属到发起记录及组件生命周期 |

URL不出现在元素截图中，具体URL/输入差异保存在evidence.json。复制替身仅暂存测试编号和完成回调，没有访问系统剪贴板。分页案例是两个真实父handler并发消费合成响应，不是直接篡改组件内部data。

四类问题均未修复，`acceptanceComplete=false`。检查通过表示复现稳定和证据一致，不表示上述问题通过验收。旧104+38+172张C图、既有批准状态与P36工作不改。

收尾：无参数双端复验再次116项通过并与源/图/请求清单一致；P37全部18项相关单测通过，28图册双宽度解码/无溢出通过；73路由、153文档、运行说明及格式门通过。不宣称全项目测试绿色，P35未变化的既有颜色门失败未重复运行。复验端口49563也已关闭。

## 如何复验

```powershell
node scripts/verify-ui-phase2-org-audit-parent-read.mjs --smoke
node scripts/verify-ui-phase2-org-audit-parent-read.mjs
node --test tests/unit/ui-phase2-org-audit-parent-read.test.mjs
```

`--capture`仅重采本批28图、图册和证据；普通复验不写图。永久测试固定实际加载源、28图和零额外文件、四类未修问题、精确只读请求与失败分支。修复后应另建r2证据，保留本问题快照，不倒改为成功记录。

没有新增依赖或修改环境变量/API/OpenAPI/数据结构/权限，生产不部署、不重启。测试使用本地动态空闲端口，全部服务及浏览器在finally关闭；首轮49263、采集49314端口用于本地验证，最终均应无监听。没有临时脚本/下载/测试图片遗留；28PNG及图册/清单是用户所需的永久证据，既有Vite依赖缓存保留。P35既有颜色门与修复授权待答，未提交，commit hash不适用。完整73页C实施、生产测试和用户签收仍继续。
