# P57 发布与保存主按钮 · 局部审核

2026-09-14，实际 Vue 草稿编辑窗及发布原因窗、生产入口样式顺序和现有 P57 颜色作用域。只是组件隔离样例，不是完整 App、真实发布、保存、权限或真机验收。

| 状态 | 手机保存 | 手机发布 | 桌面保存 | 桌面发布 |
| --- | --- | --- | --- | --- |
| 默认 | [图](P57-390-create-default.png) | [图](P57-390-publish-default.png) | [图](P57-1440-create-default.png) | [图](P57-1440-publish-default.png) |
| 悬停＋键盘焦点 | [图](P57-390-create-hover-focus.png) | [图](P57-390-publish-hover-focus.png) | [图](P57-1440-create-hover-focus.png) | [图](P57-1440-publish-hover-focus.png) |
| 输入不合格 | [图](P57-390-create-invalid.png) | [图](P57-390-publish-invalid.png) | [图](P57-1440-create-invalid.png) | [图](P57-1440-publish-invalid.png) |
| 提交中 | [图](P57-390-create-submitting.png) | [图](P57-390-publish-submitting.png) | [图](P57-1440-create-submitting.png) | [图](P57-1440-publish-submitting.png) |

16 张图仅覆盖底部操作栏及邻近 7px，展示已有 deep-ocean 主题、compact 密度和精细指针；不含上方字段与原生校验提示。编辑与新建共用底部结构，编辑模式有独立测试但不重复出相同操作栏图。手机保存/发布已分别提交审核，待答复；桌面与全部整体均未批准，取消按钮和错误区的既有批准不扩大到本包。

## 修复依据与保留行为

实际样式先复现：保存按钮在 hover 时文本与背景同为 `rgb(31,85,189)`，造成文字不可读；编辑窗键盘焦点被全局主题深色覆盖。按 fixing-accessibility 局部修复，两份 CSS 仅增加 6 行：草稿窗的 `--so-focus` 使用现有蓝色，保存 hover 使用已有深蓝、白字。发布按钮原有白字/蓝底规则未更改，仅纳入验证。没有替换组件或修改原生键盘/校验实现。

“输入不合格”不能混为同一种禁用：发布原因 1 字时确认发布禁用；草稿标题 1 字时保存仍是可用按钮，但原生 minlength 拦截提交并聚焦标题。本包验证 0 次提交后再恢复合法输入，最后提交中冻结且关闭仍可用，不能把截图当作标题错误说明的验收。

## 验证与复用

运行 `node scripts/verify-platform-notification-button-states.mjs --primary`：新建/编辑/发布 × 390/1440 × 三个已有主题 × 两密度 × 模拟 coarse/fine，共 72 环境、432 项状态。检查实际媒体查询、默认/hover/focus/复合焦点/active/原生无效/提交冻结、主按钮背景与文字 token、可用主按钮文字对比度至少 4.5:1，以及本地一次提交。均使用 reduced-motion，不宣称全动效或完整无障碍验收。

原无参命令继续覆盖取消 24 环境/144 状态；既有双动效弹窗 32 组与通知合同 7 项回归通过。`--primary --capture-review` 只允许首次创建本固定目录，存在就失败关闭；无 capture 参数不写文件。manifest 保存 16 张 PNG、20 份加载来源指纹与 432 项结果，已逐一核对，不宣称完整构建依赖清单。Web 构建含类型检查、253 资源预算、文档和运行说明门均通过。测试浏览器与服务由 finally 关闭，不触达业务网络。

旧 `button-review-r1` 保留提交 `7aad0879` 的捕获身份和手机局部批准；验证器扩展后其旧来源哈希不能被表述为全部匹配当前。旧 `dialog-review-r2` 也保持历史图，不覆盖用户审核依据。未改 API、环境、数据、权限、依赖或发布服务；没有部署，无需重启，未来正式前端发布后刷新生效。
