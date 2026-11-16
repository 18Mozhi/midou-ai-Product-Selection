# 账号切换：正式协调发布入口

正式入口：`python -B scripts/deploy-account-baota.py --execute --expected-previous-sha <当前正式构建SHA> --plan-sha256 <账号迁移清单SHA256>`。只接受干净的、与批准 `origin/main` 一致的本地提交和确切在运行的基线，不要用旧发布命令绕过。

入口从本地构建，严格校验 SSH 主机，独占上传并复核候选，准备依赖与路由，停止宝塔写入端，在同一 MySQL 会话审核及迁移。安装过程中数据库锁仍持有；正向验真后，替换固定运行目录、刷新 Nginx、启动宝塔新版，最后校验公开版本、健康和路由。业务记录、审批及证据保全由迁移执行器检查。没有备份副本、隔离环境或新增常驻进程。

发布阶段写入受限 `config/account-release-state.json`，不得删除阶段记录来强行重跑。在发出正向请求之前，只有确认原版 SHA、旧表和审批类型仍 intact、且正向回执为 0，才恢复原来正在运行的组件。进入 `applying_database` 后失败，不自行启动旧版，不自动重跑任何迁移，先核对实际数据库和日志。

本地验证：`python -B tests/unit/test_baota_account_release_coordinator.py`。正式入口已实跑到源码门禁；当前工作树混有未提交改动，命令以 `account_release_source_must_be_clean` 退出，未连接 SSH、上传、停机或迁移。
