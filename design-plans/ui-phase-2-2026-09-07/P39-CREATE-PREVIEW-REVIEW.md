# P39 新建用户弹窗 · C方向实际Vue预览 r1

具体默认弹窗与其他状态均待审核。起点 `main/797e8af3`。本批是当前父子Vue原模板/原脚本加独立审核CSS，不是纯HTML模拟，也没有把新样式导入生产。

[打开42张图册](../../output/playwright/p39-create-user-preview/index.html) · [来源与浏览器清单](../../output/playwright/p39-create-user-preview/evidence.json)

## 设计与真实实现边界

`frontend-design` 用于蓝色标题/说明区、白色字段区、分隔的底部操作，以及手机单列/桌面双列；标题不再继承旧衬线样式。取消为白底蓝边，确认为蓝底，禁用为不透明灰色，键盘焦点为蓝色描边。桌面宽度760px，手机两侧保留间距；长内容原生滚动，底部操作留在弹窗内。

本批直接挂载真实 `PlatformAccountCenter.vue`，从其“新建用户”按钮打开原 `PlatformAccountDialogs.vue`，由原 `useModalDialog` 调用原生showModal。没有修改模板、输入绑定、事件、文字、错误处理或API客户端。未增添旧HTML稿里的额外关闭按钮/帮助段落；原模板已有的取消与Escape仍关闭弹窗。外围旧界面只作宿主，不属于新C整页交付。

## 字段与状态合同

| 字段 | 当前约束/行为 | 本批处理 |
| --- | --- | --- |
| 邮箱 | 原生email、必填、maxlength254 | 保留原生校验，不增加正则或就地错误规则 |
| 临时密码 | password、必填、minlength12、maxlength128、new-password | 掩码显示，样例值仅用于隔离测试；证据文件不保存原样例密码 |
| 平台角色 | 普通用户、运营、安全、超级管理员四项 | 三种管理员选择单独出图；不据此证明真实授予权限 |
| 加入组织 | 默认不加入；选项来自当前概览数组；非active禁用 | 原样例保持，另一次读取加入明确合成的停用组织检查禁用 |
| 组织角色 | 仅已选组织时显示；普通成员/组织管理员 | 两种选择各出图，未加入时请求仍保留member字段 |

请求保持原五字段：email、temporary_password、platform_role_code、organization_id、organization_role_code；未选择的平台角色和组织用null，未增加reason。父API客户端的幂等头保留。所有GET/POST均由浏览器拦截，没有真实账号/角色/数据库写入。

等待时仅确认按钮禁用，取消和字段仍可用，按钮原文仍为“确认创建”，不伪造“创建中…”文案。失败保留五字段和原错误区域；取消/Escape返回原入口焦点，重开清空表单；成功测试样例触发既有父页面提示和重读，不作为实际创建/MFA/权限或结果列表更新证明。

原生无效检查直接核对valueMissing/typeMismatch/tooShort及零POST。截图不包含系统校验气泡，也未用红框假装新的就地错误提示：目检发现原生:user-invalid在复用表单重开后可能残留，本批已移除试做的无效态CSS，保留原生约束，不改生产校验生命周期。select可访问名称仍受原label包含选项文本影响；本批按真实字段顺序定位，不把检查通过扩大为完整无障碍验收。

## 图册覆盖

双端各20张：默认四字段；邮箱/密码焦点；运营/安全/超级管理员选择；加入组织普通成员；组织管理员及底部；必填/邮箱格式/密码长度原生无效；取消/确认焦点；确认悬停/按下；等待；失败及底部；重新打开。另有390×568短屏上部与底部2张，共42张。

- 默认：[手机](../../output/playwright/p39-create-user-preview/390-default.png) / [桌面](../../output/playwright/p39-create-user-preview/1440-default.png)
- 五字段：[手机](../../output/playwright/p39-create-user-preview/390-org-admin.png) / [桌面](../../output/playwright/p39-create-user-preview/1440-org-admin.png)
- 等待：[手机](../../output/playwright/p39-create-user-preview/390-pending.png) / [桌面](../../output/playwright/p39-create-user-preview/1440-pending.png)
- 失败：[手机](../../output/playwright/p39-create-user-preview/390-failure.png) / [桌面](../../output/playwright/p39-create-user-preview/1440-failure.png)
- 短屏：[上部](../../output/playwright/p39-create-user-preview/390-short-screen-top.png) / [底部](../../output/playwright/p39-create-user-preview/390-short-screen-bottom.png)

图为桌面Chromium窄视口，不是手机设备/软键盘或触屏悬停证明；滚动裁剪分别标明top/bottom，不能把底部图当作完整弹窗。初始自动聚焦行为已检查，普通组合为方便审核清除焦点，焦点图另列。没有原生select弹出菜单截图或真实角色授权验收。

## 验证与交付

```text
node scripts/verify-ui-phase2-account-create-preview.mjs
node scripts/verify-ui-phase2-account-create-preview.mjs --capture
node --test tests/unit/ui-phase2-account-create-preview.test.mjs tests/unit/ui-phase2-account-filter-preview.test.mjs
```

首条运行检查、不改图；第二条有意重生成本批图册。四宽度390/760/761/1440共121项浏览器检查与两组8项永久单测通过。来源覆盖真实组件本地导入图、现有样例、CSS/宿主及资料辅助器。原86张P39提案和上一批18张筛选图及清单逐一保持不变。没有生产源或依赖变更，不重复跑输入未变的生产构建。

42张PNG、清单、图册、脚本、测试和本报告为永久审核交付物，无本轮临时文件；测试浏览器/Vite服务均由finally关闭。此前P38根目录7个忽略诊断文件非本轮创建，仍按原报告记录，不擅自操作。

没有修改生产Vue、API/OpenAPI、Node/Python消费方、数据库、权限、环境变量、依赖或部署配置；这些面与本次独立CSS预览无关，无重启/上线要求。新样式待明确审核后才能在相应范围接入。

## 仍需完成

本轮只请求手机默认弹窗整体组合审核，未自动批准桌面、第五字段或所有状态。P39其余控件/组织创建详情、完整父页历史与迟到写回归属、真实角色/接口/跨主题/软键盘、全73页C实现及宝塔部署仍未完成，不用图数和局部测试替代全量交付。
