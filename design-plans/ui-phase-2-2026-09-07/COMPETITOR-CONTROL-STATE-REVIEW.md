# P19/P20 · 关键提交按钮六态审核

后续[次级操作与导航](COMPETITOR-SECONDARY-STATE-REVIEW.md)已新增112图，包内现270图、剩88代表槽。本文件的四主按钮范围不变；原两张待审图经字节对比未改变。下文158图/124槽为本批初始交付时数量。

2026-09-09；CP-CONTROLS-r1，沿COMPETITOR-C-r1整体提案。状态：待用户审核。不是已部署界面；不扩大P16布局批准。

## 本批设计

- 蓝色用于采集、创建、规则提交；红色只用于最终删除。按下时轻微下移及内阴影，键盘焦点为3px深蓝轮廓，禁用时保留可读文字而非整体半透明。
- 忙碌按钮使用明确的“正在提交采集 / 正在添加 / 正在启用 / 正在删除”文字与进度符号。减少动态效果时符号静止，不依赖动画说明状态。
- 采集请求提交中与已受理的采集任务分开。前者按钮aria-busy=true，后者为“采集中…”及既有任务状态，不声称已经产生快照。
- 弹窗提交按钮的disabled与busy使用同一实际busy条件：两槽可能同图，不虚构额外业务限制。弹窗输入与关闭锁定仍是原离线稿的待审提案，真实Vue行为未改变。

## 按状态打开原尺寸图

每图是在1440或390视口中实际触发目标状态的浏览器截图，保留按钮附近上下文。移动采集图滚动到操作区，不是完整长页图；完整页面见[图册](design/competitor-direction-c/gallery.html)。

### 桌面1440

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 忙碌 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 · 立即采集 | [查看](design/competitor-direction-c/1440-control-collect-default.png) | [查看](design/competitor-direction-c/1440-control-collect-hover.png) | [查看](design/competitor-direction-c/1440-control-collect-focus.png) | [查看](design/competitor-direction-c/1440-control-collect-pressed.png) | [查看](design/competitor-direction-c/1440-control-collect-disabled.png) | [查看](design/competitor-direction-c/1440-control-collect-busy.png) |
| P19 · 确认并开始采集 | [查看](design/competitor-direction-c/1440-control-create-default.png) | [查看](design/competitor-direction-c/1440-control-create-hover.png) | [查看](design/competitor-direction-c/1440-control-create-focus.png) | [查看](design/competitor-direction-c/1440-control-create-pressed.png) | [查看](design/competitor-direction-c/1440-control-create-disabled.png) | [查看](design/competitor-direction-c/1440-control-create-busy.png) |
| P20 · 启用规则 | [查看](design/competitor-direction-c/1440-control-rule-default.png) | [查看](design/competitor-direction-c/1440-control-rule-hover.png) | [查看](design/competitor-direction-c/1440-control-rule-focus.png) | [查看](design/competitor-direction-c/1440-control-rule-pressed.png) | [查看](design/competitor-direction-c/1440-control-rule-disabled.png) | [查看](design/competitor-direction-c/1440-control-rule-busy.png) |
| P19 · 确认删除 | [查看](design/competitor-direction-c/1440-control-delete-default.png) | [查看](design/competitor-direction-c/1440-control-delete-hover.png) | [查看](design/competitor-direction-c/1440-control-delete-focus.png) | [查看](design/competitor-direction-c/1440-control-delete-pressed.png) | [查看](design/competitor-direction-c/1440-control-delete-disabled.png) | [查看](design/competitor-direction-c/1440-control-delete-busy.png) |

