# 选品详情功能精简

2026-10-17 用户要求只保留连续情报、商品发现、竞品、评分、1688 找货与选品库。旧规划不能要求继续展示独立手动 AI、复盘录入或业务血缘页面。

## 实际删除

- 删除 `OpportunityAiPanel`、`OpportunityFeedbackPanel`、`OpportunityLineagePanel` 及两个血缘子组件。
- 删除复盘写入 composable、表单、未知结果重试状态；删除手动 AI 排队、抽检、原因弹窗、读取、跨页面 AI 状态和额外请求。
- 删除 AI/复盘/血缘专用 CSS 与两份颜色 token，并移除公共样式中淘汰面板的规则。详情只保留六个直接分区，不再保留“更多记录”入口。
- 删除独立市场概览的重复计数，市场依据由情报证据承接。用户可见名称为“商品与评分 / 竞品对比 / 货源与利润 / 情报证据 / 风险 / 决策记录”。
- 删除旧预览器替换当前 Vue 模板和注入旧设计 CSS 的能力。现有 `node scripts/verify-opportunity-page-preview.mjs` 改为检查当前实际 Vue 路由及精简回归；不把旧设计文件当成当前产品。

## 旧链接和数据边界

旧 `?tab=ai`、`lineage`、`feedback` 规范到商品评分默认页；旧 `market` 规范到 `?tab=evidence`。保留其他 query 字段与 `from` 返回路径，不创建写入、补造数据或恢复旧面板。普通六个 tab 值不变，仅中文名称调整。

本次删除范围为成员端详情代码，不删除数据库或历史记录，不改后端 API、权限、评分权重或费用规则。后台、账号、组织、来源、采集和运维仍保留；后端自动情报关联、真实 Amazon 主品选择及旧 AI/复盘/血缘接口的历史兼容代码也保留。原详情 API 暂仍可返回历史扩展字段，前端不再声明或消费这些字段；这不是后端接口已删除的声明。

旧设计评审材料和历史重建脚本属于存档，不再作为当前六分区页面的验收依据；旧阶段的 UI 原子项以本次明确要求取代。现有后端历史数据与接口测试继续执行，已淘汰的用户操作浏览器用例替换为“入口不存在、旧链接正确转向、无旧接口请求”的用例，不以跳过测试冒充通过。

## 使用和运行

在选品库打开商品，使用六项导航核对数据并按现有权限决策。无需配置新的环境变量或依赖。发布仅涉及前端静态包；按固定宝塔脚本发布后刷新浏览器，本项不需要重启 Node/Python。本次未部署生产。

预览检查命令保留现有参数：默认验证桌面与 390px 手机；`P15_SMOKE=1` 仅验证手机；`--capture-review r1` 等合法版本将测试截图输出到 `output/playwright/p15-page-composition-r1/<project>/`。该输出为显式请求的评审材料，普通验证仍使用现有临时测试目录。旧模板覆盖和独立 Vite 预览服务不再使用。

## 未完成范围

这次已删除上述详情功能，不代表全站旧模块、所有成员路由、旧后台兼容接口已全部清理。通用品类费用与评分、公开评价明细、六台设备持续运行与生产任务投影、真实部署和连续每日百品仍需继续完成。六台单图真实 POST 已通过，边界见 `docs/selection-lan-1688-validation.md`。

## 当前验证与未通过项

旧界面证据与当前产品的后续验证迁移见 `docs/selection-ui-validation-boundary.md`；不能恢复已删除面板来迁就旧截图，也不能把历史记录校验当成当前产品签收。

93 项当前范围定向单测通过，含后端 AI 合同、自动情报关联、历史复盘/血缘数据读取、权限、组件边界及样式。桌面与手机的核心详情/退休链接浏览器流程各 65 项覆盖通过。构建、包体预算、静态分析、代码规范和文档检查通过；构建产物不再包含旧手动 AI/复盘请求，资源数由 209 降到 206。

扩大的 `node --test tests/unit/*.test.mjs tests/m04-02/*.test.mjs tests/m04-07/*.test.mjs` **未通过**，不能声明全量验证完成。已确认其中包含历史评审断言：`ui-phase2-teams-vue-preview.test.mjs` 期望旧首页哈希 `e54608...`，而本轮开始前的 HEAD `b2ad3f73` 已是 `908a12...`；另有旧 Shell 预览断言要求 `class="role-workspace-tabs"`。这证明至少部分差异先于本轮，不能把所有失败都归因于本轮删除，也不能把所有失败都视为无关。其余失败仍待逐项归因与修复。全量运行中暴露的当前格式问题已修复，并单独通过代码规范门禁。

未修改旧设计评审截图或批准记录，当前 Vue 的两张详情回归基线随明确的界面精简更新；没有豁免全量失败。按项目“验证失败不提交”的要求，本轮改动暂留工作区，当前不自动提交、不部署，完整目标继续推进。重写后的预览命令已以 `P15_SMOKE=1` 实跑，六项手机用例通过；临时截图已清理，5173/4101 测试服务已退出。

## 扩大单测诊断清单（修复前，2026-10-17）

直接执行 Node 测试运行器，覆盖 `tests/unit`、`tests/m04-02`、`tests/m04-07` 共 474 个测试文件，限制四文件并发。结果 2921 项：2814 通过、107 失败、0 跳过、0 取消，耗时约 512 秒。这是修复期间的完整运行快照，不能与后续定向复测混算为全量通过。

