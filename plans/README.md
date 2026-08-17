# ScoutOps 分阶段实施计划

本目录将 `new-product-enterprise-blueprint.md` 拆为可顺序执行、可暂停验收的阶段计划。P00 先交付所有后续阶段共用的工程、数据、安全、测试和宝塔基础框架；P01–P07 逐步完善业务功能；P08 按最新生产决策完成当前惠州单机的稳定性、资源保护、恢复与容量边界收尾，不启用负载均衡、备用服务器或多节点。

当前执行状态：P00 至 P07 已通过阶段验收；P08 的软件实现已经覆盖 M08-01 至 M08-06。`npm run verify:functional` 独立验证 P00–P08 的生产构建、软件功能 Node/Python 测试、桌面/390px E2E、文档、计划、发布矩阵和安全门，作为“项目可启动、功能完整”的自动验收入口。原 `verify:module`、`verify:phase`、`verify:all` 及 M08-06 生产容量证据门保持不变；同提交生产部署证据、磁盘诊断、生产压测和容量声明不属于功能验收，未执行时继续保持 `capacity_claim=unverified`，不得据此宣称 100 用户并发、10,000 用户、多节点或高可用能力。

## 执行与验收规则

1. 每个模块的目标、依赖、交付物和自动验收命令写在对应阶段文件中。模块没有通过验收不得标记完成。
2. P00 的 `M00-07` 必须先提供 `verify:module`、`verify:phase`、`verify:all` 三类实际脚本；后续表格中的命令以这些脚本为统一入口，且必须覆盖单元、契约、集成或 E2E 中适用的一类。
3. 当前可立即执行的计划完整性检查为 `npm run verify:plans`；它验证所有阶段文件、模块 ID、目标、依赖和自动验收命令都已登记。
4. 阶段完成门禁：本阶段全部模块验收通过、前置阶段已通过、OpenAPI/Feature Map/配置/运维说明同步、无遗留临时文件或进程。P08 还必须满足总计划 9.1.1 的单机资源、降载和恢复演练，并明确不形成多节点或 10,000 用户承诺。
5. 软件功能验收：只判断项目是否可构建、可启动和功能是否完整时执行 `npm run verify:functional`。该命令不会读取或伪造磁盘、容量和生产负载证据，也不会把 `capacity_claim` 从 `unverified` 提升为已测容量。

| 顺序 | 阶段 | 核心结果 | 前置 |
|---|---|---|---|
| P00 | [基础框架](phase-00-foundation.md) | 可运行、可测、可部署的统一底座 | 无 |
| P01 | [身份与租户](phase-01-identity-tenancy.md) | 组织隔离与权限真相 | P00 |
| P02 | [前端壳层](phase-02-ui-shells.md) | 全部页面壳层与设计系统 | P00、P01 |
| P03 | [来源与采集](phase-03-sources-collection.md) | 可审计的来源、任务和证据 | P00、P01 |
| P04 | [选品决策](phase-04-selection-decision.md) | 趋势、机会、竞品、供应链和评分 | P02、P03 |
| P05 | [协同与实时](phase-05-collaboration-realtime.md) | 任务、审批、通知、SSE、报表 | P01、P03、P04 |
| P06 | [管理与开放](phase-06-admin-open-platform.md) | 组织/平台运营、安全、Token、开放能力 | P01、P03、P05 |
| P07 | [发布与生产](phase-07-release-production.md) | S0 宝塔生产发布与质量门禁 | P00–P06 |
| P08 | [单机稳定性收尾](phase-08-scale-ha.md) | S0 单机资源保护、恢复与容量边界 | P07 |
