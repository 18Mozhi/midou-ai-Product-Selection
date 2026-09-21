# P58 · 确认窗等待与拒绝反馈审核

## 本批改动

使用 ui-skills-root / fixing-accessibility，在前版 C 确认预览上增加局部反馈及键盘/关闭保护。
baseline 是前版 C 确认预览，不是未经重设计的生产 UI；两侧注入同一份样式，新增规则只作用于
新反馈区域或提交后的标题焦点。没有改生产 CommercialOperationsCenter 或共享 useModalDialog。

- 初次打开仍聚焦原“取消”按钮，不给标题预先添加 tabindex；首次提交才给持续标题临时
  tabindex=-1、聚焦并滚入可见位置，避免等待时焦点落到已禁用按钮或留在长窗底部。
- 等待时保留原两个禁用按钮，增加可读 status，阻止 Escape/关闭和重复提交。
- 错误放在 modal 内 role=alert，不再仅靠背景 notice；原全局 notice 仍保留。
- 局部错误带原 operation 身份；只为仍相同的 pending 显示反馈。编号直接取自该 ApiClientError，
  不借用其他读取的全局 requestId。关闭清理局部反馈；替换 operation 的旧错误不进入新窗。
- 复用此前已验证的局部焦点边界：动态候选、原生 disabled/可见性/折叠 details 过滤，
  首尾双向循环；等待时没有可操作控件，Tab/Shift+Tab 留在可见标题。
- 手机展开追踪时标签/编号/复制改为单列，避免窄编号列反复折行；复制控件仍不少于 44px。

上述错误归属保护只覆盖本地 feedback；原全局 notice、迟到成功、路由生命周期并未一起重构。
不将本批称为完整异步操作归属修复。

## 五条真实调用路径

| 入口样例 | 原请求方法与路径 | 本地验证 |
| --- | --- | --- |
| 编辑方案 | PATCH `/platform/commercial/plans/p1` | 原请求体/版本/原因、失败保留、原键显式重试 |
| 调整分配周期 | POST `/platform/commercial/assignments` | 同上；周期为明确键入的本地样例 |
| 恢复组织配额 | POST `/platform/commercial/assignments/a1/actions` | 原数据克隆为 suspended，action=resume |
| 人工调整 | POST `/platform/commercial/adjustments` | 明确输入 +25，实际调用但仅本地拒绝 |
| 撤销人工调整 | POST `/platform/commercial/adjustments/q1/revoke` | 原原因和版本不变 |

p1/a1/q1/o1 和历史周期均来自原 E2E 合成样例，不是真实 UUID/当前业务资格证明。
每条路径在 390/760/1440、baseline/review、409/403 下各验证；每组先挂起首个本地响应，
拒绝后再显式点击一次，第二次也拒绝。共 60 组、120 次本地拒绝写请求和 60 次 commercial GET。
不存在真实外网/API/MySQL 写入，未 mock 成功结果、未使用真实账号或执行生产权限验证。
403 重试仅为原请求保留测试，不建议用户在权限未调整时反复重试。

## 图包与检查边界

[图册](../../output/playwright/p58-confirm-write-review/index.html) /
[机器证据](../../output/playwright/p58-confirm-write-review/evidence.json)。

初始与等待图只取窗顶视口；错误图只取折叠/展开的反馈区域，不冒充完整长窗。
最终 60 组、2,240 项浏览器检查、210 张局部 PNG、170 个原始源指纹通过；P58 联合回归
35 项通过（其中 6 项只是已有风险复现）。格式/差异检查及文档门通过（73 路由、153 必需文件）。
完整默认窗仍见前版 [十类确认图包](P58-CONFIRM-VUE-REVIEW.md)。前版 76 图和此前编辑/创建包未改。
初始同状态两侧图片要求字节一致，证明新增等待逻辑没有先改变初始布局或取消焦点。

定向验证覆盖：

- 完整脚本逆向还原，仅允许新增局部 UI 函数/反馈 catch；原 confirm 请求表达式、原样式及
  确认窗以外的模板不变。没有新增依赖或外部接口字段。
- 原 confirm 的单飞仍有效；等待时额外触发 submit 也只有一个挂起请求。
- 默认 2 控件、错误折叠 3 控件、展开 4 控件各执行两轮正向和反向循环；等待重复按键留标题。
- 两次拒绝之间真实发送的方法、路径、body、幂等键一致；没有因拒绝触发目录读取。
- TechnicalDetails 编号与第一次/第二次本地失败相符，折叠后复制按钮不进入可访问候选。
- ready Escape 回原触发入口；原版错误仍只在背景 notice，review 错误同时在 modal 内。

尚未执行复制写入剪贴板、读屏/软键盘/输入法实测，也未覆盖所有实际响应或全部业务状态。
等待保护是局部预览提案；未知结果关闭/重试策略仍待用户确认，不因 409/403 样例通过自动批准。

## 复验、使用与收尾

- 生成：`node scripts/verify-ui-phase2-commercial-confirm-write.mjs --capture`。
- 定向：`node --test tests/unit/ui-phase2-commercial-confirm-write-review.test.mjs`（5 项）。
- 与此前 P58 测试组成 35 项联合回归，其中 6 项 DIAGNOSTIC 仍只是风险复现。
- 调节仅限 `implementation/commercial-confirm-write-preview.css` 的 p58-impact-review /
  p58-impact-c 局部范围；生产没有加载。无需生产重启。

当前反馈区域待审，旧视觉审核仍分别待答。成功/未知结果、读回失败、离页/重开、完整无障碍、
真实事务/权限/幂等/审计及全页/全站生产门禁继续。未改生产源码、后端、OpenAPI、env、数据库、依赖。
临时 Vite/浏览器最终关闭，无一次性脚本/日志；PNG/JSON/HTML 为正式审核交付保留。
全库提交门禁未清除，未提交、未部署；commit hash 不适用。
