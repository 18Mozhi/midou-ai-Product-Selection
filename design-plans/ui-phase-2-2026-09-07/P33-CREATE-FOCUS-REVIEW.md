# P33 C 创建区 · 取消焦点修订

2026-09-13，main / af239b08b69f7d97cd0372f9840a70009eeef0c7；起点638项前序变更，暂存为空。
本轮推进真实Vue交互预览，不修改待审r4布局、原34图或P47已批准的手机空态。

## 依据与修订

ui-skills-root路由到fixing-accessibility：关闭内联创建区后，应能继续定位触发入口。
实际手机复现原cancelCreate清空并隐藏form后activeElement为BODY，下一Tab进入目录状态
按钮；这与页内锚点的原生Tab继续行为不同，关闭表单后没有返回先前操作入口。

新增独立C预览组合，不改原r4变换和生产组件：

- openCreate记录实际事件按钮，输入框聚焦限定在当前表单ref内，卸载后ref为空则无操作。
- cancelCreate保留原忙态守卫、四字段清空与关闭顺序；Vue更新后才恢复有效触发按钮。
- 仅当取消时焦点位于表单内、更新后焦点落到BODY才恢复，不抢走用户移到其他控件的焦点。
- 原触发按钮消失时回退到本组件“新建团队”；目标禁用或已卸载时不聚焦。
- 创建入口增加aria-expanded；只在表单存在时提供aria-controls，关闭后不留下悬空引用。

创建区仍是内联form，不新增dialog、焦点锁或Esc关闭策略。创建提交/成员写入函数、所有
事件和模型、字段长度/必填、取消清空规则、权限与请求保持。OG-G02仍未修。

## 前后图册

以下是实际浏览器1000px高截图，不裁切、不补绘、不隐藏固定底栏。原版取消后停留于
表单移除后的浏览位置；修订版因按钮focus自然滚回入口。两组滚动差异就是本次交互结果，
不能将它误读为新旧页面布局不同。四个宽度每组各55/60项，总计460项；40本地GET，0写入。

| 宽度 | 原版取消后 | 修订版取消后 |
| --- | --- | --- |
| 390 | [原版](../../output/playwright/p33-create-focus-r1/original-390-keyboard-cancel.png) | [修订](../../output/playwright/p33-create-focus-r1/revised-390-keyboard-cancel.png) |
| 840 | [原版](../../output/playwright/p33-create-focus-r1/original-840-keyboard-cancel.png) | [修订](../../output/playwright/p33-create-focus-r1/revised-840-keyboard-cancel.png) |
| 841 | [原版](../../output/playwright/p33-create-focus-r1/original-841-keyboard-cancel.png) | [修订](../../output/playwright/p33-create-focus-r1/revised-841-keyboard-cancel.png) |
| 1440 | [原版](../../output/playwright/p33-create-focus-r1/original-1440-keyboard-cancel.png) | [修订](../../output/playwright/p33-create-focus-r1/revised-1440-keyboard-cancel.png) |

[原版证据](../../output/playwright/p33-create-focus-r1/original-evidence.json) /
[修订证据](../../output/playwright/p33-create-focus-r1/revised-evidence.json)。每份绑定180项当前
源码、转换后的Vue和4PNG；脚本/组合来源也在其中。图包独占创建，拒绝覆盖。
当前截图显示原样例组织回退和团队事实，不是生产组织数据。手机/桌面修订图已目检，
蓝色焦点框可见，按钮未被固定导航遮挡。

## 验证与使用

先运行八项源码/惰性焦点测试和手机原版55项/修订60项，再完整捕获上述四宽前后对照。
继承上一轮锚点/历史/草稿保留及原r4业务检查；新增鼠标与键盘取消、Shift+Tab顺序、
重开后清空、扩展语义、焦点可见和中心点遮挡检查。浏览器运行全部无意外请求/异常。
额外惰性测试覆盖busy无操作、被移除/禁用入口、卸载和用户已移走焦点，不冒充真实
浏览器全部异步场景。成功保存后的焦点、自动空数据创建入口全链路、屏幕阅读器实际
朗读、主题密度/全部短屏、真实写入/权限/生产验收仍待完成。

最终八份关联测试50/50通过，0跳过/取消，约30.01秒；含新增两份捕获的180来源和8PNG
完整校验，以及原r4和三份历史图包保护。Prettier、153文件文档门禁（73路由/60受保护/
6角色）和运行文档一致性检查通过。五个本轮端口核对均无监听。

```powershell
# 原版与修订版各一个手机组，不生成文件
node scripts/verify-ui-phase2-teams-create-focus.mjs --smoke
# 原版与修订版各四宽，不生成文件
node scripts/verify-ui-phase2-teams-create-focus.mjs
# r1已存在，会在启动浏览器前拒绝覆盖
node scripts/verify-ui-phase2-teams-create-focus.mjs --capture
node --test tests/unit/ui-phase2-teams-create-focus.test.mjs
```

## 交付边界

新helper与验证/测试、8图两清单是正式交付材料。无新增临时文件、日志或截图草稿；
浏览器/Vite均在finally结束。探查端口57241、手机57367/57377、完整57544/57588单独核对，
原正式包保留、历史清理受限目录不触碰。本轮没有运行需要用户保留的服务。

未改生产导入、router、后端/Worker/Python、API/OpenAPI、数据库、环境变量、依赖、
权限与宝塔服务，无重启需求。P33整体布局仍待审，本次交互证据不是用户视觉批准；
共享原因窗、其他页面以及完整73页目标继续。工作区混合前序未提交实现且全局门禁
尚未通过，未暂存/提交/部署，commit hash不适用；本轮局部测试不推算全库现时通过数。
