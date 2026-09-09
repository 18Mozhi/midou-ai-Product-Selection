# P19/P20 · 次级操作与导航状态审核

后续[P19对象操作](COMPETITOR-OBJECT-STATE-REVIEW.md)已新增126图，竞品包396图、剩54代表槽；本文件112图与次级操作审核范围不变，以下270/88为本批初始数量。

2026-09-09 · CP-SECONDARY-r1 · C方向离线待审提案。起始Git 1fa3104d。用户尚未批准本批；不替换生产Vue。

## 这批解决什么

关闭、取消和上一步的层级与行为要可区分：右上角用于退出弹窗，页脚用于当前步骤的取消或返回；蓝色/红色提交按钮继续保留主次。导航沿C方向采用蓝色范围区中的深蓝悬停底、清晰下划线，以及可见的键盘焦点和按下反馈；来源链接始终明确新窗口。

源与方案差异：真实Vue的关闭/取消/上一步没有busy禁用，离线稿已有“表单提交中锁定”方案。本批只是把它画清楚并验证离线守卫，**没有批准或实施该业务行为变化**。关闭或取消不等于撤回已发送的POST/DELETE。锁定时只有提交按钮显示“正在…”，取消/上一步保持原文并灰化，不把取消伪装为正在提交。

创建页脚取消仅在第一步出现，前两步不POST，因此本批只提供它的四个指针/键盘态；不借第三步不存在的取消按钮生成busy图。三个导航语义的四个入口没有源disabled/请求busy，因此只画四态。

## 逐控件图

每图为目标状态的原生浏览器截图，保留当前视口上下文，不是所有长页面内容或全主题组合。所有样本与请求意图都为离线合成。

### 桌面1440

| 控件 | 默认 | 悬停 | 焦点 | 按下 | 禁用 | 表单忙碌期间 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 创建 · 右上关闭 | [查看](design/competitor-direction-c/1440-control-create-close-default.png) | [查看](design/competitor-direction-c/1440-control-create-close-hover.png) | [查看](design/competitor-direction-c/1440-control-create-close-focus.png) | [查看](design/competitor-direction-c/1440-control-create-close-pressed.png) | [查看](design/competitor-direction-c/1440-control-create-close-disabled.png) | [查看](design/competitor-direction-c/1440-control-create-close-busy.png) |
| P19 创建 · 页脚取消 | [查看](design/competitor-direction-c/1440-control-create-cancel-default.png) | [查看](design/competitor-direction-c/1440-control-create-cancel-hover.png) | [查看](design/competitor-direction-c/1440-control-create-cancel-focus.png) | [查看](design/competitor-direction-c/1440-control-create-cancel-pressed.png) | 本批不制图 | 本批不制图 |
| P19 创建 · 上一步 | [查看](design/competitor-direction-c/1440-control-create-previous-default.png) | [查看](design/competitor-direction-c/1440-control-create-previous-hover.png) | [查看](design/competitor-direction-c/1440-control-create-previous-focus.png) | [查看](design/competitor-direction-c/1440-control-create-previous-pressed.png) | [查看](design/competitor-direction-c/1440-control-create-previous-disabled.png) | [查看](design/competitor-direction-c/1440-control-create-previous-busy.png) |
| P20 规则 · 右上关闭 | [查看](design/competitor-direction-c/1440-control-rule-close-default.png) | [查看](design/competitor-direction-c/1440-control-rule-close-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-close-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-close-pressed.png) | [查看](design/competitor-direction-c/1440-control-rule-close-disabled.png) | [查看](design/competitor-direction-c/1440-control-rule-close-busy.png) |
| P20 规则 · 页脚取消 | [查看](design/competitor-direction-c/1440-control-rule-cancel-default.png) | [查看](design/competitor-direction-c/1440-control-rule-cancel-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-cancel-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-cancel-pressed.png) | [查看](design/competitor-direction-c/1440-control-rule-cancel-disabled.png) | [查看](design/competitor-direction-c/1440-control-rule-cancel-busy.png) |
| P19 删除 · 右上关闭 | [查看](design/competitor-direction-c/1440-control-delete-close-default.png) | [查看](design/competitor-direction-c/1440-control-delete-close-hover.png) | [查看](design/competitor-direction-c/1440-control-delete-close-focus.png) | [查看](design/competitor-direction-c/1440-control-delete-close-pressed.png) | [查看](design/competitor-direction-c/1440-control-delete-close-disabled.png) | [查看](design/competitor-direction-c/1440-control-delete-close-busy.png) |
| P19 删除 · 页脚取消 | [查看](design/competitor-direction-c/1440-control-delete-cancel-default.png) | [查看](design/competitor-direction-c/1440-control-delete-cancel-hover.png) | [查看](design/competitor-direction-c/1440-control-delete-cancel-focus.png) | [查看](design/competitor-direction-c/1440-control-delete-cancel-pressed.png) | [查看](design/competitor-direction-c/1440-control-delete-cancel-disabled.png) | [查看](design/competitor-direction-c/1440-control-delete-cancel-busy.png) |
| P19 范围区 · 监控规则 | [查看](design/competitor-direction-c/1440-control-rule-nav-default.png) | [查看](design/competitor-direction-c/1440-control-rule-nav-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-nav-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-nav-pressed.png) | 本批不制图 | 本批不制图 |
| P19 当前竞品规则 | [查看](design/competitor-direction-c/1440-control-rule-current-default.png) | [查看](design/competitor-direction-c/1440-control-rule-current-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-current-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-current-pressed.png) | 本批不制图 | 本批不制图 |
| P20 返回竞品目录 | [查看](design/competitor-direction-c/1440-control-rule-back-default.png) | [查看](design/competitor-direction-c/1440-control-rule-back-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-back-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-back-pressed.png) | 本批不制图 | 本批不制图 |
| P19 打开来源商品 | [查看](design/competitor-direction-c/1440-control-source-default.png) | [查看](design/competitor-direction-c/1440-control-source-hover.png) | [查看](design/competitor-direction-c/1440-control-source-focus.png) | [查看](design/competitor-direction-c/1440-control-source-pressed.png) | 本批不制图 | 本批不制图 |

