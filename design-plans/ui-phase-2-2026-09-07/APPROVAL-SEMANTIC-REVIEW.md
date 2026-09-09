# P25 审批中心：逐项审核与状态细化基线

2026-09-10字段增量：[88图与交互](design/approval-forms-direction-c/README.md)按11源字段核对标签/原生约束、错误、字符/SLA边界与4窗关闭焦点/重开；30检查只覆盖空闲窗口，不是源Vue全路径一致或pending归属。4关闭focus代表槽新增映射，未映射117→113。非详情遮罩、发布返回内存清理、必填折叠和空格校验的源/提案差异均明示；本包修复旧原型发布空格校正后请求reason丢失。具体审核、生产/服务仍待。下方是此前批次。

2026-09-10增量：[五类写入按钮逐态包](design/approval-controls-direction-c/README.md) / [64图册](design/approval-controls-direction-c/gallery.html)。旧94图保持；27代表视觉槽已绑定实际selector，未映射144→117，另5失败保留场景不计六态槽。新原型控制器在离线请求预览后锁本窗字段、只更新触发按钮的等待标签，并演示失败后同body重试；不是生产修复或真实审批成功。模板/发布不编空字段禁用，发起无发布模板变体仍未采。整体布局与控件待审，跨窗pending归属/全部字段/主题及真实服务仍未验收。以下保留前批来源审阅与发现。

2026-09-10，基线main/5bf62e18。沿已选C方向，使用ui-skills-root/frontend-design按真实ApprovalWorkspace、ApprovalQueuePanel、模态钩子与路由归属核对；没有重新选择风格，没有将P16布局批准迁移到审批页。

[94张现有图与交互](design/approval-direction-c/README.md) · [逐项清单](action-reviews/P25.json) · [原审批/通知合同](approval-notification-contract-review.md)

## 动作与窗口范围

`/tasks/approvals`读权限task:read，写入口task:assign；批准/驳回还要求返回的selected.can_decide。42源位置归30组：25页面动作、5委托/定义关联，无P26/P34混入；其中模板草稿、发布、发起、批准、驳回5写入组。四原生dialog为详情、模板、发布、发起；3个form不是额外弹窗。11模型/7结构/10容器场景关联，详情captured/fallback/task/readonly是同窗内容变体，不膨胀为四个业务窗。

| 动作或区域 | 必须保持的实际语义 | 现有C图与细化要求 |
| --- | --- | --- |
| 管理/首模板/空态配置 | task:assign；打开保留模板草稿 | normal/no_templates/template；同动作三入口分别有状态 |
| 发起审批入口 | task:assign且有已发布模板；打开保留草稿 | normal/empty/request；头部和空态不能只验一个 |
| 待我处理/我发起 | 两种involvement；切换清详情/页码再读取 | normal/requested；当前页can_decide数不是全工作区总量 |
| 四状态筛选 | pending/approved/rejected/全部；cancelled只接受URL无单按钮 | 全部移除status后刷新回pending已证实，原型显式空值修订未迁Vue |
| 分页 | 每页20；上下边界disabled；保留approval query | pagination；回读可能保留/重开详情，不改成自动清详情 |
| 读取/错误提示 | 队列与模板并行，有管理权再读成员；之后读取approval深链 | 五整页错误、成员错误、详情loading/404/error；成员失败不是局部退化成功 |
| 查看详情 | 按真实行ID GET；旧selected未在开始读时清除 | 需补A/B切换与迟到成功/失败，不能只画正常等待 |
| 关闭/遮罩/Escape/Tab | 关闭清selected和approval；仅真实遮罩坐标关闭；Tab循环可见控件 | detail；当前无busy关闭守卫，关闭不撤回已发请求 |
| 资源/证据/通知返回 | 使用真实route；通知返回只允许/notifications及其query | 三类导航；不伪造补证、自动审批或外站返回 |
| 两个技术详情 | 页级请求ID与详情资源/节点ID分别披露 | 不混成同一个动作；并发API会更新共享requestId |
| 批准/驳回 | canManage且can_decide；原因trim判空、原文发送、expected_version | decision/error/busy；缺失证据只警告，不引入五项质量门 |
| 模板保存 | 单节点UI；六字段，SLA整数1–43200，成员取工作区目录 | template/error/busy；C稿直接展示成员字段，当前Vue仍折叠且invalid自动展开 |
| 模板关闭 | 取消/Escape保留templateForm，当前无busy锁 | 不统一成丢弃草稿；叠加发布关闭层级待完整实测 |
| 发布入口/确认 | 仅draft；请求expected_revision+trim原因，无额外action字段 | publish/error/busy；展示current_version不等于提交revision |
| 发布返回/Escape | 返回只清target；Escape清target和reason；下次openPublish再清原因 | 源检查确认差异，不声称旧原因会带入新窗 |
| 发起提交 | 已发布template_id；模板watch派生类型；标题/资源ID trim | request/error/busy；不增加独立resource_type编辑或多节点功能 |
| 发起关闭/必填定位 | 保留requestForm；invalid只展开最近details，保留浏览器required | 直接展开字段与就近错误是C提案，不是生产已改 |

