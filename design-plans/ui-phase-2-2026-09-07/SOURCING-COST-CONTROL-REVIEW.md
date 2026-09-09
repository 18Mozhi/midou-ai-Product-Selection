# P21 成本与复核控件 · C 方向审核

具体稿待审核，不把P16布局批准扩展到P21。新增8控件变体双端80PNG：成本提交/重算/通过提交/驳回提交各六态，打开与取消各四态。完整capture通过：65主场景695PNG、59控件变体544双端状态实例；本批验证结果与人工目检范围记于PROGRESS。

## 控件设计与源规则

| 操作 | 源可用条件 | 请求与生效边界 |
| --- | --- | --- |
| 提交双人复核 | canConfirmCost可见；cost busy或未指定复核人禁用；其他required走原生字段有效性 | 九字段＋机会expected_version；尚未复核的值不成为当前成本 |
| 重新计算 | canConfirmCost可见；cost busy禁用 | 仅platform＋机会expected_version排队，不在前端计算利润 |
| 打开通过／驳回 | 每条item.can_review；无busy禁用 | 只展开对应原因并清旧原因，不发送审批请求 |
| 提交通过／驳回 | cost busy或trim原因少于两字符禁用 | 对应reviewId路径、decision、trim reason＋该复核条目expected_version；不是机会版本 |
| 取消通过／驳回 | 无busy禁用 | 只关闭内联表单，不撤回在途请求、不重置服务端状态 |

成本区busy属于SourcingCostConfirmationPanel，和SourcingWorkspace找货/采集busy独立。本稿原先混用顶层busy抑制成本提交，本轮对齐独立状态；每个按钮只有自身请求在途才标aria-busy，其他成本写操作因同一区域busy变灰，但不冒称它也在提交。

提交前复核同时修正成本输入／下拉框继承采集busy的问题，保持源字段可编辑；验证改为先发采集请求、再填写成本并提交，而非只验证预填表单。生产组件未改。

普通提交蓝色，驳回提交红色；次级取消保持中性。深蓝3px键盘轮廓、不透明灰底禁用、静态进度环和临近控件的状态说明，避免把结果未确认画成已通过。键盘提交后焦点移到本区域提示；取消回到对应“通过”或“驳回”入口，不总回第一个按钮。

人工抽查发现390px驳回提交中文案折成两行，已将手机成本／复核表单底部按钮纵向排列；复验按钮320×44px、文案单行，并增加在途文案不折行断言。只目检手机驳回在途与桌面取消焦点代表图，不宣称80张全部人工审核。

## 请求归属和取消

离线pending保存点击时的请求内容和版本；后续改金额、复核人或原因不改已发内容。通过请求尚未返回时取消表单、改开驳回仍保留“通过结论请求提交中”；新驳回提交因共享cost busy禁用，但aria-busy为false。源允许取消/切换，本稿不额外锁这两个本地动作。

这里仅记录合成请求意图，没有HTTP、服务端审批、成本生效、Worker计算、超时重试或幂等结果。源RQ的busy主要是模板禁用，函数自身没有busy守卫；原型的重复意图守卫不是生产修复。真实旧响应归属、切机会/卸载、复核后重读、消息被load清空等SC-G01–08未关闭。

禁用代表图：成本未选复核人；通过/驳回原因为一个非空白字符；重算为自身请求在途。其他required字段缺失不被偷换成新的按钮禁用规则，金额0仍按源有效且精确保留，不新增0金额确认窗口。打开与取消没有disabled/busy源条件，因此不画假状态，相关代表槽继续留作适用性核对。

五语义组新增26代表槽，P21累计150映射、20待核对；三个驳回额外变体不增加动作分母。20槽均涉及没有明确disabled/busy条件的局部/读取动作，不意味着应新增20张禁用图；完整字段、主题/密度、读取在途与真实流程仍需独立审核。

## 双端状态图