### 手机390

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 忙碌 |
| --- | --- | --- | --- | --- | --- | --- |
| P19 · 立即采集 | [查看](design/competitor-direction-c/390-control-collect-default.png) | [查看](design/competitor-direction-c/390-control-collect-hover.png) | [查看](design/competitor-direction-c/390-control-collect-focus.png) | [查看](design/competitor-direction-c/390-control-collect-pressed.png) | [查看](design/competitor-direction-c/390-control-collect-disabled.png) | [查看](design/competitor-direction-c/390-control-collect-busy.png) |
| P19 · 确认并开始采集 | [查看](design/competitor-direction-c/390-control-create-default.png) | [查看](design/competitor-direction-c/390-control-create-hover.png) | [查看](design/competitor-direction-c/390-control-create-focus.png) | [查看](design/competitor-direction-c/390-control-create-pressed.png) | [查看](design/competitor-direction-c/390-control-create-disabled.png) | [查看](design/competitor-direction-c/390-control-create-busy.png) |
| P20 · 启用规则 | [查看](design/competitor-direction-c/390-control-rule-default.png) | [查看](design/competitor-direction-c/390-control-rule-hover.png) | [查看](design/competitor-direction-c/390-control-rule-focus.png) | [查看](design/competitor-direction-c/390-control-rule-pressed.png) | [查看](design/competitor-direction-c/390-control-rule-disabled.png) | [查看](design/competitor-direction-c/390-control-rule-busy.png) |
| P19 · 确认删除 | [查看](design/competitor-direction-c/390-control-delete-default.png) | [查看](design/competitor-direction-c/390-control-delete-hover.png) | [查看](design/competitor-direction-c/390-control-delete-focus.png) | [查看](design/competitor-direction-c/390-control-delete-pressed.png) | [查看](design/competitor-direction-c/390-control-delete-disabled.png) | [查看](design/competitor-direction-c/390-control-delete-busy.png) |

## 覆盖边界

4个代表按钮×6状态×2视口＝48张控件上下文图；新增采集POST提交中全页场景2图，包内从108增至158PNG。原图因实际CSS焦点、禁用与忙碌标签变化已重验重拍，不静默冒用旧指纹；旧版本可从Git ce1adebc追溯。

逐selector引用写入P19的CP-COLLECT/CP-CREATE-SUBMIT/CP-DELETE-SUBMIT与P20的CP-RULE-SUBMIT。P19未映射代表槽从102降至84，P20从46降至40，共124槽仍待补；24槽有图不是24个业务动作或24项批准。

创建仅代表第三步有效确认，规则仅代表工作区价格规则，删除仅代表已填原因。前两步、库存/指定对象/其他指标、关闭/取消/上一步、采集全部禁用理由与其他控件、字段、主题密度、异常深链、真实移动软键盘和Vue生命周期仍未全部覆盖。P20异常create=1不拿P19背景抵扣。

## 验证与使用

复用现有依赖及永久浏览器验证器；使用frontend-design收紧反馈层级，不引入另一套页面布局。Playwright用于真实DOM状态与截图，不是AI栅格示意图。

最小验证：`node scripts/verify-ui-phase2-competitor-c.mjs --smoke`。只读完整验证：同命令不带参数。只有明确重生成图稿时加`--capture`。smoke与capture不能同时使用。

本轮smoke后完整捕获通过：48全页场景、48代表状态双端实例、12屏宽×5代表场景；HTTP及页面错误均0。四控件实测文字/背景对比均≥4.5，焦点/按下/禁用不误提交，实际离线点击后进入pending并拒绝显式事件重入。此项不证明生产API幂等、真实Vue忙碌守卫、辅助技术或全控件无障碍通过。

打开[交互稿](design/competitor-direction-c/index.html)的场景选择可看提交中画面。离线outcome=pending只用于验证器模拟未完成响应，不发送网络请求、不设真实超时或业务重试；切换场景重置画面。

本轮不改生产Vue/CSS、后端/Worker/Python、API/OpenAPI、数据库、配置、依赖、权限或部署，无调参/重启要求。全部新图与脚本是永久交付；无新增临时产物或服务，验证浏览器finally关闭。前轮清理被拒残留仍见[进度](PROGRESS.md)，不绕过。

## 审核方式

请按“按钮 / 状态 / 桌面或手机 / 通过或修改意见”反馈。本批通过也只批准这四个代表按钮状态，不代替其他变体、整页、其他页面或上线批准。
