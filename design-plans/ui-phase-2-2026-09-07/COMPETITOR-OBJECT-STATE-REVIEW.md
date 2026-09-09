# P19 · 对象操作与验证任务状态审核

2026-09-09 · CP-OBJECT-r1 · 起始Git 1bd2eb22。沿C方向的离线待审稿；不改生产，也不是新增业务能力或页面批准。

## 这批设计的重点

- 对象卡片的已选择标记与悬停区分：选择保留左侧蓝色标记，悬停加浅蓝反馈；键盘选择仍读取对应竞品，不把查看对象当写入。
- 更多菜单明确分隔启停与删除；暂停和恢复分别出图。打开删除确认不发送DELETE，真正删除仍须原因与版本确认。
- 价格、评论验证任务分别绑定各自变化与证据。提交中不展示“已建任务”链接，只有样本返回ID后才显示打开任务。
- 详情内写入共享禁用条件，但旋转标记只属于本次捕获的对象与动作。页面提示明确对象名称；切到另一个对象时只显示禁写，不把它标成正在提交。仅验证离线A→B→A归属，不声称完整并发/终态/Vue通过。
- 更多与帮助保留原生details/summary的Enter、Space开合；对象查看与开合没有人为补造的disabled/busy图，这些槽尚未标完成，不制造“全部六态”的假象。

## 逐控件状态图

截图保留按钮所在视口上下文，移动长页会滚动到目标；不是全页面、所有主题或真实软键盘验收。

### 桌面1440