本轮已修正 Shell 预览对旧顶部页签的要求，治理检查改为验证当前侧栏和抽屉目标；响应式依赖登记仅更新到已提交 c42a0996 的 main.ts 精确指纹，其他依赖和未知改动拒绝检查保留。对应六文件定向复测 31 项通过。P33 团队页历史图片绑定改用精确 Git 原版源码，实际当前 Vue 编译与事件合同检查仍执行。

旧发布与共享评审登记的测试改为验证登记版本的精确 Git 字节，不再要求线上源码永远停在该历史版本，也允许已淘汰组件只存在于 Git 历史。没有修改登记中的哈希、历史截图、批准记录或历史还原器；未知字节仍必须被拒绝。这两个文件的定向复测 321 项全部通过，加上前述 31 项，共 352 项定向复测通过。这些历史检查不代表当前产品验收。其余失败需要继续逐项归因，不能统一豁免；本轮没有重复执行整套测试，不推算最新全量失败数。

下表记录本次全量快照的原始失败分布（其中包括已随后定向修正的项）：

| 测试文件 | 失败项数 |
| --- | ---: |
| `platform-commercial-page-preview.test.mjs` | 1 |
| `responsive-data-view-focus.test.mjs` | 1 |
| `responsive-detail-palette-contract.test.mjs` | 1 |
| `shared-review-history-baseline.test.mjs` | 1 |
| `ui-current-palette-evidence.test.mjs` | 5 |
| `ui-governance.test.mjs` | 1 |
| `ui-phase2-acceptance-review-r2.test.mjs` | 1 |
| `ui-phase2-account-capture-boundary.test.mjs` | 1 |
| `ui-phase2-account-pair-lifecycle.test.mjs` | 2 |
| `ui-phase2-account-pair-preview.test.mjs` | 1 |
| `ui-phase2-admin-mobile-controls-implementation.test.mjs` | 1 |
| `ui-phase2-admin-mobile-palette-equivalence.test.mjs` | 3 |
| `ui-phase2-admin-mobile-results-implementation.test.mjs` | 2 |
| `ui-phase2-admin-mobile-role-facts-implementation.test.mjs` | 2 |
| `ui-phase2-admin-review-capture-boundary.test.mjs` | 1 |
| `ui-phase2-commercial-confirm-review.test.mjs` | 1 |
| `ui-phase2-commercial-confirm-write-review.test.mjs` | 1 |
| `ui-phase2-commercial-create-outcome-review.test.mjs` | 1 |
| `ui-phase2-commercial-edit-review.test.mjs` | 1 |
| `ui-phase2-contract-audit.test.mjs` | 5 |
| `ui-phase2-journey-controls-history.test.mjs` | 1 |
| `ui-phase2-journey-fields-history.test.mjs` | 1 |
| `ui-phase2-org-approvals-expired-vue.test.mjs` | 1 |
| `ui-phase2-org-approvals-loading-vue.test.mjs` | 1 |
| `ui-phase2-org-approvals-parent-current.test.mjs` | 1 |
| `ui-phase2-org-approvals-permission-vue.test.mjs` | 1 |
| `ui-phase2-org-approvals-read-order-vue.test.mjs` | 1 |
| `ui-phase2-org-approvals-review.test.mjs` | 1 |
| `ui-phase2-org-approvals-vue-preview.test.mjs` | 1 |
| `ui-phase2-org-data-parent-c.test.mjs` | 1 |
| `ui-phase2-org-data-parent.test.mjs` | 1 |
| `ui-phase2-org-data-review.test.mjs` | 1 |
| `ui-phase2-org-profile-form-preview.test.mjs` | 1 |
| `ui-phase2-org-read-state-preview.test.mjs` | 1 |
| `ui-phase2-org-refresh-preview.test.mjs` | 1 |
| `ui-phase2-organization-write-ownership.test.mjs` | 1 |
| `ui-phase2-platform-current-contract.test.mjs` | 7 |
| `ui-phase2-platform-overview-review.test.mjs` | 1 |
| `ui-phase2-platform-overview-vue-preview.test.mjs` | 1 |
| `ui-phase2-provider-adapter-filter-pagination.test.mjs` | 1 |
| `ui-phase2-provider-adapter-lifecycle.test.mjs` | 1 |
| `ui-phase2-provider-adapter-table-tools.test.mjs` | 1 |
| `ui-phase2-provider-adapters-detail-vue.test.mjs` | 1 |
| `ui-phase2-provider-adapters-vue.test.mjs` | 1 |
| `ui-phase2-provider-desktop-editor.test.mjs` | 1 |
| `ui-phase2-provider-source-configuration-return.test.mjs` | 1 |
| `ui-phase2-provider-source-configuration-states.test.mjs` | 1 |
| `ui-phase2-provider-source-configuration.test.mjs` | 1 |
| `ui-phase2-provider-source-versions.test.mjs` | 1 |
| `ui-phase2-published-presentation-baseline.test.mjs` | 34 |
| `ui-phase2-recent-review-materials.test.mjs` | 1 |
| `ui-phase2-shell-access-preview.test.mjs` | 1 |
| `ui-phase2-shell-journey-vue.test.mjs` | 1 |
| `ui-phase2-shell-org-vue.test.mjs` | 1 |
| `ui-phase2-source-scope.test.mjs` | 1 |

## 后续验证收口

上述 107 项失败是原始快照，保留用于追踪。后续修复未恢复已删除界面，也未修改原截图或批准记录；479 文件、2948 项完整覆盖及唯一 P21 失败修正后的两项复测见 `docs/selection-ui-validation-boundary.md`。当前未部署，整体目标尚未验收。
