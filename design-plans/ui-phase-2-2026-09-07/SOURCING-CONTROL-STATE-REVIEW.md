# P21 四个提交按钮 · C 方向状态审核

状态：本批待审，仅细化离线原型；不代表 P21 整页批准，不扩大 P16 的布局批准，也没有部署。

## 这次看什么

- 普通提交保持蓝色；删除保持独立红色。悬停加深，按下有内阴影；键盘焦点为深蓝 3px 轮廓，偏移 3px。
- 禁用使用不透明灰底和清晰文字；鼠标移入不会重新变成可用色。提交中增加静态进度标记和明确请求状态，不使用循环闪动。
- 按钮区的说明关联到提交按钮；本地合成请求提交后，焦点移到同一弹窗的状态提示。原生模态、完整回焦/关闭锁和这个状态焦点均为设计提案，真实 Vue 未迁入。
- 手机长报价窗的旧负偏移会使提交按钮超出屏幕约 11px，现已修正为非负吸附位置，并保留焦点显示空间；这只修离线原型。
- “请求提交中”不等于“找货/采购任务已排队”，更不代表完成采集、下单或付款。图中使用合成报价和明确填入的合成原因。

## 双端逐按钮图

以下为真实浏览器渲染的控件上下文截图，不是从同一张整页图裁出六个名字。default/hover/focus/pressed 由实际鼠标或键盘产生；disabled/busy 按下面真实条件生成。

### 1440px

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 开始公开网页采集 | [查看](design/sourcing-direction-c/1440-control-search-default.png) | [查看](design/sourcing-direction-c/1440-control-search-hover.png) | [查看](design/sourcing-direction-c/1440-control-search-focus.png) | [查看](design/sourcing-direction-c/1440-control-search-pressed.png) | [查看](design/sourcing-direction-c/1440-control-search-disabled.png) | [查看](design/sourcing-direction-c/1440-control-search-busy.png) |
| 确认新版本 | [查看](design/sourcing-direction-c/1440-control-quote-default.png) | [查看](design/sourcing-direction-c/1440-control-quote-hover.png) | [查看](design/sourcing-direction-c/1440-control-quote-focus.png) | [查看](design/sourcing-direction-c/1440-control-quote-pressed.png) | [查看](design/sourcing-direction-c/1440-control-quote-disabled.png) | [查看](design/sourcing-direction-c/1440-control-quote-busy.png) |
| 确认创建采购任务 | [查看](design/sourcing-direction-c/1440-control-purchase-default.png) | [查看](design/sourcing-direction-c/1440-control-purchase-hover.png) | [查看](design/sourcing-direction-c/1440-control-purchase-focus.png) | [查看](design/sourcing-direction-c/1440-control-purchase-pressed.png) | [查看](design/sourcing-direction-c/1440-control-purchase-disabled.png) | [查看](design/sourcing-direction-c/1440-control-purchase-busy.png) |
| 确认删除 | [查看](design/sourcing-direction-c/1440-control-delete-default.png) | [查看](design/sourcing-direction-c/1440-control-delete-hover.png) | [查看](design/sourcing-direction-c/1440-control-delete-focus.png) | [查看](design/sourcing-direction-c/1440-control-delete-pressed.png) | [查看](design/sourcing-direction-c/1440-control-delete-disabled.png) | [查看](design/sourcing-direction-c/1440-control-delete-busy.png) |

### 390px