| 控件 | 默认 | 悬停 | 焦点 | 按下 | 禁用 | 忙碌 |
| --- | --- | --- | --- | --- | --- | --- |
| 对象卡片 · 未选中 | [查看](design/competitor-direction-c/1440-control-detail-default.png) | [查看](design/competitor-direction-c/1440-control-detail-hover.png) | [查看](design/competitor-direction-c/1440-control-detail-focus.png) | [查看](design/competitor-direction-c/1440-control-detail-pressed.png) | 本批不制图 | 本批不制图 |
| 对象卡片 · 已选中 | [查看](design/competitor-direction-c/1440-control-detail-selected-default.png) | [查看](design/competitor-direction-c/1440-control-detail-selected-hover.png) | [查看](design/competitor-direction-c/1440-control-detail-selected-focus.png) | [查看](design/competitor-direction-c/1440-control-detail-selected-pressed.png) | 本批不制图 | 本批不制图 |
| 暂停监控 | [查看](design/competitor-direction-c/1440-control-toggle-default.png) | [查看](design/competitor-direction-c/1440-control-toggle-hover.png) | [查看](design/competitor-direction-c/1440-control-toggle-focus.png) | [查看](design/competitor-direction-c/1440-control-toggle-pressed.png) | [查看](design/competitor-direction-c/1440-control-toggle-disabled.png) | [查看](design/competitor-direction-c/1440-control-toggle-busy.png) |
| 恢复监控 | [查看](design/competitor-direction-c/1440-control-resume-default.png) | [查看](design/competitor-direction-c/1440-control-resume-hover.png) | [查看](design/competitor-direction-c/1440-control-resume-focus.png) | [查看](design/competitor-direction-c/1440-control-resume-pressed.png) | [查看](design/competitor-direction-c/1440-control-resume-disabled.png) | [查看](design/competitor-direction-c/1440-control-resume-busy.png) |
| 打开删除确认 | [查看](design/competitor-direction-c/1440-control-delete-open-default.png) | [查看](design/competitor-direction-c/1440-control-delete-open-hover.png) | [查看](design/competitor-direction-c/1440-control-delete-open-focus.png) | [查看](design/competitor-direction-c/1440-control-delete-open-pressed.png) | [查看](design/competitor-direction-c/1440-control-delete-open-disabled.png) | [查看](design/competitor-direction-c/1440-control-delete-open-busy.png) |
| 生成价格验证任务 | [查看](design/competitor-direction-c/1440-control-task-create-default.png) | [查看](design/competitor-direction-c/1440-control-task-create-hover.png) | [查看](design/competitor-direction-c/1440-control-task-create-focus.png) | [查看](design/competitor-direction-c/1440-control-task-create-pressed.png) | [查看](design/competitor-direction-c/1440-control-task-create-disabled.png) | [查看](design/competitor-direction-c/1440-control-task-create-busy.png) |
| 生成评论验证任务 | [查看](design/competitor-direction-c/1440-control-task-review-default.png) | [查看](design/competitor-direction-c/1440-control-task-review-hover.png) | [查看](design/competitor-direction-c/1440-control-task-review-focus.png) | [查看](design/competitor-direction-c/1440-control-task-review-pressed.png) | [查看](design/competitor-direction-c/1440-control-task-review-disabled.png) | [查看](design/competitor-direction-c/1440-control-task-review-busy.png) |
| 更多操作 · 收起 | [查看](design/competitor-direction-c/1440-control-more-default.png) | [查看](design/competitor-direction-c/1440-control-more-hover.png) | [查看](design/competitor-direction-c/1440-control-more-focus.png) | [查看](design/competitor-direction-c/1440-control-more-pressed.png) | 本批不制图 | 本批不制图 |
| 更多操作 · 展开 | [查看](design/competitor-direction-c/1440-control-more-expanded-default.png) | [查看](design/competitor-direction-c/1440-control-more-expanded-hover.png) | [查看](design/competitor-direction-c/1440-control-more-expanded-focus.png) | [查看](design/competitor-direction-c/1440-control-more-expanded-pressed.png) | 本批不制图 | 本批不制图 |
| 帮助 · 收起 | [查看](design/competitor-direction-c/1440-control-help-default.png) | [查看](design/competitor-direction-c/1440-control-help-hover.png) | [查看](design/competitor-direction-c/1440-control-help-focus.png) | [查看](design/competitor-direction-c/1440-control-help-pressed.png) | 本批不制图 | 本批不制图 |
| 帮助 · 展开 | [查看](design/competitor-direction-c/1440-control-help-expanded-default.png) | [查看](design/competitor-direction-c/1440-control-help-expanded-hover.png) | [查看](design/competitor-direction-c/1440-control-help-expanded-focus.png) | [查看](design/competitor-direction-c/1440-control-help-expanded-pressed.png) | 本批不制图 | 本批不制图 |
| 打开已建任务 | [查看](design/competitor-direction-c/1440-control-task-link-default.png) | [查看](design/competitor-direction-c/1440-control-task-link-hover.png) | [查看](design/competitor-direction-c/1440-control-task-link-focus.png) | [查看](design/competitor-direction-c/1440-control-task-link-pressed.png) | 本批不制图 | 本批不制图 |

### 手机390

