# P16 创建选品 · JOURNEY-C-r2

状态：用户已批准本页整体布局，继续细化按钮；具体控制状态及完整页面验收仍待审核。[批准边界](../../P16-C-R2-LAYOUT-APPROVAL.md)。

67个全页场景×双端=134图；18类代表控件102种状态×双端=204图，共338基础图。另40张主题/密度图、4张200% CSS放大图，总382张永久审核图。8动作组40适用槽/8导航不适用、5源字段8变体的口径不变；页尾外观选择仅审核工具，零业务弹窗。

[交互原型](index.html) · [源与图证据](evidence.json) · [页面规格](../../page-specs/P16.md) · [当前合同第9节](../../selection-journey-contract-review.md) · [统一质量门决定](../../JOURNEY-ADOPTION-DECISION.md)

## 设计与使用

[主题与自适应审核](../../P16-APPEARANCE-REVIEW.md)：页尾展开“外观审核”即可切换三种现有兼容ID和标准/紧凑密度，仅改变本图稿显示，不保存偏好、不改变草稿。目录蓝/冷雾蓝/净页白全部为浅色C稿，不按旧ID名称推断深色模式。

沿frontend-design和用户批准的C方向：蓝色阶段目录、白色工作区；候选与决定分区，时间轴按需展开，移动端纵向审阅，正文/输入16px、元信息至少13px、触区至少44px。新质量门区逐行显示评分/市场/竞争/成本/风险，不只给颜色或总分。未形成已评估机会不展示虚假5门通过；5/5仍须待决策、有效规则和来源门槛。

顶部“审核场景”与“推进隔离样例”仅用于审核；创建、采纳、观察/驳回、恢复采用内存样例返回，不访问API、原文或真实浏览器存储，不启动采集或轮询。相应按钮只记录导航或请求意图，合格样例来自已有隔离回归，不是真实机会推荐。实际输入仍是Google新闻线索，不承诺抓到ASIN价格。

## 与真实源码的对应及差异

- [字段审核](../../P16-FIELD-STATE-REVIEW.md)：三种输入和原因新增内联错误、错误焦点与修正清理，键盘切换保留焦点及草稿；长度限制和API业务规则不变。忙碌冻结等仍仅为图稿改善，真实Vue未改。

- 统一采纳门与保存成功清错已在c31fddc7实现；助手重新执行当前Vue eligibility、提交函数、三输入校验及禁采纳零请求。采用实际请求字段，adopt携带选中证据ID，observe/reject恒null，不新增expected_version。
- 五项分别缺失、无已评估机会、合格采纳、提交中、409冲突与刷新、采纳成功均有图。冲突时明确“上次读取状态”；刷新后显示缺门，保留原因，可改为观察。成功只按返回ID显示机会/验证任务链接。
- 创建与保存两动作的代表按钮六态已逐selector映射；采纳radio作为字段单独记录。hover、focus-visible、pointer-down是浏览器真实状态，拍按下图后移出再抬起，确认未意外发起提交。禁用/提交中读取实际disabled，不用CSS外观冒充禁用。
- 仍保留Vue与提案差异：原型busy冻结整个输入区、关联原因错误、reset清旧草稿、超时但任务运行时禁决定；生产Vue未全部实现这些改进。实际在途POST失活归属、storage异常、跨范围/多标签、完整RBAC、SQL竞争与生产均未验证。
- 恢复按钮现在依据实际主次处理分支：无ID时重新输入不发创建请求，读取失败副动作仅记录返回上一页，登录过期无副按钮，受阻/权限拒绝解释影响而非改变权限。Vue共享文案与实际reset可能不一致；图稿明确文案及忙碌禁用为待审改进。
- 原型正文单列最多20个候选，任务总量单独标注；缺标题/长文本/20项场景为合成排版样例。观察/驳回不伪造机会；零业务弹窗，不引入确认弹窗改变现有决定合同。

## 全页图册