### 手机390

| 控件 | 默认 | 悬停 | 焦点 | 按下 | 禁用 | 表单忙碌期间 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 创建 · 右上关闭 | [查看](design/competitor-direction-c/390-control-create-close-default.png) | [查看](design/competitor-direction-c/390-control-create-close-hover.png) | [查看](design/competitor-direction-c/390-control-create-close-focus.png) | [查看](design/competitor-direction-c/390-control-create-close-pressed.png) | [查看](design/competitor-direction-c/390-control-create-close-disabled.png) | [查看](design/competitor-direction-c/390-control-create-close-busy.png) |
| P19 创建 · 页脚取消 | [查看](design/competitor-direction-c/390-control-create-cancel-default.png) | [查看](design/competitor-direction-c/390-control-create-cancel-hover.png) | [查看](design/competitor-direction-c/390-control-create-cancel-focus.png) | [查看](design/competitor-direction-c/390-control-create-cancel-pressed.png) | 本批不制图 | 本批不制图 |
| P19 创建 · 上一步 | [查看](design/competitor-direction-c/390-control-create-previous-default.png) | [查看](design/competitor-direction-c/390-control-create-previous-hover.png) | [查看](design/competitor-direction-c/390-control-create-previous-focus.png) | [查看](design/competitor-direction-c/390-control-create-previous-pressed.png) | [查看](design/competitor-direction-c/390-control-create-previous-disabled.png) | [查看](design/competitor-direction-c/390-control-create-previous-busy.png) |
| P20 规则 · 右上关闭 | [查看](design/competitor-direction-c/390-control-rule-close-default.png) | [查看](design/competitor-direction-c/390-control-rule-close-hover.png) | [查看](design/competitor-direction-c/390-control-rule-close-focus.png) | [查看](design/competitor-direction-c/390-control-rule-close-pressed.png) | [查看](design/competitor-direction-c/390-control-rule-close-disabled.png) | [查看](design/competitor-direction-c/390-control-rule-close-busy.png) |
| P20 规则 · 页脚取消 | [查看](design/competitor-direction-c/390-control-rule-cancel-default.png) | [查看](design/competitor-direction-c/390-control-rule-cancel-hover.png) | [查看](design/competitor-direction-c/390-control-rule-cancel-focus.png) | [查看](design/competitor-direction-c/390-control-rule-cancel-pressed.png) | [查看](design/competitor-direction-c/390-control-rule-cancel-disabled.png) | [查看](design/competitor-direction-c/390-control-rule-cancel-busy.png) |
| P19 删除 · 右上关闭 | [查看](design/competitor-direction-c/390-control-delete-close-default.png) | [查看](design/competitor-direction-c/390-control-delete-close-hover.png) | [查看](design/competitor-direction-c/390-control-delete-close-focus.png) | [查看](design/competitor-direction-c/390-control-delete-close-pressed.png) | [查看](design/competitor-direction-c/390-control-delete-close-disabled.png) | [查看](design/competitor-direction-c/390-control-delete-close-busy.png) |
| P19 删除 · 页脚取消 | [查看](design/competitor-direction-c/390-control-delete-cancel-default.png) | [查看](design/competitor-direction-c/390-control-delete-cancel-hover.png) | [查看](design/competitor-direction-c/390-control-delete-cancel-focus.png) | [查看](design/competitor-direction-c/390-control-delete-cancel-pressed.png) | [查看](design/competitor-direction-c/390-control-delete-cancel-disabled.png) | [查看](design/competitor-direction-c/390-control-delete-cancel-busy.png) |
| P19 范围区 · 监控规则 | [查看](design/competitor-direction-c/390-control-rule-nav-default.png) | [查看](design/competitor-direction-c/390-control-rule-nav-hover.png) | [查看](design/competitor-direction-c/390-control-rule-nav-focus.png) | [查看](design/competitor-direction-c/390-control-rule-nav-pressed.png) | 本批不制图 | 本批不制图 |
| P19 当前竞品规则 | [查看](design/competitor-direction-c/390-control-rule-current-default.png) | [查看](design/competitor-direction-c/390-control-rule-current-hover.png) | [查看](design/competitor-direction-c/390-control-rule-current-focus.png) | [查看](design/competitor-direction-c/390-control-rule-current-pressed.png) | 本批不制图 | 本批不制图 |
| P20 返回竞品目录 | [查看](design/competitor-direction-c/390-control-rule-back-default.png) | [查看](design/competitor-direction-c/390-control-rule-back-hover.png) | [查看](design/competitor-direction-c/390-control-rule-back-focus.png) | [查看](design/competitor-direction-c/390-control-rule-back-pressed.png) | 本批不制图 | 本批不制图 |
| P19 打开来源商品 | [查看](design/competitor-direction-c/390-control-source-default.png) | [查看](design/competitor-direction-c/390-control-source-hover.png) | [查看](design/competitor-direction-c/390-control-source-focus.png) | [查看](design/competitor-direction-c/390-control-source-pressed.png) | 本批不制图 | 本批不制图 |

