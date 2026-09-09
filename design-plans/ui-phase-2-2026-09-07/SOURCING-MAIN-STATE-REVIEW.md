# P21 主操作 · C 方向状态审核

2026-09-09：主操作新增96张双端图；本包62主场景385PNG、23控件变体240双端状态实例。8语义组增加36代表槽，第二采购来源/其他记录/已勾选为3额外变体，不新增业务动作；累计84代表槽已绑定、86待补。局部/读取控件没有源码禁用或busy条件的，不编造图或减分母。仅离线提案，未提升批准、改生产或部署。

## 状态与真实业务边界

四类入口仅打开对应窗口；未发送写请求。删除入口维持危险色，确认删除仍在窗口内。当前/其他记录以白底选中与白色3px键盘轮廓区分；普通操作深蓝3px焦点，禁用为不透明灰底，请求提交中使用静态进度环和明确的“结果尚未确认”提示。焦点和已选状态不能只靠同一颜色判断。

选择报价只修改本地集合，没有请求，也没有自己的busy锁；最多5家，第6次勾选会恢复到已接受的集合。Space可取消已选。至少2家且非busy才允许保存对比。按钮只在自身请求在途时标记aria-busy；由其他请求导致的共享busy只禁用，不冒称本按钮正在提交。

记录点击发送GET /sourcing/searches/:id；源代码只在记录ID变化时清空选中报价。本轮纠正原型点击当前记录也清空的差异；当前记录保留勾选，其他记录清空。真实读取乱序/卸载/路由生命周期未在本轮修复或验收。

保存对比的POST保留原name和quote_ids；重新采集的POST /sourcing/searches/:id/refresh保留空对象。离线pending记录点击时的记录名、ID、报价ID快照；后续勾选不改变已发送意图，不重复提交。它不是服务端已保存、任务已排队、采集完成或真实幂等证明，也不模拟超时、重试或成功回调。SC-G01–08依然未关闭。

源码没有给这些入口、记录、勾选加disabled/busy；两列标为源码无此条件，机器清单仍留not-mapped等待分母复核，不用假图凑六态。比较的disabled图使用只选一家；刷新的disabled/busy均来自请求在途。额外第二采购入口、其他记录和已选报价验证相同动作的不同对象，不膨胀动作数。

## 双端状态图

