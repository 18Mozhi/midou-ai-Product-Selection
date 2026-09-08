# SCORE-C-r1 · P17评分规则

已选C方向的正式设计提案，具体稿件待用户审核。不是Vue实现、业务审批或生产部署。此独立目录不覆盖原A/B方向研究、真实Vue截图、任务C图稿或其证据。

[打开交互稿](index.html) · [P17规格](../../page-specs/P17.md) · [C方向决策](../../DIRECTION-DECISION-C.md)。用浏览器打开本地HTML即可，顶部是审核场景选择工具，不是拟上线产品导航。不请求API、不写存储、不需要服务。

## 48张双端图

24场景×1440/390。创建有版本/阈值区和8个维度编辑面，不是8个新弹窗；真实业务仍对应创建、预览及5种生命周期原因，共7种弹窗变体。图片数量不等于页面或完成率。

| 场景                 | 桌面1440                                     | 移动390                                     |
| -------------------- | -------------------------------------------- | ------------------------------------------- |
| 版本与质量门         | [图](1440-versions.png)                      | [图](390-versions.png)                      |
| 空目录               | [图](1440-empty.png)                         | [图](390-empty.png)                         |
| 只读空目录           | [图](1440-readonly-empty.png)                | [图](390-readonly-empty.png)                |
| 只读版本目录         | [图](1440-readonly.png)                      | [图](390-readonly.png)                      |
| 可提交、不可审批     | [图](1440-decide-only.png)                   | [图](390-decide-only.png)                   |
| 新建：版本与阈值     | [图](1440-create-basics.png)                 | [图](390-create-basics.png)                 |
| 新建：市场需求       | [图](1440-create-market_demand.png)          | [图](390-create-market_demand.png)          |
| 新建：竞争           | [图](1440-create-competition.png)            | [图](390-create-competition.png)            |
| 新建：利润           | [图](1440-create-profit.png)                 | [图](390-create-profit.png)                 |
| 新建：履约效率       | [图](1440-create-fulfillment_efficiency.png) | [图](390-create-fulfillment_efficiency.png) |
| 新建：客户体验       | [图](1440-create-customer_experience.png)    | [图](390-create-customer_experience.png)    |
| 新建：场景与内容适配 | [图](1440-create-content_fit.png)            | [图](390-create-content_fit.png)            |
| 新建：风险           | [图](1440-create-risk.png)                   | [图](390-create-risk.png)                   |
| 新建：数据质量       | [图](1440-create-data_quality.png)           | [图](390-create-data_quality.png)           |
| 只读影响预览         | [图](1440-preview.png)                       | [图](390-preview.png)                       |
| 预览失败（模拟）     | [图](1440-preview-error.png)                 | [图](390-preview-error.png)                 |
| 预览读取中（模拟）   | [图](1440-preview-loading.png)               | [图](390-preview-loading.png)               |
| 提交审批             | [图](1440-submit.png)                        | [图](390-submit.png)                        |
| 批准                 | [图](1440-approve.png)                       | [图](390-approve.png)                       |
| 拒绝                 | [图](1440-reject.png)                        | [图](390-reject.png)                        |
| 启用                 | [图](1440-activate.png)                      | [图](390-activate.png)                      |
| 回滚                 | [图](1440-rollback.png)                      | [图](390-rollback.png)                      |
| 审批版本冲突（模拟） | [图](1440-action-conflict.png)               | [图](390-action-conflict.png)               |
| 审批提交中（模拟）   | [图](1440-action-busy.png)                   | [图](390-action-busy.png)                   |

## 结构与真实依据

frontend-design技能影响本稿的结构：蓝色范围区承载创建入口，白色工作面先展示当前生效版本及质量缺项，再并排核对版本；移动纵向记录。草稿用蓝色、启用用绿色、缺项和待审批用文字加暖色区分，不把全部状态都画成成功。

