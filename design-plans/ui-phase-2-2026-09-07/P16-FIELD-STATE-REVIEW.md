# P16 输入与选择状态审核 · C-r2

本批沿已批准整体布局补齐字段细节，未改变生产Vue或业务合同。全部使用隔离样例，图中的禁用、错误关联与焦点改善仍待审核。

## 五个实际字段

| 实际绑定 | 本批代表图 | 校验与保留规则 |
| --- | --- | --- |
| form.input_kind | [ASIN键盘焦点](design/journey-direction-c/1440-control-kind-focus.png) | 三类输入沿用同一草稿；方向键切换并保持焦点，清除上一类型错误文案。 |
| form.input_value | [关键词必填](design/journey-direction-c/390-control-keyword-value-invalid.png)、[ASIN格式](design/journey-direction-c/390-control-asin-value-invalid.png)、[链接格式](design/journey-direction-c/390-control-url-value-invalid.png) | required、200字上限、ASIN十位字母数字及原生URL语法不变；HTTP等服务端拒绝仍走既有隔离请求分支。 |
| selectedResultId | [候选焦点](design/journey-direction-c/1440-control-candidate-focus.png) | 左右方向键只改候选，不改原因或发决定；切到不合格候选后采纳与保存继续禁用。 |
| decision.action | [观察](design/journey-direction-c/1440-control-observe-focus.png)、[驳回](design/journey-direction-c/1440-control-reject-focus.png) | 三种决定保留原有语义；键盘切换保留原因，观察/驳回仍发送selected_raw_evidence_id=null。采纳六态见上一批。 |
| decision.reason | [空原因](design/journey-direction-c/390-control-reason-invalid.png) | required与1000字上限不变；空白原因沿既有非空检查拒绝。修正后清除错误标记，不跳走焦点。 |

这五个源绑定展开8个新增控件变体：类型、候选、观察、驳回各6态；关键词/ASIN/链接/原因各6态加错误态，共52状态、双端104张控件图。另补四种字段错误与ASIN/链接各自恢复中、提交中8整页场景，新增120图。[完整图册](design/journey-direction-c/README.md)现共338PNG。

## 交互设计

- 错误文字紧邻字段，通过aria-describedby关联；提交失败后焦点落在错误字段，不只用红色表达。
- 输入修正后移除旧错误节点及aria-invalid，输入框仍关联原有说明；不因每个字符重绘整页或丢失光标。
- 切换输入类型只换校验规则与清除旧错误提示，不清空草稿。200/1000为已有原生长度限制，没有放宽，也不更改接口的原值传输及服务端校验。
- 恢复/提交期间的字段统一禁用为已列待审提案。真实Vue部分输入仍可编辑，本批不伪称已修复在途请求归属。
- 输入的hover边框、focus轮廓、disabled浅灰背景与错误边框各自可辨；候选/决定单选沿用同一组件样式，不重新安排分区。

## 已执行与未覆盖

浏览器验证真实invalid事件、错误焦点、修正清除、键盘方向键、原因/草稿保留、200/1000字输入上限；错误与选择操作均检查零误提交。原有创建/采纳/恢复及观察/驳回合同验证继续保留。67整页场景与102代表控件状态均有1440/390图，18类控件不等于18个业务动作。

这些是离线HTML设计验证，不是实际Vue、API、MySQL竞争事务或生产验收。仍待用户审核本页控件/字段，补全主题与密度、实际Vue全生命周期和权限组合后再签收；不能由5字段有图推导整站设计或部署完成。没有本页业务弹窗，不为数量新增弹窗。
