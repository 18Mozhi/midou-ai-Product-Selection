# P33 团队管理 · 源码、控件与字段对应

2026-09-10，基线 main/5db7ec3e。此批补齐实施计划 G0 的页面级登记，不是批准图稿、真实 Vue 重构或生产交付。

[机器登记](action-reviews/P33.json) · [控件图册](design/teams-controls-direction-c/gallery.html) · [字段与组合图册](design/teams-fields-direction-c/gallery.html) · [页面规格](page-specs/P33.md)

## 登记范围

真实 OrganizationAdminCenter 和 OrganizationTeamPanel 共29个候选位置，归入16组：12个含本地行为的动作、4个其他页面排除，只有创建团队和成员关系变更两类写入。三状态按钮、前后分页、分配/移除等保留同一既有业务合同身份，具体控件分别列明，不以变体增加动作数量。

41个业务控件/变体绑定到原控件图册，另外两个筛选 details 控件为纯提案，不计入真实业务控件。12个动作选取代表控件，55个代表六态槽有具体图引用，17槽仍待适用性核对；代表图不能代替全部变体。所有43控件的179单端状态早已存在，本批不重拍、不增加图片数量。

七个实际字段逐一关联49状态双端图，六个父级资料模型明确属于P29而非P33。13个扫描模型不是13个团队输入。三个源码容器分别是排除的资料form、共享原因窗、团队创建form，14个组合引用不是14个弹窗。成员选择区不是原生form，未计作第四表单；其两张组合另行关联。

## 真实调用边界

| 入口 | 实际接线 | 保持与未决事项 |
| --- | --- | --- |
| 创建 | create-team → createTeam → POST /org/admin/teams | 四字段；名称/流程键/原因trim；负责人可空；不检查流程存在 |
| 分配/移除 | perform-member-action → teamMemberAction → 共享原因 → POST /org/admin/teams/:id/members | action/membership_id/reason，没有expected_version；取消不写 |
| 刷新 | load(background) | 当前组织summary、团队和成员读取；子组件busy仅busy，不含refreshing |
| 字段选择 | 七个v-model | 所有输入等待中仍可编辑；成员关系active包含锁定账号，归档团队不另禁用 |
| 选择团队 | selectedTeamId watcher | 清操作成员与局部反馈；筛选、分页不请求新团队数据 |

两个函数prop并非emit候选，单独列入functionProps并从Vue AST核对实际属性、handler和子消费位置。没有制造额外事件组。

共享原因前端trim最短2字、无maxlength；服务端原因最大500。创建原因required/max500，不套用共享原因最短2字。原控件稿与共享原因提案的max500仍不等于生产前端约束。

OG-G02仍是已复现而未修复的实际风险：成员操作等待期间换团队或成员，成功反馈读取后来选择，可能异常或错误归属。创建成功还会清空等待期间后来编辑的草稿。以上不以登记或绿色测试宣称修复，未替用户决定新的完成反馈/草稿策略。

## 验证方式

```powershell
node scripts/build-ui-phase2-teams-review.mjs --check
node --test tests/unit/ui-phase2-teams-review.test.mjs tests/unit/ui-phase2-action-coverage.test.mjs
```

新增7项测试覆盖完整候选、模型/容器、函数回调、图证据，以及错动作、错页面、错选择器、错误状态、缺移动图、纯提案冒充业务和伪造批准。复用实际提取函数的五组行为检查，不将隔离执行冒充挂载Vue或真实API测试。通用审核验证器新增catalogControlId可选引用类型，仅接受同页面/动作/选择器/状态/视口的精确控件截图；旧引用格式继续沿用原验证路径。

来源变化时先核实真实合同和旧图，再使用 `--write` 更新本登记；不手改hash绕过失败。字段/控件全量引用由本页永久验证器及单测核对，通用全站审核另验证代表图与全部场景存在。

使用frontend-design技能按任务区分开创建、关系操作与字段组合；UI Skills CLI当前缺失，未安装新依赖。无新业务视觉、生产源码、API/OpenAPI、env、权限或数据库变化，不需重启、未部署。用户具体图稿意见、全页真实C实施、多角色/缩放/主题与生命周期、真实后端和宝塔验收仍未完成。
