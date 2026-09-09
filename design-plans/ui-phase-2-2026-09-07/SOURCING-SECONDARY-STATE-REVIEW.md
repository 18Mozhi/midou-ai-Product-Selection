# P21 弹窗关闭与取消 · C 方向状态审核

本批待审核，仅修改离线设计；真实 Vue 与生产未改，不扩大 P16 的布局批准。

## 设计与实际行为分开

四类弹窗各有右上关闭和底部取消。关闭图标带窗口名称，底部取消保持中性，不使用删除按钮的危险色；悬停浅蓝、按下内阴影、键盘深蓝3px轮廓。锁定态为不透明灰底，不靠降低透明度隐藏文字。

当前源 Vue 的关闭、取消和局部 Escape **没有 busy 禁用**。本包已有的“父请求在途时暂时锁定关闭”仍是待审核提案，本轮只是补齐对应状态证据，绝非已实施的业务规则。

关闭和取消不会发送自己的请求。因此 busy 图保持“× / 取消”，不写“取消中”、不放请求进度标记，也不把 aria-busy 挂在关闭按钮上。父表单标示在途状态，按钮关联同窗状态说明；这不等于请求取消、事务回滚或采购撤单。

## 双端控件上下文图

disabled 与 busy 两列都是父请求在途的同一锁定条件，不是两个业务场景。每图通过真实浏览器的鼠标/键盘状态生成，不由改名同一图片替代；页面尺寸1440/390，模态图仅显示视口内容，长表单仍需滚动。

### 1440px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 父请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 找货 / 右上关闭 | [查看](design/sourcing-direction-c/1440-control-search-close-default.png) | [查看](design/sourcing-direction-c/1440-control-search-close-hover.png) | [查看](design/sourcing-direction-c/1440-control-search-close-focus.png) | [查看](design/sourcing-direction-c/1440-control-search-close-pressed.png) | [查看](design/sourcing-direction-c/1440-control-search-close-disabled.png) | [查看](design/sourcing-direction-c/1440-control-search-close-busy.png) |
| 找货 / 底部取消 | [查看](design/sourcing-direction-c/1440-control-search-cancel-default.png) | [查看](design/sourcing-direction-c/1440-control-search-cancel-hover.png) | [查看](design/sourcing-direction-c/1440-control-search-cancel-focus.png) | [查看](design/sourcing-direction-c/1440-control-search-cancel-pressed.png) | [查看](design/sourcing-direction-c/1440-control-search-cancel-disabled.png) | [查看](design/sourcing-direction-c/1440-control-search-cancel-busy.png) |
| 报价确认 / 右上关闭 | [查看](design/sourcing-direction-c/1440-control-quote-close-default.png) | [查看](design/sourcing-direction-c/1440-control-quote-close-hover.png) | [查看](design/sourcing-direction-c/1440-control-quote-close-focus.png) | [查看](design/sourcing-direction-c/1440-control-quote-close-pressed.png) | [查看](design/sourcing-direction-c/1440-control-quote-close-disabled.png) | [查看](design/sourcing-direction-c/1440-control-quote-close-busy.png) |
| 报价确认 / 底部取消 | [查看](design/sourcing-direction-c/1440-control-quote-cancel-default.png) | [查看](design/sourcing-direction-c/1440-control-quote-cancel-hover.png) | [查看](design/sourcing-direction-c/1440-control-quote-cancel-focus.png) | [查看](design/sourcing-direction-c/1440-control-quote-cancel-pressed.png) | [查看](design/sourcing-direction-c/1440-control-quote-cancel-disabled.png) | [查看](design/sourcing-direction-c/1440-control-quote-cancel-busy.png) |
| 采购任务 / 右上关闭 | [查看](design/sourcing-direction-c/1440-control-purchase-close-default.png) | [查看](design/sourcing-direction-c/1440-control-purchase-close-hover.png) | [查看](design/sourcing-direction-c/1440-control-purchase-close-focus.png) | [查看](design/sourcing-direction-c/1440-control-purchase-close-pressed.png) | [查看](design/sourcing-direction-c/1440-control-purchase-close-disabled.png) | [查看](design/sourcing-direction-c/1440-control-purchase-close-busy.png) |
| 采购任务 / 底部取消 | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-default.png) | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-hover.png) | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-focus.png) | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-pressed.png) | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-disabled.png) | [查看](design/sourcing-direction-c/1440-control-purchase-cancel-busy.png) |
| 删除记录 / 右上关闭 | [查看](design/sourcing-direction-c/1440-control-delete-close-default.png) | [查看](design/sourcing-direction-c/1440-control-delete-close-hover.png) | [查看](design/sourcing-direction-c/1440-control-delete-close-focus.png) | [查看](design/sourcing-direction-c/1440-control-delete-close-pressed.png) | [查看](design/sourcing-direction-c/1440-control-delete-close-disabled.png) | [查看](design/sourcing-direction-c/1440-control-delete-close-busy.png) |
| 删除记录 / 底部取消 | [查看](design/sourcing-direction-c/1440-control-delete-cancel-default.png) | [查看](design/sourcing-direction-c/1440-control-delete-cancel-hover.png) | [查看](design/sourcing-direction-c/1440-control-delete-cancel-focus.png) | [查看](design/sourcing-direction-c/1440-control-delete-cancel-pressed.png) | [查看](design/sourcing-direction-c/1440-control-delete-cancel-disabled.png) | [查看](design/sourcing-direction-c/1440-control-delete-cancel-busy.png) |

