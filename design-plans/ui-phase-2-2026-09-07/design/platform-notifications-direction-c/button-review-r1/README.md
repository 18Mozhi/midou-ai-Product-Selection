# P57 取消按钮组合 · 当前局部审核

2026-09-14，实际 `PlatformNotificationActionDialog`、现有 P57 父级色彩作用域和生产入口样式顺序。内存样例，不含完整 App 壳层、真实权限、真实取消或真机验收。

| 状态 | 手机 390 | 桌面 1440 |
| --- | --- | --- |
| 默认 | [图](P57-390-cancel-default.png) | [图](P57-1440-cancel-default.png) |
| 悬停＋键盘焦点 | [图](P57-390-cancel-hover-focus.png) | [图](P57-1440-cancel-hover-focus.png) |
| 原因不足禁用 | [图](P57-390-cancel-invalid.png) | [图](P57-1440-cancel-invalid.png) |
| 提交中禁用 | [图](P57-390-cancel-submitting.png) | [图](P57-1440-cancel-submitting.png) |

图只截取操作栏及其周围 7px，不包括原因帮助文字、错误区或标题。用户回复“四种按钮组合通过，继续其他状态”，仅批准手机底部默认/悬停＋键盘焦点/原因不足禁用/提交中禁用四组合；桌面图、完整弹窗、真机触控和真实取消均未批准。manifest保留捕获时pending-user-review，后续批准单独记录于此。禁用沿用原淡化样式和原生 disabled，没有新增灰色方案或改变可用条件。旧手机错误区的高度/留白/说明批准保持独立范围。

## 依据与验证

先运行未修复样式：实际计算色值证明通用 hover 把危险文本与边框从 `rgb(173,57,53)` 变成 `rgb(31,85,189)`；全局焦点覆盖为三主题的深色。仅新增 5 行原因窗 CSS：局部 `--so-focus` 绑定原蓝色 token，危险按钮 hover 恢复原红色。没有改动组件、事件、原因校验、payload、全局样式或其他 P57 区域。

`node scripts/verify-platform-notification-button-states.mjs`：24 个环境组合（390/1440、三个已有主题、standard/compact、模拟 coarse/fine），144 项样式状态检查通过。实际核对 pointer/hover 媒体查询、键盘 focus-visible、鼠标按下、无效原因、无效＋悬停、提交冻结及本地一次提交；所有环境使用 reduced-motion，不能代表全部动效、读屏、真机软键盘或全部主题页面验收。既有双动效弹窗验证器 32 组及通知合同 7 项通过，Web 构建含类型检查通过。

默认运行不写文件。`--capture-review` 仅允许首次创建固定 `button-review-r1` 目录，已存在就拒绝覆盖；8 张正式审核 PNG、18 份加载来源指纹和 144 项结果记录于 manifest，不宣称完整构建依赖清单。验证服务与浏览器均在 finally 中关闭。

旧 `dialog-review-r2` 的图片、manifest 和已批准错误区域保持原捕获身份；本批 CSS 演进后，其来源指纹不再全部匹配当前。不要用旧图证明新的按钮状态。没有部署、环境配置或重启变更；未来正式前端发布后刷新浏览器生效。