| 控件 | 默认 | 悬停 | 焦点 | 按下 | 禁用 | 忙碌 |
| --- | --- | --- | --- | --- | --- | --- |
| 对象卡片 · 未选中 | [查看](design/competitor-direction-c/390-control-detail-default.png) | [查看](design/competitor-direction-c/390-control-detail-hover.png) | [查看](design/competitor-direction-c/390-control-detail-focus.png) | [查看](design/competitor-direction-c/390-control-detail-pressed.png) | 本批不制图 | 本批不制图 |
| 对象卡片 · 已选中 | [查看](design/competitor-direction-c/390-control-detail-selected-default.png) | [查看](design/competitor-direction-c/390-control-detail-selected-hover.png) | [查看](design/competitor-direction-c/390-control-detail-selected-focus.png) | [查看](design/competitor-direction-c/390-control-detail-selected-pressed.png) | 本批不制图 | 本批不制图 |
| 暂停监控 | [查看](design/competitor-direction-c/390-control-toggle-default.png) | [查看](design/competitor-direction-c/390-control-toggle-hover.png) | [查看](design/competitor-direction-c/390-control-toggle-focus.png) | [查看](design/competitor-direction-c/390-control-toggle-pressed.png) | [查看](design/competitor-direction-c/390-control-toggle-disabled.png) | [查看](design/competitor-direction-c/390-control-toggle-busy.png) |
| 恢复监控 | [查看](design/competitor-direction-c/390-control-resume-default.png) | [查看](design/competitor-direction-c/390-control-resume-hover.png) | [查看](design/competitor-direction-c/390-control-resume-focus.png) | [查看](design/competitor-direction-c/390-control-resume-pressed.png) | [查看](design/competitor-direction-c/390-control-resume-disabled.png) | [查看](design/competitor-direction-c/390-control-resume-busy.png) |
| 打开删除确认 | [查看](design/competitor-direction-c/390-control-delete-open-default.png) | [查看](design/competitor-direction-c/390-control-delete-open-hover.png) | [查看](design/competitor-direction-c/390-control-delete-open-focus.png) | [查看](design/competitor-direction-c/390-control-delete-open-pressed.png) | [查看](design/competitor-direction-c/390-control-delete-open-disabled.png) | [查看](design/competitor-direction-c/390-control-delete-open-busy.png) |
| 生成价格验证任务 | [查看](design/competitor-direction-c/390-control-task-create-default.png) | [查看](design/competitor-direction-c/390-control-task-create-hover.png) | [查看](design/competitor-direction-c/390-control-task-create-focus.png) | [查看](design/competitor-direction-c/390-control-task-create-pressed.png) | [查看](design/competitor-direction-c/390-control-task-create-disabled.png) | [查看](design/competitor-direction-c/390-control-task-create-busy.png) |
| 生成评论验证任务 | [查看](design/competitor-direction-c/390-control-task-review-default.png) | [查看](design/competitor-direction-c/390-control-task-review-hover.png) | [查看](design/competitor-direction-c/390-control-task-review-focus.png) | [查看](design/competitor-direction-c/390-control-task-review-pressed.png) | [查看](design/competitor-direction-c/390-control-task-review-disabled.png) | [查看](design/competitor-direction-c/390-control-task-review-busy.png) |
| 更多操作 · 收起 | [查看](design/competitor-direction-c/390-control-more-default.png) | [查看](design/competitor-direction-c/390-control-more-hover.png) | [查看](design/competitor-direction-c/390-control-more-focus.png) | [查看](design/competitor-direction-c/390-control-more-pressed.png) | 本批不制图 | 本批不制图 |
| 更多操作 · 展开 | [查看](design/competitor-direction-c/390-control-more-expanded-default.png) | [查看](design/competitor-direction-c/390-control-more-expanded-hover.png) | [查看](design/competitor-direction-c/390-control-more-expanded-focus.png) | [查看](design/competitor-direction-c/390-control-more-expanded-pressed.png) | 本批不制图 | 本批不制图 |
| 帮助 · 收起 | [查看](design/competitor-direction-c/390-control-help-default.png) | [查看](design/competitor-direction-c/390-control-help-hover.png) | [查看](design/competitor-direction-c/390-control-help-focus.png) | [查看](design/competitor-direction-c/390-control-help-pressed.png) | 本批不制图 | 本批不制图 |
| 帮助 · 展开 | [查看](design/competitor-direction-c/390-control-help-expanded-default.png) | [查看](design/competitor-direction-c/390-control-help-expanded-hover.png) | [查看](design/competitor-direction-c/390-control-help-expanded-focus.png) | [查看](design/competitor-direction-c/390-control-help-expanded-pressed.png) | 本批不制图 | 本批不制图 |
| 打开已建任务 | [查看](design/competitor-direction-c/390-control-task-link-default.png) | [查看](design/competitor-direction-c/390-control-task-link-hover.png) | [查看](design/competitor-direction-c/390-control-task-link-focus.png) | [查看](design/competitor-direction-c/390-control-task-link-pressed.png) | 本批不制图 | 本批不制图 |

## 新增整页场景