### 390px

| 控件 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 父请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 找货 / 右上关闭 | [查看](design/sourcing-direction-c/390-control-search-close-default.png) | [查看](design/sourcing-direction-c/390-control-search-close-hover.png) | [查看](design/sourcing-direction-c/390-control-search-close-focus.png) | [查看](design/sourcing-direction-c/390-control-search-close-pressed.png) | [查看](design/sourcing-direction-c/390-control-search-close-disabled.png) | [查看](design/sourcing-direction-c/390-control-search-close-busy.png) |
| 找货 / 底部取消 | [查看](design/sourcing-direction-c/390-control-search-cancel-default.png) | [查看](design/sourcing-direction-c/390-control-search-cancel-hover.png) | [查看](design/sourcing-direction-c/390-control-search-cancel-focus.png) | [查看](design/sourcing-direction-c/390-control-search-cancel-pressed.png) | [查看](design/sourcing-direction-c/390-control-search-cancel-disabled.png) | [查看](design/sourcing-direction-c/390-control-search-cancel-busy.png) |
| 报价确认 / 右上关闭 | [查看](design/sourcing-direction-c/390-control-quote-close-default.png) | [查看](design/sourcing-direction-c/390-control-quote-close-hover.png) | [查看](design/sourcing-direction-c/390-control-quote-close-focus.png) | [查看](design/sourcing-direction-c/390-control-quote-close-pressed.png) | [查看](design/sourcing-direction-c/390-control-quote-close-disabled.png) | [查看](design/sourcing-direction-c/390-control-quote-close-busy.png) |
| 报价确认 / 底部取消 | [查看](design/sourcing-direction-c/390-control-quote-cancel-default.png) | [查看](design/sourcing-direction-c/390-control-quote-cancel-hover.png) | [查看](design/sourcing-direction-c/390-control-quote-cancel-focus.png) | [查看](design/sourcing-direction-c/390-control-quote-cancel-pressed.png) | [查看](design/sourcing-direction-c/390-control-quote-cancel-disabled.png) | [查看](design/sourcing-direction-c/390-control-quote-cancel-busy.png) |
| 采购任务 / 右上关闭 | [查看](design/sourcing-direction-c/390-control-purchase-close-default.png) | [查看](design/sourcing-direction-c/390-control-purchase-close-hover.png) | [查看](design/sourcing-direction-c/390-control-purchase-close-focus.png) | [查看](design/sourcing-direction-c/390-control-purchase-close-pressed.png) | [查看](design/sourcing-direction-c/390-control-purchase-close-disabled.png) | [查看](design/sourcing-direction-c/390-control-purchase-close-busy.png) |
| 采购任务 / 底部取消 | [查看](design/sourcing-direction-c/390-control-purchase-cancel-default.png) | [查看](design/sourcing-direction-c/390-control-purchase-cancel-hover.png) | [查看](design/sourcing-direction-c/390-control-purchase-cancel-focus.png) | [查看](design/sourcing-direction-c/390-control-purchase-cancel-pressed.png) | [查看](design/sourcing-direction-c/390-control-purchase-cancel-disabled.png) | [查看](design/sourcing-direction-c/390-control-purchase-cancel-busy.png) |
| 删除记录 / 右上关闭 | [查看](design/sourcing-direction-c/390-control-delete-close-default.png) | [查看](design/sourcing-direction-c/390-control-delete-close-hover.png) | [查看](design/sourcing-direction-c/390-control-delete-close-focus.png) | [查看](design/sourcing-direction-c/390-control-delete-close-pressed.png) | [查看](design/sourcing-direction-c/390-control-delete-close-disabled.png) | [查看](design/sourcing-direction-c/390-control-delete-close-busy.png) |
| 删除记录 / 底部取消 | [查看](design/sourcing-direction-c/390-control-delete-cancel-default.png) | [查看](design/sourcing-direction-c/390-control-delete-cancel-hover.png) | [查看](design/sourcing-direction-c/390-control-delete-cancel-focus.png) | [查看](design/sourcing-direction-c/390-control-delete-cancel-pressed.png) | [查看](design/sourcing-direction-c/390-control-delete-cancel-disabled.png) | [查看](design/sourcing-direction-c/390-control-delete-cancel-busy.png) |

