# P16 控件状态审核 · C-r2

整体布局已获批准，本文件只供逐控件审核，不代表状态已通过或界面已上线。采用已批准蓝白分区；链接悬停增加浅蓝底与加粗下划线、按下增加内阴影，键盘焦点保留3px轮廓，不改变按钮位置和任务流程。

## 按实际动作查看

下表每项链接进入桌面焦点示例；[完整双端图册](design/journey-direction-c/README.md)列出全部状态。

| 动作 | 状态范围 | 行为边界 |
| --- | --- | --- |
| [返回列表](design/journey-direction-c/1440-control-list-focus.png) | 默认/悬停/焦点/按下 | 忙碌期间也可离开，不取消后台任务；无本地提交态。 |
| [重试读取](design/journey-direction-c/1440-control-retry-focus.png) | 四态＋禁用/读取中 | 只读已有ID，不创建新任务；禁重复点击为图稿提案。 |
| [创建提交](design/journey-direction-c/1440-control-create-focus.png) | 四态＋禁用/提交中 | 三种输入仍遵守现有字段校验；成功只表示任务接收。 |
| [来源原文](design/journey-direction-c/1440-control-source-focus.png) | 默认/悬停/焦点/按下 | 保留新窗口及noopener noreferrer，不改变候选选择。 |
| [保存决定](design/journey-direction-c/1440-control-save-focus.png) | 四态＋禁用/提交中 | 采纳需五门通过；观察/驳回不携带候选ID。 |
| [查看机会](design/journey-direction-c/1440-control-opportunity-focus.png) | 默认/悬停/焦点/按下 | 仅返回机会ID后出现；没有ID时不渲染，非禁用态。 |
| [打开任务](design/journey-direction-c/1440-control-task-focus.png) | 默认/悬停/焦点/按下 | 仅返回验证任务ID后出现，不推测链接。 |
| [开始下一次](design/journey-direction-c/1440-control-reset-focus.png) | 四态＋禁用/写入期间 | 写入期间禁用；读取期间仍可重置，旧后台任务继续。 |

另有[采纳单选](design/journey-direction-c/390-control-adopt-disabled.png)六态和[权限说明副按钮](design/journey-direction-c/390-control-secondary-focus.png)四态；它们不新增业务动作组。8组48个代表视觉槽中40关联图、8导航状态不适用；不能推导完整页面或其他输入变体已覆盖。

## 恢复主次按钮

- 存在旅程或恢复ID：主按钮重试读取。没有ID：实际源码走reset；图稿改为“重新输入”，不承诺重新登录或新建任务。
- 读取失败/创建失败：副按钮返回上一页，原型只记录history.back意图，不离开审核文件。
- 登录过期：共享源合同没有副按钮，不另外添加说明入口。
- 无权限/依赖受阻：副按钮只解释权限或影响，不授权、不重试、不取消任务。
- 图稿重试中禁用主按钮、无ID时的清晰文案，以及已记录的草稿清理/字段冻结仍为待审改善，生产Vue未因此改动。

## 验证及剩余

验证脚本实际触发hover、focus-visible、pointer-down、Enter导航，读取disabled，按下截图后移出再抬起并检查没有写入或导航。重试防重复、无ID重置、主次恢复分支和忙碌期间返回列表均使用隔离状态验证；无真实HTTP、SQL、存储、鉴权或后台采集验收。

当前59整页场景＋50代表控件状态，桌面1440/手机390共218PNG、零业务弹窗。仍需审核本批控件，继续输入类型、候选、观察/驳回、文字输入错误与主题/密度变体，之后再完成真实Vue实施及生产验证。没有要求重新批准整体布局。