每图通过浏览器真实鼠标/键盘状态生成并保留视口上下文；不是整页全部变体或真实Vue验收。busy是请求尚未确认，不是成本已生效或利润已重算。

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 提交双人成本复核 | [查看](design/sourcing-direction-c/1440-control-cost-submit-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-submit-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-submit-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-submit-pressed.png) | [查看](design/sourcing-direction-c/1440-control-cost-submit-disabled.png) | [查看](design/sourcing-direction-c/1440-control-cost-submit-busy.png) |
| 重新计算 | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-pressed.png) | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-disabled.png) | [查看](design/sourcing-direction-c/1440-control-cost-recalculate-busy.png) |
| 打开通过说明 | [查看](design/sourcing-direction-c/1440-control-cost-open-approved-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-approved-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-approved-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-approved-pressed.png) | 源码无此条件 | 源码无此条件 |
| 提交通过结论 | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-pressed.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-disabled.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-approved-busy.png) |
| 取消通过表单 | [查看](design/sourcing-direction-c/1440-control-cost-cancel-approved-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-approved-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-approved-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-approved-pressed.png) | 源码无此条件 | 源码无此条件 |
| 打开驳回原因 | [查看](design/sourcing-direction-c/1440-control-cost-open-rejected-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-rejected-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-rejected-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-open-rejected-pressed.png) | 源码无此条件 | 源码无此条件 |
| 提交驳回结论 | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-pressed.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-disabled.png) | [查看](design/sourcing-direction-c/1440-control-cost-review-rejected-busy.png) |
| 取消驳回表单 | [查看](design/sourcing-direction-c/1440-control-cost-cancel-rejected-default.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-rejected-hover.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-rejected-focus.png) | [查看](design/sourcing-direction-c/1440-control-cost-cancel-rejected-pressed.png) | 源码无此条件 | 源码无此条件 |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 提交双人成本复核 | [查看](design/sourcing-direction-c/390-control-cost-submit-default.png) | [查看](design/sourcing-direction-c/390-control-cost-submit-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-submit-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-submit-pressed.png) | [查看](design/sourcing-direction-c/390-control-cost-submit-disabled.png) | [查看](design/sourcing-direction-c/390-control-cost-submit-busy.png) |
| 重新计算 | [查看](design/sourcing-direction-c/390-control-cost-recalculate-default.png) | [查看](design/sourcing-direction-c/390-control-cost-recalculate-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-recalculate-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-recalculate-pressed.png) | [查看](design/sourcing-direction-c/390-control-cost-recalculate-disabled.png) | [查看](design/sourcing-direction-c/390-control-cost-recalculate-busy.png) |
| 打开通过说明 | [查看](design/sourcing-direction-c/390-control-cost-open-approved-default.png) | [查看](design/sourcing-direction-c/390-control-cost-open-approved-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-open-approved-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-open-approved-pressed.png) | 源码无此条件 | 源码无此条件 |
| 提交通过结论 | [查看](design/sourcing-direction-c/390-control-cost-review-approved-default.png) | [查看](design/sourcing-direction-c/390-control-cost-review-approved-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-review-approved-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-review-approved-pressed.png) | [查看](design/sourcing-direction-c/390-control-cost-review-approved-disabled.png) | [查看](design/sourcing-direction-c/390-control-cost-review-approved-busy.png) |
| 取消通过表单 | [查看](design/sourcing-direction-c/390-control-cost-cancel-approved-default.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-approved-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-approved-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-approved-pressed.png) | 源码无此条件 | 源码无此条件 |
| 打开驳回原因 | [查看](design/sourcing-direction-c/390-control-cost-open-rejected-default.png) | [查看](design/sourcing-direction-c/390-control-cost-open-rejected-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-open-rejected-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-open-rejected-pressed.png) | 源码无此条件 | 源码无此条件 |
| 提交驳回结论 | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-default.png) | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-pressed.png) | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-disabled.png) | [查看](design/sourcing-direction-c/390-control-cost-review-rejected-busy.png) |
| 取消驳回表单 | [查看](design/sourcing-direction-c/390-control-cost-cancel-rejected-default.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-rejected-hover.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-rejected-focus.png) | [查看](design/sourcing-direction-c/390-control-cost-cancel-rejected-pressed.png) | 源码无此条件 | 源码无此条件 |

## 验证与交付边界

- 定向源码检查增加2组，总13组：真实RQ trim/版本/重开原因，以及两个父组件busy独立；不是真实DOM挂载、权限或后端验收。
- 离线预检覆盖544双端控件实例、精确POST路径/字段/版本、金额0/观测时刻、required与disabled区分、请求不可重写、取消/换结论和精确回焦、跨区busy不互锁。文字对比阈值4.5、44px触控、16px控件字、可见焦点/内侧命中保留；不降低验证阈值。
- [交互原型](design/sourcing-direction-c/index.html) / [全部图册](design/sourcing-direction-c/gallery.html) / [本批验证记录](PROGRESS.md)。运行node scripts/verify-ui-phase2-sourcing-c.mjs完整复验；--smoke只预检，--capture重生成本包永久图稿/证据。
- 本轮只改离线HTML/CSS/JS、永久验证脚本和审核资料；生产Vue、API/OpenAPI、后端/Worker/Python、数据库/迁移、env、依赖/权限不变，无部署或重启要求。全站具体批准、真实重构及宝塔签收仍未完成。
