# M05-05 自动化规则运维与回滚

## 宝塔配置

在宝塔 `Node Worker` 项目环境变量设置 `AUTOMATION_POLL_MS`、`AUTOMATION_LEASE_SECONDS`、`AUTOMATION_RETRY_LIMIT`、`AUTOMATION_DEFAULT_RATE_LIMIT`。配置在启动时读取，变更后必须在宝塔重启 Node Worker；API 默认限流值变更还需重启 Node API。不得创建面板外生产服务。

## 观测与故障处理

任务处理器日志队列名为 `automation_rules`，应观察成功、限流、计划重试、死信和依赖失败。规则可在 `/automations` 查看完整详情并编辑；编辑要求当前版本和原因，会保留版本历史。规则异常时先人工暂停，再按关联编号和链路编号查询执行、审计与事务消息。租约到期会自动重领；死信不会自动改业务事实。

## 回滚

1. 在页面暂停所有 active 规则，并等待 leased 执行结束。
2. 在宝塔停止 Node Worker 和 Node API，备份数据库。
3. 仅当不存在 `source_type='automation'` 的任务时，先执行 `0066_automation_task_source_restore.down.sql`，再执行 `0018e_automation_rules_m05_05.down.sql`；否则先保留数据并停止回滚。
4. 在宝塔恢复上一版本并移除四个 `AUTOMATION_*` 配置，随后启动 API/Worker 并检查健康状态。

回滚会删除规则及执行历史，必须保留备份和审计导出。

## UI第二阶段预览验证与发布

编辑条件、动作、人员或次数后应清空旧试运行结果；关闭重开后旧请求不应把预览填入新表单，需要操作者再次试运行。当前修复只涉及前端预览归属，无新增配置、不改变规则/事务，也不需要单独重启后端。重复部署仍使用本地`python scripts/deploy-baota.py`，先核对当前生产版本、既有迁移白名单与宝塔停启窗口，不能把纯前端修改描述为部署器必然零停机。本次局部实现不自动授权或执行上文破坏性数据库回滚。

使用既有Playwright配置运行m05-05-automation-rules.spec.ts和受影响m05-06-reports.spec.ts，先定向UI2-AR，再桌面/390移动串行；本地响应夹具不证明真实通知、执行记录或生产权限。其他弹窗错误可达及完整生命周期仍见P27的未验清单。