创建表单改为“版本与阈值 / 评分维度”分区，字段仍沿ScoreRuleConsole：版本代码64字、名称160字；推荐与观察阈值0–100、步进0.01且推荐更高。阈值空白、八维权重0、必填未勾选、证据组other是当前空表单初态，不是推荐默认配置。至少2个正权重维度，合计100，至少1个启用维度必填。维度切换不丢输入；取消保留草稿，重新打开可继续，未增加浏览器持久化。

桌面八维采用目录与独立编辑面，移动采用原生维度选择框；全部8项都有对应图，不用截长输入墙代替细节设计。操作区固定在弹窗底部，内容独立滚动。图内每个选中维度的完整编辑面均经可见区域断言。当前能力只决定设计变体，不是前端授权或真实RBAC证明。

动作沿原状态：draft提交、pending_approval批准/拒绝、approved启用、active回滚；submit需要decide，其余及影响预览需要approve。原因必填且1000字；回滚目标只来自已批准/已停用目录。未增加直接编辑生效规则、绕过审批、自动批准或停用按钮。展示修订号，但没有发出expected_revision或任何请求，不能证明真实冲突处理。

## 样本来源与限制

data.js是人工核对后的明确子集，全部原文件哈希记入evidence.json；哈希用于漂移检查，不冒称自动推导全部业务事实：

- `tests/e2e/m04-03-scoring.spec.ts`第一用例的双版本及单条preview：org-v1/rev4，75/55；org-v2/rev1，78/58；市场40、竞争30、利润30。样本未配置risk，所以显示未就绪。样本名“当前生产评分规则”是原测试名称，不说明这是当前线上版本。
- 预览为org-v2，只读、page1/page_size20/total1；80.20→78.40，差值-1.80，结论仍推荐、覆盖100、missing_fields为空。只显示本页汇总；缺失项明确标成“样本未列出缺失字段”，不推断其他规则或机会已齐全。当前只有一页，分页禁用，未证明跨页行为。
- 五种生命周期场景单独使用`tests/e2e/ui-phase2-scoring-contracts.spec.ts`的UI2-S01样本生成条件：核验规则org-v1/rev4对应不同初始status，恢复目标org-v2/rev4为retired。它们不是双版本基线执行后的历史结果。不可把不同夹具的revision/status串成真实运行。
- 非org-v2的预览没有对应数据，交互稿明确提示未提供该版本样本，不挪用org-v2试算。冲突、忙碌、预览失败/读取中是明确标识的设计模拟；不生成request_id、不假装审计入库或服务恢复。
- 合法提交只显示校验/关闭演示，不更改目录或历史结果，也不制造成功回执。现有生产代码虽有missing_fields字段，尚未完整逐项展示；本稿只是对应改进提案，不谎称线上已修复。

## 复验与运行

```text
node scripts/verify-ui-phase2-scoring-c.mjs --capture
node scripts/verify-ui-phase2-scoring-c.mjs
```

capture保留48张永久图及证据；无参数只读校验源与图片哈希，并在双端运行24场景、八维初态、阈值/权重/必填校验、分区切换/取消保留、五操作原因/目标、限定能力可见性、预览只读值/重试/跨版本不混用、双向Tab/Escape返焦、非复选控件16px/44px、文字13px起及无横向溢出检查。复选框为20px，使用44px高标签行；不将复选框本体计入44px断言。预览分页和选中维度编辑面有无遮挡位置断言；不等于全读屏/真实权限验收。已有依赖复用，浏览器finally关闭，无服务或新依赖。

## 待审核及剩余范围

请审核版本对照、缺项提示、分区编辑和移动维度选择方式。三主题/密度、其他断点、200%缩放、长文本/多版本、多页/缺失值预览、读取异常、创建错误、其他冲突及所有按钮六态仍需完整补齐；真实Vue、后端/审计、全角色和生产验收未完成。方向选择不代替P17具体稿签收，未修改coverage审批或冻结分母。

本批不改生产代码/API/OpenAPI/数据库/权限/配置，不部署、不重启。文件与图片都是永久交付；无新增临时测试文件或服务。