| 场景                  | 桌面1440                           | 手机390                           |
| --------------------- | ---------------------------------- | --------------------------------- |
| 关键词输入            | [桌面](1440-keyword.png)           | [手机](390-keyword.png)           |
| ASIN 输入             | [桌面](1440-asin.png)              | [手机](390-asin.png)              |
| 商品链接输入          | [桌面](1440-url.png)               | [手机](390-url.png)               |
| 关键词已填            | [桌面](1440-keyword-edited.png)    | [手机](390-keyword-edited.png)    |
| ASIN 已填             | [桌面](1440-asin-edited.png)       | [手机](390-asin-edited.png)       |
| 链接已填              | [桌面](1440-url-edited.png)        | [手机](390-url-edited.png)        |
| 创建中                | [桌面](1440-create-busy.png)       | [手机](390-create-busy.png)       |
| 创建未获确认          | [桌面](1440-create-failed.png)     | [手机](390-create-failed.png)     |
| 非 HTTPS 返回拒绝     | [桌面](1440-url-rejected.png)      | [手机](390-url-rejected.png)      |
| 正在恢复              | [桌面](1440-restoring.png)         | [手机](390-restoring.png)         |
| 恢复失败              | [桌面](1440-restore-failed.png)    | [手机](390-restore-failed.png)    |
| 恢复登录过期          | [桌面](1440-restore-expired.png)   | [手机](390-restore-expired.png)   |
| 恢复无权访问          | [桌面](1440-restore-forbidden.png) | [手机](390-restore-forbidden.png) |
| 重试读取提交中        | [桌面](1440-retry-busy.png)        | [手机](390-retry-busy.png)        |
| 恢复受阻              | [桌面](1440-restore-blocked.png)   | [手机](390-restore-blocked.png)   |
| 非法活动 ID 已清理    | [桌面](1440-invalid-id.png)        | [手机](390-invalid-id.png)        |
| 活动 ID 返回 404      | [桌面](1440-missing-id.png)        | [手机](390-missing-id.png)        |
| 任务已接收            | [桌面](1440-accepted.png)          | [手机](390-accepted.png)          |
| 来源处理中            | [桌面](1440-running.png)           | [手机](390-running.png)           |
| 处理中已有证据        | [桌面](1440-running-evidence.png)  | [手机](390-running-evidence.png)  |
| 进度读取中            | [桌面](1440-read-busy.png)         | [手机](390-read-busy.png)         |
| 进度读取失败          | [桌面](1440-read-failed.png)       | [手机](390-read-failed.png)       |
| 读取登录过期          | [桌面](1440-read-expired.png)      | [手机](390-read-expired.png)      |
| 读取权限拒绝          | [桌面](1440-read-forbidden.png)    | [手机](390-read-forbidden.png)    |
| 读取受阻              | [桌面](1440-read-blocked.png)      | [手机](390-read-blocked.png)      |
| 双候选待选择          | [桌面](1440-results.png)           | [手机](390-results.png)           |
| 候选已选              | [桌面](1440-selected.png)          | [手机](390-selected.png)          |
| 选择无主题候选        | [桌面](1440-no-topic.png)          | [手机](390-no-topic.png)          |
| 单条自动选中          | [桌面](1440-single-result.png)     | [手机](390-single-result.png)     |
| first_result 兼容回退 | [桌面](1440-first-result.png)      | [手机](390-first-result.png)      |
| 缺标题与发布者        | [桌面](1440-missing-fields.png)    | [手机](390-missing-fields.png)    |
| 长标题与原文地址      | [桌面](1440-long-result.png)       | [手机](390-long-result.png)       |
| 20 条展示与总量区分   | [桌面](1440-twenty-results.png)    | [手机](390-twenty-results.png)    |
| 完整时间轴            | [桌面](1440-timeline.png)          | [手机](390-timeline.png)          |
| 真实空结果            | [桌面](1440-empty.png)             | [手机](390-empty.png)             |
| 来源明确受阻          | [桌面](1440-blocked.png)           | [手机](390-blocked.png)           |
| 任务失败              | [桌面](1440-failed.png)            | [手机](390-failed.png)            |
| 旅程超时但任务仍运行  | [桌面](1440-deadline-running.png)  | [手机](390-deadline-running.png)  |
| 尚无已评估机会        | [桌面](1440-adoption-pending.png)  | [手机](390-adoption-pending.png)  |
| 五门通过待采纳        | [桌面](1440-adopt-ready.png)       | [手机](390-adopt-ready.png)       |
| 评分质量门未通过      | [桌面](1440-gate-score.png)        | [手机](390-gate-score.png)        |
| 市场质量门未通过      | [桌面](1440-gate-market.png)       | [手机](390-gate-market.png)       |
| 竞争质量门未通过      | [桌面](1440-gate-competition.png)  | [手机](390-gate-competition.png)  |
| 成本质量门未通过      | [桌面](1440-gate-cost.png)         | [手机](390-gate-cost.png)         |
| 风险质量门未通过      | [桌面](1440-gate-risk.png)         | [手机](390-gate-risk.png)         |
| 采纳提交中            | [桌面](1440-adopt-busy.png)        | [手机](390-adopt-busy.png)        |
| 提交时质量门变化      | [桌面](1440-adopt-conflict.png)    | [手机](390-adopt-conflict.png)    |
| 冲突刷新后的新状态    | [桌面](1440-adopt-refreshed.png)   | [手机](390-adopt-refreshed.png)   |
| 采纳成功与验证任务    | [桌面](1440-adopt-decided.png)     | [手机](390-adopt-decided.png)     |
| 观察原因已填          | [桌面](1440-observe-edited.png)    | [手机](390-observe-edited.png)    |
| 观察提交中            | [桌面](1440-observe-busy.png)      | [手机](390-observe-busy.png)      |
| 观察失败保留          | [桌面](1440-observe-failed.png)    | [手机](390-observe-failed.png)    |
| 观察决定返回          | [桌面](1440-observe-decided.png)   | [手机](390-observe-decided.png)   |
| 驳回原因已填          | [桌面](1440-reject-edited.png)     | [手机](390-reject-edited.png)     |
| 驳回提交中            | [桌面](1440-reject-busy.png)       | [手机](390-reject-busy.png)       |
| 驳回失败保留          | [桌面](1440-reject-failed.png)     | [手机](390-reject-failed.png)     |
| 驳回决定返回          | [桌面](1440-reject-decided.png)    | [手机](390-reject-decided.png)    |
| 决定已存但无关联 ID   | [桌面](1440-decided-no-links.png)  | [手机](390-decided-no-links.png)  |
| 开始下一次的空草稿    | [桌面](1440-next-input.png)        | [手机](390-next-input.png)        |

