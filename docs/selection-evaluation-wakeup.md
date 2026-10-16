# 自动选品评估的通知保留

## 根因与处理

用户要求采集、评分与找货持续自动运行。原有三个入队入口（证据投影、评分规则、费用规则）在发现评估行为 leased 时保留租约与原状态，但没有保存新通知。评估随后完成为 waiting_evidence、waiting_profit 或 succeeded，领取查询又只读取 queued/retry_scheduled，执行期间的新通知便可能丢失。

现在三个入口复用 packages/database 的同一入队 SQL。已租用任务只在既有 result_json 中合并内部 requeue_requested=1 标记，不转移租约、不启动并行评估、不累计通知列表。领取任务时消费此前标记；领取后的新通知重新置位。当前执行成功或等待结束时，若标记已置位，则释放租约并置回 queued、立即可领取、重置尝试次数；当前评估结果仍保存为事实记录。失败结束也保留新通知形成新的 queued 执行，旧标记清除。没有新通知时，原终态及 1/5/15 分钟重试与死信规则保持。

标记为既有 JSON 内部可选元数据，不是 API 输入或输出字段；历史 null/普通结果仍兼容。无数据库结构变更、迁移、新状态、依赖、配置或外部事件名。费用/评分规则批量触发保留组织、工作区和候选过滤；新的非 leased 入队统一开始新尝试预算。租约所有者的完成条件保留，不抢占执行。

本项不自动重放过去已经丢失的通知，不回写历史评分、采购成本或生产任务；历史修复仍需按真实证据处理。修复竞态也不代表来源已启用、队列已经不间断运行或达到每日百品。

## 生产者与消费者

证据入口 queueAutomaticSelectionEvaluation（竞品、货源投影、利润运行等复用）、API 评分规则及费用规则的 queueAll 使用共享 upsert。Worker claim/complete/finishFailure 消费内部标记，前端和后台继续读取原 queued/leased/waiting 等状态。没有前端调用、OpenAPI 字段、Python 输入或插件载荷变更。

## 验证与发布

最小 38 项自动评估/评分测试通过；完整相关回归覆盖三个生产者的实际调用、三种正常完成、三种失败、领取消费、原证据/成本评分及来源投影。真实 MySQL 5.7 通过只读 SELECT，以实际 SQL SET 表达式派生运行 27 次状态转换：重复 leased 通知合并、原执行完成后排队、无通知终态与重试保留、非执行中正常入队；生产持久写入为 0。这是数据库表达式和代码回归，不是生产并发任务或持续运行验收。

本地 Database/API/Worker/Backend 构建后按固定 python scripts/deploy-baota.py 上传同一运行包，通过宝塔重启唯一 Node 项目 ai选品：/www/server/panel/pyenv/bin/python /www/server/panel/script/restart_project.py nodejs ai选品。API 和 Worker 必须一起加载共享策略，避免新生产者与旧消费者混用。无需 Python 重启或配置调节。本轮未部署。


本轮完整结果：60 项相关回归通过；真实 MySQL 5.7.44 的 27 次只读状态转换通过，三个实际入队语句及完成/失败语句共 5 条 EXPLAIN 通过，未执行这些写语句。Database/API/Worker/Backend 编译、样式、静态分析、文档/路由地图和运行文档检查通过。没有修改前端，因此未重复运行浏览器或 Web 构建。

修改前分支 codex/selection-core-rebuild、HEAD d23d459125806f8c6f8937d42fa2a3593cb48d46，唯一工作树且只有本分支未合并 main。线上版本复查仍为 c26e2b522bc616cbc2a67b01185d832f93789174。本轮未创建临时脚本、截图、日志或本地服务；远端只读进程已退出，未上传文件。原有 verification/state.json 改动不提交。
