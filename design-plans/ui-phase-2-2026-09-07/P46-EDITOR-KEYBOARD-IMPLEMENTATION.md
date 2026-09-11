# P46 编辑窗键盘边界实施

2026-09-11，实施基线 main / 29cb58b5。用户已批准所展示的整体结构并要求继续完善交互；本批只关闭真实路由中复现的Tab逃逸，不改变该批准范围。

## 改动

ProviderRegistry新增局部 `containEditorTab`、form键盘监听及 `tabindex=-1` 兜底。每次Tab根据当前可见、非禁用、非inert且可参与Tab的控件计算首尾；正向尾部回首项、反向首部回末项。中间正常移动，已处理事件及Ctrl/Meta组合键不劫持；无可用控件时留在窗口本身。动态步骤、保存禁用、折叠技术详情均重新计算，不缓存旧节点。

除此以外，完整原script及template均由永久测试逐字还原比较：新建/编辑模型、日期转换、请求体、权限、保存/刷新归属、Escape/关闭回焦点、按钮文案、样式保持原样。没有新增依赖、环境变量、API或持久化数据变化，无需更新OpenAPI/.env.example/后端/Python/插件；feature map、页面规格和当前计划已同步。

当前Registry LF SHA256：`768d2d9cef24b0cedddb7f2c69e0d5a3e3055f2a5a8fd2a868616b2c78bc9c19`。

## 证据与复现

[当前104图](../../output/playwright/p46-editor-keyboard-implementation/index.html) · [原始证据](../../output/playwright/p46-editor-keyboard-implementation/evidence.json)

`node scripts/verify-ui-phase2-provider-route-assembly.mjs --keyboard-trap` 回放当前真实App/NavigationShell/KeepAlive链路；加 `--capture` 写入独立正式目录。390/760/761/840/841/1440六宽度，388项浏览器检查、168个原始加载源指纹。104图不是新增104个获批状态，也不是168页覆盖。

每宽度核对创建四步、编辑首步、保存禁用、错误技术详情折叠/展开的正反循环和中间Tab；Escape关闭回来源入口、新建关闭回入口、手机详情转编辑、路由往返及读取错误恢复一并回放。此前六宽度 `editor-last-tab.inside=false`，本次均为true。

接口仍全部本地样例：48GET、6PUT，PUT全部409拒绝，无POST或真实保存。当前回放采用已批准结构的审核宿主CSS；生产组件键盘代码已改，但C整页CSS仍未接入生产。此证据不等于生产样式完整回归、真实权限/保存或完整模态无障碍验收。

`node --test tests/unit/ui-phase2-provider-keyboard-implementation.test.mjs` 直接绑定当前原始源；历史批准图与缺陷观察不回写。精确版本适配器仅供旧证据测试使用，必须同时匹配已知before/after SHA，未知漂移不接受。原整体图重拍命令在源码变化后失败关闭；复现旧证据应使用29cb58b5，当前使用 `--keyboard-trap`。

## 收尾与未完成

最终验证：新增4项当前实现测试通过；相关回归875/875通过，文档门与代码风格门通过；前端类型检查及421模块构建通过。首次完整回归的2项失败源于两个变更后的静态签名尚未绑定，已按真实源更新合同并复测；当前未归属候选为0，1484项源引用齐全，但运行时分母仍未冻结，不能外推全站验收。

未部署、未重启、没有触碰真实权限/数据。后续发布仍由既有宝塔部署流程控制，不承诺静态零停机；发布器会停止Node并执行既有迁移白名单，需要发布前检查授权与恢复材料。

原104张结构审核图保留，本次另104张及HTML/JSON为正式交付；临时浏览器与Vite关闭，无额外一次性文件。构建生成的浏览器插件包与web dist为项目正常构建产物保留。

完整背景隔离/屏幕阅读器、短屏全部控件、三主题密度、日期与只读字段残留、真实保存与未知结果、生产一致性及全73页验收仍未完成。已批准的是所展示结构，不扩为全部状态；“创建并刷新成功”反馈仍待答。