## 代表控件状态（待审核）

[按动作审核与不适用边界](../../P16-CONTROL-STATE-REVIEW.md)。链接仅四态，不伪造禁用或提交中；恢复及重置的忙碌场景与后端任务状态不同。

| 控件/状态                  | 桌面                                         | 手机                                        |
| -------------------------- | -------------------------------------------- | ------------------------------------------- |
| 创建提交 / 默认            | [桌面](1440-control-create-default.png)      | [手机](390-control-create-default.png)      |
| 创建提交 / 悬停            | [桌面](1440-control-create-hover.png)        | [手机](390-control-create-hover.png)        |
| 创建提交 / 键盘焦点        | [桌面](1440-control-create-focus.png)        | [手机](390-control-create-focus.png)        |
| 创建提交 / 按下            | [桌面](1440-control-create-pressed.png)      | [手机](390-control-create-pressed.png)      |
| 创建提交 / 禁用            | [桌面](1440-control-create-disabled.png)     | [手机](390-control-create-disabled.png)     |
| 创建提交 / 提交/读取中     | [桌面](1440-control-create-busy.png)         | [手机](390-control-create-busy.png)         |
| 采纳单选 / 默认            | [桌面](1440-control-adopt-default.png)       | [手机](390-control-adopt-default.png)       |
| 采纳单选 / 悬停            | [桌面](1440-control-adopt-hover.png)         | [手机](390-control-adopt-hover.png)         |
| 采纳单选 / 键盘焦点        | [桌面](1440-control-adopt-focus.png)         | [手机](390-control-adopt-focus.png)         |
| 采纳单选 / 按下            | [桌面](1440-control-adopt-pressed.png)       | [手机](390-control-adopt-pressed.png)       |
| 采纳单选 / 禁用            | [桌面](1440-control-adopt-disabled.png)      | [手机](390-control-adopt-disabled.png)      |
| 采纳单选 / 提交/读取中     | [桌面](1440-control-adopt-busy.png)          | [手机](390-control-adopt-busy.png)          |
| 保存提交 / 默认            | [桌面](1440-control-save-default.png)        | [手机](390-control-save-default.png)        |
| 保存提交 / 悬停            | [桌面](1440-control-save-hover.png)          | [手机](390-control-save-hover.png)          |
| 保存提交 / 键盘焦点        | [桌面](1440-control-save-focus.png)          | [手机](390-control-save-focus.png)          |
| 保存提交 / 按下            | [桌面](1440-control-save-pressed.png)        | [手机](390-control-save-pressed.png)        |
| 保存提交 / 禁用            | [桌面](1440-control-save-disabled.png)       | [手机](390-control-save-disabled.png)       |
| 保存提交 / 提交/读取中     | [桌面](1440-control-save-busy.png)           | [手机](390-control-save-busy.png)           |
| 返回列表 / 默认            | [桌面](1440-control-list-default.png)        | [手机](390-control-list-default.png)        |
| 返回列表 / 悬停            | [桌面](1440-control-list-hover.png)          | [手机](390-control-list-hover.png)          |
| 返回列表 / 键盘焦点        | [桌面](1440-control-list-focus.png)          | [手机](390-control-list-focus.png)          |
| 返回列表 / 按下            | [桌面](1440-control-list-pressed.png)        | [手机](390-control-list-pressed.png)        |
| 来源原文 / 默认            | [桌面](1440-control-source-default.png)      | [手机](390-control-source-default.png)      |
| 来源原文 / 悬停            | [桌面](1440-control-source-hover.png)        | [手机](390-control-source-hover.png)        |
| 来源原文 / 键盘焦点        | [桌面](1440-control-source-focus.png)        | [手机](390-control-source-focus.png)        |
| 来源原文 / 按下            | [桌面](1440-control-source-pressed.png)      | [手机](390-control-source-pressed.png)      |
| 查看机会 / 默认            | [桌面](1440-control-opportunity-default.png) | [手机](390-control-opportunity-default.png) |
| 查看机会 / 悬停            | [桌面](1440-control-opportunity-hover.png)   | [手机](390-control-opportunity-hover.png)   |
| 查看机会 / 键盘焦点        | [桌面](1440-control-opportunity-focus.png)   | [手机](390-control-opportunity-focus.png)   |
| 查看机会 / 按下            | [桌面](1440-control-opportunity-pressed.png) | [手机](390-control-opportunity-pressed.png) |
| 打开任务 / 默认            | [桌面](1440-control-task-default.png)        | [手机](390-control-task-default.png)        |
| 打开任务 / 悬停            | [桌面](1440-control-task-hover.png)          | [手机](390-control-task-hover.png)          |
| 打开任务 / 键盘焦点        | [桌面](1440-control-task-focus.png)          | [手机](390-control-task-focus.png)          |
| 打开任务 / 按下            | [桌面](1440-control-task-pressed.png)        | [手机](390-control-task-pressed.png)        |
| 重试读取 / 默认            | [桌面](1440-control-retry-default.png)       | [手机](390-control-retry-default.png)       |
| 重试读取 / 悬停            | [桌面](1440-control-retry-hover.png)         | [手机](390-control-retry-hover.png)         |
| 重试读取 / 键盘焦点        | [桌面](1440-control-retry-focus.png)         | [手机](390-control-retry-focus.png)         |
| 重试读取 / 按下            | [桌面](1440-control-retry-pressed.png)       | [手机](390-control-retry-pressed.png)       |
| 重试读取 / 禁用            | [桌面](1440-control-retry-disabled.png)      | [手机](390-control-retry-disabled.png)      |
| 重试读取 / 读取/提交期间   | [桌面](1440-control-retry-busy.png)          | [手机](390-control-retry-busy.png)          |
| 开始下一次 / 默认          | [桌面](1440-control-reset-default.png)       | [手机](390-control-reset-default.png)       |
| 开始下一次 / 悬停          | [桌面](1440-control-reset-hover.png)         | [手机](390-control-reset-hover.png)         |
| 开始下一次 / 键盘焦点      | [桌面](1440-control-reset-focus.png)         | [手机](390-control-reset-focus.png)         |
| 开始下一次 / 按下          | [桌面](1440-control-reset-pressed.png)       | [手机](390-control-reset-pressed.png)       |
| 开始下一次 / 禁用          | [桌面](1440-control-reset-disabled.png)      | [手机](390-control-reset-disabled.png)      |
| 开始下一次 / 读取/提交期间 | [桌面](1440-control-reset-busy.png)          | [手机](390-control-reset-busy.png)          |
| 权限说明副按钮 / 默认      | [桌面](1440-control-secondary-default.png)   | [手机](390-control-secondary-default.png)   |
| 权限说明副按钮 / 悬停      | [桌面](1440-control-secondary-hover.png)     | [手机](390-control-secondary-hover.png)     |
| 权限说明副按钮 / 键盘焦点  | [桌面](1440-control-secondary-focus.png)     | [手机](390-control-secondary-focus.png)     |
| 权限说明副按钮 / 按下      | [桌面](1440-control-secondary-pressed.png)   | [手机](390-control-secondary-pressed.png)   |