| 场景 | 桌面 | 手机 |
| --- | --- | --- |
| 暂停请求在途 | [查看](design/competitor-direction-c/1440-toggle-busy.png) | [查看](design/competitor-direction-c/390-toggle-busy.png) |
| 恢复请求在途 | [查看](design/competitor-direction-c/1440-resume-busy.png) | [查看](design/competitor-direction-c/390-resume-busy.png) |
| 价格任务在途 | [查看](design/competitor-direction-c/1440-task-busy.png) | [查看](design/competitor-direction-c/390-task-busy.png) |
| 评论任务在途 | [查看](design/competitor-direction-c/1440-review-task-busy.png) | [查看](design/competitor-direction-c/390-review-task-busy.png) |
| 价格任务已返回ID | [查看](design/competitor-direction-c/1440-task-created.png) | [查看](design/competitor-direction-c/390-task-created.png) |

## 覆盖与缺口

新增12变体58状态×双端＝116图，加5整页场景双端10图，共126新PNG。本包从270增至396PNG；现53整页场景、27代表控件变体138状态/276双端实例。7个语义组新增34代表槽；已选中、恢复、评论任务及展开状态作为5个额外变体，不重复算业务动作。

P19尚余24代表槽，P20仍30，共54。全站仍21页同级语义核对、52页待继续；不按PNG数冻结分母或宣布完整页面通过。源码候选不变；初始场景动作标记从25变26只是原有任务链接现在有独立场景，不是新业务动作。

桌面也使用“更多”菜单是C提案，与源桌面直接展示不同；没有擅改生产。顶部创建、弹窗间并发写入、真实异步成功/失败/迟到结果、采集在途切换对象的全部新稿状态、历史/KeepAlive/scope与RBAC、字段/主题密度/长文仍待。不能用此处任务pending模型抵扣真实幂等或后台任务完成。

## 验证记录

真实源码核对包括detail逐行GET、启停status/expected_revision、删除入口无写入、task:create独立权限与任务payload、原生更多/帮助。UI Skills用于C方向反馈层级，既有Playwright依赖用于真实DOM截图，未安装新依赖。

最小smoke首次发现离线对象卡片没有显式type，委托事件把默认submit类型过滤，Enter未产生GET。仅原型补type=button后通过；真实Vue直接绑定事件，不据此认定Vue同样失效。随后核对恢复禁用图仍须保持暂停对象，改为resume-busy背景并加入状态断言，复跑smoke通过。

完整捕获396图通过：双端276控件实例、原场景交互、12屏宽×5代表场景；HTTP/页面错误0，文字对比最低5.33419。新增检查覆盖对象Enter读取、summary Enter/Space、删除入口零写入、启停精确status/revision、任务四字段/对应证据、详情共享禁写与捕获对象A→B→A标记，不产生第二次POST；ID未返回不生成任务链接。

只目检390-toggle-busy与1440-detail-hover；未宣称396图全部人工检查。上轮待审390-control-collect-busy与1440-control-delete-focus通过Git字节对比确认不变。

## 使用与交付

[全部图册](design/competitor-direction-c/gallery.html) · [交互原型](design/competitor-direction-c/index.html) · [主按钮审核](COMPETITOR-CONTROL-STATE-REVIEW.md) · [次级操作审核](COMPETITOR-SECONDARY-STATE-REVIEW.md)

最小验证：`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`；完整只读验证不带参数；有意重画本包使用`--capture`。动作与变体关联由`node scripts/audit-ui-phase2-action-coverage.mjs`核对。样本outcome=pending仅用于停留在途状态，切换审核场景可重置，不设业务超时、不调用实际API。

未改生产Vue/CSS、后端/Worker/Python、API/OpenAPI、数据库、权限、安全、配置、依赖或部署；无运行参数或重启要求。新增图/脚本/文档都是永久交付，无新临时产物、服务，浏览器finally关闭；此前清理被拒目录仍见[进度](PROGRESS.md)，不绕过。

审核请注明“控件/状态/桌面或手机/通过或修改意见”；不重复申请前轮两张图，不扩展其批准范围。
