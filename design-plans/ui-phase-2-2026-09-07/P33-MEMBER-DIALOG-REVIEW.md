# P33 成员操作确认窗 · 实际 Vue C 组合 r1

2026-09-13。承接已选C方向，完成分配/移除成员原因窗的局部重设计及取消回焦修订。
这不是整页或全73页完成声明；新组合待用户审核，之前P47空态批准及P33待审意见不扩大。

## 实现范围

新的本地审核组合保留真实App、Router、团队数据、父子事件及原生dialog：

- 蓝色标题区，桌面目标/原因左右分区、手机单列；目标区显示本次团队名称与成员姓名/邮箱，
  不要求填写UUID。目标文本在发起确认时复制，后续数据名称变化不会悄悄改写这次说明。
- 明确“确认分配”蓝色按钮与“确认移除”红色按钮；禁用均为灰色。关闭按钮使用“关闭”
  而非符号，保留原可访问名称、Escape和取消事件，沿用原生模态与Tab循环。
- 原原因默认文案、trim、最少2字、required、无默认maxlength均不改变；600字仅在输入框
  验证后取消，没有拿它验证后端接收上限。新参数仅为内部Vue可选展示上下文，不是API字段。
- 实测取消原因窗后，原入口仍处于成员操作busy清理过程中，原模态回焦可能失败；观察到
  焦点先留在已关闭文本框，随后为BODY。新P33子预览捕获原入口，等Vue更新与下一帧后，
  仅在取消/请求失败、未转向其他区域且入口有效可用时，从BODY或已关闭原因窗内返回入口。
  监听在finally移除。原生关闭产生的BODY过渡不视为用户选择了别处；真正外部聚焦仍取消回焦。
- 成功反馈仍使用原逻辑，不引入新的成功落点或迟到回执策略。此前的风险是成功反馈引用
  后来选择，不是已经证实请求目标被替换；该OG-G02子项仍开放，未自行决定处理策略。

实现文件为`implementation/teams-member-dialog-c.css`、
`scripts/lib/ui-phase2-teams-member-dialog-preview.mjs`。helper分别组合真实父组件、团队组件
与共享原因组件，但不写入这三个生产源码。共享原因窗无新上下文时不取得新样式class；
SSR继续验证无默认上限及显式可选500上限，没有宣称其他页面已做像素回归。

## 实际图与验证

图包：`output/playwright/p33-member-dialog-c-r1`，含40PNG及`evidence.json`。
390/840/841/1440各81项，共324浏览器检查；每宽两次用户确认的POST被本机拦截为500，
共20本地GET、8拦截POST、0真实API/数据库写入。拒绝写入后不重读列表、不自动重试。
逐一核对原成员关系地址、action/membership_id/reason字段、trim与不同幂等键。

| 状态 | 手机分配 | 手机移除 | 桌面移除 |
| --- | --- | --- | --- |
| 初始输入焦点/目标信息 | [图](../../output/playwright/p33-member-dialog-c-r1/390-assign-default.png) | [图](../../output/playwright/p33-member-dialog-c-r1/390-remove-default.png) | [图](../../output/playwright/p33-member-dialog-c-r1/1440-remove-default.png) |
| 关闭按钮焦点 | [图](../../output/playwright/p33-member-dialog-c-r1/390-assign-close-focus.png) | [图](../../output/playwright/p33-member-dialog-c-r1/390-remove-close-focus.png) | [图](../../output/playwright/p33-member-dialog-c-r1/1440-remove-close-focus.png) |
| 确认按钮焦点 | [图](../../output/playwright/p33-member-dialog-c-r1/390-assign-confirm-focus.png) | [图](../../output/playwright/p33-member-dialog-c-r1/390-remove-confirm-focus.png) | [图](../../output/playwright/p33-member-dialog-c-r1/1440-remove-confirm-focus.png) |
| 空原因/灰色禁用 | [图](../../output/playwright/p33-member-dialog-c-r1/390-assign-empty-disabled.png) | [图](../../output/playwright/p33-member-dialog-c-r1/390-remove-empty-disabled.png) | [图](../../output/playwright/p33-member-dialog-c-r1/1440-remove-empty-disabled.png) |
| 560px短屏确认入口 | [图](../../output/playwright/p33-member-dialog-c-r1/390-assign-short-screen.png) | [图](../../output/playwright/p33-member-dialog-c-r1/390-remove-short-screen.png) | [图](../../output/playwright/p33-member-dialog-c-r1/1440-remove-short-screen.png) |

每图均为完整视口，不裁切焦点框。常规32图高1000px，短屏8图高560px。短屏图展示内部
滚动后的确认入口，标题/部分目标可滚出视口，不代表所有内容同时可见或虚拟键盘验收。
已目检手机初始分配、手机空原因移除、桌面移除确认焦点与手机短屏移除四图。

预检过程中，原C页面的高优先级禁用样式覆盖新窗设置；等待动画结束后仍返回旧灰色，
所以提高新弹窗局部选择器优先级。未修改共享样式或引入!important。焦点时序问题也经过
实际回放复现与修订，不将一次超时当成浏览器连接故障。诊断日志仅在工具输出，已移除
代码里的临时探针，未创建日志文件或失败截图草稿。

11项新增定向测试通过：三处Vue编译/精确逆转、原submit/handleTab函数不变、真实SSR原因
合同、展示身份快照、取消/替换上下文、取消/失败回焦及外部/不可用入口保护、成功策略
保持、异常监听清理、189个当前来源及40PNG/请求绑定、命令入口拒绝覆盖。
模拟DOM/函数测试不冒充真实跨路由、跨组织或KeepAlive生命周期验收。

收尾验证：12份团队/共享原因关联测试89/89通过，0跳过/取消，约38.65秒。Prettier、
153文件文档门禁（73路由/60受保护/6角色）、运行文档一致性与本次文档diff检查通过。
这不是全库门禁。工作区656→661项，新增加CSS/helper/driver/永久测试/本记录五项，暂存区空。
本轮11端口独立复核无监听：50296、50381、50488、50670、51150、51266、51353、51435、
51498、51704、51950。临时探针检索无匹配（rg退出1表示未找到，不是产品验证失败）。

## 使用与运行边界

```powershell
node scripts/verify-ui-phase2-teams-member-dialog.mjs --smoke
node scripts/verify-ui-phase2-teams-member-dialog.mjs
# 现有r1目录在浏览器启动前拒绝覆盖
node scripts/verify-ui-phase2-teams-member-dialog.mjs --capture
node --test tests/unit/ui-phase2-teams-member-dialog.test.mjs
```

smoke为手机390，其余无参数四宽；只接受一个smoke或capture选项。复用现有依赖，在随机
空闲本机端口运行，外部与未知请求拒绝。Node/Vite与浏览器均finally关闭，不保留常驻服务。
原状态driver的归一化SHA256固定为
`692d4a99de832980b014726cde94d541538d41f29bdd9ee20a4646edd56c08c2`，源变动时需核对后再组合。

同步当前计划、进度、P33规格、Feature Map、运行说明。API/OpenAPI、数据库、环境变量、
权限规则、依赖、Worker/Python和宝塔均未改，无生产重启/迁移要求；没有真实分配或移除。
未提交混合阶段工作区、未部署，commit hash不适用。全库失败数未重新测算。

本轮只创建正式40图/清单与永久实现、测试、记录，未创建需删除的临时文件或目录；
前轮四个回焦r1草稿和其他历史清理受限目录未触碰。hover/active、长目标名称、所有写入
结果、成功后刷新失败、迟到成功反馈、完整生命周期、真实RBAC和生产验收仍未完成。