## 输入与选择补充图（待审核）

| 整页错误或忙碌场景 | 桌面                              | 手机                             |
| ------------------ | --------------------------------- | -------------------------------- |
| 关键词必填错误     | [桌面](1440-keyword-required.png) | [手机](390-keyword-required.png) |
| ASIN格式错误       | [桌面](1440-asin-invalid.png)     | [手机](390-asin-invalid.png)     |
| 链接格式错误       | [桌面](1440-url-invalid.png)      | [手机](390-url-invalid.png)      |
| 原因必填错误       | [桌面](1440-reason-required.png)  | [手机](390-reason-required.png)  |
| ASIN恢复中         | [桌面](1440-asin-restoring.png)   | [手机](390-asin-restoring.png)   |
| 链接恢复中         | [桌面](1440-url-restoring.png)    | [手机](390-url-restoring.png)    |
| ASIN提交中         | [桌面](1440-asin-create-busy.png) | [手机](390-asin-create-busy.png) |
| 链接提交中         | [桌面](1440-url-create-busy.png)  | [手机](390-url-create-busy.png)  |

| 控件/状态                  | 桌面                                            | 手机                                           |
| -------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| 输入类型 / 默认            | [桌面](1440-control-kind-default.png)           | [手机](390-control-kind-default.png)           |
| 输入类型 / 悬停            | [桌面](1440-control-kind-hover.png)             | [手机](390-control-kind-hover.png)             |
| 输入类型 / 键盘焦点        | [桌面](1440-control-kind-focus.png)             | [手机](390-control-kind-focus.png)             |
| 输入类型 / 按下            | [桌面](1440-control-kind-pressed.png)           | [手机](390-control-kind-pressed.png)           |
| 输入类型 / 禁用            | [桌面](1440-control-kind-disabled.png)          | [手机](390-control-kind-disabled.png)          |
| 输入类型 / 恢复/提交期间   | [桌面](1440-control-kind-busy.png)              | [手机](390-control-kind-busy.png)              |
| 候选选择 / 默认            | [桌面](1440-control-candidate-default.png)      | [手机](390-control-candidate-default.png)      |
| 候选选择 / 悬停            | [桌面](1440-control-candidate-hover.png)        | [手机](390-control-candidate-hover.png)        |
| 候选选择 / 键盘焦点        | [桌面](1440-control-candidate-focus.png)        | [手机](390-control-candidate-focus.png)        |
| 候选选择 / 按下            | [桌面](1440-control-candidate-pressed.png)      | [手机](390-control-candidate-pressed.png)      |
| 候选选择 / 禁用            | [桌面](1440-control-candidate-disabled.png)     | [手机](390-control-candidate-disabled.png)     |
| 候选选择 / 恢复/提交期间   | [桌面](1440-control-candidate-busy.png)         | [手机](390-control-candidate-busy.png)         |
| 继续观察 / 默认            | [桌面](1440-control-observe-default.png)        | [手机](390-control-observe-default.png)        |
| 继续观察 / 悬停            | [桌面](1440-control-observe-hover.png)          | [手机](390-control-observe-hover.png)          |
| 继续观察 / 键盘焦点        | [桌面](1440-control-observe-focus.png)          | [手机](390-control-observe-focus.png)          |
| 继续观察 / 按下            | [桌面](1440-control-observe-pressed.png)        | [手机](390-control-observe-pressed.png)        |
| 继续观察 / 禁用            | [桌面](1440-control-observe-disabled.png)       | [手机](390-control-observe-disabled.png)       |
| 继续观察 / 恢复/提交期间   | [桌面](1440-control-observe-busy.png)           | [手机](390-control-observe-busy.png)           |
| 驳回 / 默认                | [桌面](1440-control-reject-default.png)         | [手机](390-control-reject-default.png)         |
| 驳回 / 悬停                | [桌面](1440-control-reject-hover.png)           | [手机](390-control-reject-hover.png)           |
| 驳回 / 键盘焦点            | [桌面](1440-control-reject-focus.png)           | [手机](390-control-reject-focus.png)           |
| 驳回 / 按下                | [桌面](1440-control-reject-pressed.png)         | [手机](390-control-reject-pressed.png)         |
| 驳回 / 禁用                | [桌面](1440-control-reject-disabled.png)        | [手机](390-control-reject-disabled.png)        |
| 驳回 / 恢复/提交期间       | [桌面](1440-control-reject-busy.png)            | [手机](390-control-reject-busy.png)            |
| 关键词输入 / 默认          | [桌面](1440-control-keyword-value-default.png)  | [手机](390-control-keyword-value-default.png)  |
| 关键词输入 / 悬停          | [桌面](1440-control-keyword-value-hover.png)    | [手机](390-control-keyword-value-hover.png)    |
| 关键词输入 / 键盘焦点      | [桌面](1440-control-keyword-value-focus.png)    | [手机](390-control-keyword-value-focus.png)    |
| 关键词输入 / 按下          | [桌面](1440-control-keyword-value-pressed.png)  | [手机](390-control-keyword-value-pressed.png)  |
| 关键词输入 / 禁用          | [桌面](1440-control-keyword-value-disabled.png) | [手机](390-control-keyword-value-disabled.png) |
| 关键词输入 / 恢复/提交期间 | [桌面](1440-control-keyword-value-busy.png)     | [手机](390-control-keyword-value-busy.png)     |
| 关键词输入 / 字段错误      | [桌面](1440-control-keyword-value-invalid.png)  | [手机](390-control-keyword-value-invalid.png)  |
| ASIN输入 / 默认            | [桌面](1440-control-asin-value-default.png)     | [手机](390-control-asin-value-default.png)     |
| ASIN输入 / 悬停            | [桌面](1440-control-asin-value-hover.png)       | [手机](390-control-asin-value-hover.png)       |
| ASIN输入 / 键盘焦点        | [桌面](1440-control-asin-value-focus.png)       | [手机](390-control-asin-value-focus.png)       |
| ASIN输入 / 按下            | [桌面](1440-control-asin-value-pressed.png)     | [手机](390-control-asin-value-pressed.png)     |
| ASIN输入 / 禁用            | [桌面](1440-control-asin-value-disabled.png)    | [手机](390-control-asin-value-disabled.png)    |
| ASIN输入 / 恢复/提交期间   | [桌面](1440-control-asin-value-busy.png)        | [手机](390-control-asin-value-busy.png)        |
| ASIN输入 / 字段错误        | [桌面](1440-control-asin-value-invalid.png)     | [手机](390-control-asin-value-invalid.png)     |
| 链接输入 / 默认            | [桌面](1440-control-url-value-default.png)      | [手机](390-control-url-value-default.png)      |
| 链接输入 / 悬停            | [桌面](1440-control-url-value-hover.png)        | [手机](390-control-url-value-hover.png)        |
| 链接输入 / 键盘焦点        | [桌面](1440-control-url-value-focus.png)        | [手机](390-control-url-value-focus.png)        |
| 链接输入 / 按下            | [桌面](1440-control-url-value-pressed.png)      | [手机](390-control-url-value-pressed.png)      |
| 链接输入 / 禁用            | [桌面](1440-control-url-value-disabled.png)     | [手机](390-control-url-value-disabled.png)     |
| 链接输入 / 恢复/提交期间   | [桌面](1440-control-url-value-busy.png)         | [手机](390-control-url-value-busy.png)         |
| 链接输入 / 字段错误        | [桌面](1440-control-url-value-invalid.png)      | [手机](390-control-url-value-invalid.png)      |
| 决策原因 / 默认            | [桌面](1440-control-reason-default.png)         | [手机](390-control-reason-default.png)         |
| 决策原因 / 悬停            | [桌面](1440-control-reason-hover.png)           | [手机](390-control-reason-hover.png)           |
| 决策原因 / 键盘焦点        | [桌面](1440-control-reason-focus.png)           | [手机](390-control-reason-focus.png)           |
| 决策原因 / 按下            | [桌面](1440-control-reason-pressed.png)         | [手机](390-control-reason-pressed.png)         |
| 决策原因 / 禁用            | [桌面](1440-control-reason-disabled.png)        | [手机](390-control-reason-disabled.png)        |
| 决策原因 / 恢复/提交期间   | [桌面](1440-control-reason-busy.png)            | [手机](390-control-reason-busy.png)            |
| 决策原因 / 字段错误        | [桌面](1440-control-reason-invalid.png)         | [手机](390-control-reason-invalid.png)         |