## 数量与未完成项

新增七个次级控件变体40状态、四个导航变体16状态，共56状态×2视口＝112PNG。与前批四个主按钮24状态合计15个代表控件/80状态/160双端实例；本包48整页场景与附加图保持，当前270PNG。所有新增图永久保留，不作为测试垃圾清理。

动作口径不膨胀：新映射7个语义组36代表槽，额外的页脚取消及当前对象规则入口只作变体，不新增语义组或抵扣其他代表槽。P19剩58、P20剩30，共88代表槽未映射；全站仍21页完成同级语义梳理，52页待继续，完整页面批准仍0。

P20异常create=1背景、双query弹窗优先级、其他动作及字段、全部主题/密度/长文本、真实焦点/辅助技术/移动软键盘、Vue生命周期与未修异步边界仍待实施和验收。不能用本页关闭图抵扣其他弹窗，不能用来源主入口抵扣所有无快照恢复入口。

## 验证证据

先运行现有验证器--smoke，再完整--capture：双端160控件实例、原有场景交互、12屏宽×5代表场景通过，HTTP与页面错误均0；文字/实际背景对比最低5.33419。此次对透明链接背景沿父节点查找实际不透明底色，不把透明当黑色。

首次最小验证在连续切换场景后发现创建页脚取消的焦点回到body。核对离线openModal发现预置场景也可能沿用旧弹窗焦点；改为场景使用对应默认入口、正常操作只从app区域读取当前入口，复测通过。增加Enter触发、精确href、来源新窗口/rel、次级操作零写入、关闭回焦、创建草稿保留与删除重开清空检查。该修复只在离线原型，不宣称真实Vue已修。

新增additionalControlVariants校验：key唯一、所属动作/页面、selector、状态名及双端截图中的实际control元数据必须一致；额外变体不增加动作或代表槽计数。tests/unit/ui-phase2-action-coverage.test.mjs包含新增12个有效/损坏变体案例，全部48例通过。现有全站动作审计也通过。

只人工目检390-create-cancel-focus和1440-rule-nav-hover两张。上一轮正在等待审核的390-control-collect-busy与1440-control-delete-focus经Git字节哈希对比均未改变，不撤换原审核对象；未声称270图全部人工看过。

## 使用与交付边界

- [全部图册](design/competitor-direction-c/gallery.html)、[交互稿](design/competitor-direction-c/index.html)、[关键主按钮审核](COMPETITOR-CONTROL-STATE-REVIEW.md)。请按“页面/控件/状态/桌面或手机/修改意见”反馈。
- 最小验证：`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`；完整只读验证不带参数；明确重画本包时使用`--capture`。额外变体关联由`node scripts/audit-ui-phase2-action-coverage.mjs`校验。
- 未改生产Vue/CSS、后端/Worker/Python、API/OpenAPI、数据库、权限、安全、环境配置、依赖或部署；无运行参数/重启要求。
- 所有新图/脚本/文档为永久交付；没有新建临时产物、服务，浏览器finally关闭。此前清理被拒残留见[进度](PROGRESS.md)，不重试绕过。