## 关闭后的草稿与焦点

| 窗口 | 当前重开语义 | 本批离线验证 |
| --- | --- | --- |
| 找货 | 搜索输入保留 | 关闭/取消、Enter/Escape不提交，重开仍有草稿 |
| 报价确认 | 按选中候选重新预填，不沿用上次编辑 | 重开恢复候选缺失值，不把未提交规格变成事实 |
| 采购任务 | 数量恢复当前报价MOQ，原因恢复既有默认 | 用第二个同名采购入口验证精确回焦，不回第一个供应商 |
| 删除记录 | 关闭保留原因，成功删除后源处理器才清理 | 本批只验关闭/重开保留，不模拟真实删除成功 |

上表的焦点回归是新设计提案，源窗口尚未实现完整焦点圈/归还。P21 初始 create=1 直达没有可见原始按钮时的回焦、路由反向同步和迟到响应未在本批关闭；这里不编造导航结果。失败、重新打开期间的真实网络响应与对象归属继续按 SC-G03/G05 处理。

## 覆盖与使用

本批新增8个控件变体×6状态×双端＝96张图片；包现62主场景289PNG，共12控件变体144双端状态实例。四个关闭语义组增加24代表状态槽；底部取消是同动作的额外变体，不膨胀动作分母。P21累计48代表槽已映射，仍缺122槽。

检查包括真实hover/focus/active、文字对比、触控尺寸与按钮内侧命中、disabled不可误激活、在途Escape保持窗口，以及键盘关闭后回到精确入口。真实Vue、服务端、完整辅助技术与用户批准不由这些离线检查代替。

直接打开表格中的图片审核。复验使用已有依赖：

```powershell
node scripts/verify-ui-phase2-sourcing-c.mjs --smoke
node scripts/verify-ui-phase2-sourcing-c.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

smoke不出图、不验收旧图片哈希；默认命令核对来源/图片并重跑离线交互；--capture重渲染本包永久图稿与证据。没有运行服务或配置变化，无需重启。参见[提交按钮图](SOURCING-CONTROL-STATE-REVIEW.md)、[全部图册](design/sourcing-direction-c/gallery.html)、[机器清单](action-reviews/P21.json)。