| 按钮 | 默认 | 悬停 | 键盘焦点 | 按下 | 禁用 | 请求提交中 |
| --- | --- | --- | --- | --- | --- | --- |
| 开始公开网页采集 | [查看](design/sourcing-direction-c/390-control-search-default.png) | [查看](design/sourcing-direction-c/390-control-search-hover.png) | [查看](design/sourcing-direction-c/390-control-search-focus.png) | [查看](design/sourcing-direction-c/390-control-search-pressed.png) | [查看](design/sourcing-direction-c/390-control-search-disabled.png) | [查看](design/sourcing-direction-c/390-control-search-busy.png) |
| 确认新版本 | [查看](design/sourcing-direction-c/390-control-quote-default.png) | [查看](design/sourcing-direction-c/390-control-quote-hover.png) | [查看](design/sourcing-direction-c/390-control-quote-focus.png) | [查看](design/sourcing-direction-c/390-control-quote-pressed.png) | [查看](design/sourcing-direction-c/390-control-quote-disabled.png) | [查看](design/sourcing-direction-c/390-control-quote-busy.png) |
| 确认创建采购任务 | [查看](design/sourcing-direction-c/390-control-purchase-default.png) | [查看](design/sourcing-direction-c/390-control-purchase-hover.png) | [查看](design/sourcing-direction-c/390-control-purchase-focus.png) | [查看](design/sourcing-direction-c/390-control-purchase-pressed.png) | [查看](design/sourcing-direction-c/390-control-purchase-disabled.png) | [查看](design/sourcing-direction-c/390-control-purchase-busy.png) |
| 确认删除 | [查看](design/sourcing-direction-c/390-control-delete-default.png) | [查看](design/sourcing-direction-c/390-control-delete-hover.png) | [查看](design/sourcing-direction-c/390-control-delete-focus.png) | [查看](design/sourcing-direction-c/390-control-delete-pressed.png) | [查看](design/sourcing-direction-c/390-control-delete-disabled.png) | [查看](design/sourcing-direction-c/390-control-delete-busy.png) |

## 禁用条件不是新业务规则

| 动作 | 禁用图的依据 | 本批没有声称 |
| --- | --- | --- |
| 找货提交 | 当前源按钮只有 busy 禁用；disabled 和 busy 两图采用同一请求在途条件 | 不将空输入改为额外禁用规则；必填由原生校验拦截 |
| 报价确认 | 当前源按钮只有 busy 禁用；同上 | 证据建议列表不等于服务端鉴权；默认值不变成采集事实 |
| 创建采购任务 | disabled 图为数量 99，小于当前报价 MOQ 100；busy 图为有效输入请求在途 | 不改变 MOQ；原因不足另有 DOM 验证，但未单独制图；未下单付款 |
| 删除记录 | 当前源按钮只有 busy 禁用；同上 | 不增加虚构版本参数；空白原因仍按当前处理器阻断；保留候选证据及审计 |

找货精确提交 input_type/input_ref；报价提交 candidate_id 加现有九字段，不改 price/currency；采购提交 quote_id/quantity/trim 原因；删除只提交 trim 原因。键盘触发与鼠标触发使用同一内存意图处理器，不访问真实接口。

当前原型的 pending 模式只保持“尚未确认”的合成在途状态，没有真实网络请求、超时或取消能力；重复点击/Enter/派发 submit 均不新增意图。关闭锁不表示撤回已发出的服务器请求，真实 Vue 的并发、离开返回和对象归属仍按 SC-G03/G05 待处理。

## 覆盖与复验

4 个提交动作 × 6 个代表状态 × 2 个宽度＝48 张状态图。24 个代表状态槽完成显式 pageId/actionId/selector/状态绑定，P21 仍有 146 槽待细化。上述三个按钮 disabled/busy 同属一个在途条件，不能算成两个新业务场景。其他输入类型、报价差异、失败/成功、关闭/取消、字段、主题密度与辅助技术不因本批获验。

复验命令（已有依赖，无需安装或启动服务）：

```powershell
node scripts/verify-ui-phase2-sourcing-c.mjs --smoke
node scripts/verify-ui-phase2-sourcing-c.mjs
node scripts/audit-ui-phase2-action-coverage.mjs
```

--smoke 不出图、不对旧图片哈希验收；默认检查当前来源和已登记图，并重跑离线交互；--capture 会重渲染本包永久审核图片、证据和图册。不得用 smoke 代替正式图片验收。仅本地 file 页面，无生产重启或配置变化。

参见 [全部图册](design/sourcing-direction-c/gallery.html)、[真实动作清单](SOURCING-SEMANTIC-REVIEW.md)、[机器映射](action-reviews/P21.json)。所有既有 SC-G01–08 保持待处理，本批不把真实 Vue 或全站交付标为完成。
