# ScoutOps 分阶段实施计划

本目录将 `new-product-enterprise-blueprint.md` 拆为可顺序执行、可暂停验收的阶段计划。P00 先交付所有后续阶段共用的工程、数据、安全、测试和宝塔基础框架；P01–P07 逐步完善业务功能；P08 收口软件功能、诚实运行状态和自动验收，不启用负载均衡、备用服务器或多节点。

当前执行状态：P00–P08 软件实现与自动验收已完成。M08-06 模块门运行 ID 为 `29af24e4-2ff4-467a-9676-b49cae9b8b14`，P08 阶段门运行 ID 为 `ed48aa0b-d6fc-493e-9842-c95a473e18a2`，全量门运行 ID 为 `39a427ac-a8ff-41f0-816b-e5052a4d5b64`。`verify:module`、`verify:phase`、`verify:all` 是逐级的软件完成门，成功结果写入 `verification/state.json` 并被下游验收复用；`npm run verify:functional` 负责新鲜的全仓构建与功能回归。软件完成门不依赖磁盘、容量压测或生产资源证据，也不操作 PVE、备用服务器或其他项目。未执行可选容量测量时继续保持 `capacity_claim=unverified`，不得据此宣称 100 用户并发、10,000 用户、多节点或高可用能力。

## 执行与验收规则

1. 每个模块的目标、依赖、交付物和自动验收命令写在对应阶段文件中。模块没有通过验收不得标记完成。
2. P00 的 `M00-07` 必须先提供 `verify:module`、`verify:phase`、`verify:all` 三类实际脚本；后续表格中的命令以这些脚本为统一入口，且必须覆盖单元、契约、集成或 E2E 中适用的一类。
3. 当前可立即执行的计划完整性检查为 `npm run verify:plans`；它验证所有阶段文件、模块 ID、目标、依赖和自动验收命令都已登记。
4. 阶段完成门禁：本阶段全部模块的软件验收通过、前置阶段已通过、OpenAPI/Feature Map/配置/运维说明同步、无本次任务遗留临时文件或进程。P08 的磁盘、主机资源、容量压测和生产资源观测仅是可选运营程序，不阻断软件完成。
5. 软件功能验收：执行 `npm run verify:functional` 判断项目是否可构建、可启动和功能是否完整。该命令不会读取或伪造磁盘、容量和生产负载证据，也不会把 `capacity_claim` 从 `unverified` 提升为已测容量。

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
| P08 | [软件功能收尾](phase-08-scale-ha.md) | S0 功能完整、诚实状态与全量软件验收 | P07 |
