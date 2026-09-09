# P22 费用版本审批 · COST-RULES-C-r1

状态：C 方向整页提案，具体稿待用户审核。起点 main/c79a0626；不是生产 Vue，也不是费用发布或回滚验收。

本包 74 场景、166 PNG：148 张双端主图、12 张长表单下部、4 张焦点/悬停、2 张 768/1024 目录图。9 组实际源检查、16 类场景 DOM 动作标记；表单提交/输入监听另外验证，16 不是全页业务动作分母。

[完整桌面/手机图册](gallery.html) · [离线交互原型](index.html) · [来源与截图指纹](evidence.json) · [页面规格](../../page-specs/P22.md) · [既有合同与缺口](../../sourcing-cost-contract-review.md)

## 构图与使用

使用 frontend-design：紧凑身份栏、蓝色范围/创建区、白色版本目录与下方费用核对面。详情按费用依据与审批进度分区，不沿用旧准备度大卡、账页编号或供应商卡片。手机改为范围顶区、版本纵向选择与单列表单，不缩小桌面。示例费用不是推荐费率，不访问示例汇率来源。

打开 index.html，通过顶部“审核场景”选择版本状态、角色、表单及操作变体；业务按钮只记录内存中的离线请求意图，不发送 HTTP、不写本地存储。刷新与返回也仅演示意图。图册内的 busy/success 是人为选择的合成状态，不是后端回执。关闭后重开草稿恢复空白费用；取消操作不重放。

## 控件与状态映射

| 语义 | 场景 / 验证 |
| --- | --- |
| SC-R-CREATE / CREATE-SUBMIT / CLOSE | create-blank/zero/automatic/invalid/conflict/busy/saved；版本身份、4 费用、币种、可选物流/汇率与自动品类。提交意图有精确字段；显式 0 保留，空费用阻止提交，错误保留、重开重置 |
| SC-R-SEARCH/FILTER/RESET | directory/filter-empty；本地筛选，不改变当前生效版本；重置与无结果恢复 |
| SC-R-PAGE-PREV/NEXT / SELECT | page-two 12 个合成版本、每页 10 条、边界禁用；实际源优先 query.rule 并计算页码。离线原型不实现浏览器历史反向同步 |
| SC-R-BACK / REFRESH | 原型演示 /sourcing 与只读重读意图；实际源隔离核对内部 from 边界。没有新 API |
| SC-R-SOURCE | exchange-basis：日期、货币对及已有来源入口，noopener noreferrer；占位链接不作为可用汇率证据 |
| SC-R-SUBMIT | submit-{confirm,invalid,conflict,busy,success}；仅 draft |
| SC-R-APPROVE/REJECT | selection-approve/selection-reject/admin-approve/admin-reject 各五态；真实角色及尚未批准条件，manager-only 不代替审批角色 |
| SC-R-PUBLISH | publish 五态；仅 approved，明确替换同范围当前版本，历史保留 |
| SC-R-ROLLBACK | rollback 五态/no-rollback；只选同市场/平台 approved 或 retired；无目标不显示入口 |
| ACTION-SUBMIT / CLOSE | 七操作变体：reason trim 2–1000；expected_revision 来自目标，approve/reject 才带 approval_role，rollback 才带 target_rule_id；取消零意图、busy 阻止关闭和重复提交、错误保留 |
| 读取状态 | loading/empty/error/expired/forbidden/rate-limited/blocked；失败不冒充空目录，刷新不自动重放写入 |
| 对象/显示状态 | 七 status-*、one-approved/no-active、只读/单角色、long-name；首 active 只代表该条规则而非所有市场；无利润数字 |
| 样式与响应式 | 三主题×两密度的目录代表场景；button-focus/hover、1440/390 主图和长窗下部、768/1024 目录；12 个宽度检查及等效重排，不代替所有动作六态或完整主题/弹窗组合 |

## 实际源码与验证边界

`node scripts/verify-ui-phase2-cost-rules-source.mjs` 执行提取自真实 CostRuleConsole 的 setup，使用 Vue 响应式与隔离传输/路由/模态占位。九组检查覆盖空/零与准确草稿字段、可选物流和 CNY→履约币种、真实角色计算、回滚筛选、七操作 payload、busy 单飞/原因保留、安全 from/分页、保存仍 draft。

另复现 **SC-G05 未修复**：先发请求晚返回会覆盖后发列表。仅记录现状，不修改 Vue 或重绑旧证据掩盖问题。原型操作目标快照、统一表单锁和错误关联属于待审交互改进，不是源码已修。原生模态钩子本次没有实际挂载，不能用源函数测试替代真实键盘/焦点证明。

服务端代码复核：profit-service 查真实角色与参数；mysql-profit-repository 事务查 revision、状态、双角色计数和同范围回滚。此次没有运行真实 SQL、鉴权、审计、Outbox、利润 Worker 或生产流程，也没有验证实际费用依据。所有源文件指纹只证明绑定版本，不表示每个文件均被动态执行。

## 复验与保留

- `node scripts/verify-ui-phase2-cost-rules-c.mjs --capture`：仅重新生成本包正式 PNG、图册和 evidence；浏览器最终关闭，HTTP 尝试被拦截并要求为 0。
- `node scripts/verify-ui-phase2-cost-rules-c.mjs`：只读核对源/图指纹并重跑离线浏览器与九组源检查。
- 图册 PNG 是用户要求的正式审核交付物，保留；不产生一次性脚本、测试服务或日志。无需生产重启；调节场景只影响此原型，不调费用配置。
- 没有修改生产 Vue/API/OpenAPI/数据库/环境/依赖/权限或历史稿件、coverage、用户意见。

## 待审与下一步

请以“P22 / COST-RULES-C-r1 / 场景名 / 通过或修改意见”给出具体意见。C 方向选择不是逐页批准。

全站现阶段仍需逐页动作与弹窗语义去重、各态映射、P11/P18/P54 组合核对、真实 Vue/主题密度/生命周期/权限/生产验证及部署签收。P22 的关联稿补齐不将全站门禁提升，也不表示第二阶段已完成。
