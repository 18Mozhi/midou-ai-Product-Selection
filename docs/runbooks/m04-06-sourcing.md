# M04-06 供应链找货运维与回滚

重复采集后，DHgate 的新观测应生成下一版规范记录，`sourcing_candidates` 仍按来源外部 ID 保持唯一；Made-in-China 的验证码和 EC21 的 robots 禁止必须继续显示为受阻，禁止绕过后宣称通过。

## 宝塔上线

在宝塔发布任务备份后应用 `0017f_sourcing_m04_06.up.sql`，配置 `SOURCING_PROJECTION_POLL_MS`、`SOURCING_PROJECTION_LEASE_SECONDS`，重新构建 Vue，并在宝塔重启 Node API 与 Node Worker。运行 `npm run verify:module -- M04-06`。

核心工作台增强发布还必须按顺序应用 `0044b_sourcing_soft_delete.up.sql`、`0044c_truthful_missing_metrics.up.sql` 和 `0044e_core_collection_projection.up.sql`。平台管理员种子任务成功后会立即同步代码目录，API 启动时也会再次同步并登记 `dhgate_supplier_search`、`made_in_china_search` 与 `ec21_supplier_search`；不需要官方 API 密钥。公开页在 Worker 执行前仍必须具备已批准且未过期的来源条款记录。变更代码后必须在宝塔重启 Node API 与 Node Worker，不得创建 systemd、独立 PM2 或其他面板外服务。

`verify-sourcing-live.mjs` 使用随机 `m04-06-…@example.test` 范围，并为两条合成规范记录写入当前任务的 `collection_task_evidence_links`。验收不创建第二个队列消费者，而是等待宝塔管理的生产 Worker 投影；查询只允许使用本次 `job_id + organization_id + workspace_id` 精确范围，禁止领取或读取任意其他生产任务。清理时必须先删除该随机组织的证据关联，再删除规范记录、原始证据和任务。若本次 job 没有在 10 秒内进入受控终态，验收必须失败关闭，不能把其他队列项的结果当成本模块证据。

发布成本双人复核时在备份后执行 `0064_governed_workflow_confirmations.up.sql`，通过宝塔重启统一 Node 后端以同时加载 API 和通知 Worker。验收使用两个不同的活动成员：提交后确认利润仍读取旧的当前成本，指定复核人批准后再确认新成本生效并排队重算；驳回、截止前提醒和逾期升级均不得激活成本。down 会把每个机会/平台/类型的最新成本恢复为当前并删除复核历史，因此只有在停止写入、导出审批审计且业务接受该退化语义后才能执行；Python、MySQL 和 Redis 无需重启。

## 诊断

- 找货任务不投影：确认 `dhgate_supplier_search`、`made_in_china_search` 与 `ec21_supplier_search` 已登记，其中至少一个为 `enabled/public_page` 且具备已批准、未过期的来源条款；关联采集任务必须属于同一组织/工作区并进入成功、空成功或带警告完成。再按精确任务编号检查三个独立子查询和 `core_collection_projection_runs`。当前 Made-in-China 验证码应记录为 `captcha`，EC21 robots 403 应记录为 `robots_disallowed`，不得改写为成功；旧的 `product-supply-csv-v1` 投影仍兼容。
- 候选不能对比：检查缺失项；采购成员必须带 Evidence ID 确认规格、交期、所在地、可信度、稳定性和风险。
- 对比页面：已保存的每一份对比必须按相同顺序显示供应商、规格、MOQ、报价与交期，并在对比区上方显示规格归一化提示。出现多种规格文本时应要求采购成员核对型号、容量、包装和计量单位；系统只识别格式差异，不自动换算或认定等价。当前三个来源均为公开页，不存在登录档案续期入口；不要把验证码或网络失败伪装成登录受阻。
- 页面核对：四阶段导航必须反映当前记录进度；候选卡优先展示报价、MOQ、交期和明确未计算的到岸价，外部原页同时显示采集时间。选择一家时固定栏提示至少再选一家，选择 2–5 家才允许保存对比；390px 报价字段保持两列且不得横向溢出。
- 采购任务被拒绝：数量不得低于现行报价 MOQ。
- 队列异常：在宝塔 Worker 日志搜索 `sourcing_projection`，再检查租约、尝试次数和 `last_error_code`。配置修改后必须重启 Worker。

## 回滚

先停用页面写入口并导出搜索、候选、报价版本、对比、采购任务、事件和 Outbox；在宝塔停止 Worker 后才执行 down 迁移。down 会删除本模块业务数据，必须确认备份可恢复。已被 P05 消费的任务不能由本迁移撤销，应按任务模块 Runbook 处理。回退应用后在宝塔重启 API/Worker。
