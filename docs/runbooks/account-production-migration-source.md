# 账号切换：迁移源码闭包

正式迁移源码包括当前 `0076_collection_backlog_cancellation.up.sql` 基线、0077–0079 前置、0080–0197 正向及逆向 SQL，以及 `serve-account-production-cutover.mjs` 的直接及间接脚本依赖。0076 文件只补齐已经上线的源字节，正式回执和本地源码的 LF 归一化 SHA-256 均为 `d4624a108969168897dccc80f9f35db2bcd8a95354309230c27ed25feb82c77e`，不会在本次迁移重跑。

执行前用 `node scripts/plan-account-retirement-production.mjs` 核对清单，当前预期计划摘要为 `0ff5ad78f839b040087ff013598a5d574f338b57b798c4b8f7aea81d984d3886`。三个前置和 118 条正向回执须在同一已停写连接完成并通过保全检查。回退 SQL 只保留受保护的迁移源码，不表示本流程生成或使用备份，也不授权正式回退。

本次只将迁移源码及对应定向测试纳入 Git；并未将混合工作区或其他应用改动打包。正式入口仍须从批准的干净 `main` 构建。正式库仅查过 0076 回执，未迁移、停服或创建备份及隔离环境。

## 0190 保留独立证据版本链

保留原 ID、所有原始证据及引用、原去重键、版本值、状态、原审批和封存账号。0190 由封存对应的原坐标派生 32 字节不透明 `history_chain`，不得用作权限，也不恢复组织/工作区表、路由或旧写入流程。新采集默认为全零链，只能在该链内去重和选现行版本。历史读取由原证据或原记录 ID 定位，再沿同一链读取版本，不跨链选择；账号仍是权限边界。无新增环境变量、接口字段或客户端参数。

修正只变更尚未应用的 0190 正/逆向 SQL 字节，旧计划的 113 条已落账回执不变。独立的后缀执行器要求以下硬门禁：精确前缀、0190 两表未部分修改、原索引及 MySQL 5.7 同会话停写锁、原封存归属、全部 0190 只读保护查询和 0194 预检。只按序执行 0190–0197；执行前后比较报价、情报、业务及原标准化记录的内容指纹，并逐表验证原链标记与封存相符。不能使用这个入口重跑已应用的迁移，或从未核对的部分 DDL 恢复。已完成验证的新版必须一起更新 API 和 Worker，并由宝塔按原协调流程重新启动 Node/Python；不启动旧版。

从已经核对的 `resuming_after_prewrites` 断点（113/121）只允许用受审的干净 `main == origin/main` 构建：
```powershell
python -B scripts/deploy-account-baota.py --continue-evidence-suffix --expected-previous-sha <仍在磁盘的旧SHA> --plan-sha256 <修正版计划SHA256> --interrupted-build-sha <中断候选SHA> --interrupted-plan-sha256 <中断计划SHA256> --sealed-records <已复核的封存行数>
```
新包只允许在迁移目录内修改原候选尚未执行的 0190 正/逆向两份文件。旧日志按原样保留，新候选取得其自身准确的库验证与运行回执。若 `evidence_suffix_applying` 之后再中断，必须重新查明实际持久结构和前缀，本入口不会自动接管。

### 121 条回执已齐、运行包已安装但 Node 未就绪

先通过 SSH 核对正式发布日志止于 `runtime_installed`、实际构建与独占门禁。修复包从干净且等于受审 `origin/main` 的源码构建，迁移文件和回执定义必须完全不变。仍无监听、无 Worker、无 Python 且备份任务停用时，以下命令只通过宝塔停止失败的 Node，再在同一数据库停写锁下只读检查 121 条回执、封存总数及退役结构，安装修复包并重新执行健康、Worker 和旧路由验证：

```powershell
python -B scripts/deploy-account-baota.py --recover-retired-runtime --expected-previous-sha <已安装的失败构建SHA> --plan-sha256 <已完成迁移的计划SHA256> --interrupted-build-sha <首次中断的候选SHA> --interrupted-plan-sha256 <首次中断的计划SHA256> --sealed-records <已核验封存数>
```

本入口不运行任何迁移，也不会启动旧版。若监听或任一 Worker / Python 已运行，拒绝按启动失败路径停机；不得用此命令代替正常健康发布。退役模式的拓扑心跳和平台审计不再引用已移除的组织／工作区列；事件身份、节点配置、心跳周期、权限和 HTTP 契约不变。