四窗口的大部分字段未绑定busy禁用；决定、模板、发起函数也没有自身busy重入守卫，发布有。DOM提交按钮仍disabled，不能仅据函数检查就声称浏览器双击能重复写入。模板/发布/发起失败主要进入页级notice，现有图中的窗内错误与统一字段锁定须获审后落地。

## 新增源证据与限制

运行`node scripts/verify-ui-phase2-approval-review.mjs`，复用已有助手的5写入body、4路由变更、2范围SQL构造、字段验证器与快照diff检查，再新增5类源验证：

1. 同实例先读A再读B：B先成功会解除共享detailBusy；A后成功覆盖selected与URL；A后失败清空B但URL仍为B。只证明当前函数的响应次序，不是跨工作区数据泄露证明。
2. 读取A等待时执行closeDetail，A成功仍恢复selected与approval query。没有执行真实浏览器历史，未声称线上误弹窗已发生。
3. 提交A批准→关闭详情→读B→A成功：发送body仍是A/原版本/原原因，但成功回调关闭B并清B的URL。本轮验证真实函数组合，不把它称为“审批错对象”或服务端错写。
4. 发布返回与实际useModalDialog Escape回调清理不同；重新openPublish会清原因，不夸大为可见草稿错误复用。
5. 确认函数级busy守卫差异，明确与DOM禁用分开，未复现浏览器重复提交。

这些缺口均**未修复**，作为接下来按钮状态、请求结果归属和关闭策略的实施基线；未来修复后应更新缺陷预期。父NavigationShell的reset_on_scope键包含组织/工作区，这不保护同一实例的A/B请求，却也不能忽略父层而泛化成跨租户泄露。完整激活/失活/缓存返回、真正鉴权/版本冲突/持久化、Worker升级另验。

## 视觉证据与审核

Playwright技能下复用既有`verify-ui-phase2-approval-c.mjs`无capture运行通过：43场景×1440/390、94PNG来源/图hash、5请求预览、校验/失败草稿/安全返回/叠加焦点与多断点，HTTP/存储/控制台错误均0。未新增或重拍图片。直接检查并向用户展示1440-detail和390-detail两图，发出APPROVAL-C-r1**整体布局**审核问题；未收到回复前保持pending，不自动批准其他窗口或全部按钮。

94图包含2张非业务控件板、86主图与8下部图；现有场景关联不是逐控件六态。当前144个代表视觉槽尚未显式映射，并非恰好缺144张图片。下一优先细化P25代表按钮、表单字段及叠加窗口状态，处理用户布局意见；同级页面审阅尚有P26等47页。全站真实重构/部署/签收未完成，不能以26页语义审阅或579独立源位置/549逐页组替代。

## 使用和运行交接

新脚本无参数，仅源码/内存检查；`node scripts/audit-ui-phase2-action-coverage.mjs`只读复验，`--write`刷新生成清单。报告/JSON/验证器是永久交付，未改业务Vue/CSS、接口/OpenAPI、后端/Worker/Python、数据库/迁移、env/配置、依赖、权限与宝塔，无部署或重启要求。未变生产输入不重复build/生产E2E。

本轮无新一次性文件/截图/日志/服务，验证器浏览器finally关闭。历史受限清理三路径仍保留、不提交、不重试绕过：`output/playwright/p16-layout-20260910/.last-run.json`、`output/playwright/ui-phase2-competitor-races-20260909/playwright.config.ts`及该目录`results/.last-run.json`。现有依赖与构建缓存不删除。
