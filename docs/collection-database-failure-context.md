# 采集队列数据库锁失败定位

## 当前事实

2026-10-18 线上 collection_tasks 调度快照出现 Deadlock found when trying to get lock，连续失败触发队列熔断。MySQL 业务账号没有 PROCESS 权限，SHOW ENGINE INNODB STATUS 无法读取；没有扩大权限、改用数据库 root、关闭锁或放宽健康检查。仅凭现有通用错误不能判断具体失败语句，也不能把代码中的可疑锁顺序当作已证实的本次死锁图。

09:30北京时间快照显示队列自然恢复，连续失败计数归零；09:30:35对91e5b0e3的完整公开健康复核通过。没有人工重置队列或熔断。该次恢复不证明间歇死锁已根治。

## 定位上下文

Worker 的 recoverExpired、queueReady、claim 三个执行前阶段，对既有 ER_LOCK_DEADLOCK／ER_LOCK_WAIT_TIMEOUT 异常补充受控标签：

`collection_database:<阶段>:<错误码>:<语句类别>`

阶段为 recover_expired、queue_ready、claim。语句类别只来自固定前缀白名单：过期调度租约删除、调度槽锁、租约插入、任务主键锁、候选读取、任务更新、尝试记录插入，其他情况只显示 statement_other／statement_unknown。调度快照既有 last_error 字符串承载该信息；不新增字段，不输出 SQL、绑定值、凭证或私有任务标识。原异常保存在 cause，错误码保留。

这不是死锁修复。异常继续抛给现有调度器，事务仍由原仓储回滚；重试、并发、租约、任务尝试次数、熔断与健康告警不变。其他错误和成功结果原样返回。执行阶段还未定位到时，不得据此签收采集持续运行或每日100品。

## 使用与发布

查看既有平台运维调度快照／last_error 即可识别失败阶段，不新增配置、环境变量、API、数据库迁移或依赖。API/OpenAPI、Python请求和用户侧调用没有对应变更。需要经既有宝塔部署重启 Node Worker 才加载新代码；不得为收集诊断人工重复领取生产任务、重置熔断或扩大数据库权限。

定向验证：build:worker，tests/unit/collection-database-context.test.mjs 和 tests/m03-05/collection-task-state-machine.test.mjs。测试覆盖原异常因果、标签不泄露 SQL／值、非锁错误不包装，以及真实 Worker 在三个阶段失败后不继续执行。
