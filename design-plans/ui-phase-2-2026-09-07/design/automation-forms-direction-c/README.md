# P27 自动化规则 · 字段状态 C-r1

2026-09-10，待审核的独立图稿，不是已部署 Vue 页面。沿用蓝色规则目录、白色分区编辑器、固定主次操作区；本包引用父包控制器、夹具和 CSS，不改父包122图或按钮包208图。

[打开114张双端图册](gallery.html) · [交互稿](index.html) · [源码及范围登记](../../AUTOMATION-SEMANTIC-REVIEW.md)

## 本批改变

10个原有模型的说明全部通过 aria-describedby 关联；名称、标题、原因有字符计数；必填、超范围和非整数给出就近错误，修正后移除该项旧错误。新包将默认字段边框由父包浅色加深为#7a8ba8，白底对比≥3；输入文字对比≥4.5。红色边界与文字并用，蓝色键盘焦点不被错误红框吞没。窗内失败说明调整为16px。以上仅为新图稿呈现，不更换全局主题、布局或业务控制器。

## 逐字段图证

默认/焦点/在途各10项；必填空值7项；两数值字段各最小/最大/小于最小/大于最大/小数5项；三文本最大长度3项。合计50种字段状态×1440/390两视口=100PNG。默认态为有效样例，不代表新建时字段自动填入。完整空新建仍在父包create场景。

| 原始模型 | 约束与呈现 | 焦点示例 |
| --- | --- | --- |
| form.name | 必填，最多200字符 | [桌面](name-focus-1440.png) / [手机](name-focus-390.png) |
| form.trigger_event_type | 原4种事件选项；无虚构无效/禁用状态 | [桌面](trigger_event_type-focus-1440.png) / [手机](trigger_event_type-focus-390.png) |
| form.condition_severity | any/info/warning/critical | [桌面](condition_severity-focus-1440.png) / [手机](condition_severity-focus-390.png) |
| form.action_type | notify_owner/create_task；任务事件只允许前者 | [桌面](action_type-focus-1440.png) / [手机](action_type-focus-390.png) |
| form.owner_id | 必填，当前工作区成员 | [桌面](owner_id-focus-1440.png) / [手机](owner_id-focus-390.png) |
| form.action_assignee_id | 仅create_task时显示且必填 | [桌面](action_assignee_id-focus-1440.png) / [手机](action_assignee_id-focus-390.png) |
| form.action_title | 必填，最多200字符 | [桌面](action_title-focus-1440.png) / [手机](action_title-focus-390.png) |
| editReason | 仅编辑必填；界面500/服务1000保持；不在preview body中 | [桌面](reason-focus-1440.png) / [手机](reason-focus-390.png) |
| form.rate_limit_count | 必填整数1–1000，原初值20 | [桌面](rate_limit_count-focus-1440.png) / [手机](rate_limit_count-focus-390.png) |
| form.rate_limit_window_minutes | 必填整数1–1440分钟，原初值60 | [桌面](rate_limit_window_minutes-focus-1440.png) / [手机](rate_limit_window_minutes-focus-390.png) |

在途不是disabled：实际源字段无busy禁用绑定。8个字段真实改写草稿，验证已记录请求body不变且保存仍禁用；负责人/任务负责人沿用原夹具唯一成员，只验证可操作和原选择保持，不伪造第二成员或宣称换人已验。新草稿不代表已保存，旧请求可能完成；本包不模拟成功回执归属。

## 7个组合场景（另14PNG）

| 场景 | 保持的事实 | 手机示例 |
| --- | --- | --- |
| 任务触发 | 自动回到通知，清任务负责人并隐藏该字段 | [查看](task-trigger-390.png) |
| 空成员 | 原选择仍可聚焦，但没有有效成员可选 | [查看](members-empty-390.png) |
| 成员读取失败 | 明确失败，不将错误当作真实零成员 | [查看](members-error-390.png) |
| 规则字段变更 | 已有预览清除，不自动重发 | [查看](preview-edited-390.png) |
| 仅原因变更 | 原规则预览保留，原因不是规则预览输入 | [查看](reason-preview-retained-390.png) |
| 新建失败 | 保留草稿，不生成/启用虚构规则 | [查看](create-failure-390.png) |
| 编辑冲突 | 原版本与原因保留，不伪造覆盖成功 | [查看](edit-conflict-390.png) |

## 与真实运行的差异

- 全部截图是本地HTML提案。源Vue目前错误主要仍在窗外notice，未自动获得本包错误关联/计数/即时清错效果。
- 父包校验额外拦截纯空格；源Vue原生required只阻止空字符串，后端text会trim并拒绝纯空格。本批未改变这项既有提案差异，也未把纯空格作为新通过图证。
- 原父包保存有busy早退，源create/status函数没有同等早退；本包不能证明真实防重入已修。
- 编辑原因虽不在预览body，却因同一原生表单而必须先填才可预览；只改原因不使已有预览失效。
- 关闭不会取消已经发出的操作；成员跨范围/移除、服务权限/版本、异步回执归属、真实Vue/软键盘/辅助技术、全部主题与密度组合仍待。没有扩大P16布局批准，也未批准P27或全站。

## 验证和使用

运行 `node scripts/verify-ui-phase2-automation-forms-c.mjs --smoke` 做34项最小校验；`--capture`重建114PNG、evidence与图册；无参数检查来源/图片哈希和逐字段登记，再复跑114项浏览器场景。原Vue AST核对10模型、7必填、条件渲染、选项、数值/长度约束及无字段禁用。单测拒绝遗漏字段、错上限、错selector、缺手机图或伪造禁用状态。

真实Tab产生focus-visible，原生输入和点击触发校验，错误字段聚焦并关联提示；字段文本≥16px、热区≥44px、中心可命中且页面/窗口不横向溢出。无HTTP、Cookie或local/sessionStorage写入；临时浏览器在finally关闭，未启动服务。

新增图稿/脚本/测试/文档是永久交付物，不是一次性测试垃圾。未改变真实Vue、API/OpenAPI、环境变量、数据库、依赖、权限、Worker或Python；不部署、不迁移、不要求生产重启。以后真实实施与宝塔发布须分别验证，不能用本包截图代替生产验收。