每图来自真实浏览器的鼠标/键盘状态。主控件图保留视口上下文，不是裁切按钮或给同一图换名；未声称已覆盖所有主题、所有记录、辅助技术或真实Vue。

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 发起找货 | [查看](design/sourcing-direction-c/1440-control-main-search-open-default.png) | [查看](design/sourcing-direction-c/1440-control-main-search-open-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-search-open-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-search-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 确认报价入口 | [查看](design/sourcing-direction-c/1440-control-main-quote-open-default.png) | [查看](design/sourcing-direction-c/1440-control-main-quote-open-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-quote-open-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-quote-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 采购入口 / 第一来源 | [查看](design/sourcing-direction-c/1440-control-main-purchase-open-default.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-open-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-open-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 删除入口 | [查看](design/sourcing-direction-c/1440-control-main-delete-open-default.png) | [查看](design/sourcing-direction-c/1440-control-main-delete-open-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-delete-open-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-delete-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 当前记录 | [查看](design/sourcing-direction-c/1440-control-main-record-current-default.png) | [查看](design/sourcing-direction-c/1440-control-main-record-current-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-record-current-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-record-current-pressed.png) | 源码无此条件 | 源码无此条件 |
| 未选报价 | [查看](design/sourcing-direction-c/1440-control-main-select-default.png) | [查看](design/sourcing-direction-c/1440-control-main-select-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-select-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-select-pressed.png) | 源码无此条件 | 源码无此条件 |
| 保存对比 | [查看](design/sourcing-direction-c/1440-control-main-compare-default.png) | [查看](design/sourcing-direction-c/1440-control-main-compare-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-compare-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-compare-pressed.png) | [查看](design/sourcing-direction-c/1440-control-main-compare-disabled.png) | [查看](design/sourcing-direction-c/1440-control-main-compare-busy.png) |
| 重新采集 | [查看](design/sourcing-direction-c/1440-control-main-refresh-default.png) | [查看](design/sourcing-direction-c/1440-control-main-refresh-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-refresh-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-refresh-pressed.png) | [查看](design/sourcing-direction-c/1440-control-main-refresh-disabled.png) | [查看](design/sourcing-direction-c/1440-control-main-refresh-busy.png) |
| 采购入口 / 第二来源 | [查看](design/sourcing-direction-c/1440-control-main-purchase-second-default.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-second-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-second-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-purchase-second-pressed.png) | 源码无此条件 | 源码无此条件 |
| 其他记录 | [查看](design/sourcing-direction-c/1440-control-main-record-other-default.png) | [查看](design/sourcing-direction-c/1440-control-main-record-other-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-record-other-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-record-other-pressed.png) | 源码无此条件 | 源码无此条件 |
| 已选报价 | [查看](design/sourcing-direction-c/1440-control-main-select-checked-default.png) | [查看](design/sourcing-direction-c/1440-control-main-select-checked-hover.png) | [查看](design/sourcing-direction-c/1440-control-main-select-checked-focus.png) | [查看](design/sourcing-direction-c/1440-control-main-select-checked-pressed.png) | 源码无此条件 | 源码无此条件 |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 发起找货 | [查看](design/sourcing-direction-c/390-control-main-search-open-default.png) | [查看](design/sourcing-direction-c/390-control-main-search-open-hover.png) | [查看](design/sourcing-direction-c/390-control-main-search-open-focus.png) | [查看](design/sourcing-direction-c/390-control-main-search-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 确认报价入口 | [查看](design/sourcing-direction-c/390-control-main-quote-open-default.png) | [查看](design/sourcing-direction-c/390-control-main-quote-open-hover.png) | [查看](design/sourcing-direction-c/390-control-main-quote-open-focus.png) | [查看](design/sourcing-direction-c/390-control-main-quote-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 采购入口 / 第一来源 | [查看](design/sourcing-direction-c/390-control-main-purchase-open-default.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-open-hover.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-open-focus.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 删除入口 | [查看](design/sourcing-direction-c/390-control-main-delete-open-default.png) | [查看](design/sourcing-direction-c/390-control-main-delete-open-hover.png) | [查看](design/sourcing-direction-c/390-control-main-delete-open-focus.png) | [查看](design/sourcing-direction-c/390-control-main-delete-open-pressed.png) | 源码无此条件 | 源码无此条件 |
| 当前记录 | [查看](design/sourcing-direction-c/390-control-main-record-current-default.png) | [查看](design/sourcing-direction-c/390-control-main-record-current-hover.png) | [查看](design/sourcing-direction-c/390-control-main-record-current-focus.png) | [查看](design/sourcing-direction-c/390-control-main-record-current-pressed.png) | 源码无此条件 | 源码无此条件 |
| 未选报价 | [查看](design/sourcing-direction-c/390-control-main-select-default.png) | [查看](design/sourcing-direction-c/390-control-main-select-hover.png) | [查看](design/sourcing-direction-c/390-control-main-select-focus.png) | [查看](design/sourcing-direction-c/390-control-main-select-pressed.png) | 源码无此条件 | 源码无此条件 |
| 保存对比 | [查看](design/sourcing-direction-c/390-control-main-compare-default.png) | [查看](design/sourcing-direction-c/390-control-main-compare-hover.png) | [查看](design/sourcing-direction-c/390-control-main-compare-focus.png) | [查看](design/sourcing-direction-c/390-control-main-compare-pressed.png) | [查看](design/sourcing-direction-c/390-control-main-compare-disabled.png) | [查看](design/sourcing-direction-c/390-control-main-compare-busy.png) |
| 重新采集 | [查看](design/sourcing-direction-c/390-control-main-refresh-default.png) | [查看](design/sourcing-direction-c/390-control-main-refresh-hover.png) | [查看](design/sourcing-direction-c/390-control-main-refresh-focus.png) | [查看](design/sourcing-direction-c/390-control-main-refresh-pressed.png) | [查看](design/sourcing-direction-c/390-control-main-refresh-disabled.png) | [查看](design/sourcing-direction-c/390-control-main-refresh-busy.png) |
| 采购入口 / 第二来源 | [查看](design/sourcing-direction-c/390-control-main-purchase-second-default.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-second-hover.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-second-focus.png) | [查看](design/sourcing-direction-c/390-control-main-purchase-second-pressed.png) | 源码无此条件 | 源码无此条件 |
| 其他记录 | [查看](design/sourcing-direction-c/390-control-main-record-other-default.png) | [查看](design/sourcing-direction-c/390-control-main-record-other-hover.png) | [查看](design/sourcing-direction-c/390-control-main-record-other-focus.png) | [查看](design/sourcing-direction-c/390-control-main-record-other-pressed.png) | 源码无此条件 | 源码无此条件 |
| 已选报价 | [查看](design/sourcing-direction-c/390-control-main-select-checked-default.png) | [查看](design/sourcing-direction-c/390-control-main-select-checked-hover.png) | [查看](design/sourcing-direction-c/390-control-main-select-checked-focus.png) | [查看](design/sourcing-direction-c/390-control-main-select-checked-pressed.png) | 源码无此条件 | 源码无此条件 |

## 验证与待审

- 定向smoke与完整capture通过：9组真实setup隔离检查、240双端控件状态实例、44px触控/16px控件字体、文字对比至少4.5、焦点可见及内侧命中、键盘精确入口和GET/POST意图、比较快照与共享busy；HTTP/页面错误0。
- 仅人工目检手机保存对比busy、桌面其他记录focus两张，不宣称全图人工审核。九屏宽×五代表面、纽约报价本地时间、720×500等效重排保持通过，非实际浏览器缩放或全时区验收。
- [交互原型](design/sourcing-direction-c/index.html)与[全部图册](design/sourcing-direction-c/gallery.html)可直接打开。复验：node scripts/verify-ui-phase2-sourcing-c.mjs；--smoke只预检，--capture重生成本包永久交付物。
- 待确认本批具体样式；P16仅整体布局获批，不能外推P21。其余86代表槽、全主题/字段/真实异步及其他页面继续。生产Vue/API/OpenAPI、数据库、env、依赖、权限未改；无部署或重启要求。