## 外观与放大补充图（待审核）

以下48个案例中8张默认标准图复用前表原图，新增40张，不重复计数。

| 主题/密度/阶段             | 桌面                                                              | 手机                                                             |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 目录蓝 / 标准 / 线索已填   | [桌面](1440-keyword-edited.png)                                   | [手机](390-keyword-edited.png)                                   |
| 目录蓝 / 标准 / 合格待采纳 | [桌面](1440-adopt-ready.png)                                      | [手机](390-adopt-ready.png)                                      |
| 目录蓝 / 标准 / 提交后冲突 | [桌面](1440-adopt-conflict.png)                                   | [手机](390-adopt-conflict.png)                                   |
| 目录蓝 / 标准 / 采纳成功   | [桌面](1440-adopt-decided.png)                                    | [手机](390-adopt-decided.png)                                    |
| 目录蓝 / 紧凑 / 线索已填   | [桌面](1440-appearance-deep-ocean-compact-keyword-edited.png)     | [手机](390-appearance-deep-ocean-compact-keyword-edited.png)     |
| 目录蓝 / 紧凑 / 合格待采纳 | [桌面](1440-appearance-deep-ocean-compact-adopt-ready.png)        | [手机](390-appearance-deep-ocean-compact-adopt-ready.png)        |
| 目录蓝 / 紧凑 / 提交后冲突 | [桌面](1440-appearance-deep-ocean-compact-adopt-conflict.png)     | [手机](390-appearance-deep-ocean-compact-adopt-conflict.png)     |
| 目录蓝 / 紧凑 / 采纳成功   | [桌面](1440-appearance-deep-ocean-compact-adopt-decided.png)      | [手机](390-appearance-deep-ocean-compact-adopt-decided.png)      |
| 冷雾蓝 / 标准 / 线索已填   | [桌面](1440-appearance-aurora-purple-standard-keyword-edited.png) | [手机](390-appearance-aurora-purple-standard-keyword-edited.png) |
| 冷雾蓝 / 标准 / 合格待采纳 | [桌面](1440-appearance-aurora-purple-standard-adopt-ready.png)    | [手机](390-appearance-aurora-purple-standard-adopt-ready.png)    |
| 冷雾蓝 / 标准 / 提交后冲突 | [桌面](1440-appearance-aurora-purple-standard-adopt-conflict.png) | [手机](390-appearance-aurora-purple-standard-adopt-conflict.png) |
| 冷雾蓝 / 标准 / 采纳成功   | [桌面](1440-appearance-aurora-purple-standard-adopt-decided.png)  | [手机](390-appearance-aurora-purple-standard-adopt-decided.png)  |
| 冷雾蓝 / 紧凑 / 线索已填   | [桌面](1440-appearance-aurora-purple-compact-keyword-edited.png)  | [手机](390-appearance-aurora-purple-compact-keyword-edited.png)  |
| 冷雾蓝 / 紧凑 / 合格待采纳 | [桌面](1440-appearance-aurora-purple-compact-adopt-ready.png)     | [手机](390-appearance-aurora-purple-compact-adopt-ready.png)     |
| 冷雾蓝 / 紧凑 / 提交后冲突 | [桌面](1440-appearance-aurora-purple-compact-adopt-conflict.png)  | [手机](390-appearance-aurora-purple-compact-adopt-conflict.png)  |
| 冷雾蓝 / 紧凑 / 采纳成功   | [桌面](1440-appearance-aurora-purple-compact-adopt-decided.png)   | [手机](390-appearance-aurora-purple-compact-adopt-decided.png)   |
| 净页白 / 标准 / 线索已填   | [桌面](1440-appearance-cloud-white-standard-keyword-edited.png)   | [手机](390-appearance-cloud-white-standard-keyword-edited.png)   |
| 净页白 / 标准 / 合格待采纳 | [桌面](1440-appearance-cloud-white-standard-adopt-ready.png)      | [手机](390-appearance-cloud-white-standard-adopt-ready.png)      |
| 净页白 / 标准 / 提交后冲突 | [桌面](1440-appearance-cloud-white-standard-adopt-conflict.png)   | [手机](390-appearance-cloud-white-standard-adopt-conflict.png)   |
| 净页白 / 标准 / 采纳成功   | [桌面](1440-appearance-cloud-white-standard-adopt-decided.png)    | [手机](390-appearance-cloud-white-standard-adopt-decided.png)    |
| 净页白 / 紧凑 / 线索已填   | [桌面](1440-appearance-cloud-white-compact-keyword-edited.png)    | [手机](390-appearance-cloud-white-compact-keyword-edited.png)    |
| 净页白 / 紧凑 / 合格待采纳 | [桌面](1440-appearance-cloud-white-compact-adopt-ready.png)       | [手机](390-appearance-cloud-white-compact-adopt-ready.png)       |
| 净页白 / 紧凑 / 提交后冲突 | [桌面](1440-appearance-cloud-white-compact-adopt-conflict.png)    | [手机](390-appearance-cloud-white-compact-adopt-conflict.png)    |
| 净页白 / 紧凑 / 采纳成功   | [桌面](1440-appearance-cloud-white-compact-adopt-decided.png)     | [手机](390-appearance-cloud-white-compact-adopt-decided.png)     |

| 200% CSS放大（非原生浏览器缩放） | 桌面                                 | 手机                                |
| -------------------------------- | ------------------------------------ | ----------------------------------- |
| 长标题与来源                     | [桌面](1440-zoom-2-long-result.png)  | [手机](390-zoom-2-long-result.png)  |
| ASIN错误反馈                     | [桌面](1440-zoom-2-asin-invalid.png) | [手机](390-zoom-2-asin-invalid.png) |

## 验证与交接

最小验证：`node scripts/verify-ui-phase2-journey-c.mjs --smoke`。完整只读复验不带参数；`--capture`重拍全部图并登记当前源/图片哈希，旧r1可从Git历史追溯。本批检查源码提取、DOM布局溢出、最小字号触区、各场景及十八类代表控件状态，HTTP=0、真实storage=0，浏览器finally关闭。

本轮只更新审核原型、验证脚本和文档，未改生产Vue/API/OpenAPI/数据库/权限/环境/依赖，不部署、不重启。382PNG为永久交付，无临时图片遗留。48外观案例、18断点及4 CSS放大案例仅代表性验证；全部主题状态、真实可访问性、Vue生命周期和生产签收仍待完成，整体布局批准不提升全页或全站完成门。
